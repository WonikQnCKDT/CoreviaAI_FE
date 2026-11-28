// @vitest-environment jsdom
import { useEffect, useState, type ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, screen, waitFor, within } from "@testing-library/react";
import WbsPage from "@/pages/project-detail/wbs";
import WbsDraftPage from "@/pages/project-detail/wbs-draft";
import { useDemoStore } from "@/stores/DemoStore";
import { MILESTONE_TEXT, WBS_DRAFT_TEXT, WBS_FORM_TEXT, WBS_TEXT } from "@/features/wbs/i18n/ko";
import { jsonFail, jsonOk, renderApp, stubFetch } from "@test/support/appHarness";
import type { ServerProjectDetail } from "@/features/project/api/projectApi";

/** 로그인 사용자(fakeAuth api)는 서버 사용자 5 */
const ME = 5;

const detail: ServerProjectDetail = {
  id: 77,
  code: "PRT-2026-001",
  name: "서버 프로젝트",
  status: "planned",
  template: "itProject",
  methodology: "waterfall",
  visibility: "company",
  departments: [],
  pms: [{ id: 1, name: "김피엠" }],
  startDate: null,
  endDate: null,
  createdAt: "2026-11-26T00:00:00Z",
  departmentType: "sw",
  createdBy: 1,
  actors: ["pm", "dev"],
  features: ["wbs"],
  progress: 0,
  version: 0,
};

