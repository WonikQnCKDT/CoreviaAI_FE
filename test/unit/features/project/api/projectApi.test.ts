import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  assignedTasksOf,
  changeProjectMemberRole,
  checkProjectCode,
  createProject,
  createProjectPhase,
  deleteProjectPhase,
  fetchAllProjectMembers,
  fetchCreationOptions,
  fetchMemberHistories,
  fetchProjectDetail,
  fetchProjectPhases,
  fetchProjects,
  fetchRiskOverloads,
  inviteProjectMembers,
  removeProjectMember,
  renameProjectPhase,
  reorderProjectPhases,
  type NewProjectInput,
} from "@/features/project/api/projectApi";
import { creationOptionsDto } from "@test/support/projectFixtures";

const ok = (response: unknown) => new Response(JSON.stringify({ success: true, response, error: null }), { status: 200 });

const fail = (status: number, message: string, response: unknown = null) =>
  new Response(JSON.stringify({ success: false, response, error: { message, status } }), { status });

/** 03 v9 명세의 ProjectSummaryResponse */
const summaryDto = (overrides: Record<string, unknown> = {}) => ({
  id: 1,
  code: "PUR-2026",
  name: "구매 발주 시스템 구축",
  status: "PLANNED",
  template: "IT_PROJECT",
  methodology: "WATERFALL",
  visibility: "COMPANY",
  departments: [
    { id: 2, name: "개발팀" },
    { id: 3, name: "구매팀" },
  ],
  pms: [
    { id: 5, name: "홍길동" },
    { id: 11, name: "이개발" },
  ],
  startDate: "2026-12-01",
  endDate: null,
  createdAt: "2026-11-22T01:30:00Z",
  ...overrides,
});

const detailDto = (overrides: Record<string, unknown> = {}) => ({
  ...summaryDto(),
  departmentType: "SW",
  createdBy: 5,
  actors: ["PM", "BUSINESS_OWNER", "DEVELOPER"],
  features: ["WBS", "KANBAN", "DELIVERABLE"],
  progress: 37,
  updatedAt: "2026-11-22T01:30:00Z",
  version: 3,
  ...overrides,
});

const fetchMock = vi.fn<typeof fetch>();

