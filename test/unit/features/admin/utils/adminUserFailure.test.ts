import { describe, expect, it } from "vitest";
import type { ApiFailure } from "@/shared/api/client";
import { AUTH_TEXT } from "@/features/auth/i18n/ko";
import { ADMIN_ERROR_TEXT } from "@/features/admin/i18n/ko";
import {
  interpretAccountChangeFailure,
  interpretCreateUserFailure,
  interpretUpdateProfileFailure,
} from "@/features/admin/utils/adminUserFailure";

/** 서버 오류 본문은 message·status만 준다. client는 code를 null로 채운다. */
const http = (status: number, message: string | null = null): ApiFailure => ({ kind: "http", status, code: null, message });

describe("interpretCreateUserFailure (POST /api/admin/users)", () => {
  it("409는 아이디 중복이므로 아이디 칸에 서버 메시지를 붙인다", () => {
    expect(interpretCreateUserFailure(http(409, "이미 사용 중인 아이디입니다"))).toEqual({
      message: "이미 사용 중인 아이디입니다",
      field: "loginId",
      stale: false,
    });
  });

  it("404는 없는 부서이므로 부서 칸에 붙인다", () => {
    expect(interpretCreateUserFailure(http(404, "부서를 찾을 수 없습니다"))).toMatchObject({ field: "departmentId" });
  });

  it("400은 상황이 여럿이라 입력칸을 고르지 않고 서버 메시지를 폼 오류로 보여 준다", () => {
    expect(interpretCreateUserFailure(http(400, "비활성 부서에는 사용자를 배치할 수 없습니다"))).toEqual({
      message: "비활성 부서에는 사용자를 배치할 수 없습니다",
      field: null,
      stale: false,
    });
  });

  it("서버 메시지가 없으면 공통 문구를 쓴다", () => {
    expect(interpretCreateUserFailure(http(500)).message).toBe(AUTH_TEXT.unknown);
  });

  it("네트워크 실패는 입력칸과 무관하다", () => {
    expect(interpretCreateUserFailure({ kind: "network" })).toEqual({ message: AUTH_TEXT.network, field: null, stale: false });
  });
});

describe("interpretUpdateProfileFailure (PATCH /api/admin/users/{userId})", () => {
  it("409 동시 수정은 FE 안내 문구를 쓰고 최신 값을 다시 받는다", () => {
    expect(interpretUpdateProfileFailure(http(409, "다른 사용자가 먼저 수정했습니다"))).toEqual({
      message: ADMIN_ERROR_TEXT.concurrentModification,
      field: null,
      stale: true,
    });
  });

  it("404는 사용자나 부서가 사라진 경우라 서버 메시지를 쓰고 다시 받는다", () => {
    expect(interpretUpdateProfileFailure(http(404, "사용자를 찾을 수 없습니다"))).toEqual({
      message: "사용자를 찾을 수 없습니다",
      field: null,
      stale: true,
    });
  });

  it("400 검증 오류는 다시 받지 않는다", () => {
    expect(interpretUpdateProfileFailure(http(400, "이름은 50자 이하로 입력해 주세요")).stale).toBe(false);
  });

  it("시간 초과는 다시 받지 않는다", () => {
    expect(interpretUpdateProfileFailure({ kind: "timeout" })).toEqual({ message: AUTH_TEXT.timeout, field: null, stale: false });
  });
});

describe("interpretAccountChangeFailure (PATCH .../system-role, .../status)", () => {
  it("503은 반영은 됐지만 세션을 못 끊은 경우라 재시도 안내를 보여 주고 다시 받지 않는다", () => {
    expect(interpretAccountChangeFailure(http(503, "외부 서비스에 일시적으로 연결할 수 없습니다"))).toEqual({
      message: ADMIN_ERROR_TEXT.sessionRevokeFailed,
      field: null,
      stale: false,
    });
  });

  it("409 마지막 시스템 관리자는 서버 메시지를 쓰고 대상 사용자를 다시 받는다", () => {
    expect(interpretAccountChangeFailure(http(409, "마지막 시스템 관리자의 역할·상태는 변경할 수 없습니다"))).toEqual({
      message: "마지막 시스템 관리자의 역할·상태는 변경할 수 없습니다",
      field: null,
      stale: true,
    });
  });

  it("404 없는 사용자도 다시 받는다", () => {
    expect(interpretAccountChangeFailure(http(404, "사용자를 찾을 수 없습니다")).stale).toBe(true);
  });

  it("400 본인 계정 변경은 서버 메시지만 보여 준다", () => {
    expect(interpretAccountChangeFailure(http(400, "본인 계정의 역할·상태는 변경할 수 없습니다"))).toEqual({
      message: "본인 계정의 역할·상태는 변경할 수 없습니다",
      field: null,
      stale: false,
    });
  });

  it("사용자가 취소하면 문구를 비운다", () => {
    expect(interpretAccountChangeFailure({ kind: "aborted" })).toEqual({ message: "", field: null, stale: false });
  });
});