const SeedServerProject = ({ children }: { children: ReactNode }) => {
  const { syncServerProjectDetail } = useDemoStore();
  const [ready, setReady] = useState(false);
  useEffect(() => {
    syncServerProjectDetail({ detail, phases: [], members: [] });
    setReady(true);
    // 처음 한 번만 넣는다.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return ready ? <>{children}</> : null;
};

const task = (overrides: Record<string, unknown> = {}) => ({
  id: 101,
  phaseId: 1,
  parentTaskId: null,
  sortOrder: 1,
  name: "요구사항 분석",
  description: null,
  assignee: { id: 11, name: "이개발" },
  startDate: "2026-12-01",
  endDate: "2026-12-10",
  scheduleDerived: false,
  estimatedEffort: 3,
  taskType: "TASK",
  priority: "MEDIUM",
  progress: 0,
  status: "TODO",
  source: "MANUAL",
  version: 2,
  subtasks: [],
  ...overrides,
});

const phase = (id: number, name: string, order: number) => ({
  id,
  name,
  phaseOrder: order,
  progress: 0,
  status: "NOT_STARTED",
  gateStatus: "PENDING",
  gateApproverUserId: null,
  gateApproverName: null,
});

const members = (myActor: string) => ({
  items: [
    { userId: ME, name: "홍길동", actor: myActor, assignedTaskCount: 0 },
    { userId: 11, name: "이개발", actor: "DEVELOPER", assignedTaskCount: 1 },
  ],
  nextCursor: null,
  hasNext: false,
});

const baseHandlers = (myActor: string, tree: unknown[] = [task()]) => ({
  "GET /api/projects/77/wbs/tasks": () => jsonOk({ tasks: tree }),
  "GET /api/projects/77/phases": () => jsonOk([phase(1, "분석", 1), phase(2, "설계", 2)]),
  "GET /api/projects/77/members": () => jsonOk(members(myActor)),
  "GET /api/projects/77/wbs/milestones": () => jsonOk({ milestones: [] }),
});

/** BE MilestoneResponse 모양 그대로 */
const milestone = (overrides: Record<string, unknown> = {}) => ({
  id: 31,
  name: "분석 단계 종료",
  targetDate: "2026-12-10",
  source: "MANUAL",
  dDay: 3,
  delayed: false,
  linkedTaskCount: 1,
  incompleteTaskCount: 1,
  tasks: [{ id: 101, parentTaskId: null, name: "요구사항 분석", status: "TODO", endDate: "2026-12-10" }],
  version: 4,
  ...overrides,
});

const ROUTES = [
  { path: "/projects/:projectId/wbs", element: <WbsPage /> },
  { path: "/projects/:projectId/wbs/draft", element: <WbsDraftPage /> },
];

const renderServer = (route = "/projects/77/wbs") =>
  renderApp({ mode: "api", route, routes: ROUTES, wrap: (tree) => <SeedServerProject>{tree}</SeedServerProject> });

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("api 모드 WBS (서버 프로젝트)", () => {
  it("서버 트리를 단계별로 보여 준다", async () => {
    renderServerWith(baseHandlers("PM", [task(), task({ id: 102, phaseId: 2, name: "API 설계", assignee: null })]));
    const analysis = await screen.findByRole("region", { name: "분석" });
    expect(within(analysis).getByText("요구사항 분석")).toBeTruthy();
    expect(within(screen.getByRole("region", { name: "설계" })).getByText("API 설계")).toBeTruthy();
  });

  it("PM이 작업을 추가하면 서버에 보내고, 응답 트리로 다시 그린 뒤 성공을 알린다", async () => {
    const { calls } = renderServerWith({
      ...baseHandlers("PM"),
      "POST /api/projects/77/wbs/tasks": () => jsonOk({ taskId: 103, tasks: [task(), task({ id: 103, phaseId: 2, name: "DB 설계", assignee: null })] }),
    });
    const design = await screen.findByRole("region", { name: "설계" });
    fireEvent.click(within(design).getByRole("button", { name: WBS_TEXT.addTask }));
    const dialog = screen.getByRole("dialog");
    const inputs = within(dialog).getAllByRole("textbox");
    fireEvent.change(inputs[0], { target: { value: "DB 설계" } });
    const dates = dialog.querySelectorAll('input[type="date"]');
    fireEvent.change(dates[0], { target: { value: "2026-12-11" } });
    fireEvent.change(dates[1], { target: { value: "2026-12-15" } });
    fireEvent.click(within(dialog).getByRole("button", { name: WBS_FORM_TEXT.submit }));

    expect(await screen.findByText("'DB 설계'을(를) 등록했습니다.")).toBeTruthy();
    expect(within(screen.getByRole("region", { name: "설계" })).getByText("DB 설계")).toBeTruthy();
    expect(calls.find((c) => c.method === "POST")?.body).toEqual({
      name: "DB 설계",
      description: null,
      assigneeUserId: null,
      startDate: "2026-12-11",
      endDate: "2026-12-15",
      estimatedEffort: null,
      parentTaskId: null,
      phaseId: 2,
    });
  });

  it("입력이 잘못되면 서버에 보내지 않는다(시작일 > 종료일)", async () => {
    const { calls } = renderServerWith(baseHandlers("PM"));
    const analysis = await screen.findByRole("region", { name: "분석" });
    fireEvent.click(within(analysis).getByRole("button", { name: WBS_TEXT.addTask }));
    const dialog = screen.getByRole("dialog");
    fireEvent.change(within(dialog).getAllByRole("textbox")[0], { target: { value: "역순" } });
    const dates = dialog.querySelectorAll('input[type="date"]');
    fireEvent.change(dates[0], { target: { value: "2026-12-15" } });
    fireEvent.change(dates[1], { target: { value: "2026-12-11" } });
    fireEvent.click(within(dialog).getByRole("button", { name: WBS_FORM_TEXT.submit }));
    expect(within(dialog).getByRole("alert").textContent).toBe(WBS_FORM_TEXT.dateOrder);
    expect(calls.some((c) => c.method === "POST")).toBe(false);
  });

  it("수정이 409(다른 사용자가 먼저 수정)면 화면을 바꾸지 않고 최신 트리를 다시 받는다", async () => {
    let treeCalls = 0;
    const { calls } = renderServerWith({
      ...baseHandlers("PM"),
      "GET /api/projects/77/wbs/tasks": () => {
        treeCalls += 1;
        return jsonOk({ tasks: [task({ name: treeCalls > 1 ? "남이 고친 이름" : "요구사항 분석" })] });
      },
      "PATCH /api/projects/77/wbs/tasks/101": () => jsonFail(409, "다른 사용자가 먼저 수정했습니다. 새로고침한 뒤 다시 시도해 주세요"),
    });
    fireEvent.click(await screen.findByRole("button", { name: `${WBS_TEXT.edit}: 요구사항 분석` }));
    const dialog = screen.getByRole("dialog");
    fireEvent.change(within(dialog).getAllByRole("textbox")[0], { target: { value: "내가 고친 이름" } });
    fireEvent.click(within(dialog).getByRole("button", { name: WBS_FORM_TEXT.submit }));

    expect(await screen.findByText(WBS_TEXT.concurrent)).toBeTruthy();
    expect(await screen.findByText("남이 고친 이름")).toBeTruthy();
    expect(screen.queryByText("내가 고친 이름")).toBeNull();
    expect(calls.find((c) => c.method === "PATCH")?.body).toMatchObject({ version: 2, phaseId: 1, name: "내가 고친 이름" });
  });

  it("삭제가 409(연결 있음)면 이유를 보여 주고 항목은 남는다", async () => {
    vi.spyOn(window, "confirm").mockReturnValue(true);
    renderServerWith({
      ...baseHandlers("PM"),
      "DELETE /api/projects/77/wbs/tasks/101": () => jsonFail(409, "하위작업·선후행 관계·마일스톤 연결이 있는 작업은 삭제할 수 없습니다"),
    });
    fireEvent.click(await screen.findByRole("button", { name: `${WBS_TEXT.delete}: 요구사항 분석` }));
    expect(await screen.findByText(WBS_TEXT.inUse)).toBeTruthy();
    expect(screen.getByText("요구사항 분석")).toBeTruthy();
  });

  it("삭제 확인을 취소하면 요청하지 않는다", async () => {
    vi.spyOn(window, "confirm").mockReturnValue(false);
    const { calls } = renderServerWith(baseHandlers("PM"));
    fireEvent.click(await screen.findByRole("button", { name: `${WBS_TEXT.delete}: 요구사항 분석` }));
    expect(calls.some((c) => c.method === "DELETE")).toBe(false);
  });

  it("개발자는 작업 추가·이동·삭제 버튼이 없고, 본인 담당이 아닌 항목은 수정할 수 없다", async () => {
    renderServerWith(baseHandlers("DEVELOPER", [task({ assignee: { id: ME, name: "홍길동" } }), task({ id: 102, name: "남의 작업" })]));
    await screen.findByText("남의 작업");
    expect(screen.getByText(WBS_TEXT.memberNote)).toBeTruthy();
    expect(screen.queryByRole("button", { name: WBS_TEXT.addTask })).toBeNull();
    expect(screen.queryByRole("button", { name: new RegExp(`${WBS_TEXT.delete}:`) })).toBeNull();
    expect(screen.getByRole("button", { name: `${WBS_TEXT.edit}: 요구사항 분석` })).toBeTruthy();
    expect(screen.getByRole("button", { name: `${WBS_TEXT.addSubtask}: 요구사항 분석` })).toBeTruthy();
    expect(screen.queryByRole("button", { name: `${WBS_TEXT.edit}: 남의 작업` })).toBeNull();
  });

  it("서버가 403을 주면 권한 안내를 보이고 트리를 다시 받는다", async () => {
    let treeCalls = 0;
    renderServerWith({
      ...baseHandlers("DEVELOPER", []),
      "GET /api/projects/77/wbs/tasks": () => {
        treeCalls += 1;
        return jsonOk({ tasks: [task({ assignee: { id: ME, name: "홍길동" } })] });
      },
      "PATCH /api/projects/77/wbs/tasks/101": () => jsonFail(403, "본인이 담당한 작업만 수정하거나 하위작업을 추가할 수 있습니다"),
    });
    fireEvent.click(await screen.findByRole("button", { name: `${WBS_TEXT.edit}: 요구사항 분석` }));
    fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: WBS_FORM_TEXT.submit }));
    expect(await screen.findByText(WBS_TEXT.forbidden)).toBeTruthy();
    await waitFor(() => expect(treeCalls).toBe(2));
  });

  it("진척률 저장은 진척률 API로 보내고 트리를 다시 받는다", async () => {
    const { calls } = renderServerWith({
      ...baseHandlers("PM"),
      "PATCH /api/projects/77/tasks/101/progress": () => jsonOk({ id: 101, progress: 40, status: "IN_PROGRESS", version: 3 }),
    });
    fireEvent.click(await screen.findByRole("button", { name: `${WBS_TEXT.editProgress}: 요구사항 분석` }));
    const dialog = screen.getByRole("dialog");
    fireEvent.change(within(dialog).getByRole("spinbutton"), { target: { value: "40" } });
    fireEvent.click(within(dialog).getByRole("button", { name: WBS_FORM_TEXT.submit }));
    expect(await screen.findByText("진척률을 40%로 저장했습니다.")).toBeTruthy();
    expect(calls.find((c) => c.path === "/api/projects/77/tasks/101/progress")?.body).toEqual({ progress: 40, version: 2 });
    expect(calls.filter((c) => c.path === "/api/projects/77/wbs/tasks" && c.method === "GET")).toHaveLength(2);
  });

  it("WBS 기능이 꺼졌으면(404) 사용할 수 없다고 안내한다", async () => {
    renderServerWith({ ...baseHandlers("PM"), "GET /api/projects/77/wbs/tasks": () => jsonFail(404, "이 프로젝트에서 사용하지 않는 기능입니다") });
    expect(await screen.findByText(WBS_TEXT.unavailable)).toBeTruthy();
  });

  it("조회가 실패하면 오류와 다시 시도를 보여 준다", async () => {
    renderServerWith({ ...baseHandlers("PM"), "GET /api/projects/77/wbs/tasks": () => jsonFail(500, "서버 오류") });
    expect(await screen.findByText(WBS_TEXT.loadFailed)).toBeTruthy();
    expect(screen.getByRole("button", { name: WBS_TEXT.retry })).toBeTruthy();
  });
});