const lastRequest = () => {
  const [url, init] = fetchMock.mock.calls.at(-1) ?? [];
  return {
    raw: String(url),
    url: new URL(String(url), "http://localhost"),
    method: init?.method,
    body: init?.body ? JSON.parse(String(init.body)) : undefined,
  };
};

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
  vi.stubGlobal("window", globalThis);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("목록·상세", () => {
  it("목록은 복수 부서·복수 PM·빈 기간을 그대로 바꾼다", async () => {
    fetchMock.mockResolvedValue(ok({ items: [summaryDto()], nextCursor: null, hasNext: false }));
    const result = await fetchProjects({});
    expect(result.ok === true && result.data.items[0]).toEqual({
      id: 1,
      code: "PUR-2026",
      name: "구매 발주 시스템 구축",
      status: "planned",
      template: "itProject",
      methodology: "waterfall",
      visibility: "company",
      departments: [
        { id: 2, name: "개발팀" },
        { id: 3, name: "구매팀" },
      ],
      pms: [
        { id: 5, name: "홍길동" },
        { id: 11, name: "이개발" },
      ],
      startDate: "2026-12-01",
      endDate: null,
      createdAt: "2026-11-22T01:30:00Z",
    });
  });

  it("목록 필터를 서버 값으로 보내고 빈 값은 보내지 않는다", async () => {
    fetchMock.mockResolvedValue(ok({ items: [], nextCursor: null, hasNext: false }));
    await fetchProjects({ status: "inProgress", departmentId: 3, pmUserId: null });
    expect(Object.fromEntries(lastRequest().url.searchParams)).toEqual({ size: "100", status: "IN_PROGRESS", departmentId: "3" });
  });

  it("단계 없음(NONE)·주관 부서 0개·PM 없음도 바꾼다", async () => {
    fetchMock.mockResolvedValue(
      ok({ items: [summaryDto({ methodology: "NONE", template: "EMPTY", departments: [], pms: [], startDate: null })], nextCursor: null, hasNext: false }),
    );
    const result = await fetchProjects({});
    expect(result.ok === true && result.data.items[0]).toMatchObject({
      methodology: "none",
      template: "empty",
      departments: [],
      pms: [],
      startDate: null,
    });
  });

  it("모르는 운영 방식은 단계 없음, 모르는 공개 범위는 가장 좁은 범위로 본다", async () => {
    fetchMock.mockResolvedValue(ok({ items: [summaryDto({ methodology: "KANBAN_ONLY", visibility: "PUBLIC" })], nextCursor: null, hasNext: false }));
    const result = await fetchProjects({});
    expect(result.ok === true && result.data.items[0]).toMatchObject({ methodology: "none", visibility: "members" });
  });

  it("상세는 기능·진척률·version을 담고, 모르는 기능·액터는 뺀다", async () => {
    fetchMock.mockResolvedValue(ok(detailDto({ features: ["WBS", "AI_MAGIC"], actors: ["PM", "ROBOT"] })));
    const result = await fetchProjectDetail({ projectId: 1 });
    expect(lastRequest().url.pathname).toBe("/api/projects/1");
    expect(result.ok === true && result.data).toMatchObject({
      departmentType: "sw",
      createdBy: 5,
      actors: ["pm"],
      features: ["wbs"],
      progress: 37,
      version: 3,
    });
  });

  it("없거나 볼 수 없는 프로젝트는 404 실패", async () => {
    fetchMock.mockResolvedValue(fail(404, "프로젝트를 찾을 수 없습니다"));
    expect(await fetchProjectDetail({ projectId: 9 })).toMatchObject({ ok: false, failure: { status: 404 } });
  });
});

describe("단계 (사용자 정의 단계)", () => {
  it("단계 순서로 정렬하고, 기본 폭포수 이름만 고정 단계 키로 바꾼다", async () => {
    fetchMock.mockResolvedValue(
      ok([
        { id: 2, name: "설계", phaseOrder: 2, progress: 0, status: "NOT_STARTED", gateStatus: "PENDING", gateApproverUserId: null, gateApproverName: null },
        { id: 1, name: " 분석 ", phaseOrder: 1, progress: 50, status: "IN_PROGRESS", gateStatus: "PENDING", gateApproverUserId: 21, gateApproverName: "김현업" },
        { id: 3, name: "고객 검수", phaseOrder: 3, progress: 0, status: "NOT_STARTED", gateStatus: "PENDING", gateApproverUserId: null, gateApproverName: null },
      ]),
    );
    const result = await fetchProjectPhases({ projectId: 1 });
    expect(result.ok === true && result.data.map(({ id, name, stage, progress }) => ({ id, name, stage, progress }))).toEqual([
      { id: 1, name: "분석", stage: "analysis", progress: 50 },
      { id: 2, name: "설계", stage: "design", progress: 0 },
      { id: 3, name: "고객 검수", stage: null, progress: 0 },
    ]);
  });

  it("단계가 없으면 빈 배열이다", async () => {
    fetchMock.mockResolvedValue(ok([]));
    expect(await fetchProjectPhases({ projectId: 1 })).toEqual({ ok: true, data: [] });
  });

  it("단계 추가·이름 변경·순서 변경·삭제 경로와 본문", async () => {
    fetchMock.mockImplementation(async () =>
      ok({ id: 7, name: "검수", phaseOrder: 6, progress: 0, status: "NOT_STARTED", gateStatus: "PENDING", gateApproverUserId: null, gateApproverName: null }),
    );
    await createProjectPhase({ projectId: 1, name: " 검수 " });
    expect(lastRequest()).toMatchObject({ method: "POST", body: { name: "검수" } });
    expect(lastRequest().url.pathname).toBe("/api/projects/1/phases");
    await renameProjectPhase({ projectId: 1, phaseId: 7, name: "최종 검수" });
    expect(lastRequest()).toMatchObject({ method: "PATCH", body: { name: "최종 검수" } });
    expect(lastRequest().url.pathname).toBe("/api/projects/1/phases/7");
    await reorderProjectPhases({ projectId: 1, phaseIds: [7, 1, 2] });
    expect(lastRequest()).toMatchObject({ method: "PUT", body: { phaseIds: [7, 1, 2] } });
    expect(lastRequest().url.pathname).toBe("/api/projects/1/phases/order");
    await deleteProjectPhase({ projectId: 1, phaseId: 7 });
    expect(lastRequest().method).toBe("DELETE");
  });

  it("WBS 작업이 연결된 단계 삭제는 409", async () => {
    fetchMock.mockResolvedValue(fail(409, "WBS 작업이 연결된 단계는 삭제할 수 없습니다"));
    expect(await deleteProjectPhase({ projectId: 1, phaseId: 1 })).toMatchObject({ ok: false, failure: { status: 409 } });
  });
});

