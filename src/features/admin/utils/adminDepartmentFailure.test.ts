import { describe, expect, it } from "vitest";
import type { ApiFailure } from "@/shared/api/client";
import { AUTH_TEXT } from "@/features/auth/i18n/ko";
import {
  interpretCreateDepartmentFailure,
  interpretDepartmentStatusFailure,
  interpretUpdateDepartmentFailure,
} from "@/features/admin/utils/adminDepartmentFailure";

const http = (status: number, message: string | null = null): ApiFailure => ({ kind: "http", status, code: null, message });

describe("interpretCreateDepartmentFailure (POST /api/admin/departments)", () => {
  it("409 이름 중복은 이름 칸에 서버 메시지를 붙이고 목록은 그대로 둔다", () => {
    expect(interpretCreateDepartmentFailure(http(409, "같은 상위 부서에 이름이 같은 부서가 있습니다"))).toEqual({
      message: "같은 상위 부서에 이름이 같은 부서가 있습니다",
      nameError: true,
      stale: false,
    });
  });

  it("400 상위 부서 문제는 폼 오류로 보여 주고 목록을 다시 받는다", () => {
    expect(interpretCreateDepartmentFailure(http(400, "상위 부서로 지정할 수 없는 부서입니다"))).toEqual({
      message: "상위 부서로 지정할 수 없는 부서입니다",
      nameError: false,
      stale: true,
    });
  });

  it("서버 오류(500)는 목록을 다시 받지 않는다", () => {
    expect(interpretCreateDepartmentFailure(http(500))).toEqual({ message: AUTH_TEXT.unknown, nameError: false, stale: false });
  });

  it("네트워크 실패는 목록을 다시 받지 않는다", () => {
    expect(interpretCreateDepartmentFailure({ kind: "network" })).toEqual({
      message: AUTH_TEXT.network,
      nameError: false,
      stale: false,
    });
  });
});

describe("interpretUpdateDepartmentFailure (PATCH /api/admin/departments/{departmentId})", () => {
  it("409는 이름 중복·동시 수정을 구분할 수 없어 폼 오류로 보여 주고 목록을 다시 받는다", () => {
    expect(interpretUpdateDepartmentFailure(http(409, "다른 사용자가 먼저 수정했습니다"))).toEqual({
      message: "다른 사용자가 먼저 수정했습니다",
      nameError: false,
      stale: true,
    });
  });

  it.each([400, 404])("%i이면 목록을 다시 받는다", (status) => {
    expect(interpretUpdateDepartmentFailure(http(status, "서버 메시지")).stale).toBe(true);
  });

  it("시간 초과는 목록을 다시 받지 않는다", () => {
    expect(interpretUpdateDepartmentFailure({ kind: "timeout" })).toEqual({
      message: AUTH_TEXT.timeout,
      nameError: false,
      stale: false,
    });
  });
});

describe("interpretDepartmentStatusFailure (PATCH .../status)", () => {
  it("409 사용 중인 부서는 서버 메시지를 보여 주고 인원 정보를 다시 받는다", () => {
    expect(interpretDepartmentStatusFailure(http(409, "소속 사용자나 활성 하위 부서가 있어 비활성화할 수 없습니다"))).toEqual({
      message: "소속 사용자나 활성 하위 부서가 있어 비활성화할 수 없습니다",
      nameError: false,
      stale: true,
    });
  });

  it.each([400, 404])("%i이면 목록을 다시 받는다", (status) => {
    expect(interpretDepartmentStatusFailure(http(status, "서버 메시지")).stale).toBe(true);
  });

  it("503은 목록을 다시 받지 않는다", () => {
    expect(interpretDepartmentStatusFailure(http(503)).stale).toBe(false);
  });

  it("취소하면 문구를 비운다", () => {
    expect(interpretDepartmentStatusFailure({ kind: "aborted" })).toEqual({ message: "", nameError: false, stale: false });
  });
});