describe("api 모드 AI WBS 초안", () => {
  const draftResponse = {
    status: "AI_DRAFT",
    draftToken: "secret-token",
    expiresAt: "2026-11-27T01:00:00Z",
    stages: [
      {
        phaseId: 1,
        phaseName: "분석",
        tasks: [
          { tempId: "T-001", name: "요구사항 정리", description: null, estimatedPersonDays: 2, suggestedAssigneeId: 999, suggestedRole: null, startDate: "2026-12-01", endDate: "2026-12-03", dependencies: [], subtasks: [], reason: null },
          { tempId: "T-002", name: "현행 분석", description: null, estimatedPersonDays: 1, suggestedAssigneeId: null, suggestedRole: null, startDate: "2026-12-04", endDate: "2026-12-05", dependencies: ["T-001"], subtasks: [], reason: null },
        ],
      },
    ],
    milestones: [],
    feasibility: null,
    warnings: [],
    suggestions: [],
    assumptions: [],
    clarificationQuestions: [],
  };

  const fillPurposeAndGenerate = () => {
    fireEvent.change(screen.getByLabelText(WBS_DRAFT_TEXT.purpose), { target: { value: "구매 발주를 전산화한다" } });
    fireEvent.click(screen.getByRole("button", { name: new RegExp(WBS_DRAFT_TEXT.generate) }));
  };

  it("AI가 아직 준비되지 않았으면(503) 그 이유를 보여 준다", async () => {
    renderServerWith({ ...baseHandlers("PM"), "POST /api/projects/77/wbs/ai-draft": () => jsonFail(503, "AI 기능을 준비 중입니다") }, "/projects/77/wbs/draft");
    await screen.findByLabelText(WBS_DRAFT_TEXT.purpose);
    fillPurposeAndGenerate();
    expect(await screen.findByText(WBS_DRAFT_TEXT.aiUnavailable)).toBeTruthy();
  });

  it("고른 작업만 반영하고, 멤버가 아닌 담당 제안은 보내지 않으며, 토큰을 저장소에 남기지 않는다", async () => {
    const { calls } = renderServerWith(
      {
        ...baseHandlers("PM"),
        "POST /api/projects/77/wbs/ai-draft": () => jsonOk(draftResponse),
        "POST /api/projects/77/wbs/ai-draft/apply": () => jsonOk({ taskIds: { "T-001": 201 }, milestoneIds: {} }),
      },
      "/projects/77/wbs/draft",
    );
    await screen.findByLabelText(WBS_DRAFT_TEXT.purpose);
    fillPurposeAndGenerate();
    fireEvent.click(await screen.findByRole("checkbox", { name: "요구사항 정리" }));
    fireEvent.click(screen.getByRole("button", { name: WBS_DRAFT_TEXT.apply }));

    expect(await screen.findByText("작업 1건·마일스톤 0건을 WBS에 반영했습니다.")).toBeTruthy();
    const body = calls.find((c) => c.path === "/api/projects/77/wbs/ai-draft/apply")?.body as { tasks: { tempId: string; assigneeUserId: unknown; dependencies: string[] }[]; rejectedCount: number; draftToken: string };
    expect(body.draftToken).toBe("secret-token");
    expect(body.tasks.map((t) => t.tempId)).toEqual(["T-001"]);
    expect(body.tasks[0].assigneeUserId).toBeNull();
    expect(body.rejectedCount).toBe(1);
    expect(JSON.stringify({ ...localStorage })).not.toContain("secret-token");
    expect(JSON.stringify({ ...sessionStorage })).not.toContain("secret-token");
    // 한 번 쓴 토큰은 버린다
    expect(screen.queryByRole("button", { name: WBS_DRAFT_TEXT.apply })).toBeNull();
  });

  it("만료 시각이 비었거나 형식이 틀리면 표시하지 않는다", async () => {
    renderServerWith({ ...baseHandlers("PM"), "POST /api/projects/77/wbs/ai-draft": () => jsonOk({ ...draftResponse, expiresAt: "not-a-date" }) }, "/projects/77/wbs/draft");
    await screen.findByLabelText(WBS_DRAFT_TEXT.purpose);
    fillPurposeAndGenerate();
    await screen.findByRole("checkbox", { name: "요구사항 정리" });
    expect(screen.queryByText(/Invalid Date/)).toBeNull();
  });

  it("아무것도 고르지 않으면 반영 요청을 보내지 않는다", async () => {
    const { calls } = renderServerWith({ ...baseHandlers("PM"), "POST /api/projects/77/wbs/ai-draft": () => jsonOk(draftResponse) }, "/projects/77/wbs/draft");
    await screen.findByLabelText(WBS_DRAFT_TEXT.purpose);
    fillPurposeAndGenerate();
    fireEvent.click(await screen.findByRole("button", { name: WBS_DRAFT_TEXT.apply }));
    expect(await screen.findByText(WBS_DRAFT_TEXT.nothingSelected)).toBeTruthy();
    expect(calls.some((c) => c.path.endsWith("/ai-draft/apply"))).toBe(false);
  });

  it("PM이 아니면 초안 화면을 쓸 수 없다고 안내하고 생성 요청을 보내지 않는다", async () => {
    const { calls } = renderServerWith(baseHandlers("DEVELOPER"), "/projects/77/wbs/draft");
    expect(await screen.findByText(WBS_DRAFT_TEXT.pmOnly)).toBeTruthy();
    expect(calls.some((c) => c.path.endsWith("/ai-draft"))).toBe(false);
  });
});

