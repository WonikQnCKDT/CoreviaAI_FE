import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  SESSION_IDLE_LIMIT_MS,
  clearReturnTo,
  clearSessionActivity,
  clearSessionNotice,
  consumeSessionNotice,
  isSessionExpired,
  markPasswordChangedNotice,
  markSessionExpiredNotice,
  peekReturnTo,
  peekSessionNotice,
  readSessionActivity,
  saveReturnTo,
  takeReturnTo,
  touchSession,
} from "@/features/auth/utils/session";

beforeEach(() => {
  sessionStorage.clear();
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-11-28T09:00:00Z"));
});

afterEach(() => {
  vi.useRealTimers();
  sessionStorage.clear();
});

describe("세션 활동 기록과 무활동 만료 (sessionStorage)", () => {
  it("활동 기록이 없거나 다른 사용자 기록이면 만료로 보지 않는다", () => {
    expect(isSessionExpired("u1")).toBe(false);
    touchSession("u2", true);
    expect(isSessionExpired("u1", Date.now() + SESSION_IDLE_LIMIT_MS + 1)).toBe(false);
  });

  it("30분 미만은 유지되고 정확히 30분이 지나면 만료된다(경계값)", () => {
    const start = Date.now();
    touchSession("u1", true);

    expect(isSessionExpired("u1", start + SESSION_IDLE_LIMIT_MS - 1)).toBe(false);
    expect(isSessionExpired("u1", start + SESSION_IDLE_LIMIT_MS)).toBe(true);
  });

  it("같은 사용자의 짧은 간격 반복 기록은 스로틀하고 force=true면 즉시 갱신한다", () => {
    touchSession("u1", true);
    const first = readSessionActivity()?.lastActiveAt;

    vi.advanceTimersByTime(10_000);
    touchSession("u1");
    expect(readSessionActivity()?.lastActiveAt).toBe(first);

    touchSession("u1", true);
    expect(readSessionActivity()?.lastActiveAt).toBe((first ?? 0) + 10_000);

    clearSessionActivity();
    expect(readSessionActivity()).toBeNull();
  });
});

describe("세션 종료 안내와 복귀 경로", () => {
  it("peekSessionNotice는 삭제하지 않고, consumeSessionNotice는 읽은 뒤 즉시 삭제한다", () => {
    markSessionExpiredNotice();
    expect(peekSessionNotice()?.reason).toBe("expired");
    expect(peekSessionNotice()?.reason).toBe("expired");

    const consumed = consumeSessionNotice();
    expect(consumed?.reason).toBe("expired");
    expect(peekSessionNotice()).toBeNull();
  });

  it("비밀번호 변경 안내를 저장하고 clearSessionNotice로 지울 수 있다", () => {
    markPasswordChangedNotice({ title: "비밀번호 변경됨", note: "다시 로그인하세요." });
    expect(peekSessionNotice()).toMatchObject({
      reason: "passwordChanged",
      title: "비밀번호 변경됨",
      note: "다시 로그인하세요.",
    });

    clearSessionNotice();
    expect(peekSessionNotice()).toBeNull();
  });

  it("복귀 경로는 /login 경로를 무시하고, takeReturnTo로 한 번만 꺼낸다", () => {
    saveReturnTo("/login");
    expect(peekReturnTo()).toBeNull();

    saveReturnTo("/projects/77/wbs");
    expect(peekReturnTo()).toBe("/projects/77/wbs");
    expect(takeReturnTo()).toBe("/projects/77/wbs");
    expect(peekReturnTo()).toBeNull();

    saveReturnTo("/mywork");
    clearReturnTo();
    expect(peekReturnTo()).toBeNull();
  });
});
