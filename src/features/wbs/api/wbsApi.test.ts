import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  applyWbsDraft,
  createWbsTask,
  deleteWbsTask,
  fetchWbsTree,
  generateWbsDraft,
  moveWbsTask,
  toDraft,
  toEffort,
  updateTaskProgress,
  updateWbsTask,
} from "@/features/wbs/api/wbsApi";
import { jsonFail, jsonOk, stubFetch } from "@/test/appHarness";

/** BE WbsTaskResponse 모양 그대로 */
const taskDto = (overrides: Record<string, unknown> = {}) => ({
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
  estimatedEffort: 3.5,
  taskType: "TASK",
  priority: "MEDIUM",
  progress: 0,
  status: "TODO",
  source: "MANUAL",
  version: 0,
  subtasks: [],
  ...overrides,
});

const FIELDS = { name: "  설계  ", description: "  ", assigneeUserId: 11, startDate: "2026-12-01", endDate: "2026-12-05", estimatedEffort: 2 };

beforeEach(() => vi.stubGlobal("window", globalThis));
afterEach(() => vi.unstubAllGlobals());

describe("fetchWbsTree", () => {
  it("트리를 화면 모델로 바꾼다(상태·출처·공수 문자열·하위작업)", async () => {
    stubFetch({
      "GET /api/projects/7/wbs/tasks": () =>
        jsonOk({
          tasks: [
            taskDto({
              scheduleDerived: true,
              estimatedEffort: "4.0",
              status: "IN_PROGRESS",
              source: "AI_DRAFT",
              subtasks: [taskDto({ id: 102, parentTaskId: 101, assignee: null, estimatedEffort: null, status: "DONE", progress: 100 })],
            }),
          ],
        }),
    });
    const result = await fetchWbsTree({ projectId: 7 });
    expect(result.ok).toBe(true);
    if (result.ok !== true) return;
    const [task] = result.data;
    expect(task).toMatchObject({ id: 101, status: "progress", source: "aiDraft", scheduleDerived: true, estimatedEffort: 4, description: "" });
    expect(task.subtasks[0]).toMatchObject({ id: 102, assignee: null, estimatedEffort: null, status: "done", progress: 100 });
  });

  it("모르는 상태는 todo, 진척률은 0~100으로 자르고, 하위작업 아래 단계는 버린다", async () => {
    stubFetch({
      "GET /api/projects/7/wbs/tasks": () =>
        jsonOk({
          tasks: [
            taskDto({
              status: "WEIRD",
              progress: 140,
              subtasks: [taskDto({ id: 102, parentTaskId: 101, progress: -3, subtasks: [taskDto({ id: 103 })] })],
            }),
          ],
        }),
    });
    const result = await fetchWbsTree({ projectId: 7 });
    if (result.ok !== true) throw new Error("성공해야 한다");
    expect(result.data[0].status).toBe("todo");
    expect(result.data[0].progress).toBe(100);
    expect(result.data[0].subtasks[0].progress).toBe(0);
    expect(result.data[0].subtasks[0].subtasks).toEqual([]);
  });

  it("tasks가 null이면 빈 트리, 실패는 그대로 돌려준다", async () => {
    stubFetch({ "GET /api/projects/7/wbs/tasks": () => jsonOk({ tasks: null }) });
    expect(await fetchWbsTree({ projectId: 7 })).toEqual({ ok: true, data: [] });
    stubFetch({ "GET /api/projects/7/wbs/tasks": () => jsonFail(404, "이 프로젝트에서 사용하지 않는 기능입니다") });
    expect(await fetchWbsTree({ projectId: 7 })).toMatchObject({ ok: false, failure: { status: 404 } });
  });
});

describe("toEffort", () => {
  it.each([
    [3.5, 3.5],
    ["0.1", 0.1],
    [0, null],
    [-1, null],
    ["abc", null],
    [null, null],
  ])("%s → %s", (input, expected) => {
    expect(toEffort(input)).toBe(expected);
  });
});

