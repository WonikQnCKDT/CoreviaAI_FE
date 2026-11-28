// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, screen, waitFor, within } from "@testing-library/react";
import ServerNotificationBell from "@/features/notification/components/ServerNotificationBell";
import { NOTIFICATION_POLL_MS } from "@/features/notification/hooks/useServerNotifications";
import { SERVER_NOTIFICATION_TEXT } from "@/features/notification/i18n/ko";
import { BUTTON_TEXT } from "@/shared/i18n/catalog/button";
import { jsonFail, jsonOk, renderApp, stubFetch } from "@test/support/appHarness";

/** 테스트용 EventSource: 서버 이벤트를 직접 보낸다 */
class FakeEventSource {
  static last: FakeEventSource | null = null;
  url: string;
  withCredentials: boolean;
  closed = false;
  onerror: (() => void) | null = null;
  private listeners: Record<string, ((event: MessageEvent) => void)[]> = {};
  constructor(url: string, init?: { withCredentials?: boolean }) {
    this.url = url;
    this.withCredentials = init?.withCredentials === true;
    FakeEventSource.last = this;
  }
  addEventListener(type: string, listener: (event: MessageEvent) => void) {
    (this.listeners[type] ??= []).push(listener);
  }
  emit(type: string, data: string) {
    (this.listeners[type] ?? []).forEach((l) => l(new MessageEvent(type, { data })));
  }
  close() {
    this.closed = true;
  }
}

const dto = (overrides: Record<string, unknown> = {}) => ({
  id: 10, notificationType: "ASSIGNED", projectId: 77, targetType: "TASK", targetId: 103,
  messageKey: "notification.assigned", messageParams: { taskName: "API 설계" }, channel: "IN_APP", readAt: null, createdAt: "2026-11-27T01:00:00Z",
  ...overrides,
});
const page = (items: unknown[]) => ({ items, nextCursor: null, hasNext: false });

const ROUTES = [
  { path: "/", element: <ServerNotificationBell /> },
  { path: "/projects/:projectId/kanban", element: <p>칸반 화면</p> },
];
const render = () => renderApp({ mode: "api", route: "/", routes: ROUTES });
const badge = () => screen.queryByTestId("notification-badge");