describe("생성", () => {
  const input = (overrides: Partial<NewProjectInput> = {}): NewProjectInput => ({
    name: " 구매 발주 시스템 구축 ",
    code: " pur-2026 ",
    startDate: "2026-12-01",
    endDate: "",
    departmentIds: [2, 3, 2],
    visibility: "company",
    template: "itProject",
    methodology: "waterfall",
    departmentType: "sw",
    actors: ["pm", "biz", "dev", "dev"],
    features: ["wbs", "kanban", "deliverable"],
    members: [{ userId: 11, actor: "dev" }],
    gateApproverUserId: null,
    ...overrides,
  });

  it("명세 형식으로 보낸다: 대문자 코드, 빈 종료일 null, 중복 부서·액터 제거, 단계 생략은 템플릿 기본값", async () => {
    fetchMock.mockResolvedValue(ok(detailDto()));
    await createProject({ input: input() });
    expect(lastRequest()).toMatchObject({ method: "POST" });
    expect(lastRequest().body).toEqual({
      name: "구매 발주 시스템 구축",
      code: "PUR-2026",
      startDate: "2026-12-01",
      endDate: null,
      departmentIds: [2, 3],
      visibility: "COMPANY",
      template: "IT_PROJECT",
      methodology: "WATERFALL",
      departmentType: "SW",
      actors: ["PM", "BUSINESS_OWNER", "DEVELOPER"],
      features: ["WBS", "KANBAN", "DELIVERABLE"],
      members: [{ userId: 11, actor: "DEVELOPER" }],
      gateApproverUserId: null,
    });
  });

  it("단계 빈 배열은 단계 없음, 문자열 배열은 사용자 정의 단계로 보낸다", async () => {
    fetchMock.mockImplementation(async () => ok(detailDto()));
    await createProject({ input: input({ methodology: "none", phases: [] }) });
    expect(lastRequest().body.phases).toEqual([]);
    await createProject({ input: input({ phases: [" 기획 ", "개발"] }) });
    expect(lastRequest().body.phases).toEqual(["기획", "개발"]);
  });

  it("코드 중복은 409", async () => {
    fetchMock.mockResolvedValue(fail(409, "이미 사용 중인 프로젝트 코드입니다"));
    expect(await createProject({ input: input() })).toMatchObject({ ok: false, failure: { status: 409 } });
  });

  it("코드 중복 확인은 앞뒤 공백을 지워 보내고 정규화된 코드를 받는다", async () => {
    fetchMock.mockResolvedValue(ok({ code: "ERP-2026", available: true }));
    expect(await checkProjectCode({ code: " erp-2026 " })).toEqual({ ok: true, data: { code: "ERP-2026", available: true } });
    expect(lastRequest().url.searchParams.get("code")).toBe("erp-2026");
  });

  it("생성 선택지: 실제 BE 응답(기본 시드)을 화면 모델로 바꾸고 기능은 enabled·requiresPhases를 그대로 담는다", async () => {
    fetchMock.mockResolvedValue(ok(creationOptionsDto()));
    const result = await fetchCreationOptions();
    expect(lastRequest().url.pathname).toBe("/api/projects/creation-options");
    expect(result.ok === true && result.data).toEqual({
      templates: [
        { value: "empty", defaultMethodology: "none", defaultActors: ["pm"], defaultFeatures: ["kanban", "board", "meeting", "issue", "file"], defaultPhases: [] },
        {
          value: "itProject",
          defaultMethodology: "waterfall",
          defaultActors: ["pm", "biz", "dev", "qa"],
          defaultFeatures: ["wbs", "kanban", "board", "meeting", "deliverable", "issue", "file"],
          defaultPhases: ["분석", "설계", "개발", "테스트", "이행"],
        },
      ],
      methodologies: [
        { value: "none", enabled: true },
        { value: "waterfall", enabled: true },
        { value: "agile", enabled: false },
      ],
      departmentTypes: [
        {
          value: "sw",
          enabled: true,
          actors: [
            { value: "pm", enabled: true, required: true },
            { value: "biz", enabled: true, required: false },
            { value: "dev", enabled: true, required: false },
            { value: "qa", enabled: true, required: false },
          ],
        },
        {
          value: "manufacturing",
          enabled: false,
          actors: [
            { value: "pm", enabled: false, required: true },
            { value: "deptStaff", enabled: false, required: false },
            { value: "customerLiaison", enabled: false, required: false },
          ],
        },
      ],
      features: [
        { value: "wbs", enabled: true, requiresPhases: false },
        { value: "kanban", enabled: true, requiresPhases: false },
        { value: "board", enabled: true, requiresPhases: false },
        { value: "meeting", enabled: true, requiresPhases: false },
        { value: "deliverable", enabled: true, requiresPhases: true },
        { value: "issue", enabled: true, requiresPhases: false },
        { value: "file", enabled: true, requiresPhases: false },
        { value: "git", enabled: false, requiresPhases: false },
      ],
    });
  });

  it("회귀(SCRUM-98): 실제 BE 응답의 기능이 하나도 걸러지지 않는다", async () => {
    fetchMock.mockResolvedValue(ok(creationOptionsDto()));
    const result = await fetchCreationOptions();
    expect(result.ok === true && result.data.features).toHaveLength(creationOptionsDto().features.length);
  });

  it("생성 선택지의 모르는 값은 빼고, requiresPhases가 없는 기능은 단계가 필요하다고 본다", async () => {
    const dto = creationOptionsDto();
    fetchMock.mockResolvedValue(
      ok({
        ...dto,
        templates: [...dto.templates, { ...dto.templates[0], value: "MYSTERY" }],
        methodologies: [...dto.methodologies, { value: "SCRUM", enabled: true }],
        features: [{ value: "AI_MAGIC", enabled: true, requiresPhases: false }, { value: "WBS", enabled: true }],
      }),
    );
    const result = await fetchCreationOptions();
    expect(result.ok === true && result.data.templates.map(({ value }) => value)).toEqual(["empty", "itProject"]);
    expect(result.ok === true && result.data.methodologies.map(({ value }) => value)).toEqual(["none", "waterfall", "agile"]);
    expect(result.ok === true && result.data.features).toEqual([{ value: "wbs", enabled: true, requiresPhases: true }]);
  });

  it("생성 선택지 응답이 비어 있으면 빈 목록", async () => {
    fetchMock.mockResolvedValue(ok({ templates: null, methodologies: [], departmentTypes: [], features: null }));
    const result = await fetchCreationOptions();
    expect(result.ok === true && result.data).toEqual({ templates: [], methodologies: [], departmentTypes: [], features: [] });
  });
});

