import { describe, expect, it } from "vitest";
import type { ApiFailure } from "@/shared/api/client";
import type { TodoItem } from "@/features/mywork/api/todoApi";
import { TODO_TEXT } from "@/features/mywork/i18n/ko";
import { interpretTodoFailure, matchesFilter, newRequestId, requestIdFor, todoStats, validateTodoInput } from "@/features/mywork/utils/todoRules";

const http = (status: number, message: string | null = null): ApiFailure => ({ kind: "http", status, code: null, message });

const todo = (overrides: Partial<TodoItem> = {}): TodoItem => ({
  id: 1, source: "personal", key: "personal-1", title: "t", dueDate: null, done: false,
  projectId: null, taskStatus: null, urgency: 4, overdue: false, ...overrides,
});

describe("validateTodoInput", () => {
  it("200자는 통과, 201자·공백만·제어 문자는 거부", () => {
    expect(validateTodoInput({ title: "가".repeat(200), dueDate: "" })).toMatchObject({ ok: true });
    expect(validateTodoInput({ title: "가".repeat(201), dueDate: "" })).toEqual({ ok: false, message: TODO_TEXT.titleTooLong });
    expect(validateTodoInput({ title: "   ", dueDate: "" })).toEqual({ ok: false, message: TODO_TEXT.titleRequired });
    expect(validateTodoInput({ title: "a\tb", dueDate: "" })).toEqual({ ok: false, message: TODO_TEXT.titleControl });
    expect(validateTodoInput({ title: "a\nb", dueDate: "" })).toEqual({ ok: false, message: TODO_TEXT.titleControl });
  });

  it("제목은 다듬고, 마감일은 날짜 형식일 때만(비우면 null)", () => {
    expect(validateTodoInput({ title: " 보고 ", dueDate: "2026-12-01" })).toEqual({ ok: true, input: { title: "보고", dueDate: "2026-12-01" } });
    expect(validateTodoInput({ title: "보고", dueDate: "" })).toEqual({ ok: true, input: { title: "보고", dueDate: null } });
  });
});

describe("등록 멱등 키", () => {
  it("UUID v4 형식", () => {
    expect(newRequestId()).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  });

  it("같은 입력의 재시도는 같은 키, 입력이 바뀌면 새 키", () => {
    const pending = { requestId: "k1", input: { title: "보고", dueDate: null } };
    expect(requestIdFor(pending, { title: "보고", dueDate: null })).toBe("k1");
    expect(requestIdFor(pending, { title: "보고", dueDate: "2026-12-01" })).not.toBe("k1");
    expect(requestIdFor(null, { title: "보고", dueDate: null })).not.toBe("k1");
  });
});

describe("필터·집계 (서버 urgency·overdue 기준)", () => {
  const items = [
    todo({ key: "a", urgency: 0 }),
    todo({ key: "b", urgency: 1 }),
    todo({ key: "c", urgency: 2, overdue: true }),
    todo({ key: "d", urgency: 4, source: "task" }),
  ];
  const done = [todo({ key: "e", done: true })];

  it("오늘·임박·지연·완료·전체", () => {
    const pick = (f: Parameters<typeof matchesFilter>[1]) => [...items, ...done].filter((i) => matchesFilter(i, f)).map((i) => i.key);
    expect(pick("today")).toEqual(["a"]);
    expect(pick("soon")).toEqual(["b"]);
    expect(pick("late")).toEqual(["c"]);
    expect(pick("done")).toEqual(["e"]);
    expect(pick("open")).toEqual(["a", "b", "c", "d"]);
    expect(pick("all")).toHaveLength(5);
  });

  it("KPI 수", () => {
    expect(todoStats(items, done)).toEqual({ today: 1, soon: 1, late: 1, open: 4, done: 1 });
  });
});

describe("실패 해석", () => {
  it("네트워크·시간 초과는 키를 남겨 같은 입력 재전송이 중복되지 않게 한다", () => {
    expect(interpretTodoFailure("create", { kind: "timeout" })).toEqual({ message: TODO_TEXT.timeout, reload: false, resetRequest: false });
    expect(interpretTodoFailure("create", { kind: "network" }).resetRequest).toBe(false);
  });

  it("등록 409는 새 키로 다시 등록하게 하고 목록을 다시 받는다", () => {
    expect(interpretTodoFailure("create", http(409))).toEqual({ message: TODO_TEXT.createConflict, reload: true, resetRequest: true });
  });

  it("400은 서버 메시지, 404는 다시 받기, 수정·삭제 409는 동시 처리 안내", () => {
    expect(interpretTodoFailure("update", http(400, "할 일 마감일은 0001-01-01부터 9999-12-31까지 입력해 주세요")).message).toContain("마감일");
    expect(interpretTodoFailure("delete", http(404))).toEqual({ message: TODO_TEXT.notFound, reload: true, resetRequest: false });
    expect(interpretTodoFailure("update", http(409))).toEqual({ message: TODO_TEXT.concurrent, reload: true, resetRequest: false });
    expect(interpretTodoFailure("load", http(503)).message).toBe(TODO_TEXT.serverError);
  });
});
