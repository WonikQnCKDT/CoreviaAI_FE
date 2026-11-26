// @vitest-environment jsdom
import { useEffect, useState, type ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, screen, waitFor, within } from "@testing-library/react";
import WbsPage from "@/pages/project-detail/wbs";
import WbsDraftPage from "@/pages/project-detail/wbs-draft";
import { useDemoStore } from "@/stores/DemoStore";
import { WBS_DRAFT_TEXT, WBS_FORM_TEXT, WBS_TEXT } from "@/features/wbs/i18n/ko";
import { jsonFail, jsonOk, renderApp, stubFetch } from "@/test/appHarness";
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
