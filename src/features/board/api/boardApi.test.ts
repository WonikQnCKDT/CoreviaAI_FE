import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  createBoardColumn,
  deleteBoardColumn,
  fetchBoard,
  fetchTaskDetail,
  fetchTaskHistories,
  moveBoardCard,
  reorderBoardColumns,
  toHistoryValues,
  updateBoardColumn,
  updateTaskAttributes,
} from "@/features/board/api/boardApi";
import { jsonFail, jsonOk, stubFetch } from "@/test/appHarness";

const card = (overrides: Record<string, unknown> = {}) => ({
  id: 103,
  phaseId: 1,
  parentTaskId: 101,
  parentTaskName: "설계",
  name: "API 설계",
  taskType: "TASK",
  priority: "MEDIUM",
  status: "TODO",
  assignee: { id: 11, name: "김QA" },
  startDate: "2026-12-01",
  endDate: "2026-12-05",
  progress: 0,
  statusChangedAt: null,
  completedAt: null,
  version: 0,
  ...overrides,
});

const column = (overrides: Record<string, unknown> = {}) => ({
  id: 31,
  name: null,
  labelKey: "code.TASK_STATUS.TODO",
  statusCategory: "TODO",
  sortOrder: 1,
  wipLimit: null,
  cardCount: 1,
  wipExceeded: false,
  cards: [card()],
  ...overrides,
});

beforeEach(() => vi.stubGlobal("window", globalThis));
afterEach(() => vi.unstubAllGlobals());

describe("fetchBoard", () => {
  it("컬럼을 순서대로 정렬하고 카드·라벨 키를 화면 모델로 바꾼다", async () => {
    stubFetch({
      "GET /api/projects/7/board": () =>
        jsonOk({
          columns: [
            column({ id: 32, name: " 개발 중 ", labelKey: null, statusCategory: "IN_PROGRESS", sortOrder: 2, wipLimit: 3, cardCount: 4, wipExceeded: true, cards: [card({ id: 104, taskType: "DEFECT", priority: "HIGH", status: "IN_PROGRESS" })] }),
            column(),
          ],
        }),
    });
    const result = await fetchBoard({ projectId: 7 });
    if (result.ok !== true) throw new Error("성공해야 한다");
    expect(result.data.map((c) => c.id)).toEqual([31, 32]);
    expect(result.data[1]).toMatchObject({ name: "개발 중", labelKey: null, statusCategory: "progress", wipLimit: 3, wipExceeded: true });
    expect(result.data[1].cards[0]).toMatchObject({ taskType: "defect", priority: "high", status: "progress" });
    expect(result.data[0].cards[0]).toMatchObject({ parentTaskName: "설계", assignee: { id: 11, name: "김QA" } });
  });

  it("라벨 키 형식이 아니면 버리고, 상태를 모르는 컬럼은 뺀다", async () => {
    stubFetch({
      "GET /api/projects/7/board": () => jsonOk({ columns: [column({ labelKey: "<img src=x>" }), column({ id: 99, statusCategory: "WEIRD" })] }),
    });
    const result = await fetchBoard({ projectId: 7 });
    if (result.ok !== true) throw new Error("성공해야 한다");
    expect(result.data).toHaveLength(1);
    expect(result.data[0].labelKey).toBeNull();
  });

  it("담당자 필터는 쿼리로 보낸다", async () => {
    const { calls } = stubFetch({ "GET /api/projects/7/board": () => jsonOk({ columns: [] }) });
    await fetchBoard({ projectId: 7, assigneeUserId: 11 });
    await fetchBoard({ projectId: 7, assigneeUserId: null });
    expect(calls.map((c) => c.path)).toEqual(["/api/projects/7/board?assigneeUserId=11", "/api/projects/7/board"]);
  });
});