beforeEach(() => {
  FakeEventSource.last = null;
  vi.stubGlobal("EventSource", FakeEventSource);
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("api 모드 알림", () => {
  it("미확인 수를 배지로, 누르면 목록을 보여 준다", async () => {
    stubFetch({
      "GET /api/notifications": () => jsonOk(page([dto(), dto({ id: 9, readAt: "2026-11-27T00:00:00Z", notificationType: "DUE_SOON", messageKey: "notification.dueSoon", messageParams: { taskName: "보고서", endDate: "2026-11-28" } })])),
      "GET /api/notifications/unread-count": () => jsonOk({ unreadCount: 1 }),
    });
    render();
    await waitFor(() => expect(badge()?.textContent).toBe("1"));
    fireEvent.click(screen.getByRole("button", { name: BUTTON_TEXT.notifications }));
    const panel = screen.getByRole("dialog");
    expect(within(panel).getByText("'API 설계' 업무가 배정되었습니다.")).toBeTruthy();
    expect(within(panel).getByText("'보고서' 업무가 내일(2026-11-28) 마감입니다.")).toBeTruthy();
    expect(FakeEventSource.last?.withCredentials).toBe(true);
    expect(FakeEventSource.last?.url).toContain("/notifications/stream");
  });

  it("알림을 누르면 읽음 처리한 뒤 업무의 프로젝트 칸반으로 간다", async () => {
    const { calls } = stubFetch({
      "GET /api/notifications": () => jsonOk(page([dto()])),
      "GET /api/notifications/unread-count": () => jsonOk({ unreadCount: 1 }),
      "POST /api/notifications/10/read": () => jsonOk(dto({ readAt: "2026-11-27T02:00:00Z" })),
    });
    render();
    await waitFor(() => expect(badge()).toBeTruthy());
    fireEvent.click(screen.getByRole("button", { name: BUTTON_TEXT.notifications }));
    fireEvent.click(screen.getByRole("button", { name: "'API 설계' 업무가 배정되었습니다." }));
    expect(await screen.findByText("칸반 화면")).toBeTruthy();
    expect(calls.some((c) => c.method === "POST" && c.path === "/api/notifications/10/read")).toBe(true);
  });

  it("읽음 처리가 실패하면 이동하지 않고 안내한다", async () => {
    stubFetch({
      "GET /api/notifications": () => jsonOk(page([dto()])),
      "GET /api/notifications/unread-count": () => jsonOk({ unreadCount: 1 }),
      "POST /api/notifications/10/read": () => jsonFail(500, "서버 오류"),
    });
    render();
    await waitFor(() => expect(badge()).toBeTruthy());
    fireEvent.click(screen.getByRole("button", { name: BUTTON_TEXT.notifications }));
    fireEvent.click(screen.getByRole("button", { name: "'API 설계' 업무가 배정되었습니다." }));
    expect(await screen.findByText(SERVER_NOTIFICATION_TEXT.readFailed)).toBeTruthy();
    expect(screen.queryByText("칸반 화면")).toBeNull();
  });

  it("SSE로 새 알림이 오면 목록 맨 위에 넣고 배지를 올린다(같은 알림·깨진 데이터는 무시)", async () => {
    stubFetch({
      "GET /api/notifications": () => jsonOk(page([dto()])),
      "GET /api/notifications/unread-count": () => jsonOk({ unreadCount: 1 }),
    });
    render();
    await waitFor(() => expect(badge()?.textContent).toBe("1"));
    act(() => {
      FakeEventSource.last?.emit("ready", "ok");
      const event = JSON.stringify(dto({ id: 11, notificationType: "STATUS_CHANGED", messageKey: "notification.statusChanged", messageParams: { taskName: "DB 설계", status: "DONE" } }));
      FakeEventSource.last?.emit("notification", event);
      // 같은 알림이 다시 와도 한 번만 센다
      FakeEventSource.last?.emit("notification", event);
      FakeEventSource.last?.emit("notification", "{broken");
    });
    expect(badge()?.textContent).toBe("2");
    fireEvent.click(screen.getByRole("button", { name: BUTTON_TEXT.notifications }));
    const items = within(screen.getByRole("dialog")).getAllByRole("listitem");
    expect(items[0].textContent).toContain("'DB 설계' 업무 상태가 '완료'(으)로 바뀌었습니다.");
    expect(screen.getByText(new RegExp(SERVER_NOTIFICATION_TEXT.live))).toBeTruthy();
  });

  it("SSE가 없어도 1분마다 미확인 수를 보고, 늘었으면 목록을 다시 받는다", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    let round = 0;
    stubFetch({
      "GET /api/notifications": () => jsonOk(page(round > 0 ? [dto({ id: 12, messageParams: { taskName: "새 업무" } }), dto()] : [dto()])),
      "GET /api/notifications/unread-count": () => jsonOk({ unreadCount: round > 0 ? 2 : 1 }),
    });
    render();
    await waitFor(() => expect(badge()?.textContent).toBe("1"));
    round = 1;
    await act(async () => {
      await vi.advanceTimersByTimeAsync(NOTIFICATION_POLL_MS);
    });
    await waitFor(() => expect(badge()?.textContent).toBe("2"));
    fireEvent.click(screen.getByRole("button", { name: BUTTON_TEXT.notifications }));
    expect(screen.getByText("'새 업무' 업무가 배정되었습니다.")).toBeTruthy();
  });

  it("처음 조회가 실패하면 1분 뒤 목록부터 다시 받아 회복한다", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    let fail = true;
    stubFetch({
      "GET /api/notifications": () => (fail ? jsonFail(500, "서버 오류") : jsonOk(page([dto()]))),
      "GET /api/notifications/unread-count": () => jsonOk({ unreadCount: 1 }),
    });
    render();
    fireEvent.click(screen.getByRole("button", { name: BUTTON_TEXT.notifications }));
    expect(await screen.findByRole("button", { name: BUTTON_TEXT.retry })).toBeTruthy();
    fail = false;
    await act(async () => {
      await vi.advanceTimersByTimeAsync(NOTIFICATION_POLL_MS);
    });
    expect(await screen.findByText("'API 설계' 업무가 배정되었습니다.")).toBeTruthy();
    expect(badge()?.textContent).toBe("1");
  });

  it("서버에 알림 API가 없으면(404) 준비 중으로 안내하고 SSE를 열지 않는다", async () => {
    stubFetch({
      "GET /api/notifications": () => jsonFail(404, "Not Found"),
      "GET /api/notifications/unread-count": () => jsonFail(404, "Not Found"),
    });
    render();
    fireEvent.click(screen.getByRole("button", { name: BUTTON_TEXT.notifications }));
    expect(await screen.findByText(SERVER_NOTIFICATION_TEXT.unavailable)).toBeTruthy();
    expect(FakeEventSource.last).toBeNull();
    expect(badge()).toBeNull();
  });

  it("화면을 벗어나면 SSE 연결을 닫는다", async () => {
    stubFetch({
      "GET /api/notifications": () => jsonOk(page([])),
      "GET /api/notifications/unread-count": () => jsonOk({ unreadCount: 0 }),
    });
    render();
    await waitFor(() => expect(FakeEventSource.last).not.toBeNull());
    const source = FakeEventSource.last;
    cleanup();
    expect(source?.closed).toBe(true);
  });
});
