import { describe, expect, it } from "vitest";
import type { User } from "@/types";
import { canCreateProject } from "@/utils/permission";

const user = (overrides: Partial<User> = {}): User => ({
  id: "u1",
  name: "김서연",
  dept: "DX기획팀",
  job: "서비스 기획",
  role: "pm",
  roleLabel: "PM",
  email: "seoyeon.kim@corevia.co.kr",
  systemRole: "user",
  active: true,
  ...overrides,
});

describe("canCreateProject (FR-PRJ-01, 권한 매트릭스 3.3 PRJ-01)", () => {
  it("활성 일반 사용자는 별도 권한 없이 만들 수 있다", () => {
    expect(canCreateProject(user())).toBe(true);
  });

  it("예전 데모 저장소에 canCreateProject=false가 남아 있어도 막지 않는다", () => {
    const legacy = { ...user(), canCreateProject: false } as User;
    expect(canCreateProject(legacy)).toBe(true);
  });

  it("경영진은 조회만 하므로 만들 수 없다", () => {
    expect(canCreateProject(user({ systemRole: "exec" }))).toBe(false);
  });

  it("시스템 관리자는 프로젝트 데이터에 접근하지 않으므로 만들 수 없다", () => {
    expect(canCreateProject(user({ systemRole: "admin", isSystemAdmin: true }))).toBe(false);
  });

  it("비활성 일반 사용자는 만들 수 없다", () => {
    expect(canCreateProject(user({ active: false }))).toBe(false);
  });

  it("로그인 정보가 없으면 만들 수 없다", () => {
    expect(canCreateProject(null)).toBe(false);
    expect(canCreateProject(undefined)).toBe(false);
  });
});
