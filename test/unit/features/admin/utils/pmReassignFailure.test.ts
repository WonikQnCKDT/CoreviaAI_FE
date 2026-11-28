import { describe, expect, it } from "vitest";
import type { ApiFailure } from "@/shared/api/client";
import { AUTH_TEXT } from "@/features/auth/i18n/ko";
import { ADMIN_PM_TEXT } from "@/features/admin/i18n/pmReassign";
import { interpretReassignPmFailure } from "@/features/admin/utils/pmReassignFailure";

const http = (status: number, message: string | null = null): ApiFailure => ({ kind: "http", status, code: null, message });

describe("interpretReassignPmFailure", () => {
  it("409는 활성 PM이 남았거나 코드가 없는 경우를 함께 안내한다", () => {
    expect(interpretReassignPmFailure(http(409, "PM을 재지정할 수 없는 프로젝트입니다"))).toBe(ADMIN_PM_TEXT.notAllowed);
  });

  it("400은 서버 사유(초대할 수 없는 사용자·게이트 승인자 등)를 그대로 보여 준다", () => {
    expect(interpretReassignPmFailure(http(400, "프로젝트 멤버로 초대할 수 없는 사용자입니다"))).toBe("프로젝트 멤버로 초대할 수 없는 사용자입니다");
  });

  it("메시지 없는 오류·연결 문제·취소", () => {
    expect(interpretReassignPmFailure(http(500))).toBe(AUTH_TEXT.unknown);
    expect(interpretReassignPmFailure({ kind: "network" })).toBe(AUTH_TEXT.network);
    expect(interpretReassignPmFailure({ kind: "aborted" })).toBe("");
  });
});
