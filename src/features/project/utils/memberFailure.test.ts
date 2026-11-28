import { describe, expect, it } from "vitest";
import type { ApiFailure } from "@/shared/api/client";
import { AUTH_TEXT } from "@/features/auth/i18n/ko";
import { PROJECT_MEMBER_TEXT } from "@/features/project/i18n/member";
import { interpretRemoveFailure, interpretRoleChangeFailure, memberLoadFailureMessage } from "@/features/project/utils/memberFailure";

/** 서버 오류 본문은 message·status(·보조 데이터)만 준다. client는 code를 null로 채운다. */
const http = (status: number, message: string | null = null, data?: unknown): ApiFailure => ({
  kind: "http",
  status,
  code: null,
  message,
  ...(data === undefined ? {} : { data }),
});

describe("interpretRoleChangeFailure (PATCH .../members/{userId}/role)", () => {
  it("409는 마지막 PM 해제(LAST_PM_REQUIRED)라 FE 안내 문구를 쓰고 목록을 다시 받는다", () => {
    expect(interpretRoleChangeFailure(http(409, "프로젝트에는 PM이 1명 이상 있어야 합니다"), "pmRelease")).toEqual({
      message: PROJECT_MEMBER_TEXT.lastPm,
      stale: true,
      tasks: [],
    });
  });

  it("PM 추가 400(게이트 승인자·비활성)은 서버 사유를 보여 준다", () => {
    expect(interpretRoleChangeFailure(http(400, "게이트 승인자는 PM이 될 수 없습니다"), "pmAdd")).toEqual({
      message: "게이트 승인자는 PM이 될 수 없습니다",
      stale: false,
      tasks: [],
    });
  });

  it("400인데 서버 메시지가 없으면 변경 종류에 맞는 FE 문구를 쓴다", () => {
    expect(interpretRoleChangeFailure(http(400), "pmAdd").message).toBe(PROJECT_MEMBER_TEXT.pmTargetRejected);
    expect(interpretRoleChangeFailure(http(400), "role").message).toBe(PROJECT_MEMBER_TEXT.roleRejected);
  });

  it("403(PM 아님)·404(멤버 없음)는 화면 값이 낡은 경우라 다시 받는다", () => {
    expect(interpretRoleChangeFailure(http(403, "프로젝트 PM만 할 수 있는 작업입니다"), "role")).toEqual({
      message: PROJECT_MEMBER_TEXT.pmOnly,
      stale: true,
      tasks: [],
    });
    expect(interpretRoleChangeFailure(http(404), "role")).toMatchObject({ message: PROJECT_MEMBER_TEXT.memberGone, stale: true });
  });

  it("네트워크·시간 초과·취소·알 수 없는 오류", () => {
    expect(interpretRoleChangeFailure({ kind: "network" }, "role")).toEqual({ message: AUTH_TEXT.network, stale: false, tasks: [] });
    expect(interpretRoleChangeFailure({ kind: "timeout" }, "role").message).toBe(AUTH_TEXT.timeout);
    expect(interpretRoleChangeFailure({ kind: "aborted" }, "role").message).toBe("");
    expect(interpretRoleChangeFailure(http(500), "role")).toEqual({ message: AUTH_TEXT.unknown, stale: false, tasks: [] });
  });
});

describe("interpretRemoveFailure (DELETE .../members/{userId})", () => {
  it("409 + 업무 목록이면 재배정할 업무를 돌려주고 다시 받지 않는다", () => {
    const view = interpretRemoveFailure(http(409, "담당 중인 업무가 있어 제외할 수 없습니다", [{ taskId: 1, title: "업무", status: "TODO" }]));
    expect(view).toEqual({ message: PROJECT_MEMBER_TEXT.hasTasks, stale: false, tasks: [{ taskId: 1, title: "업무", status: "todo" }] });
  });

  it("업무 목록이 비어 있는 409는 마지막 PM 또는 게이트 승인자라 서버 사유를 쓰고 다시 받는다", () => {
    expect(interpretRemoveFailure(http(409, "게이트 승인자는 멤버에서 제외할 수 없습니다", []))).toEqual({
      message: "게이트 승인자는 멤버에서 제외할 수 없습니다",
      stale: true,
      tasks: [],
    });
    expect(interpretRemoveFailure(http(409)).message).toBe(PROJECT_MEMBER_TEXT.removeConflict);
  });

  it("403·404는 다시 받는다", () => {
    expect(interpretRemoveFailure(http(403)).stale).toBe(true);
    expect(interpretRemoveFailure(http(404)).stale).toBe(true);
  });

  it("서버 메시지가 있는 그 밖의 오류는 메시지를 그대로 보여 준다", () => {
    expect(interpretRemoveFailure(http(500, "일시적인 오류"))).toEqual({ message: "일시적인 오류", stale: false, tasks: [] });
  });
});

describe("memberLoadFailureMessage", () => {
  it("연결 문제는 공통 문구, 그 밖에는 화면 문구", () => {
    expect(memberLoadFailureMessage({ kind: "timeout" }, "x")).toBe(AUTH_TEXT.timeout);
    expect(memberLoadFailureMessage(http(500, "내부 오류"), "목록 실패")).toBe("목록 실패");
  });
});
