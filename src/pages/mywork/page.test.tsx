// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, screen, waitFor, within } from "@testing-library/react";
import MyWorkPage from "@/pages/mywork/page";
import { TODO_TEXT } from "@/features/mywork/i18n/ko";
import { TODO_REFRESH_MS } from "@/features/mywork/hooks/useServerTodos";
import { MYWORK_TAB_TEXT } from "@/shared/i18n/catalog/menu";
import { jsonFail, jsonOk, renderApp, stubFetch } from "@/test/appHarness";

const item = (overrides: Record<string, unknown> = {}) => ({
  id: 1, source: "PERSONAL", title: "주간 보고서", dueDate: "2026-11-27", done: false, doneAt: null,
  projectId: null, taskStatus: null, urgency: 0, overdue: false, ...overrides,
});
const page = (items: unknown[]) => ({ items, nextCursor: null, hasNext: false });
const personal = (overrides: Record<string, unknown> = {}) => ({
  id: 9, title: "새 할 일", dueDate: null, done: false, doneAt: null, createdAt: "", updatedAt: "", ...overrides,
});

/** done=false·true 목록을 따로 정한다 */
const todos = (active: unknown[], done: unknown[] = []) => ({
  "GET /api/me/todos": ({ url }: { url: URL }) => jsonOk(page(url.searchParams.get("done") === "true" ? done : active)),
});

const ROUTES = [{ path: "/", element: <MyWorkPage /> }];
const renderServer = () => renderApp({ mode: "api", route: "/", routes: ROUTES });

