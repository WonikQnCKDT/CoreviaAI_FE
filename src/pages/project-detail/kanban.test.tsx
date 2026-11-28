// @vitest-environment jsdom
import { useEffect, useState, type ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, screen, waitFor, within } from "@testing-library/react";
import KanbanPage from "@/pages/project-detail/kanban";
import { useDemoStore } from "@/stores/DemoStore";
import { BOARD_COLUMN_TEXT, BOARD_TEXT, TASK_DETAIL_TEXT } from "@/features/board/i18n/ko";
import { jsonFail, jsonOk, renderApp, stubFetch } from "@/test/appHarness";
import type { ServerProjectDetail } from "@/features/project/api/projectApi";

/** 로그인 사용자(fakeAuth api)는 서버 사용자 5 */
const ME = 5;

const detail: ServerProjectDetail = {
  id: 77, code: "PRT-2026-001", name: "서버 프로젝트", status: "planned", template: "itProject", methodology: "waterfall",
  visibility: "company", departments: [], pms: [{ id: 1, name: "김피엠" }], startDate: null, endDate: null,
  createdAt: "2026-11-26T00:00:00Z", departmentType: "sw", createdBy: 1, actors: ["pm", "dev"], features: ["kanban"], progress: 0, version: 0,
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

const card = (overrides: Record<string, unknown> = {}) => ({
  id: 103, phaseId: 1, parentTaskId: null, parentTaskName: null, name: "API 설계", taskType: "TASK", priority: "MEDIUM", status: "TODO",
  assignee: { id: 11, name: "이개발" }, startDate: "2026-12-01", endDate: "2026-12-05", progress: 0, statusChangedAt: null, completedAt: null, version: 2,
  ...overrides,
});

const column = (id: number, status: string, cards: unknown[] = [], overrides: Record<string, unknown> = {}) => ({
  id, name: null, labelKey: `code.TASK_STATUS.${status}`, statusCategory: status, sortOrder: id - 30, wipLimit: null,
  cardCount: cards.length, wipExceeded: false, cards, ...overrides,
});

const board = (cards: unknown[] = [card()]) => ({
  columns: [column(31, "TODO", cards), column(32, "IN_PROGRESS"), column(33, "REVIEW"), column(34, "DONE")],
});

const members = (myActor: string) => ({
  items: [
    { userId: ME, name: "홍길동", actor: myActor, assignedTaskCount: 0 },
    { userId: 11, name: "이개발", actor: "DEVELOPER", assignedTaskCount: 1 },
  ],
  nextCursor: null,
  hasNext: false,
});

const phases = [
  { id: 1, name: "설계", sortOrder: 1, status: "IN_PROGRESS", gateApproverUserId: null },
  { id: 2, name: "개발", sortOrder: 2, status: "WAITING", gateApproverUserId: null },
];

const handlers = (myActor: string, boardBody: unknown = board(), phaseList: unknown = phases) => ({
  "GET /api/projects/77/board": () => jsonOk(boardBody),
  "GET /api/projects/77/phases": () => jsonOk(phaseList),
  "GET /api/projects/77/members": () => jsonOk(members(myActor)),
});

const ROUTES = [{ path: "/projects/:projectId/kanban", element: <KanbanPage /> }];

const renderServerWith = (h: Parameters<typeof stubFetch>[0]) => {
  const stub = stubFetch(h);
  renderApp({ mode: "api", route: "/projects/77/kanban", routes: ROUTES, wrap: (tree) => <SeedServerProject>{tree}</SeedServerProject> });
  return stub;
};

const moveSelect = (name: string) => screen.getByRole("combobox", { name: `'${name}' 카드를 옮길 컬럼` });

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("api 모드 칸반 (서버 프로젝트)", () => {
  it("서버 컬럼을 기본 이름(라벨 키)·사용자 이름으로 보여 준다", async () => {
    renderServerWith(handlers("PM", { columns: [column(31, "TODO", [card()]), column(32, "IN_PROGRESS", [], { name: "개발 중", labelKey: null })] }));
    expect(await screen.findByRole("region", { name: "대기" })).toBeTruthy();
    expect(screen.getByRole("region", { name: "개발 중" })).toBeTruthy();
    expect(within(screen.getByRole("region", { name: "대기" })).getByText("API 설계")).toBeTruthy();
  });

  it("PM이 카드를 옮기면 서버에 보내고 성공 뒤 보드를 다시 받는다", async () => {
    let boardCalls = 0;
    const { calls } = renderServerWith({
      ...handlers("PM"),
      "GET /api/projects/77/board": () => {
        boardCalls += 1;
        return jsonOk(boardCalls > 1 ? { columns: [column(31, "TODO"), column(32, "IN_PROGRESS", [card({ status: "IN_PROGRESS", version: 3 })])] } : board());
      },
      "PUT /api/projects/77/board/cards/103/column": () => jsonOk({ card: card({ status: "IN_PROGRESS", version: 3 }), column: column(32, "IN_PROGRESS"), wipWarning: false }),
    });
    await screen.findByText("API 설계");
    fireEvent.change(moveSelect("API 설계"), { target: { value: "32" } });
    expect(await screen.findByText("'API 설계'을(를) '진행'(으)로 옮겼습니다.")).toBeTruthy();
    expect(calls.find((c) => c.method === "PUT")?.body).toEqual({ columnId: 32, version: 2 });
    await waitFor(() => expect(within(screen.getByRole("region", { name: "진행" })).getByText("API 설계")).toBeTruthy());
  });

  it("WIP 한도를 넘으면 경고를 띄운다(이동은 반영)", async () => {
    renderServerWith({
      ...handlers("PM"),
      "PUT /api/projects/77/board/cards/103/column": () => jsonOk({ card: card(), column: column(32, "IN_PROGRESS"), wipWarning: true }),
    });
    await screen.findByText("API 설계");
    fireEvent.change(moveSelect("API 설계"), { target: { value: "32" } });
    expect(await screen.findByText("'진행' 컬럼이 WIP 한도를 넘었습니다. 이동은 반영되었습니다.")).toBeTruthy();
  });

  it("이동이 409면 동시 수정 안내 후 보드를 다시 받고 카드는 원래 컬럼에 남는다", async () => {
    let boardCalls = 0;
    renderServerWith({
      ...handlers("PM"),
      "GET /api/projects/77/board": () => {
        boardCalls += 1;
        return jsonOk(board());
      },
      "PUT /api/projects/77/board/cards/103/column": () => jsonFail(409, "다른 사용자가 먼저 수정했습니다"),
    });
    await screen.findByText("API 설계");
    fireEvent.change(moveSelect("API 설계"), { target: { value: "34" } });
    expect(await screen.findByText(BOARD_TEXT.concurrent)).toBeTruthy();
    await waitFor(() => expect(boardCalls).toBe(2));
    expect(within(screen.getByRole("region", { name: "대기" })).getByText("API 설계")).toBeTruthy();
  });

  it("개발자는 본인 카드만 옮길 수 있고 컬럼 관리가 없다", async () => {
    renderServerWith(handlers("DEVELOPER", board([card({ assignee: { id: ME, name: "홍길동" } }), card({ id: 104, name: "남의 카드" })])));
    await screen.findByText("남의 카드");
    expect(screen.getByText(BOARD_TEXT.memberNote)).toBeTruthy();
    expect(moveSelect("API 설계")).toBeTruthy();
    expect(screen.queryByRole("combobox", { name: "'남의 카드' 카드를 옮길 컬럼" })).toBeNull();
    expect(screen.queryByRole("button", { name: new RegExp(BOARD_TEXT.manageColumns) })).toBeNull();
  });

  it("현업 담당자는 담당 카드도 옮길 수 없다(조회만)", async () => {
    renderServerWith(handlers("BUSINESS_OWNER", board([card({ assignee: { id: ME, name: "홍길동" } })])));
    await screen.findByText("API 설계");
    expect(screen.getByText(BOARD_TEXT.viewerNote)).toBeTruthy();
    expect(screen.queryByRole("combobox", { name: "'API 설계' 카드를 옮길 컬럼" })).toBeNull();
  });

  it("담당자 필터를 바꾸면 그 담당자로 서버에 다시 묻는다", async () => {
    const { calls } = renderServerWith(handlers("PM"));
    await screen.findByText("API 설계");
    fireEvent.change(screen.getByRole("combobox", { name: BOARD_TEXT.assigneeFilter }), { target: { value: "11" } });
    await waitFor(() => expect(calls.some((c) => c.path === "/api/projects/77/board?assigneeUserId=11")).toBe(true));
  });

  it("단계 필터와 담당자 필터를 조합해 서버에 요청하고, 빈 결과 시 안내와 초기화 버튼을 보여 준다", async () => {
    const { calls } = renderServerWith({
      ...handlers("PM"),
      "GET /api/projects/77/board": ({ url }) => {
        const phase = url.searchParams.get("phaseId");
        const assignee = url.searchParams.get("assigneeUserId");
        if (phase === "2" && assignee === "11") {
          return jsonOk(board([]));
        }
        return jsonOk(board());
      },
    });
    await screen.findByText("API 설계");

    fireEvent.change(screen.getByRole("combobox", { name: BOARD_TEXT.phaseFilter }), { target: { value: "2" } });
    await waitFor(() => expect(calls.some((c) => c.path === "/api/projects/77/board?phaseId=2")).toBe(true));

    fireEvent.change(screen.getByRole("combobox", { name: BOARD_TEXT.assigneeFilter }), { target: { value: "11" } });
    await waitFor(() => expect(calls.some((c) => c.path === "/api/projects/77/board?assigneeUserId=11&phaseId=2")).toBe(true));

    expect(await screen.findByText(BOARD_TEXT.emptyFilteredTitle)).toBeTruthy();
    expect(screen.getByText(BOARD_TEXT.emptyFilteredDescription)).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: BOARD_TEXT.resetFilters }));
    await waitFor(() => expect(screen.getByText("API 설계")).toBeTruthy());
    expect(screen.queryByText(BOARD_TEXT.emptyFilteredTitle)).toBeNull();
  });

  it("단계 없는 프로젝트(단계 404)에서는 단계 필터를 숨기고 보드를 정상 표시한다", async () => {
    renderServerWith({
      ...handlers("PM"),
      "GET /api/projects/77/phases": () => jsonFail(404, "단계를 찾을 수 없습니다"),
    });
    await screen.findByText("API 설계");
    expect(screen.queryByRole("combobox", { name: BOARD_TEXT.phaseFilter })).toBeNull();
    expect(screen.getByRole("combobox", { name: BOARD_TEXT.assigneeFilter })).toBeTruthy();
  });

  it("드래그앤드롭: 카드를 다른 컬럼에 드롭하면 상태 변경 API를 호출하고 새 컬럼에 반영한다", async () => {
    let moved = false;
    const { calls } = renderServerWith({
      ...handlers("PM"),
      "GET /api/projects/77/board": () =>
        jsonOk(moved ? { columns: [column(31, "TODO"), column(32, "IN_PROGRESS", [card({ status: "IN_PROGRESS", version: 3 })]), column(33, "REVIEW"), column(34, "DONE")] } : board()),
      "PUT /api/projects/77/board/cards/103/column": () => {
        moved = true;
        return jsonOk({ card: card({ status: "IN_PROGRESS", version: 3 }), column: column(32, "IN_PROGRESS"), wipWarning: false });
      },
    });
    const cardItem = (await screen.findByText("API 설계")).closest("li");
    if (!cardItem) throw new Error("카드 항목을 찾을 수 없다");
    const targetColumn = screen.getByRole("region", { name: "진행" });

    fireEvent.dragStart(cardItem);
    fireEvent.dragOver(targetColumn);
    fireEvent.drop(targetColumn);

    expect(await screen.findByText("'API 설계'을(를) '진행'(으)로 옮겼습니다.")).toBeTruthy();
    expect(calls.find((c) => c.method === "PUT")).toMatchObject({
      path: "/api/projects/77/board/cards/103/column",
      body: { columnId: 32, version: 2 },
    });
    await waitFor(() => expect(within(targetColumn).getByText("API 설계")).toBeTruthy());
  });

  it("드래그앤드롭: WIP 한도 초과 응답이면 경고를 표시한다", async () => {
    renderServerWith({
      ...handlers("PM"),
      "PUT /api/projects/77/board/cards/103/column": () =>
        jsonOk({ card: card({ status: "IN_PROGRESS", version: 3 }), column: column(32, "IN_PROGRESS", [], { wipLimit: 1, cardCount: 2, wipExceeded: true }), wipWarning: true }),
    });
    const cardItem = (await screen.findByText("API 설계")).closest("li");
    if (!cardItem) throw new Error("카드 항목을 찾을 수 없다");
    const targetColumn = screen.getByRole("region", { name: "진행" });

    fireEvent.dragStart(cardItem);
    fireEvent.dragOver(targetColumn);
    fireEvent.drop(targetColumn);

    const status = await screen.findByRole("status");
    expect(status.textContent).toBe("'진행' 컬럼이 WIP 한도를 넘었습니다. 이동은 반영되었습니다.");
  });

  it("드래그앤드롭: 단계·담당자 필터 적용 중에도 이동이 동작하고 필터 쿼리를 유지해 다시 조회한다", async () => {
    let moved = false;
    const { calls } = renderServerWith({
      ...handlers("PM"),
      "GET /api/projects/77/board": () =>
        jsonOk(moved ? { columns: [column(31, "TODO"), column(32, "IN_PROGRESS", [card({ status: "IN_PROGRESS", version: 3 })]), column(33, "REVIEW"), column(34, "DONE")] } : board()),
      "PUT /api/projects/77/board/cards/103/column": () => {
        moved = true;
        return jsonOk({ card: card({ status: "IN_PROGRESS", version: 3 }), column: column(32, "IN_PROGRESS"), wipWarning: false });
      },
    });
    await screen.findByText("API 설계");
    fireEvent.change(screen.getByRole("combobox", { name: BOARD_TEXT.phaseFilter }), { target: { value: "1" } });
    fireEvent.change(screen.getByRole("combobox", { name: BOARD_TEXT.assigneeFilter }), { target: { value: "11" } });
    await waitFor(() => expect(calls.some((c) => c.path === "/api/projects/77/board?assigneeUserId=11&phaseId=1")).toBe(true));

    const callsBeforeDrop = calls.filter((c) => c.path === "/api/projects/77/board?assigneeUserId=11&phaseId=1").length;
    const cardItem = screen.getByText("API 설계").closest("li");
    if (!cardItem) throw new Error("카드 항목을 찾을 수 없다");
    const targetColumn = screen.getByRole("region", { name: "진행" });

    fireEvent.dragStart(cardItem);
    fireEvent.dragOver(targetColumn);
    fireEvent.drop(targetColumn);

    expect(await screen.findByText("'API 설계'을(를) '진행'(으)로 옮겼습니다.")).toBeTruthy();
    await waitFor(() =>
      expect(calls.filter((c) => c.path === "/api/projects/77/board?assigneeUserId=11&phaseId=1").length).toBeGreaterThan(callsBeforeDrop),
    );
    expect(within(targetColumn).getByText("API 설계")).toBeTruthy();
  });

  it("드래그앤드롭: 서버 오류(500)로 실패하면 오류를 표시하고 카드는 원래 컬럼에 남는다", async () => {
    renderServerWith({
      ...handlers("PM"),
      "PUT /api/projects/77/board/cards/103/column": () => jsonFail(500, "서버 내부 오류"),
    });
    const cardItem = (await screen.findByText("API 설계")).closest("li");
    if (!cardItem) throw new Error("카드 항목을 찾을 수 없다");
    const sourceColumn = screen.getByRole("region", { name: "대기" });
    const targetColumn = screen.getByRole("region", { name: "진행" });

    fireEvent.dragStart(cardItem);
    fireEvent.dragOver(targetColumn);
    fireEvent.drop(targetColumn);

    expect((await screen.findByRole("alert")).textContent).toBe(BOARD_TEXT.serverError);
    expect(within(sourceColumn).getByText("API 설계")).toBeTruthy();
    expect(within(targetColumn).queryByText("API 설계")).toBeNull();
  });

  it("드래그앤드롭 경계값: 같은 컬럼에 드롭하거나 이동 권한이 없으면 API를 호출하지 않는다", async () => {
    const { calls } = renderServerWith(handlers("BUSINESS_OWNER", board([card({ assignee: { id: ME, name: "홍길동" } })])));
    const cardItem = (await screen.findByText("API 설계")).closest("li");
    if (!cardItem) throw new Error("카드 항목을 찾을 수 없다");
    const targetColumn = screen.getByRole("region", { name: "진행" });

    fireEvent.dragStart(cardItem);
    fireEvent.dragOver(targetColumn);
    fireEvent.drop(targetColumn);

    expect(calls.some((c) => c.method === "PUT")).toBe(false);
  });

  it("드래그앤드롭 경계값: PM이라도 같은 컬럼에 드롭하면 API를 호출하지 않는다", async () => {
    const { calls } = renderServerWith(handlers("PM"));
    const cardItem = (await screen.findByText("API 설계")).closest("li");
    if (!cardItem) throw new Error("카드 항목을 찾을 수 없다");
    const sameColumn = screen.getByRole("region", { name: "대기" });

    fireEvent.dragStart(cardItem);
    fireEvent.dragOver(sameColumn);
    fireEvent.drop(sameColumn);

    expect(calls.some((c) => c.method === "PUT")).toBe(false);
  });

  it("칸반 기능이 꺼졌으면(404) 사용할 수 없다고 안내한다", async () => {
    renderServerWith({ ...handlers("PM"), "GET /api/projects/77/board": () => jsonFail(404, "이 프로젝트에서 사용하지 않는 기능입니다") });
    expect(await screen.findByText(BOARD_TEXT.unavailable)).toBeTruthy();
  });

  it("컬럼 관리: 제어 문자가 든 이름은 보내지 않고, 저장하면 서버에 보낸 뒤 보드를 다시 받는다", async () => {
    let boardCalls = 0;
    const { calls } = renderServerWith({
      ...handlers("PM"),
      "GET /api/projects/77/board": () => {
        boardCalls += 1;
        return jsonOk(board());
      },
      "PATCH /api/projects/77/board/columns/31": () => jsonOk({ columns: board().columns.map((c) => ({ ...c, cards: undefined, ...(c.id === 31 ? { name: "대기열", labelKey: null } : {}) })) }),
    });
    await screen.findByText("API 설계");
    fireEvent.click(screen.getByRole("button", { name: new RegExp(BOARD_TEXT.manageColumns) }));
    const dialog = screen.getByRole("dialog");
    const nameInput = within(dialog).getByRole("textbox", { name: `${BOARD_COLUMN_TEXT.name}: 대기` });
    // 입력칸은 줄바꿈을 지우므로 탭으로 확인한다
    fireEvent.change(nameInput, { target: { value: `탭${String.fromCharCode(9)}이름` } });
    fireEvent.click(within(dialog).getByRole("button", { name: `${BOARD_COLUMN_TEXT.save}: 대기` }));
    expect(within(dialog).getByRole("alert").textContent).toBe(BOARD_COLUMN_TEXT.nameControl);
    expect(calls.some((c) => c.method === "PATCH")).toBe(false);

    fireEvent.change(nameInput, { target: { value: "대기열" } });
    fireEvent.click(within(dialog).getByRole("button", { name: `${BOARD_COLUMN_TEXT.save}: 대기` }));
    expect(await within(dialog).findByText(BOARD_COLUMN_TEXT.saved)).toBeTruthy();
    expect(calls.find((c) => c.method === "PATCH")?.body).toEqual({ name: "대기열", wipLimit: null });
    await waitFor(() => expect(boardCalls).toBe(2));
  });

  it("컬럼 추가가 409(상한)면 이유를 보여 주고 입력을 남긴다", async () => {
    const { calls } = renderServerWith({ ...handlers("PM"), "POST /api/projects/77/board/columns": () => jsonFail(409, "컬럼은 최대 20개입니다") });
    await screen.findByText("API 설계");
    fireEvent.click(screen.getByRole("button", { name: new RegExp(BOARD_TEXT.manageColumns) }));
    const dialog = screen.getByRole("dialog");
    const nameInput = within(dialog).getByRole("textbox", { name: `${BOARD_COLUMN_TEXT.addTitle} ${BOARD_COLUMN_TEXT.name}` });
    fireEvent.change(nameInput, { target: { value: "QA 대기" } });
    fireEvent.change(within(dialog).getByRole("combobox", { name: `${BOARD_COLUMN_TEXT.addTitle} ${BOARD_COLUMN_TEXT.status}` }), { target: { value: "review" } });
    fireEvent.click(within(dialog).getByRole("button", { name: BOARD_COLUMN_TEXT.add }));
    expect(await within(dialog).findByText(BOARD_COLUMN_TEXT.limitExceeded)).toBeTruthy();
    expect(calls.find((c) => c.method === "POST")?.body).toEqual({ name: "QA 대기", statusCategory: "REVIEW", wipLimit: null });
    expect((nameInput as HTMLInputElement).value).toBe("QA 대기");
  });

  it("컬럼 관리: 카드가 있거나 상태의 마지막 컬럼은 삭제 버튼이 꺼져 있다", async () => {
    renderServerWith(handlers("PM"));
    await screen.findByText("API 설계");
    fireEvent.click(screen.getByRole("button", { name: new RegExp(BOARD_TEXT.manageColumns) }));
    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByRole("button", { name: `${BOARD_COLUMN_TEXT.delete}: 대기` })).toHaveProperty("disabled", true);
    expect(within(dialog).getByRole("button", { name: `${BOARD_COLUMN_TEXT.delete}: 완료` })).toHaveProperty("disabled", true);
  });
});

