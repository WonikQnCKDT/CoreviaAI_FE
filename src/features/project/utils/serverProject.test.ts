import { describe, expect, it } from "vitest";
import type { Project, User } from "@/types";
import type { ServerProjectDetail, ServerProjectPhase, ServerProjectSummary } from "@/features/project/api/projectApi";
import { departmentLabel, mergeServerDetail, mergeServerSummary } from "@/features/project/utils/serverProject";

const summary = (overrides: Partial<ServerProjectSummary> = {}): ServerProjectSummary => ({
  id: 12,
  code: "PUR-2026",
  name: "구매 발주",
  status: "planned",
  template: "itProject",
  methodology: "waterfall",
  visibility: "company",
  departments: [{ id: 2, name: "개발팀" }],
  pms: [{ id: 5, name: "홍길동" }],
  startDate: "2026-12-01",
  endDate: "2027-03-31",
  createdAt: "2026-11-22T01:30:00Z",
  ...overrides,
});

const detail = (overrides: Partial<ServerProjectDetail> = {}): ServerProjectDetail => ({
  ...summary(),
  departmentType: "sw",
  createdBy: 5,
  actors: ["pm", "biz", "dev"],
  features: ["wbs"],
  progress: 0,
  version: 0,
  ...overrides,
});

const phase = (overrides: Partial<ServerProjectPhase> = {}): ServerProjectPhase => ({
  id: 1,
  name: "분석",
  stage: "analysis",
  order: 1,
  progress: 0,
  status: "notStarted",
  gateStatus: "pending",
  gateApproverUserId: null,
  gateApproverName: null,
  ...overrides,
});

const users: User[] = [];

describe("departmentLabel", () => {
  it("주관 부서 0개는 '-', 여러 개는 쉼표로 잇는다", () => {
    expect(departmentLabel([])).toBe("-");
    expect(departmentLabel([{ id: 1, name: "개발팀" }, { id: 2, name: "구매팀" }])).toBe("개발팀, 구매팀");
  });
});

describe("mergeServerSummary", () => {
  it("복수 PM을 모두 PM 멤버로 두고 첫 PM을 대표 PM으로 쓴다", () => {
    const { project, users: next } = mergeServerSummary({
      summary: summary({ pms: [{ id: 5, name: "홍길동" }, { id: 11, name: "이개발" }] }),
      users,
    });
    expect(project.pmId).toBe("server-5");
    expect(project.members).toEqual([
      { userId: "server-5", role: "pm" },
      { userId: "server-11", role: "pm" },
    ]);
    expect(next.map(({ id, name }) => ({ id, name }))).toEqual([
      { id: "server-5", name: "홍길동" },
      { id: "server-11", name: "이개발" },
    ]);
  });

  it("활성 PM이 없으면 대표 PM을 비워 아무도 PM 권한을 갖지 않는다", () => {
    const { project } = mergeServerSummary({ summary: summary({ pms: [] }), users });
    expect(project.pmId).toBe("");
    expect(project.members).toEqual([]);
  });

  it("빈 기간은 빈 문자열(화면 '-')로, 운영 방식 '단계 없음'은 그대로 둔다", () => {
    const { project } = mergeServerSummary({ summary: summary({ startDate: null, endDate: null, methodology: "none" }), users });
    expect(project).toMatchObject({ startDate: "", endDate: "", method: "none", dept: "개발팀" });
  });

  it("PM에서 해제된 사람의 PM 역할은 빼고, 다른 멤버는 그대로 둔다", () => {
    const existing = mergeServerSummary({ summary: summary({ pms: [{ id: 5, name: "홍길동" }, { id: 11, name: "이개발" }] }), users }).project;
    const withDev: Project = { ...existing, members: [...existing.members, { userId: "server-31", role: "dev" }] };
    const { project } = mergeServerSummary({ summary: summary({ pms: [{ id: 11, name: "이개발" }] }), existing: withDev, users });
    expect(project.pmId).toBe("server-11");
    expect(project.members).toEqual([
      { userId: "server-11", role: "pm" },
      { userId: "server-31", role: "dev" },
    ]);
  });

  it("이미 연결된 프로젝트의 화면 값(리스크 점수 등)은 유지한다", () => {
    const first = mergeServerSummary({ summary: summary(), users }).project;
    const { project } = mergeServerSummary({ summary: summary({ name: "새 이름" }), existing: { ...first, riskScore: 72 }, users });
    expect(project).toMatchObject({ name: "새 이름", riskScore: 72 });
  });
});

describe("mergeServerDetail", () => {
  it("멤버 API의 멤버로 바꾸고 화면이 모르는 액터는 뺀다", () => {
    const { project } = mergeServerDetail({
      detail: detail(),
      phases: [],
      members: [
        { userId: 5, name: "홍길동", actor: "pm", assignedTaskCount: 0 },
        { userId: 11, name: "이개발", actor: "dev", assignedTaskCount: 3 },
        { userId: 40, name: "제조 담당", actor: "deptStaff", assignedTaskCount: 0 },
      ],
      users,
    });
    expect(project.members).toEqual([
      { userId: "server-5", role: "pm" },
      { userId: "server-11", role: "dev" },
    ]);
    expect(project.actors).toEqual(["pm", "biz", "dev"]);
  });

  it("멤버를 받지 못했으면(null) 목록에서 만든 멤버를 둔다", () => {
    const { project } = mergeServerDetail({ detail: detail(), phases: [], members: null, users });
    expect(project.members).toEqual([{ userId: "server-5", role: "pm" }]);
  });

  it("기본 단계 이름이면 진행 단계·게이트 승인자를 쓴다", () => {
    const { project } = mergeServerDetail({
      detail: detail(),
      phases: [
        phase({ id: 1, name: "분석", stage: "analysis", status: "completed" }),
        phase({ id: 2, name: "설계", stage: "design", order: 2, status: "inProgress", gateApproverUserId: 21, gateApproverName: "김현업" }),
      ],
      members: [],
      users,
    });
    expect(project).toMatchObject({ stage: "design", serverStageKnown: true, gateApprovers: { design: "server-21" } });
  });

  it("사용자 정의 단계만 있으면 고정 단계를 모르는 것으로 둔다", () => {
    const { project } = mergeServerDetail({
      detail: detail(),
      phases: [phase({ name: "고객 검수", stage: null, status: "inProgress" })],
      members: [],
      users,
    });
    expect(project.serverStageKnown).toBe(false);
    expect(project.gateApprovers).toEqual({});
  });

  it("단계가 없는 프로젝트(빈 배열)도 오류 없이 반영한다", () => {
    const { project } = mergeServerDetail({ detail: detail({ methodology: "none" }), phases: [], members: [], users });
    expect(project).toMatchObject({ method: "none", serverStageKnown: false, stage: "analysis" });
  });
});
