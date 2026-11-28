import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fetchNotifications, fetchUnreadCount, markNotificationRead, parseStreamData, toNotification, type ServerNotification } from "@/features/notification/api/notificationApi";
import { SERVER_NOTIFICATION_TEXT } from "@/features/notification/i18n/ko";
import { isNotificationApiMissing, mergeNotifications, notificationMessage, notificationPath } from "@/features/notification/utils/serverNotification";
import { jsonFail, jsonOk, stubFetch } from "@test/support/appHarness";

const dto = (overrides: Record<string, unknown> = {}) => ({
  id: 10, notificationType: "ASSIGNED", projectId: 77, targetType: "TASK", targetId: 103,
  messageKey: "notification.assigned", messageParams: { taskName: "API 설계" }, channel: "IN_APP", readAt: null, createdAt: "2026-11-27T01:00:00Z",
  ...overrides,
});

const notification = (overrides: Partial<ServerNotification> = {}): ServerNotification => ({
  id: 10, type: "assigned", projectId: 77, targetType: "task", targetId: 103, messageKey: "notification.assigned",
  params: { taskName: "API 설계" }, read: false, createdAt: "", ...overrides,
});

describe("변환", () => {
  it("명세 필드를 화면 모델로, readAt이 있으면 읽음", () => {
    expect(toNotification(dto())).toMatchObject({ id: 10, type: "assigned", projectId: 77, targetType: "task", read: false, params: { taskName: "API 설계" } });
    expect(toNotification(dto({ readAt: "2026-11-27T02:00:00Z" }))?.read).toBe(true);
  });

  it("모르는 종류·잘못된 ID는 버리고, params는 문자열·숫자만 길이 제한해 받는다", () => {
    expect(toNotification(dto({ notificationType: "OTHER" }))).toBeNull();
    expect(toNotification(dto({ id: 0 }))).toBeNull();
    expect(toNotification(null)).toBeNull();
    const n = toNotification(dto({ messageParams: { taskName: "가".repeat(500), n: 3, obj: { x: 1 }, arr: [1] } }));
    expect(n?.params.taskName).toHaveLength(200);
    expect(n?.params).toEqual({ taskName: "가".repeat(200), n: "3" });
  });

  it("SSE data: JSON이 아니거나 형태가 다르면 무시한다", () => {
    expect(parseStreamData(JSON.stringify(dto()))?.id).toBe(10);
    expect(parseStreamData("ok")).toBeNull();
    expect(parseStreamData("{bad")).toBeNull();
    expect(parseStreamData(JSON.stringify({ id: "x" }))).toBeNull();
    expect(parseStreamData(undefined)).toBeNull();
  });
});

describe("본문·이동 경로", () => {
  it("알고 있는 키는 템플릿에 값을 넣고, 상태 코드는 라벨로", () => {
    expect(notificationMessage(notification())).toBe("'API 설계' 업무가 배정되었습니다.");
    expect(notificationMessage(notification({ type: "statusChanged", messageKey: "notification.statusChanged", params: { taskName: "API 설계", status: "IN_PROGRESS" } }))).toBe(
      "'API 설계' 업무 상태가 '진행'(으)로 바뀌었습니다.",
    );
    expect(notificationMessage(notification({ type: "dueSoon", messageKey: "notification.dueSoon", params: { taskName: "API 설계", endDate: "2026-11-28" } }))).toBe(
      "'API 설계' 업무가 내일(2026-11-28) 마감입니다.",
    );
  });

  it("모르는 키·빠진 값은 종류별 기본 문구(자리 표시가 보이지 않게)", () => {
    expect(notificationMessage(notification({ messageKey: "notification.unknown" }))).toBe(SERVER_NOTIFICATION_TEXT.fallbackAssigned);
    expect(notificationMessage(notification({ params: {} }))).toBe(SERVER_NOTIFICATION_TEXT.fallbackAssigned);
    expect(notificationMessage(notification({ type: "riskUp", messageKey: "" }))).toBe(SERVER_NOTIFICATION_TEXT.fallbackRiskUp);
  });

  it("사용자 입력 값은 그대로 문자열로 넣는다(HTML로 해석하지 않음)", () => {
    expect(notificationMessage(notification({ params: { taskName: "<img src=x>" } }))).toBe("'<img src=x>' 업무가 배정되었습니다.");
  });

  it("경로는 숫자 ID로만: 업무는 칸반, 프로젝트는 홈, 프로젝트를 모르면 이동 없음", () => {
    expect(notificationPath(notification())).toBe("/projects/77/kanban");
    expect(notificationPath(notification({ targetType: "project" }))).toBe("/projects/77");
    expect(notificationPath(notification({ projectId: null }))).toBeNull();
  });

  it("최신순 합치기, 같은 id는 새 값으로", () => {
    const merged = mergeNotifications([notification({ id: 1 }), notification({ id: 3 })], [notification({ id: 2 }), notification({ id: 3, read: true })]);
    expect(merged.map((n) => [n.id, n.read])).toEqual([[3, true], [2, false], [1, false]]);
  });
});

describe("요청", () => {
  beforeEach(() => vi.stubGlobal("window", globalThis));
  afterEach(() => vi.unstubAllGlobals());

  it("목록 쿼리·미확인 수·읽음", async () => {
    const { calls } = stubFetch({
      "GET /api/notifications": () => jsonOk({ items: [dto(), dto({ id: 0 })], nextCursor: "c2", hasNext: true }),
      "GET /api/notifications/unread-count": () => jsonOk({ unreadCount: 3 }),
      "POST /api/notifications/10/read": () => jsonOk(dto({ readAt: "2026-11-27T02:00:00Z" })),
    });
    expect(await fetchNotifications({ cursor: "c1" })).toMatchObject({ ok: true, data: { items: [{ id: 10 }], nextCursor: "c2", hasNext: true } });
    expect(calls[0].path).toBe("/api/notifications?size=20&unreadOnly=false&cursor=c1");
    expect(await fetchUnreadCount()).toEqual({ ok: true, data: 3 });
    expect(await markNotificationRead({ notificationId: 10 })).toMatchObject({ ok: true, data: { read: true } });
  });

  it("API가 없으면(404) '준비 중'으로 본다", async () => {
    stubFetch({ "GET /api/notifications/unread-count": () => jsonFail(404, "Not Found") });
    const result = await fetchUnreadCount();
    expect(result.ok === false && isNotificationApiMissing(result.failure)).toBe(true);
  });
});
