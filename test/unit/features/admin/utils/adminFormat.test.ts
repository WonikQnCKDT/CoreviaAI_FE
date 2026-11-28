import { describe, expect, it } from "vitest";
import type { ApiFailure } from "@/shared/api/client";
import { AUTH_TEXT } from "@/features/auth/i18n/ko";
import { HISTORY_ACTION_TEXT } from "@/features/admin/i18n/ko";
import { adminErrorMessage, failureStatus, formatDateTime } from "@/features/admin/utils/adminFormat";

const http = (status: number, message: string | null = null): ApiFailure => ({ kind: "http", status, code: null, message });

describe("adminErrorMessage", () => {
  it("400이 아닌 status도 서버 메시지를 그대로 보여 준다 (이전에는 409·404가 '알 수 없는 오류'였다)", () => {
    expect(adminErrorMessage(http(409, "이미 사용 중인 아이디입니다"))).toBe("이미 사용 중인 아이디입니다");
    expect(adminErrorMessage(http(404, "사용자를 찾을 수 없습니다"))).toBe("사용자를 찾을 수 없습니다");
  });

  it("호출한 쪽이 넘긴 status 문구가 서버 메시지보다 먼저다", () => {
    expect(adminErrorMessage(http(503, "서버 메시지"), { byStatus: { 503: "FE 안내" } })).toBe("FE 안내");
  });

  it("다른 status의 문구는 쓰지 않는다", () => {
    expect(adminErrorMessage(http(409, "서버 메시지"), { byStatus: { 503: "FE 안내" } })).toBe("서버 메시지");
  });

  it("서버 메시지가 비어 있으면 503은 서비스 장애 문구, 그 밖은 공통 문구를 쓴다", () => {
    expect(adminErrorMessage(http(503, ""))).toBe(AUTH_TEXT.serviceUnavailable);
    expect(adminErrorMessage(http(500))).toBe(AUTH_TEXT.unknown);
  });

  it("네트워크·시간 초과·취소를 구분한다", () => {
    expect(adminErrorMessage({ kind: "network" })).toBe(AUTH_TEXT.network);
    expect(adminErrorMessage({ kind: "timeout" })).toBe(AUTH_TEXT.timeout);
    expect(adminErrorMessage({ kind: "aborted" })).toBe("");
  });
});

describe("failureStatus", () => {
  it("HTTP 실패만 status가 있다", () => {
    expect(failureStatus(http(409))).toBe(409);
    expect(failureStatus({ kind: "network" })).toBeNull();
  });
});

describe("HISTORY_ACTION_TEXT", () => {
  it("명세의 6개 action과 폐지 전 감사 로그 action을 모두 사람이 읽는 문구로 보여 준다", () => {
    const actions = [
      "USER_CREATED",
      "USER_PROFILE_CHANGED",
      "USER_ROLE_CHANGED",
      "USER_ACTIVATED",
      "USER_DEACTIVATED",
      "PASSWORD_RESET",
      "PROJECT_CREATION_GRANTED",
      "PROJECT_CREATION_REVOKED",
    ];
    actions.forEach((action) => expect(HISTORY_ACTION_TEXT[action], action).toBeTruthy());
  });
});

describe("formatDateTime", () => {
  it("값이 없으면 빈 문자열, 해석할 수 없으면 원문을 돌려준다", () => {
    expect(formatDateTime({ iso: null })).toBe("");
    expect(formatDateTime({ iso: "not-a-date" })).toBe("not-a-date");
  });
});