describe("멤버", () => {
  it("멤버 목록을 끝까지 이어 받고 담당 업무 수를 담는다", async () => {
    fetchMock
      .mockImplementationOnce(async () => ok({ items: [{ userId: 5, name: "홍길동", actor: "PM", assignedTaskCount: 2 }], nextCursor: "c1", hasNext: true }))
      .mockImplementationOnce(async () => ok({ items: [{ userId: 11, name: "이개발", actor: "DEVELOPER", assignedTaskCount: 0 }], nextCursor: null, hasNext: false }));
    const result = await fetchAllProjectMembers({ projectId: 1 });
    expect(lastRequest().url.pathname).toBe("/api/projects/1/members");
    expect(lastRequest().url.searchParams.get("cursor")).toBe("c1");
    expect(result).toEqual({
      ok: true,
      data: [
        { userId: 5, name: "홍길동", actor: "pm", assignedTaskCount: 2 },
        { userId: 11, name: "이개발", actor: "dev", assignedTaskCount: 0 },
      ],
    });
  });

  it("초대·역할 변경은 서버 액터로 보낸다", async () => {
    fetchMock.mockImplementation(async () => ok([{ userId: 31, name: "박품질", actor: "QA", assignedTaskCount: 0 }]));
    const invited = await inviteProjectMembers({ projectId: 1, members: [{ userId: 31, actor: "qa" }] });
    expect(lastRequest()).toMatchObject({ method: "POST", body: { members: [{ userId: 31, actor: "QA" }] } });
    expect(invited.ok === true && invited.data).toEqual([{ userId: 31, name: "박품질", actor: "qa", assignedTaskCount: 0 }]);

    fetchMock.mockImplementation(async () => ok({ userId: 31, name: "박품질", actor: "PM", assignedTaskCount: 0 }));
    const changed = await changeProjectMemberRole({ projectId: 1, userId: 31, actor: "pm" });
    expect(lastRequest()).toMatchObject({ method: "PATCH", body: { actor: "PM" } });
    expect(lastRequest().url.pathname).toBe("/api/projects/1/members/31/role");
    expect(changed.ok === true && changed.data).toMatchObject({ actor: "pm" });
  });

  it("마지막 PM 해제는 409", async () => {
    fetchMock.mockResolvedValue(fail(409, "프로젝트에는 PM이 1명 이상 있어야 합니다"));
    expect(await changeProjectMemberRole({ projectId: 1, userId: 5, actor: "dev" })).toMatchObject({ ok: false, failure: { status: 409 } });
  });

  it("제외 409(미완료 담당 업무)는 재배정할 업무 목록을 함께 받는다 (C안)", async () => {
    fetchMock.mockResolvedValue(
      fail(409, "담당 중인 업무가 있어 제외할 수 없습니다", [
        { taskId: 42, title: "미완료 담당 업무", status: "TODO" },
        { taskId: 43, title: "검토 중", status: "REVIEW" },
        { taskId: "x", title: "형식 오류", status: "TODO" },
        { taskId: 44, title: "완료는 오지 않음", status: "DONE" },
      ]),
    );
    const result = await removeProjectMember({ projectId: 1, userId: 11 });
    expect(lastRequest()).toMatchObject({ method: "DELETE" });
    expect(lastRequest().url.pathname).toBe("/api/projects/1/members/11");
    expect(result.ok).toBe(false);
    expect(result.ok === false && assignedTasksOf(result.failure)).toEqual([
      { taskId: 42, title: "미완료 담당 업무", status: "todo" },
      { taskId: 43, title: "검토 중", status: "review" },
    ]);
  });

  it("다른 실패에는 재배정 목록이 없다", async () => {
    fetchMock.mockResolvedValue(fail(409, "게이트 승인자는 멤버에서 제외할 수 없습니다"));
    const result = await removeProjectMember({ projectId: 1, userId: 21 });
    expect(result.ok === false && assignedTasksOf(result.failure)).toEqual([]);
    expect(result.ok === false && result.failure).not.toHaveProperty("data");
    expect(assignedTasksOf({ kind: "network" })).toEqual([]);
  });

  it("멤버 이력은 변경 유형·전후 역할을 바꾸고 모르는 유형은 원래 값으로 둔다", async () => {
    fetchMock.mockResolvedValue(
      ok({
        items: [
          { id: 9, userId: 11, userName: "이개발", changeType: "PM_ADDED", beforeActor: "DEVELOPER", afterActor: "PM", changedBy: 5, changedByName: "홍길동", occurredAt: "2026-11-23T00:00:00Z" },
          { id: 8, userId: 31, userName: "박품질", changeType: "INVITED", beforeActor: null, afterActor: "QA", changedBy: 5, changedByName: "홍길동", occurredAt: "2026-11-22T00:00:00Z" },
          { id: 7, userId: 31, userName: "박품질", changeType: "FUTURE_TYPE", beforeActor: null, afterActor: null, changedBy: 1, changedByName: "관리자", occurredAt: "2026-11-21T00:00:00Z" },
        ],
        nextCursor: null,
        hasNext: false,
      }),
    );
    const result = await fetchMemberHistories({ projectId: 1 });
    expect(lastRequest().url.pathname).toBe("/api/projects/1/members/histories");
    expect(result.ok === true && result.data.items.map(({ changeType, beforeActor, afterActor }) => ({ changeType, beforeActor, afterActor }))).toEqual([
      { changeType: "pmAdded", beforeActor: "dev", afterActor: "pm" },
      { changeType: "invited", beforeActor: null, afterActor: "qa" },
      { changeType: "FUTURE_TYPE", beforeActor: null, afterActor: null },
    ]);
  });
});

