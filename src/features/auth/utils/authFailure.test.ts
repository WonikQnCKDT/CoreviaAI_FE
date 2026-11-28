import { describe, expect, it } from "vitest";
import type { ApiFailure } from "@/shared/api/client";
import { AUTH_TEXT } from "@/features/auth/i18n/ko";
import { toChangePasswordOutcome, toResetOutcome, toSignInOutcome } from "@/features/auth/utils/authFailure";

/** BE 실제 실패: code 없이 status·message만 온다 */
const http = (status: number, message: string | null = null): ApiFailure => ({ kind: "http", status, code: null, message });

describe("toSignInOutcome (POST /api/auth/login)", () => {
  it("400(INVALID_CREDENTIALS)은 아이디·비밀번호 불일치 문구로 비밀번호 칸에 붙인다", () => {
    expect(toSignInOutcome(http(400, "아이디나 패스워드가 일치하지 않습니다."))).toEqual({
      kind: "rejected",
      field: "password",
      message: AUTH_TEXT.invalidCredentials,
    });
  });

  it("403(ACCOUNT_DISABLED)은 비활성 계정 안내", () => {
    expect(toSignInOutcome(http(403, "비활성화된 계정입니다. 시스템 관리자에게 문의해 주세요"))).toEqual({
      kind: "rejected",
      field: "account",
      message: AUTH_TEXT.accountDisabled,
    });
  });

  it("423(ACCOUNT_LOCKED)은 잠김", () => {
    expect(toSignInOutcome(http(423))).toEqual({ kind: "locked", message: AUTH_TEXT.accountLocked });
  });

  it("503·네트워크·시간 초과·취소를 구분한다", () => {
    expect(toSignInOutcome(http(503))).toEqual({ kind: "failed", message: AUTH_TEXT.serviceUnavailable });
    expect(toSignInOutcome({ kind: "network" })).toEqual({ kind: "failed", message: AUTH_TEXT.network });
    expect(toSignInOutcome({ kind: "timeout" })).toEqual({ kind: "failed", message: AUTH_TEXT.timeout });
    expect(toSignInOutcome({ kind: "aborted" })).toEqual({ kind: "aborted" });
  });
});

describe("toChangePasswordOutcome (PATCH /api/users/me/password)", () => {
  it.each([
    "잘못된 비밀번호입니다",
    "비밀번호는 영문, 숫자, 특수문자를 모두 포함해 8자 이상 64자 이하로 입력해 주세요",
    "새 비밀번호는 현재 비밀번호와 달라야 합니다",
  ])("400은 status로 구분할 수 없어 서버 메시지(%s)를 폼 오류로 보인다", (message) => {
    expect(toChangePasswordOutcome(http(400, message))).toEqual({ kind: "rejected", field: "form", message });
  });

  it("400인데 메시지가 없으면 공통 문구", () => {
    expect(toChangePasswordOutcome(http(400))).toEqual({ kind: "rejected", field: "form", message: AUTH_TEXT.unknown });
  });

  it("404는 계정 없음", () => {
    expect(toChangePasswordOutcome(http(404))).toEqual({ kind: "failed", message: AUTH_TEXT.accountNotFound });
  });
});

describe("toResetOutcome (POST /api/admin/users/{id}/password-reset)", () => {
  it("404는 대상 사용자 없음, 403은 관리자 본인 비밀번호 변경 필요, 400은 서버 메시지", () => {
    expect(toResetOutcome(http(404))).toEqual({ kind: "failed", message: AUTH_TEXT.resetUserNotFound });
    expect(toResetOutcome(http(403))).toEqual({ kind: "failed", message: AUTH_TEXT.forcedChangeDescription });
    expect(toResetOutcome(http(400, "사용자 ID를 확인해 주세요"))).toEqual({ kind: "failed", message: "사용자 ID를 확인해 주세요" });
  });
});