describe("카드 이동·컬럼 관리 요청", () => {
  it("카드 이동은 columnId·version을 보내고 WIP 경고를 돌려준다", async () => {
    const { calls } = stubFetch({
      "PUT /api/projects/7/board/cards/103/column": () => jsonOk({ card: card({ status: "DONE", progress: 100, version: 3 }), column: column({ id: 34, cards: undefined }), wipWarning: true }),
    });
    const result = await moveBoardCard({ projectId: 7, taskId: 103, columnId: 34, version: 2 });
    expect(calls[0].body).toEqual({ columnId: 34, version: 2 });
    expect(result).toMatchObject({ ok: true, data: { card: { status: "done", progress: 100, version: 3 }, wipWarning: true } });
  });

  it("컬럼 추가·수정은 빈 이름을 null로, 상태는 서버 코드로 보낸다", async () => {
    const { calls } = stubFetch({
      "POST /api/projects/7/board/columns": () => jsonOk({ columns: [column({ cards: undefined })] }),
      "PATCH /api/projects/7/board/columns/31": () => jsonOk({ columns: [column({ cards: undefined })] }),
      "PUT /api/projects/7/board/columns/order": () => jsonOk({ columns: [] }),
      "DELETE /api/projects/7/board/columns/31": () => jsonOk({ columns: [] }),
    });
    await createBoardColumn({ projectId: 7, name: "  ", statusCategory: "review", wipLimit: 5 });
    await updateBoardColumn({ projectId: 7, columnId: 31, name: " 대기열 ", wipLimit: null });
    await reorderBoardColumns({ projectId: 7, columnIds: [32, 31] });
    const deleted = await deleteBoardColumn({ projectId: 7, columnId: 31 });
    expect(calls.map((c) => [c.method, c.body])).toEqual([
      ["POST", { name: null, statusCategory: "REVIEW", wipLimit: 5 }],
      ["PATCH", { name: "대기열", wipLimit: null }],
      ["PUT", { columnIds: [32, 31] }],
      ["DELETE", undefined],
    ]);
    expect(deleted).toEqual({ ok: true, data: [] });
  });

  it("실패는 그대로 돌려준다", async () => {
    stubFetch({ "DELETE /api/projects/7/board/columns/31": () => jsonFail(409, "카드가 있는 컬럼은 삭제할 수 없습니다") });
    expect(await deleteBoardColumn({ projectId: 7, columnId: 31 })).toMatchObject({ ok: false, failure: { status: 409 } });
  });
});

describe("업무 상세·이력", () => {
  const detail = {
    id: 103, projectId: 7, phaseId: 1, parentTaskId: 101, name: "로그인 오류", description: null, taskType: "DEFECT", priority: "HIGH",
    completionCriteria: "재현 절차로 다시 확인", assignee: { id: 11, name: "김QA" }, startDate: "2026-12-01", endDate: "2026-12-03",
    scheduleDerived: false, estimatedEffort: "1.5", progress: 0, status: "TODO", source: "MANUAL", completedAt: null, boardColumnId: null,
    statusChangedAt: null, createdBy: { id: 7, name: "박PM" }, createdAt: "2026-11-21T01:00:00Z", updatedAt: "2026-11-21T01:00:00Z", version: 0,
  };

  it("상세를 화면 모델로 바꾼다", async () => {
    stubFetch({ "GET /api/projects/7/tasks/103": () => jsonOk(detail) });
    const result = await fetchTaskDetail({ projectId: 7, taskId: 103 });
    expect(result).toMatchObject({ ok: true, data: { taskType: "defect", priority: "high", estimatedEffort: 1.5, description: "", createdBy: { name: "박PM" } } });
  });

  it("속성 수정은 서버 코드로, 공백 완료 조건은 null로 보낸다", async () => {
    const { calls } = stubFetch({ "PATCH /api/projects/7/tasks/103": () => jsonOk({ ...detail, version: 1 }) });
    await updateTaskAttributes({ projectId: 7, taskId: 103, taskType: "task", priority: "low", completionCriteria: "  ", version: 0 });
    expect(calls[0].body).toEqual({ taskType: "TASK", priority: "LOW", completionCriteria: null, version: 0 });
  });

  it("이력은 커서·크기를 보내고 활동 종류를 바꾸며, 모르는 종류는 other", async () => {
    const { calls } = stubFetch({
      "GET /api/projects/7/tasks/103/histories": () =>
        jsonOk({
          items: [
            { id: 51, activityType: "ASSIGNED", before: { assigneeUserId: null }, after: { assigneeUserId: 11 }, actor: { id: 7, name: "박PM" }, occurredAt: "2026-11-21T01:05:00Z" },
            { id: 52, activityType: "NEW_KIND", before: null, after: null, actor: null, occurredAt: "x" },
          ],
          nextCursor: "c2",
          hasNext: true,
        }),
    });
    const result = await fetchTaskHistories({ projectId: 7, taskId: 103, cursor: "c1" });
    expect(calls[0].path).toBe("/api/projects/7/tasks/103/histories?size=20&cursor=c1");
    if (result.ok !== true) throw new Error("성공해야 한다");
    expect(result.data.items.map((h) => h.activity)).toEqual(["assigned", "other"]);
    expect(result.data.items[0].after).toEqual({ assigneeUserId: "11" });
    expect(result.data).toMatchObject({ nextCursor: "c2", hasNext: true });
  });

  it("toHistoryValues: 객체만 받고 값은 문자열로, 중첩은 JSON, 긴 값은 자른다", () => {
    expect(toHistoryValues(null)).toBeNull();
    expect(toHistoryValues([1])).toBeNull();
    expect(toHistoryValues("text")).toBeNull();
    const values = toHistoryValues({ a: 1, b: true, c: { x: 1 }, d: "가".repeat(3000), e: null });
    expect(values).toMatchObject({ a: "1", b: "true", c: '{"x":1}', e: null });
    expect(values?.d).toHaveLength(2000);
  });
});
