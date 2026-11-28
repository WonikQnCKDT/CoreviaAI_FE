import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createTodo, deleteTodo, fetchAllTodos, fetchTodoPage, toTodoItem, updateTodo } from "@/features/mywork/api/todoApi";
import { jsonFail, jsonOk, stubFetch } from "@/test/appHarness";

const item = (overrides: Record<string, unknown> = {}) => ({
  id: 1, source: "PERSONAL", title: "보고서", dueDate: "2026-11-27", done: false, doneAt: null,
  projectId: null, taskStatus: null, urgency: 0, overdue: false, ...overrides,
});
const page = (items: unknown[], nextCursor: string | null = null) => ({ items, nextCursor, hasNext: nextCursor !== null });

beforeEach(() => vi.stubGlobal("window", globalThis));
afterEach(() => vi.unstubAllGlobals());

describe("toTodoItem", () => {
  it("개인·배정 업무를 source-id 키로 구분하고, 배정 업무만 프로젝트·상태를 쓴다", () => {
    expect(toTodoItem(item())).toMatchObject({ key: "personal-1", source: "personal", projectId: null, taskStatus: null });
    expect(toTodoItem(item({ source: "TASK", projectId: 77, taskStatus: "IN_PROGRESS", done: true }))).toMatchObject({
      key: "task-1", projectId: 77, taskStatus: "progress", done: false,
    });
  });

  it("모르는 source·잘못된 ID는 버리고, 범위 밖 urgency는 4(마감 없음), 날짜 형식이 틀리면 null", () => {
    expect(toTodoItem(item({ source: "OTHER" }))).toBeNull();
    expect(toTodoItem(item({ id: 0 }))).toBeNull();
    expect(toTodoItem(item({ urgency: 9, dueDate: "27/11" }))).toMatchObject({ urgency: 4, dueDate: null });
  });
});

describe("목록 조회", () => {
  it("한 페이지: size·done·cursor를 쿼리로 보낸다", async () => {
    const { calls } = stubFetch({ "GET /api/me/todos": () => jsonOk(page([item()])) });
    await fetchTodoPage({ done: true, cursor: "abc" });
    expect(calls[0].path).toBe("/api/me/todos?size=100&done=true&cursor=abc");
  });

  it("끝까지 이어 받고 같은 항목은 한 번만 담는다", async () => {
    const { calls } = stubFetch({
      "GET /api/me/todos": ({ url }) =>
        url.searchParams.get("cursor") ? jsonOk(page([item(), item({ id: 2, source: "TASK", projectId: 77 })])) : jsonOk(page([item()], "c1")),
    });
    const result = await fetchAllTodos({ done: false });
    expect(calls).toHaveLength(2);
    expect(result).toMatchObject({ ok: true, data: { truncated: false } });
    if (result.ok === true) expect(result.data.items.map((i) => i.key)).toEqual(["personal-1", "task-2"]);
  });

  it("다음 페이지가 400(INVALID_CURSOR)이면 첫 페이지부터 한 번만 다시 받는다", async () => {
    let n = 0;
    const { calls } = stubFetch({
      "GET /api/me/todos": ({ url }) => {
        n += 1;
        if (url.searchParams.get("cursor")) return jsonFail(400, "목록 조회 위치(cursor)가 올바르지 않습니다");
        return n === 1 ? jsonOk(page([item()], "c1")) : jsonOk(page([item()]));
      },
    });
    const result = await fetchAllTodos({ done: false });
    expect(calls.map((c) => c.path)).toEqual(["/api/me/todos?size=100&done=false", "/api/me/todos?size=100&done=false&cursor=c1", "/api/me/todos?size=100&done=false"]);
    expect(result.ok).toBe(true);
  });

  it("첫 페이지 실패는 그대로 돌려준다", async () => {
    stubFetch({ "GET /api/me/todos": () => jsonFail(500, "서버 오류") });
    expect(await fetchAllTodos({ done: false })).toMatchObject({ ok: false, failure: { status: 500 } });
  });

  it("상한(20페이지)에서 멈추고 잘렸다고 알린다", async () => {
    let n = 0;
    stubFetch({ "GET /api/me/todos": () => jsonOk(page([item({ id: (n += 1) })], `c${n}`)) });
    const result = await fetchAllTodos({ done: false });
    expect(result).toMatchObject({ ok: true, data: { truncated: true } });
    if (result.ok === true) expect(result.data.items).toHaveLength(20);
  });
});

describe("변경 요청", () => {
  it("등록은 requestId·다듬은 제목·마감일을 보내고 사용자 ID는 보내지 않는다", async () => {
    const { calls } = stubFetch({ "POST /api/me/todos": () => jsonOk({ id: 9, title: "보고서", dueDate: null, done: false, doneAt: null, createdAt: "", updatedAt: "" }) });
    const result = await createTodo({ requestId: "0b8b1d6e-6f0f-4b0a-9f00-000000000001", input: { title: " 보고서 ", dueDate: null } });
    expect(calls[0].body).toEqual({ requestId: "0b8b1d6e-6f0f-4b0a-9f00-000000000001", title: "보고서", dueDate: null });
    expect(result).toEqual({ ok: true, data: { id: 9, title: "보고서", dueDate: null, done: false } });
  });

  it("수정은 제목·마감·완료를 덮어쓰고, 삭제는 204를 성공으로 본다", async () => {
    const { calls } = stubFetch({
      "PATCH /api/me/todos/9": () => jsonOk({ id: 9, title: "보고서", dueDate: "2026-12-01", done: true, doneAt: "x", createdAt: "", updatedAt: "" }),
      "DELETE /api/me/todos/9": () => new Response(null, { status: 204 }),
    });
    await updateTodo({ todoId: 9, input: { title: "보고서", dueDate: "2026-12-01" }, done: true });
    expect(calls[0].body).toEqual({ title: "보고서", dueDate: "2026-12-01", done: true });
    expect(await deleteTodo({ todoId: 9 })).toEqual({ ok: true, data: null });
  });
});