describe("api 모드 마일스톤 (FR-WBS-04)", () => {
  const milestoneRegion = () => screen.findByRole("region", { name: MILESTONE_TEXT.title });

  it("서버 dDay로 D-day를 표시하고, delayed=true면 지연 배지를 보인다", async () => {
    renderServerWith({
      ...baseHandlers("PM"),
      "GET /api/projects/77/wbs/milestones": () =>
        jsonOk({
          milestones: [
            milestone(),
            milestone({ id: 32, name: "설계 종료", dDay: 0, delayed: true }),
            milestone({ id: 33, name: "오픈", dDay: -2, delayed: false, linkedTaskCount: 0, incompleteTaskCount: 0, tasks: [] }),
          ],
        }),
    });
    const region = await milestoneRegion();
    const rows = await within(region).findAllByRole("row");
    // 머리행 + 3건
    expect(rows).toHaveLength(4);
    expect(within(rows[1]).getByText("D-3")).toBeTruthy();
    expect(within(rows[1]).queryByText(MILESTONE_TEXT.delayed)).toBeNull();
    expect(within(rows[1]).getByText("미완료 1 / 연결 1")).toBeTruthy();
    expect(within(rows[2]).getByText("D-day")).toBeTruthy();
    expect(within(rows[2]).getByText(MILESTONE_TEXT.delayed)).toBeTruthy();
    expect(within(rows[3]).getByText("D+2")).toBeTruthy();
    expect(within(rows[3]).getByText(MILESTONE_TEXT.noTasks)).toBeTruthy();
    // 선후행 관계만 아직 서버와 연결하지 않았다는 안내
    expect(screen.getByText(WBS_TEXT.dependencyNote)).toBeTruthy();
    expect(screen.queryByText(/마일스톤 편집은 아직/)).toBeNull();
  });

  it("마일스톤이 없으면 빈 상태 안내를 보인다", async () => {
    renderServerWith(baseHandlers("PM"));
    const region = await milestoneRegion();
    expect(await within(region).findByText(MILESTONE_TEXT.empty)).toBeTruthy();
    expect(within(region).getByText(MILESTONE_TEXT.emptyHintPm)).toBeTruthy();
  });

  it("조회가 실패하면 오류와 다시 시도를 보이고, 다시 시도하면 다시 받는다", async () => {
    let attempts = 0;
    renderServerWith({
      ...baseHandlers("PM"),
      "GET /api/projects/77/wbs/milestones": () => {
        attempts += 1;
        return attempts === 1 ? jsonFail(500, "서버 오류") : jsonOk({ milestones: [milestone()] });
      },
    });
    const region = await milestoneRegion();
    expect(await within(region).findByText(new RegExp(MILESTONE_TEXT.loadFailed))).toBeTruthy();
    fireEvent.click(within(region).getByRole("button", { name: MILESTONE_TEXT.retry }));
    expect(await within(region).findByText("분석 단계 종료")).toBeTruthy();
  });

  it("개발자는 읽기 전용이다(추가·수정·삭제·연결 버튼 없음)", async () => {
    renderServerWith({ ...baseHandlers("DEVELOPER"), "GET /api/projects/77/wbs/milestones": () => jsonOk({ milestones: [milestone()] }) });
    const region = await milestoneRegion();
    await within(region).findByText("분석 단계 종료");
    expect(within(region).getByText(MILESTONE_TEXT.viewerNote)).toBeTruthy();
    expect(within(region).queryByRole("button", { name: MILESTONE_TEXT.add })).toBeNull();
    expect(within(region).queryByRole("button", { name: new RegExp(`${MILESTONE_TEXT.edit}:`) })).toBeNull();
    expect(within(region).queryByRole("button", { name: new RegExp(`${MILESTONE_TEXT.delete}:`) })).toBeNull();
    expect(within(region).queryByRole("button", { name: new RegExp(`${MILESTONE_TEXT.editTasks}:`) })).toBeNull();
  });

  it("멤버가 아닌 열람자(경영진 등)도 읽기 전용이다", async () => {
    renderServerWith({
      ...baseHandlers("PM"),
      "GET /api/projects/77/members": () => jsonOk({ items: [{ userId: 11, name: "이개발", actor: "DEVELOPER", assignedTaskCount: 1 }], nextCursor: null, hasNext: false }),
      "GET /api/projects/77/wbs/milestones": () => jsonOk({ milestones: [milestone()] }),
    });
    const region = await milestoneRegion();
    await within(region).findByText("분석 단계 종료");
    expect(within(region).queryByRole("button", { name: MILESTONE_TEXT.add })).toBeNull();
  });

  it("PM이 마일스톤을 추가하면 이름·목표일·고른 작업을 보내고 응답을 목록에 넣는다", async () => {
    const { calls } = renderServerWith({
      ...baseHandlers("PM", [task(), task({ id: 102, name: "API 설계", subtasks: [task({ id: 103, parentTaskId: 102, name: "엔드포인트 정의" })] })]),
      "POST /api/projects/77/wbs/milestones": () =>
        jsonOk(milestone({ id: 40, name: "설계 종료", targetDate: "2026-12-20", dDay: 13, tasks: [], linkedTaskCount: 2, incompleteTaskCount: 2, version: 0 })),
    });
    const region = await milestoneRegion();
    fireEvent.click(await within(region).findByRole("button", { name: MILESTONE_TEXT.add }));
    const dialog = screen.getByRole("dialog");
    fireEvent.change(within(dialog).getByLabelText(MILESTONE_TEXT.name), { target: { value: "  설계 종료 " } });
    fireEvent.change(within(dialog).getByLabelText(MILESTONE_TEXT.targetDate), { target: { value: "2026-12-20" } });
    fireEvent.click(within(dialog).getByRole("checkbox", { name: "API 설계" }));
    fireEvent.click(within(dialog).getByRole("checkbox", { name: "엔드포인트 정의" }));
    expect(within(dialog).getByText("2개 선택")).toBeTruthy();
    fireEvent.click(within(dialog).getByRole("button", { name: MILESTONE_TEXT.submit }));

    expect(await screen.findByText("'설계 종료' 마일스톤을 등록했습니다.")).toBeTruthy();
    expect(within(region).getByText("D-13")).toBeTruthy();
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(calls.find((c) => c.method === "POST")?.body).toEqual({ name: "설계 종료", targetDate: "2026-12-20", taskIds: [102, 103] });
  });

  it("이름이 비면 서버에 보내지 않는다", async () => {
    const { calls } = renderServerWith(baseHandlers("PM"));
    const region = await milestoneRegion();
    fireEvent.click(await within(region).findByRole("button", { name: MILESTONE_TEXT.add }));
    const dialog = screen.getByRole("dialog");
    fireEvent.change(within(dialog).getByLabelText(MILESTONE_TEXT.targetDate), { target: { value: "2026-12-20" } });
    fireEvent.click(within(dialog).getByRole("button", { name: MILESTONE_TEXT.submit }));
    expect(within(dialog).getByRole("alert").textContent).toBe(MILESTONE_TEXT.nameRequired);
    expect(calls.some((c) => c.method === "POST")).toBe(false);
  });

  it("등록이 400(목표일이 프로젝트 기간 밖)이면 대화상자에 서버 메시지를 보인다", async () => {
    renderServerWith({
      ...baseHandlers("PM"),
      "POST /api/projects/77/wbs/milestones": () => jsonFail(400, "마일스톤 목표일을 확인해 주세요. 프로젝트 기간이 있으면 그 안이어야 합니다"),
    });
    const region = await milestoneRegion();
    fireEvent.click(await within(region).findByRole("button", { name: MILESTONE_TEXT.add }));
    const dialog = screen.getByRole("dialog");
    fireEvent.change(within(dialog).getByLabelText(MILESTONE_TEXT.name), { target: { value: "오픈" } });
    fireEvent.change(within(dialog).getByLabelText(MILESTONE_TEXT.targetDate), { target: { value: "2030-01-01" } });
    fireEvent.click(within(dialog).getByRole("button", { name: MILESTONE_TEXT.submit }));
    expect((await within(dialog).findByRole("alert")).textContent).toContain("마일스톤 목표일을 확인해 주세요");
  });

  it("수정이 409(version 충돌)면 새로고침 안내를 보이고 최신 목록을 다시 받는다", async () => {
    let listCalls = 0;
    const { calls } = renderServerWith({
      ...baseHandlers("PM"),
      "GET /api/projects/77/wbs/milestones": () => {
        listCalls += 1;
        return jsonOk({ milestones: [milestone({ name: listCalls > 1 ? "남이 고친 이름" : "분석 단계 종료" })] });
      },
      "PATCH /api/projects/77/wbs/milestones/31": () => jsonFail(409, "다른 사용자가 먼저 수정했습니다. 새로고침한 뒤 다시 시도해 주세요"),
    });
    const region = await milestoneRegion();
    fireEvent.click(await within(region).findByRole("button", { name: `${MILESTONE_TEXT.edit}: 분석 단계 종료` }));
    const dialog = screen.getByRole("dialog");
    fireEvent.change(within(dialog).getByLabelText(MILESTONE_TEXT.name), { target: { value: "내가 고친 이름" } });
    fireEvent.click(within(dialog).getByRole("button", { name: MILESTONE_TEXT.submit }));

    expect(await screen.findByText(MILESTONE_TEXT.concurrent)).toBeTruthy();
    expect(await within(region).findByText("남이 고친 이름")).toBeTruthy();
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(calls.find((c) => c.method === "PATCH")?.body).toEqual({ name: "내가 고친 이름", targetDate: "2026-12-10", version: 4 });
  });

  it("연결 작업을 모두 해제하면 빈 배열과 version을 PUT으로 보낸다", async () => {
    const { calls } = renderServerWith({
      ...baseHandlers("PM"),
      "GET /api/projects/77/wbs/milestones": () => jsonOk({ milestones: [milestone()] }),
      "PUT /api/projects/77/wbs/milestones/31/tasks": () => jsonOk(milestone({ tasks: [], linkedTaskCount: 0, incompleteTaskCount: 0, version: 5 })),
    });
    const region = await milestoneRegion();
    fireEvent.click(await within(region).findByRole("button", { name: `${MILESTONE_TEXT.editTasks}: 분석 단계 종료` }));
    const dialog = screen.getByRole("dialog");
    const box = within(dialog).getByRole("checkbox", { name: "요구사항 분석" }) as HTMLInputElement;
    expect(box.checked).toBe(true);
    fireEvent.click(box);
    fireEvent.click(within(dialog).getByRole("button", { name: MILESTONE_TEXT.submit }));

    expect(await screen.findByText("'분석 단계 종료' 마일스톤의 연결 작업을 저장했습니다.")).toBeTruthy();
    expect(within(region).getByText(MILESTONE_TEXT.noTasks)).toBeTruthy();
    expect(calls.find((c) => c.method === "PUT")?.body).toEqual({ taskIds: [], version: 4 });
  });

  it("트리에 없는 연결 작업(이미 지워진 작업)은 연결 교체 요청에서 뺀다", async () => {
    const { calls } = renderServerWith({
      ...baseHandlers("PM"),
      "GET /api/projects/77/wbs/milestones": () =>
        jsonOk({
          milestones: [
            milestone({
              linkedTaskCount: 2,
              incompleteTaskCount: 2,
              tasks: [
                { id: 101, parentTaskId: null, name: "요구사항 분석", status: "TODO", endDate: "2026-12-10" },
                { id: 999, parentTaskId: null, name: "지워진 작업", status: "TODO", endDate: "2026-12-10" },
              ],
            }),
          ],
        }),
      "PUT /api/projects/77/wbs/milestones/31/tasks": () => jsonOk(milestone({ version: 5 })),
    });
    const region = await milestoneRegion();
    fireEvent.click(await within(region).findByRole("button", { name: `${MILESTONE_TEXT.editTasks}: 분석 단계 종료` }));
    const dialog = screen.getByRole("dialog");
    expect((within(dialog).getByRole("checkbox", { name: "요구사항 분석" }) as HTMLInputElement).checked).toBe(true);
    expect(within(dialog).queryByRole("checkbox", { name: "지워진 작업" })).toBeNull();
    fireEvent.click(within(dialog).getByRole("button", { name: MILESTONE_TEXT.submit }));

    await screen.findByText("'분석 단계 종료' 마일스톤의 연결 작업을 저장했습니다.");
    expect(calls.find((c) => c.method === "PUT")?.body).toEqual({ taskIds: [101], version: 4 });
  });

  it("연결 작업이 상한(200개)이면 고르지 않은 작업은 더 고를 수 없다", async () => {
    const tree = Array.from({ length: 201 }, (_, i) => task({ id: 1000 + i, name: `작업 ${i + 1}`, sortOrder: i + 1 }));
    const linked = tree.slice(0, 200).map((t) => ({ id: t.id, parentTaskId: null, name: t.name, status: "TODO", endDate: "2026-12-10" }));
    renderServerWith({
      ...baseHandlers("PM", tree),
      "GET /api/projects/77/wbs/milestones": () => jsonOk({ milestones: [milestone({ tasks: linked, linkedTaskCount: 200, incompleteTaskCount: 200 })] }),
    });
    const region = await milestoneRegion();
    fireEvent.click(await within(region).findByRole("button", { name: `${MILESTONE_TEXT.editTasks}: 분석 단계 종료` }));
    const dialog = screen.getByRole("dialog");
    expect((within(dialog).getByRole("checkbox", { name: "작업 201" }) as HTMLInputElement).disabled).toBe(true);
    expect((within(dialog).getByRole("checkbox", { name: "작업 200" }) as HTMLInputElement).disabled).toBe(false);
    expect(within(dialog).getByText("연결 작업은 최대 200개까지 고를 수 있습니다.")).toBeTruthy();
    // 하나를 풀면 다시 고를 수 있다
    fireEvent.click(within(dialog).getByRole("checkbox", { name: "작업 200" }));
    expect((within(dialog).getByRole("checkbox", { name: "작업 201" }) as HTMLInputElement).disabled).toBe(false);
  });

  it("삭제를 확인하면 지우고, 403이면 PM 전용 안내와 함께 목록을 다시 받는다", async () => {
    vi.spyOn(window, "confirm").mockReturnValue(true);
    let listCalls = 0;
    renderServerWith({
      ...baseHandlers("PM"),
      "GET /api/projects/77/wbs/milestones": () => {
        listCalls += 1;
        return jsonOk({ milestones: [milestone()] });
      },
      "DELETE /api/projects/77/wbs/milestones/31": () => jsonFail(403, "프로젝트 PM만 할 수 있는 작업입니다"),
    });
    const region = await milestoneRegion();
    fireEvent.click(await within(region).findByRole("button", { name: `${MILESTONE_TEXT.delete}: 분석 단계 종료` }));
    expect(await screen.findByText(MILESTONE_TEXT.pmOnly)).toBeTruthy();
    await waitFor(() => expect(listCalls).toBe(2));
    expect(within(region).getByText("분석 단계 종료")).toBeTruthy();
  });

  it("삭제가 성공하면 목록에서 뺀다", async () => {
    vi.spyOn(window, "confirm").mockReturnValue(true);
    renderServerWith({
      ...baseHandlers("PM"),
      "GET /api/projects/77/wbs/milestones": () => jsonOk({ milestones: [milestone()] }),
      "DELETE /api/projects/77/wbs/milestones/31": () => jsonOk(null),
    });
    const region = await milestoneRegion();
    fireEvent.click(await within(region).findByRole("button", { name: `${MILESTONE_TEXT.delete}: 분석 단계 종료` }));
    expect(await screen.findByText("'분석 단계 종료' 마일스톤을 삭제했습니다.")).toBeTruthy();
    expect(within(region).getByText(MILESTONE_TEXT.empty)).toBeTruthy();
  });
});