describe("변경 요청 본문", () => {
  it("최상위 작업 등록은 phaseId를 보내고 이름을 다듬고 빈 설명은 null", async () => {
    const { calls } = stubFetch({ "POST /api/projects/7/wbs/tasks": () => jsonOk({ taskId: 200, tasks: [] }) });
    await createWbsTask({ projectId: 7, parentTaskId: null, phaseId: 3, fields: FIELDS });
    expect(calls[0].body).toEqual({
      name: "설계",
      description: null,
      assigneeUserId: 11,
      startDate: "2026-12-01",
      endDate: "2026-12-05",
      estimatedEffort: 2,
      parentTaskId: null,
      phaseId: 3,
    });
  });

  it("하위작업 등록은 단계를 상위에서 물려받으므로 phaseId를 null로 보낸다", async () => {
    const { calls } = stubFetch({ "POST /api/projects/7/wbs/tasks": () => jsonOk({ taskId: 201, tasks: [] }) });
    await createWbsTask({ projectId: 7, parentTaskId: 101, phaseId: 3, fields: FIELDS });
    expect(calls[0].body).toMatchObject({ parentTaskId: 101, phaseId: null });
  });

  it("수정은 version과 phaseId를 함께 보낸다", async () => {
    const { calls } = stubFetch({ "PATCH /api/projects/7/wbs/tasks/101": () => jsonOk({ taskId: 101, tasks: [taskDto()] }) });
    const result = await updateWbsTask({ projectId: 7, taskId: 101, phaseId: 1, fields: FIELDS, version: 4 });
    expect(calls[0].body).toMatchObject({ phaseId: 1, version: 4, name: "설계" });
    expect(result).toMatchObject({ ok: true, data: { taskId: 101, tasks: [{ id: 101 }] } });
  });

  it("이동·삭제·진척률 경로와 본문", async () => {
    const { calls } = stubFetch({
      "PUT /api/projects/7/wbs/tasks/101/position": () => jsonOk({ taskId: 101, tasks: [] }),
      "DELETE /api/projects/7/wbs/tasks/101": () => jsonOk({ taskId: 101, tasks: [] }),
      "PATCH /api/projects/7/tasks/101/progress": () => jsonOk({ id: 101, progress: 60, status: "IN_PROGRESS", version: 5 }),
    });
    await moveWbsTask({ projectId: 7, taskId: 101, parentTaskId: null, index: 0, version: 2 });
    await deleteWbsTask({ projectId: 7, taskId: 101 });
    const progress = await updateTaskProgress({ projectId: 7, taskId: 101, progress: 60, version: 4 });
    expect(calls.map((c) => [c.method, c.path, c.body])).toEqual([
      ["PUT", "/api/projects/7/wbs/tasks/101/position", { parentTaskId: null, index: 0, version: 2 }],
      ["DELETE", "/api/projects/7/wbs/tasks/101", undefined],
      ["PATCH", "/api/projects/7/tasks/101/progress", { progress: 60, version: 4 }],
    ]);
    expect(progress).toEqual({ ok: true, data: { id: 101, progress: 60, status: "progress", version: 5 } });
  });
});

describe("AI 초안", () => {
  it("생성 요청은 빈 값을 null로, 빈 제약조건 줄은 뺀다", async () => {
    const { calls } = stubFetch({ "POST /api/projects/7/wbs/ai-draft": () => jsonFail(503, "AI 기능을 준비 중입니다") });
    const result = await generateWbsDraft({
      projectId: 7,
      input: { projectPurpose: " 발주 전산화 ", requirementsText: "", constraints: ["12월 오픈", " ", ""], userInstruction: " " },
    });
    expect(calls[0].body).toEqual({ projectPurpose: "발주 전산화", requirementsText: null, constraints: ["12월 오픈"], userInstruction: null });
    expect(result).toMatchObject({ ok: false, failure: { status: 503 } });
  });

  it("toDraft: 단계별 작업을 펼치고 단계 ID를 붙이며 잘못된 항목은 버린다", () => {
    const draft = toDraft({
      status: "AI_DRAFT",
      draftToken: "tok",
      expiresAt: "2026-11-27T01:00:00Z",
      stages: [
        {
          phaseId: 1,
          phaseName: "분석",
          tasks: [
            {
              tempId: "T-001",
              name: "요구사항 분석",
              description: null,
              estimatedPersonDays: "3.5",
              suggestedAssigneeId: 11,
              suggestedRole: "DEVELOPER",
              startDate: "2026-12-01",
              endDate: "bad-date",
              dependencies: ["T-000", 3 as unknown as string],
              subtasks: [{ tempId: "ST-1", name: "정리", description: null, estimatedPersonDays: null }, { tempId: "", name: "x", description: null, estimatedPersonDays: null }],
              reason: "근거",
            },
            { tempId: "", name: "임시 ID 없음", description: null, estimatedPersonDays: null, suggestedAssigneeId: null, suggestedRole: null, startDate: null, endDate: null, dependencies: null, subtasks: null, reason: null },
          ],
        },
        { phaseId: null, phaseName: null, tasks: null },
      ],
      milestones: [{ tempId: "M-1", name: "설계 완료", targetDate: "2026-12-20", relatedTaskIds: ["T-001"], reason: null }],
      feasibility: { status: "AT_RISK", reason: "기간 부족" },
      warnings: ["주의"],
      suggestions: null,
      assumptions: null,
      clarificationQuestions: null,
    });
    expect(draft.tasks).toHaveLength(1);
    expect(draft.tasks[0]).toMatchObject({ tempId: "T-001", phaseId: 1, estimatedPersonDays: 3.5, startDate: "2026-12-01", endDate: "", dependencies: ["T-000"] });
    expect(draft.tasks[0].subtasks.map((s) => s.tempId)).toEqual(["ST-1"]);
    expect(draft.feasibility).toEqual({ status: "atRisk", reason: "기간 부족" });
    expect(draft.suggestions).toEqual([]);
  });

  it("반영 응답은 반영 건수로 바꾼다", async () => {
    stubFetch({ "POST /api/projects/7/wbs/ai-draft/apply": () => jsonOk({ taskIds: { "T-001": 101, "ST-1": 102 }, milestoneIds: { "M-1": 7 } }) });
    const result = await applyWbsDraft({ projectId: 7, body: { draftToken: "tok", tasks: [], milestones: [], rejectedCount: 0 } });
    expect(result).toEqual({ ok: true, data: { taskCount: 2, milestoneCount: 1 } });
  });
});
