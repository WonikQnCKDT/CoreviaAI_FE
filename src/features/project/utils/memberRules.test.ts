import { describe, expect, it } from "vitest";
import type { ServerProjectMember } from "@/features/project/api/projectApi";
import {
  actorLabel,
  canManageServerMembers,
  changeTypeLabel,
  formatOccurredAt,
  inviteRoleOptions,
  isLastPm,
  pmCountOf,
  roleChangeKind,
  roleOptionsFor,
} from "@/features/project/utils/memberRules";
import { PROJECT_MEMBER_TEXT } from "@/features/project/i18n/member";

const member = (userId: number, actor: ServerProjectMember["actor"]): ServerProjectMember => ({ userId, name: `u${userId}`, actor, assignedTaskCount: 0 });

describe("canManageServerMembers", () => {
  const members = [member(5, "pm"), member(11, "dev")];

  it("서버 멤버 목록에서 본인이 PM이면 관리할 수 있다", () => {
    expect(canManageServerMembers({ members, viewerUserId: 5, viewerIsExecutive: false })).toBe(true);
  });

  it("PM이 아닌 멤버·멤버가 아닌 사용자는 읽기 전용이다", () => {
    expect(canManageServerMembers({ members, viewerUserId: 11, viewerIsExecutive: false })).toBe(false);
    expect(canManageServerMembers({ members, viewerUserId: 99, viewerIsExecutive: false })).toBe(false);
  });

  it("경영진은 PM으로 보이더라도 읽기 전용이다", () => {
    expect(canManageServerMembers({ members, viewerUserId: 5, viewerIsExecutive: true })).toBe(false);
  });

  it("로그인 정보가 없거나 멤버가 비어 있으면 관리할 수 없다", () => {
    expect(canManageServerMembers({ members, viewerUserId: null, viewerIsExecutive: false })).toBe(false);
    expect(canManageServerMembers({ members: [], viewerUserId: 5, viewerIsExecutive: false })).toBe(false);
  });
});

describe("PM 수와 마지막 PM", () => {
  it("PM 수를 센다 (0명 포함)", () => {
    expect(pmCountOf([])).toBe(0);
    expect(pmCountOf([member(1, "pm"), member(2, "pm"), member(3, "qa")])).toBe(2);
  });

  it("PM이 1명 이하일 때 그 PM만 마지막 PM이다", () => {
    expect(isLastPm(member(1, "pm"), 1)).toBe(true);
    expect(isLastPm(member(1, "pm"), 0)).toBe(true);
    expect(isLastPm(member(1, "pm"), 2)).toBe(false);
    expect(isLastPm(member(2, "dev"), 1)).toBe(false);
  });
});

describe("roleOptionsFor", () => {
  it("지정한 액터만 중복 없이 지정 순서대로 준다", () => {
    expect(roleOptionsFor(member(1, "dev"), ["pm", "dev", "qa", "dev"])).toEqual(["pm", "dev", "qa"]);
  });

  it("현재 역할이 지정 목록에 없으면 맨 앞에 둔다", () => {
    expect(roleOptionsFor(member(1, "biz"), ["pm", "dev"])).toEqual(["biz", "pm", "dev"]);
  });

  it("지정 액터가 비어 있어도 현재 역할은 보인다", () => {
    expect(roleOptionsFor(member(1, "qa"), [])).toEqual(["qa"]);
  });
});

describe("roleChangeKind", () => {
  it("→ PM은 PM 추가, PM → 다른 역할은 PM 해제, 그 밖은 역할 변경", () => {
    expect(roleChangeKind("dev", "pm")).toBe("pmAdd");
    expect(roleChangeKind("pm", "qa")).toBe("pmRelease");
    expect(roleChangeKind("dev", "qa")).toBe("role");
  });
});

describe("라벨", () => {
  it("화면 역할·추가 액터·없음을 이름으로 바꾼다", () => {
    expect(actorLabel("dev")).toBe("개발자");
    expect(actorLabel("deptStaff")).toBe("부서 담당자");
    expect(actorLabel(null)).toBe(PROJECT_MEMBER_TEXT.noActor);
  });

  it("알려진 변경 유형은 이름으로, 모르는 유형은 원래 값으로", () => {
    expect(changeTypeLabel("pmReleased")).toBe("PM 해제");
    expect(changeTypeLabel("FUTURE_TYPE")).toBe("FUTURE_TYPE");
  });

  it("시각을 locale 형식으로 바꾸고 읽을 수 없는 값은 그대로 둔다", () => {
    expect(formatOccurredAt({ iso: "2026-11-27T01:00:00Z", locale: "ko-KR" })).toMatch(/2026/);
    expect(formatOccurredAt({ iso: "not-a-date", locale: "ko-KR" })).toBe("not-a-date");
    expect(formatOccurredAt({ iso: "", locale: "ko-KR" })).toBe("");
  });
});

describe("inviteRoleOptions", () => {
  it("지정한 액터 중 PM을 빼고 중복 없이 준다", () => {
    expect(inviteRoleOptions(["pm", "dev", "qa", "dev"])).toEqual(["dev", "qa"]);
  });

  it("PM만 지정했거나 비어 있으면 고를 역할이 없다", () => {
    expect(inviteRoleOptions(["pm"])).toEqual([]);
    expect(inviteRoleOptions([])).toEqual([]);
  });
});