describe("서버 WBS 계층 변경 & 파생 상태 (FR-WBS-01)", () => {
  it("PM이 '상위 작업 변경'으로 작업을 다른 상위 작업 아래로 옮기면 PUT .../position을 호출한다", async () => {
    const t1 = task({ id: 101, name: "상위 작업 A", version: 2 });
    const t2 = task({ id: 102, name: "이동할 작업 B", sortOrder: 2, version: 3 });
    const movedTree = [
      task({
        id: 101,
        name: "상위 작업 A",
        version: 2,
        subtasks: [task({ id: 102, parentTaskId: 101, name: "이동할 작업 B", sortOrder: 1, version: 4 })],
      }),
    ];
    const { calls } = renderServerWith({
      ...baseHandlers("PM", [t1, t2]),
      "PUT /api/projects/77/wbs/tasks/102/position": () => jsonOk({ taskId: 102, tasks: movedTree }),
    });

    fireEvent.click(await screen.findByRole("button", { name: "상위 작업 변경: 이동할 작업 B" }));
    const dialog = screen.getByRole("dialog");
    fireEvent.click(within(dialog).getByRole("button", { name: "저장" }));

    await waitFor(() => {
      const moveCall = calls.find((c) => c.method === "PUT" && c.path === "/api/projects/77/wbs/tasks/102/position");
      expect(moveCall).toBeTruthy();
      expect(moveCall?.body).toEqual({ parentTaskId: 101, index: 0, version: 3 });
    });
  });

  it("하위작업이 모두 완료된 상위 작업은 서버 상태가 TODO여도 완료로 표시한다", async () => {
    const parent = task({
      id: 201,
      name: "통합 상위 작업",
      status: "TODO",
      progress: 100,
      subtasks: [
        task({ id: 202, parentTaskId: 201, name: "하위 1", status: "DONE", progress: 100 }),
        task({ id: 203, parentTaskId: 201, name: "하위 2", status: "DONE", progress: 100 }),
      ],
    });
    renderServerWith(baseHandlers("PM", [parent]));

    const parentRow = (await screen.findByText("통합 상위 작업")).closest("tr") as HTMLElement;
    expect(within(parentRow).getByText("완료")).toBeTruthy();
  });
});

describe("데모 모드 WBS (기존 시연 유지)", () => {
  it("데모 프로젝트는 데모 WBS를 그대로 보여 주고 서버를 부르지 않는다", async () => {
    const { fetchMock } = stubFetch({});
    renderApp({ mode: "demo", route: "/projects/p1/wbs", routes: ROUTES });
    expect(await screen.findByRole("link", { name: /AI WBS 초안/ })).toBeTruthy();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

function renderServerWith(handlers: Parameters<typeof stubFetch>[0], route?: string) {
  const stub = stubFetch(handlers);
  renderServer(route);
  return stub;
}