describe("인력 편중 (FR-AIR-03)", () => {
  it("담당자 범위 결과를 바꾼다", async () => {
    fetchMock.mockResolvedValue(
      ok({ scope: "ASSIGNEES", thresholdPercent: 100, runDate: "2026-11-26", assignees: [{ userId: 7, name: "홍길동", allocationPercent: 120, allocatedEffort: 6, availableDays: 5 }], departments: [] }),
    );
    const result = await fetchRiskOverloads({ projectId: 1 });
    expect(lastRequest().url.pathname).toBe("/api/projects/1/risk-overloads");
    expect(result.ok === true && result.data).toEqual({
      scope: "assignees",
      thresholdPercent: 100,
      runDate: "2026-11-26",
      assignees: [{ userId: 7, name: "홍길동", allocationPercent: 120, allocatedEffort: 6, availableDays: 5 }],
      departments: [],
    });
  });

  it("배치 결과가 없으면 runDate null과 빈 목록, 소속 없는 부서는 departmentId null", async () => {
    fetchMock.mockResolvedValue(
      ok({ scope: "DEPARTMENTS", thresholdPercent: 120, runDate: null, assignees: [], departments: [{ departmentId: null, name: "소속 없음", overloadedCount: 2 }] }),
    );
    const result = await fetchRiskOverloads({ projectId: 1 });
    expect(result.ok === true && result.data).toMatchObject({ scope: "departments", runDate: null, departments: [{ departmentId: null, overloadedCount: 2 }] });
  });

  it("허용되지 않은 프로젝트 역할은 403", async () => {
    fetchMock.mockResolvedValue(fail(403, "인력 편중 정보를 볼 수 없습니다"));
    expect(await fetchRiskOverloads({ projectId: 1 })).toMatchObject({ ok: false, failure: { status: 403 } });
  });
});
