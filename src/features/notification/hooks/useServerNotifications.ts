import { useCallback, useEffect, useRef, useState } from "react";
import {
  fetchNotifications,
  fetchUnreadCount,
  markNotificationRead,
  openNotificationStream,
  type ServerNotification,
} from "@/features/notification/api/notificationApi";
import { isNotificationApiMissing, mergeNotifications } from "@/features/notification/utils/serverNotification";

export type ServerNotificationState =
  | { phase: "loading" }
  | { phase: "unavailable" }
  | { phase: "error" }
  | { phase: "ready"; items: ServerNotification[]; nextCursor: string | null; unread: number };

/** 인수 기준 '이벤트 후 1분 이내 표시': SSE가 끊겨도 이 간격으로 미확인 수를 다시 본다 */
export const NOTIFICATION_POLL_MS = 60_000;

/**
 * api 모드 인앱 알림. 첫 페이지와 미확인 수를 받고, SSE로 새 알림을 받는다.
 * - SSE는 서버 메모리에만 있어(명세) 끊기거나 다른 인스턴스면 못 받을 수 있다 → 1분마다 미확인 수를 보고, 늘었으면 첫 페이지를 다시 받는다
 * - 서버에 알림 API가 없으면(404, develop 미반영) '준비 중'으로 두고 SSE·주기 조회를 하지 않는다
 * - 401은 공통 client가 재발급·세션 종료로 처리한다(EventSource는 상태 코드를 알 수 없어 주기 조회가 이를 맡는다)
 */
export const useServerNotifications = function () {
  const [state, setState] = useState<ServerNotificationState>({ phase: "loading" });
  const [live, setLive] = useState(false);
  const unreadRef = useRef(0);
  // 주기 확인이 지금 상태를 보게 한다(처음 조회가 실패했으면 목록부터 다시 받는다)
  const readyRef = useRef(false);
  readyRef.current = state.phase === "ready";

  const loadFirstPage = useCallback(async (signal?: AbortSignal) => {
    const [page, count] = await Promise.all([fetchNotifications({ signal }), fetchUnreadCount({ signal })]);
    if (signal?.aborted) return "aborted" as const;
    if (page.ok === false || count.ok === false) {
      const failure = page.ok === false ? page.failure : count.ok === false ? count.failure : null;
      if (failure && isNotificationApiMissing(failure)) {
        setState({ phase: "unavailable" });
        return "unavailable" as const;
      }
      setState((prev) => (prev.phase === "ready" ? prev : { phase: "error" }));
      return "error" as const;
    }
    unreadRef.current = count.data;
    setState((prev) => ({
      phase: "ready",
      items: mergeNotifications(prev.phase === "ready" ? prev.items : [], page.data.items),
      nextCursor: prev.phase === "ready" && prev.items.length > page.data.items.length ? prev.nextCursor : page.data.hasNext ? page.data.nextCursor : null,
      unread: count.data,
    }));
    return "ready" as const;
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    let closeStream: (() => void) | null = null;
    let timer: number | undefined;

    void loadFirstPage(controller.signal).then((outcome) => {
      if (outcome !== "ready" && outcome !== "error") return;
      // 미확인 수 주기 확인: 늘었으면 첫 페이지를 다시 받는다
      timer = window.setInterval(async () => {
        if (!readyRef.current) {
          await loadFirstPage(controller.signal);
          return;
        }
        const count = await fetchUnreadCount({ signal: controller.signal });
        if (controller.signal.aborted || count.ok === false) return;
        if (count.data !== unreadRef.current) await loadFirstPage(controller.signal);
      }, NOTIFICATION_POLL_MS);
      closeStream = openNotificationStream({
        onReady: () => setLive(true),
        onError: () => setLive(false),
        onNotification: (notification) => {
          setState((prev) => {
            if (prev.phase !== "ready") return prev;
            const isNew = !prev.items.some((n) => n.id === notification.id);
            const unread = prev.unread + (isNew && !notification.read ? 1 : 0);
            unreadRef.current = unread;
            return { ...prev, items: mergeNotifications(prev.items, [notification]), unread };
          });
        },
      });
    });

    return () => {
      controller.abort();
      if (timer !== undefined) window.clearInterval(timer);
      closeStream?.();
    };
  }, [loadFirstPage]);

  const loadMore = useCallback(async () => {
    if (state.phase !== "ready" || !state.nextCursor) return;
    const page = await fetchNotifications({ cursor: state.nextCursor });
    if (page.ok === false) return;
    setState((prev) => (prev.phase === "ready" ? { ...prev, items: mergeNotifications(prev.items, page.data.items), nextCursor: page.data.hasNext ? page.data.nextCursor : null } : prev));
  }, [state]);

  /** 읽음 처리. 성공하면 true. 없는 알림(404)이면 목록에서 뺀다 */
  const markRead = useCallback(async (notification: ServerNotification): Promise<boolean> => {
    if (notification.read) return true;
    const result = await markNotificationRead({ notificationId: notification.id });
    if (result.ok === true) {
      setState((prev) => {
        if (prev.phase !== "ready") return prev;
        const unread = Math.max(0, prev.unread - 1);
        unreadRef.current = unread;
        return { ...prev, items: prev.items.map((n) => (n.id === notification.id ? { ...n, read: true } : n)), unread };
      });
      return true;
    }
    if (result.failure.kind === "http" && result.failure.status === 404) {
      setState((prev) => (prev.phase === "ready" ? { ...prev, items: prev.items.filter((n) => n.id !== notification.id) } : prev));
    }
    return false;
  }, []);

  const retry = useCallback(() => {
    setState({ phase: "loading" });
    void loadFirstPage();
  }, [loadFirstPage]);

  return { state, live, loadMore, markRead, retry };
};