const openAdd = () => fireEvent.click(screen.getByRole("button", { name: new RegExp(TODO_TEXT.add) }));
const fillAndSave = (title: string) => {
  const dialog = screen.getByRole("dialog");
  fireEvent.change(within(dialog).getByRole("textbox"), { target: { value: title } });
  fireEvent.click(within(dialog).getByRole("button", { name: TODO_TEXT.save }));
  return dialog;
};

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("api 모드 내 TODO", () => {
  it("개인 할 일과 배정 업무를 함께 보여 주고 KPI를 서버 urgency·overdue로 센다", async () => {
    stubFetch(
      todos([
        item(),
        item({ id: 2, source: "TASK", title: "API 설계", projectId: 77, taskStatus: "IN_PROGRESS", urgency: 2, overdue: true, dueDate: "2026-11-20" }),
        item({ id: 3, title: "임박", urgency: 1, dueDate: "2026-11-29" }),
      ]),
    );
    renderServer();
    expect(await screen.findByText("주간 보고서")).toBeTruthy();
    expect(screen.getByText("API 설계")).toBeTruthy();
    expect(screen.getByRole("link", { name: `${TODO_TEXT.openProject}: API 설계` }).getAttribute("href")).toBe("/projects/77/kanban");
    // 배정 업무에는 완료 체크·수정·삭제가 없다(상태는 업무 API 책임)
    expect(screen.queryByRole("checkbox", { name: new RegExp("API 설계") })).toBeNull();
    expect(screen.queryByRole("button", { name: `${TODO_TEXT.delete}: API 설계` })).toBeNull();
    // KPI 카드는 안내 문구(title)로 찾는다(필터 버튼과 이름이 겹친다)
    const kpi = (hint: string) => screen.getByTitle(hint);
    expect(kpi(TODO_TEXT.kpiTodayHint).textContent).toContain("1");
    expect(kpi(TODO_TEXT.kpiLateHint).textContent).toContain("1");
    fireEvent.click(kpi(TODO_TEXT.kpiLateHint));
    expect(screen.queryByText("주간 보고서")).toBeNull();
    expect(screen.getByText("API 설계")).toBeTruthy();
  });

  it("할 일을 추가하면 requestId와 함께 보내고, 성공 뒤 목록을 다시 받는다", async () => {
    let listCalls = 0;
    const { calls } = stubFetch({
      "GET /api/me/todos": ({ url }) => {
        if (url.searchParams.get("done") !== "true") listCalls += 1;
        return jsonOk(page(listCalls > 1 && url.searchParams.get("done") !== "true" ? [item({ id: 9, title: "새 할 일", urgency: 4, dueDate: null })] : []));
      },
      "POST /api/me/todos": () => jsonOk(personal()),
    });
    renderServer();
    await screen.findByText(TODO_TEXT.empty);
    openAdd();
    fillAndSave(" 새 할 일 ");
    expect(await screen.findByText("'새 할 일'을(를) 추가했습니다.")).toBeTruthy();
    const body = calls.find((c) => c.method === "POST")?.body as { requestId: string; title: string; dueDate: null };
    expect(body.title).toBe("새 할 일");
    expect(body.requestId).toMatch(/^[0-9a-f-]{36}$/);
    expect(Object.keys(body).sort()).toEqual(["dueDate", "requestId", "title"]);
    expect(await screen.findByText("새 할 일")).toBeTruthy();
  });

  it("시간 초과 뒤 같은 내용으로 다시 저장하면 같은 requestId를 쓴다(중복 생성 방지)", async () => {
    let posts = 0;
    const { calls } = stubFetch({
      ...todos([]),
      "POST /api/me/todos": () => {
        posts += 1;
        if (posts === 1) throw new TypeError("Failed to fetch");
        return jsonOk(personal());
      },
    });
    renderServer();
    await screen.findByText(TODO_TEXT.empty);
    openAdd();
    const dialog = fillAndSave("새 할 일");
    expect(await within(dialog).findByText(TODO_TEXT.network)).toBeTruthy();
    fireEvent.click(within(dialog).getByRole("button", { name: TODO_TEXT.save }));
    expect(await screen.findByText("'새 할 일'을(를) 추가했습니다.")).toBeTruthy();
    const ids = calls.filter((c) => c.method === "POST").map((c) => (c.body as { requestId: string }).requestId);
    expect(ids).toHaveLength(2);
    expect(ids[0]).toBe(ids[1]);
  });

  it("결과를 모르는 등록 뒤 폼을 닫으면 목록을 다시 받고, 다음 등록은 새 requestId를 쓴다", async () => {
    let posts = 0;
    let listCalls = 0;
    const { calls } = stubFetch({
      "GET /api/me/todos": ({ url }) => {
        if (url.searchParams.get("done") !== "true") listCalls += 1;
        return jsonOk(page([]));
      },
      "POST /api/me/todos": () => {
        posts += 1;
        if (posts === 1) throw new TypeError("Failed to fetch");
        return jsonOk(personal());
      },
    });
    renderServer();
    await screen.findByText(TODO_TEXT.empty);
    openAdd();
    const dialog = fillAndSave("새 할 일");
    expect(await within(dialog).findByText(TODO_TEXT.network)).toBeTruthy();
    fireEvent.click(within(dialog).getByRole("button", { name: TODO_TEXT.cancel }));
    await waitFor(() => expect(listCalls).toBe(2));
    openAdd();
    fillAndSave("새 할 일");
    expect(await screen.findByText("'새 할 일'을(를) 추가했습니다.")).toBeTruthy();
    const ids = calls.filter((c) => c.method === "POST").map((c) => (c.body as { requestId: string }).requestId);
    expect(ids[0]).not.toBe(ids[1]);
  });

  it("제어 문자가 든 제목은 서버에 보내지 않는다", async () => {
    const { calls } = stubFetch(todos([]));
    renderServer();
    await screen.findByText(TODO_TEXT.empty);
    openAdd();
    const dialog = fillAndSave(`탭${String.fromCharCode(9)}제목`);
    expect(within(dialog).getByRole("alert").textContent).toBe(TODO_TEXT.titleControl);
    expect(calls.some((c) => c.method === "POST")).toBe(false);
  });

  it("완료 체크는 제목·마감을 그대로 두고 done만 바꿔 보낸다", async () => {
    const { calls } = stubFetch({ ...todos([item()]), "PATCH /api/me/todos/1": () => jsonOk(personal({ id: 1, title: "주간 보고서", done: true })) });
    renderServer();
    fireEvent.click(await screen.findByRole("checkbox", { name: `${TODO_TEXT.markDone}: 주간 보고서` }));
    expect(await screen.findByText("'주간 보고서'을(를) 완료했습니다.")).toBeTruthy();
    expect(calls.find((c) => c.method === "PATCH")?.body).toEqual({ title: "주간 보고서", dueDate: "2026-11-27", done: true });
  });

  it("삭제가 404(이미 삭제)면 안내하고 목록을 다시 받는다", async () => {
    vi.spyOn(window, "confirm").mockReturnValue(true);
    let listCalls = 0;
    stubFetch({
      "GET /api/me/todos": ({ url }) => {
        if (url.searchParams.get("done") !== "true") listCalls += 1;
        return jsonOk(page(url.searchParams.get("done") === "true" ? [] : [item()]));
      },
      "DELETE /api/me/todos/1": () => jsonFail(404, "할 일을 찾을 수 없습니다"),
    });
    renderServer();
    fireEvent.click(await screen.findByRole("button", { name: `${TODO_TEXT.delete}: 주간 보고서` }));
    expect(await screen.findByText(TODO_TEXT.notFound)).toBeTruthy();
    await waitFor(() => expect(listCalls).toBe(2));
  });

  it("제목은 텍스트로만 그린다", async () => {
    stubFetch(todos([item({ title: "<img src=x onerror=alert(1)>" })]));
    const { container } = renderServer();
    expect(await screen.findByText("<img src=x onerror=alert(1)>")).toBeTruthy();
    expect(container.querySelector("img")).toBeNull();
  });

  it("1분마다 다시 받아 새 배정 업무를 보여 준다", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    let round = 0;
    stubFetch({
      "GET /api/me/todos": ({ url }) => {
        if (url.searchParams.get("done") === "true") return jsonOk(page([]));
        round += 1;
        return jsonOk(page(round > 1 ? [item({ id: 5, source: "TASK", title: "새 배정", projectId: 77, taskStatus: "TODO" })] : []));
      },
    });
    renderServer();
    await screen.findByText(TODO_TEXT.empty);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(TODO_REFRESH_MS);
    });
    expect(await screen.findByText("새 배정")).toBeTruthy();
  });

  it("배정 해제되거나 완료된 업무는 다음 재조회 결과 반영 시 목록에서 사라진다", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    let round = 0;
    stubFetch({
      "GET /api/me/todos": ({ url }) => {
        if (url.searchParams.get("done") === "true") return jsonOk(page([]));
        round += 1;
        return jsonOk(
          page(
            round === 1
              ? [item({ id: 5, source: "TASK", title: "해제될 배정 업무", projectId: 77, taskStatus: "IN_PROGRESS", urgency: 0 })]
              : [],
          ),
        );
      },
    });
    renderServer();
    expect(await screen.findByText("해제될 배정 업무")).toBeTruthy();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(TODO_REFRESH_MS);
    });
    expect(await screen.findByText(TODO_TEXT.empty)).toBeTruthy();
    expect(screen.queryByText("해제될 배정 업무")).toBeNull();
  });

  it("개인 TODO 조회는 소유자 파라미터를 보내지 않고 서버 세션 기준으로 본인 것만 조회한다", async () => {
    const { calls } = stubFetch(todos([item()]));
    renderServer();
    await screen.findByText("주간 보고서");
    const todoCalls = calls.filter((c) => c.path.startsWith("/api/me/todos"));
    expect(todoCalls.length).toBeGreaterThanOrEqual(2);
    for (const call of todoCalls) {
      expect(call.path).not.toMatch(/userId|ownerId|assignee/i);
    }
  });

  it("승인 요청 탭은 서버 모드에서 데모 데이터를 보여 주지 않고 준비 중 안내를 표시한다", async () => {
    stubFetch(todos([item()]));
    renderServer();
    await screen.findByText("주간 보고서");
    fireEvent.click(screen.getByRole("tab", { name: new RegExp(MYWORK_TAB_TEXT.approval) }));
    expect(await screen.findByText(TODO_TEXT.approvalPendingTitle)).toBeTruthy();
    expect(screen.getByText(TODO_TEXT.approvalPendingDesc)).toBeTruthy();
    expect(screen.queryByText("승인 대기")).toBeNull();
  });

  it("처음 조회가 실패하면 오류와 다시 시도를 보여 준다", async () => {
    stubFetch({ "GET /api/me/todos": () => jsonFail(500, "서버 오류") });
    renderServer();
    expect(await screen.findByText(TODO_TEXT.loadFailed)).toBeTruthy();
    expect(screen.getByRole("button", { name: TODO_TEXT.retry })).toBeTruthy();
  });
});

describe("데모 모드 내 업무 (기존 시연 유지)", () => {
  it("데모 업무 목록과 승인 요청 탭을 그대로 보여 주고 서버를 부르지 않는다", async () => {
    const { fetchMock } = stubFetch({});
    renderApp({ mode: "demo", route: "/", routes: ROUTES });
    expect(await screen.findByText("업무 목록")).toBeTruthy();
    fireEvent.click(screen.getByRole("tab", { name: new RegExp(MYWORK_TAB_TEXT.approval) }));
    expect(screen.queryByText(TODO_TEXT.approvalPendingTitle)).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