describe("api 모드 업무 상세", () => {
  const taskDetail = (overrides: Record<string, unknown> = {}) => ({
    id: 103, projectId: 77, phaseId: 1, parentTaskId: null, name: "API 설계", description: "설명", taskType: "TASK", priority: "MEDIUM",
    completionCriteria: null, assignee: { id: 11, name: "이개발" }, startDate: "2026-12-01", endDate: "2026-12-05", scheduleDerived: false,
    estimatedEffort: 2, progress: 0, status: "TODO", source: "MANUAL", completedAt: null, boardColumnId: 31, statusChangedAt: null,
    createdBy: { id: 1, name: "김피엠" }, createdAt: "2026-11-21T01:00:00Z", updatedAt: "2026-11-21T01:00:00Z", version: 2, ...overrides,
  });
  const histories = {
    items: [
      {
        id: 51,
        activityType: "CREATED",
        before: null,
        after: { name: "<img src=x onerror=alert(1)>", priority: "HIGH", unknownKey: "v1" },
        actor: { id: 1, name: "김피엠" },
        occurredAt: "2026-11-21T01:00:00Z",
      },
    ],
    nextCursor: null,
    hasNext: false,
  };

  it("카드를 누르면 상세·이력을 보여 주고, 필드 키는 라벨로 매핑하며 사용자 입력은 텍스트로만 그린다", async () => {
    renderServerWith({
      ...handlers("PM"),
      "GET /api/projects/77/tasks/103": () => jsonOk(taskDetail()),
      "GET /api/projects/77/tasks/103/histories": () => jsonOk(histories),
    });
    fireEvent.click(await screen.findByRole("button", { name: `${BOARD_TEXT.openDetail}: API 설계` }));
    const dialog = await screen.findByRole("dialog");
    expect(await within(dialog).findByText(`${TASK_DETAIL_TEXT.fieldName}: <img src=x onerror=alert(1)>`)).toBeTruthy();
    expect(within(dialog).getByText(`${TASK_DETAIL_TEXT.priority}: HIGH`)).toBeTruthy();
    expect(within(dialog).getByText("unknownKey: v1")).toBeTruthy();
    expect(dialog.querySelector("img")).toBeNull();
    expect(within(within(dialog).getByRole("region", { name: TASK_DETAIL_TEXT.histories })).getByText(TASK_DETAIL_TEXT.activityCreated)).toBeTruthy();
  });

  it("PM이 속성을 저장하면 서버 코드로 보내고, 409면 동시 수정 안내 후 다시 받는다", async () => {
    let detailCalls = 0;
    const { calls } = renderServerWith({
      ...handlers("PM"),
      "GET /api/projects/77/tasks/103": () => {
        detailCalls += 1;
        return jsonOk(taskDetail());
      },
      "GET /api/projects/77/tasks/103/histories": () => jsonOk(histories),
      "PATCH /api/projects/77/tasks/103": () => jsonFail(409, "다른 사용자가 먼저 수정했습니다"),
    });
    fireEvent.click(await screen.findByRole("button", { name: `${BOARD_TEXT.openDetail}: API 설계` }));
    const dialog = await screen.findByRole("dialog");
    const form = await within(dialog).findByRole("form", { name: TASK_DETAIL_TEXT.attributes });
    fireEvent.change(within(form).getByRole("combobox", { name: TASK_DETAIL_TEXT.taskType }), { target: { value: "defect" } });
    fireEvent.change(within(form).getByRole("combobox", { name: TASK_DETAIL_TEXT.priority }), { target: { value: "high" } });
    fireEvent.click(within(form).getByRole("button", { name: TASK_DETAIL_TEXT.save }));
    expect(await within(dialog).findByText(TASK_DETAIL_TEXT.concurrent)).toBeTruthy();
    expect(calls.find((c) => c.method === "PATCH")?.body).toEqual({ taskType: "DEFECT", priority: "HIGH", completionCriteria: null, version: 2 });
    await waitFor(() => expect(detailCalls).toBe(2));
  });

  it("담당이 아닌 개발자는 속성을 조회만 한다", async () => {
    renderServerWith({
      ...handlers("DEVELOPER"),
      "GET /api/projects/77/tasks/103": () => jsonOk(taskDetail()),
      "GET /api/projects/77/tasks/103/histories": () => jsonOk({ items: [], nextCursor: null, hasNext: false }),
    });
    fireEvent.click(await screen.findByRole("button", { name: `${BOARD_TEXT.openDetail}: API 설계` }));
    const dialog = await screen.findByRole("dialog");
    expect(await within(dialog).findByText(TASK_DETAIL_TEXT.readOnly)).toBeTruthy();
    expect(within(dialog).queryByRole("button", { name: TASK_DETAIL_TEXT.save })).toBeNull();
    expect(within(dialog).getByText(TASK_DETAIL_TEXT.historiesEmpty)).toBeTruthy();
  });

  it("업무가 지워졌으면(404) 찾을 수 없다고 안내한다", async () => {
    renderServerWith({
      ...handlers("PM"),
      "GET /api/projects/77/tasks/103": () => jsonFail(404, "WBS 작업을 찾을 수 없습니다"),
      "GET /api/projects/77/tasks/103/histories": () => jsonFail(404, "WBS 작업을 찾을 수 없습니다"),
    });
    fireEvent.click(await screen.findByRole("button", { name: `${BOARD_TEXT.openDetail}: API 설계` }));
    expect(await screen.findByText(TASK_DETAIL_TEXT.notFound)).toBeTruthy();
  });
});

describe("데모 모드 칸반 (기존 시연 유지)", () => {
  it("데모 프로젝트는 데모 칸반을 그대로 보여 주고 서버를 부르지 않는다", async () => {
    const { fetchMock } = stubFetch({});
    renderApp({ mode: "demo", route: "/projects/p1/kanban", routes: ROUTES });
    expect(await screen.findByText(/카드를 드래그하면 WBS와 상태가 함께 변경됩니다/)).toBeTruthy();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
