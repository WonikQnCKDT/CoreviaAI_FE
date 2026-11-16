import { useCallback, useEffect, useRef, useState } from "react";
import type { ApiResult } from "@/shared/api/client";
import type { CursorPage } from "@/features/admin/api/adminApi";
import { adminErrorMessage } from "@/features/admin/utils/adminFormat";

export type MoreState = { phase: "idle" } | { phase: "loading" } | { phase: "error"; message: string };

export type CursorListState<T> =
  | { phase: "loading" }
  | { phase: "error"; message: string }
  | { phase: "ready"; items: T[]; nextCursor: string | null; hasNext: boolean; more: MoreState };

type FetchPage<T> = (args: { cursor: string | null; signal: AbortSignal }) => Promise<ApiResult<CursorPage<T>>>;

/**
 * 커서 목록 공통 상태.
 * - queryKey가 바뀌면(검색·필터 변경) 진행 중인 요청을 취소하고 처음부터 다시 불러온다.
 * - '더 보기'는 중복 호출을 막고, 실패해도 이미 받은 목록은 유지한다.
 */
export const useCursorList = function <T>({ queryKey, fetchPage }: { queryKey: string; fetchPage: FetchPage<T> }) {
  const [state, setState] = useState<CursorListState<T>>({ phase: "loading" });
  const fetchRef = useRef(fetchPage);
  const controllerRef = useRef<AbortController | null>(null);
  const stateRef = useRef(state);

  fetchRef.current = fetchPage;
  stateRef.current = state;

  const reload = useCallback(() => {
    controllerRef.current?.abort();
    const controller = new AbortController();
    controllerRef.current = controller;
    setState({ phase: "loading" });
    fetchRef.current({ cursor: null, signal: controller.signal }).then((result) => {
      if (controller.signal.aborted) return;
      if (result.ok === false) {
        setState({ phase: "error", message: adminErrorMessage(result.failure) });
        return;
      }
      const { items, nextCursor, hasNext } = result.data;
      setState({ phase: "ready", items, nextCursor, hasNext, more: { phase: "idle" } });
    });
  }, []);

  useEffect(() => {
    reload();
    return () => controllerRef.current?.abort();
  }, [queryKey, reload]);

  const loadMore = useCallback(() => {
    const current = stateRef.current;
    if (current.phase !== "ready" || !current.hasNext || current.more.phase === "loading") return;
    const controller = new AbortController();
    controllerRef.current = controller;
    setState({ ...current, more: { phase: "loading" } });
    fetchRef.current({ cursor: current.nextCursor, signal: controller.signal }).then((result) => {
      if (controller.signal.aborted) return;
      setState((prev) => {
        if (prev.phase !== "ready") return prev;
        if (result.ok === false) return { ...prev, more: { phase: "error", message: adminErrorMessage(result.failure) } };
        const { items, nextCursor, hasNext } = result.data;
        return { phase: "ready", items: [...prev.items, ...items], nextCursor, hasNext, more: { phase: "idle" } };
      });
    });
  }, []);

  /** 변경 API가 돌려준 최신 항목으로 목록의 한 줄만 바꾼다. */
  const replaceItem = useCallback((matches: (item: T) => boolean, next: T) => {
    setState((prev) => (prev.phase === "ready" ? { ...prev, items: prev.items.map((item) => (matches(item) ? next : item)) } : prev));
  }, []);

  /** 새로 만든 항목을 목록 맨 앞에 넣는다 (최신순 목록). */
  const prependItem = useCallback((next: T) => {
    setState((prev) => (prev.phase === "ready" ? { ...prev, items: [next, ...prev.items] } : prev));
  }, []);

  return { state, reload, loadMore, replaceItem, prependItem };
};
