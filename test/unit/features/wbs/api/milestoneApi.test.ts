import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  createMilestone,
  deleteMilestone,
  fetchMilestones,
  MAX_MILESTONE_TASKS,
  MAX_MILESTONES,
  replaceMilestoneTasks,
  toMilestone,
  updateMilestone,
} from "@/features/wbs/api/milestoneApi";
import { jsonFail, jsonOk, stubFetch } from "@test/support/appHarness";

/** BE MilestoneResponse 모양 그대로(record 필드 순서, dDay는 @JsonProperty("dDay")) */
const milestoneDto = (overrides: Record<string, unknown> = {}) => ({
  id: 31,
  name: "분석 단계 종료",
  targetDate: "2026-12-10",
  source: "MANUAL",
  dDay: 12,
  delayed: false,
  linkedTaskCount: 2,
  incompleteTaskCount: 1,
  tasks: [
    { id: 101, parentTaskId: null, name: "요구사항 분석", status: "DONE", endDate: "2026-12-05" },
    { id: 102, parentTaskId: 101, name: "인터뷰", status: "IN_PROGRESS", endDate: "2026-12-08" },
  ],
  version: 3,
  ...overrides,
});

beforeEach(() => vi.stubGlobal("window", globalThis));
afterEach(() => vi.unstubAllGlobals());

describe("fetchMilestones", () => {
  it("목록을 화면 모델로 바꾼다(dDay·delayed·연결 작업 상태는 서버 값 그대로)", async () => {
    stubFetch({
      "GET /api/projects/7/wbs/milestones": () =>
        jsonOk({ milestones: [milestoneDto(), milestoneDto({ id: 32, source: "AI_DRAFT", dDay: -2, delayed: true, tasks: [] })] }),
    });
    const result = await fetchMilestones({ projectId: 7 });
    expect(result.ok).toBe(true);
    if (result.ok !== true) return;
    expect(result.data[0]).toEqual({
      id: 31,
      name: "분석 단계 종료",
      targetDate: "2026-12-10",
      source: "manual",
      dDay: 12,
      delayed: false,
      linkedTaskCount: 2,
      incompleteTaskCount: 1,
      tasks: [
        { id: 101, parentTaskId: null, name: "요구사항 분석", status: "done", endDate: "2026-12-05" },
        { id: 102, parentTaskId: 101, name: "인터뷰", status: "progress", endDate: "2026-12-08" },
      ],
      version: 3,
    });
    expect(result.data[1]).toMatchObject({ id: 32, source: "aiDraft", dDay: -2, delayed: true, tasks: [] });
  });

  it("빈 목록·null 목록은 빈 배열이다", async () => {
    stubFetch({ "GET /api/projects/7/wbs/milestones": () => jsonOk({ milestones: [] }) });
    expect(await fetchMilestones({ projectId: 7 })).toEqual({ ok: true, data: [] });
    stubFetch({ "GET /api/projects/7/wbs/milestones": () => jsonOk({ milestones: null }) });
    expect(await fetchMilestones({ projectId: 7 })).toEqual({ ok: true, data: [] });
  });

  it("서버 상한(200)보다 많이 오면 자른다", async () => {
    const many = Array.from({ length: MAX_MILESTONES + 5 }, (_, i) => milestoneDto({ id: i + 1 }));
    stubFetch({ "GET /api/projects/7/wbs/milestones": () => jsonOk({ milestones: many }) });
    const result = await fetchMilestones({ projectId: 7 });
    expect(result.ok === true && result.data.length).toBe(MAX_MILESTONES);
  });

  it("기능이 꺼진 프로젝트(404 FEATURE_DISABLED)는 실패로 그대로 돌려준다", async () => {
    stubFetch({ "GET /api/projects/7/wbs/milestones": () => jsonFail(404, "이 프로젝트에서 사용하지 않는 기능입니다") });
    const result = await fetchMilestones({ projectId: 7 });
    expect(result).toMatchObject({ ok: false, failure: { kind: "http", status: 404 } });
  });

  it("호출자의 취소 신호를 요청에 전달한다", async () => {
    const { fetchMock } = stubFetch({ "GET /api/projects/7/wbs/milestones": () => jsonOk({ milestones: [] }) });
    const controller = new AbortController();
    controller.abort();
    await fetchMilestones({ projectId: 7, signal: controller.signal });
    const init = fetchMock.mock.calls[0][1] as { signal?: AbortSignal };
    expect(init.signal?.aborted).toBe(true);
  });
});

describe("toMilestone (신뢰하지 않는 서버 값)", () => {
  it("dDay가 정수가 아니면 null, 개수가 음수·소수면 0, 모르는 상태는 todo, 날짜 형식이 틀리면 빈 값", () => {
    const m = toMilestone(
      milestoneDto({
        dDay: "3",
        delayed: "true",
        linkedTaskCount: -1,
        incompleteTaskCount: 1.5,
        targetDate: "2026/12/10",
        tasks: [{ id: 101, parentTaskId: 0, name: null, status: "WEIRD", endDate: null }, { id: -1 }, null],
      }) as never,
    );
    expect(m).toMatchObject({ dDay: null, delayed: false, linkedTaskCount: 0, incompleteTaskCount: 0, targetDate: "" });
    expect(m.tasks).toEqual([{ id: 101, parentTaskId: null, name: "", status: "todo", endDate: "" }]);
  });

  it("dDay 0·음수·큰 값을 그대로 둔다", () => {
    expect(toMilestone(milestoneDto({ dDay: 0 }) as never).dDay).toBe(0);
    expect(toMilestone(milestoneDto({ dDay: -1 }) as never).dDay).toBe(-1);
    expect(toMilestone(milestoneDto({ dDay: 36500 }) as never).dDay).toBe(36500);
  });
});

describe("변경 요청", () => {
  it("등록은 이름을 다듬고 연결 작업 중복을 빼서 보낸다", async () => {
    const { calls } = stubFetch({ "POST /api/projects/7/wbs/milestones": () => jsonOk(milestoneDto({ version: 0 })) });
    const result = await createMilestone({ projectId: 7, name: "  분석 단계 종료 ", targetDate: "2026-12-10", taskIds: [101, 102, 101] });
    expect(result.ok === true && result.data.id).toBe(31);
    expect(calls[0].body).toEqual({ name: "분석 단계 종료", targetDate: "2026-12-10", taskIds: [101, 102] });
  });

  it("등록에서 연결 작업이 없으면 빈 배열을 보낸다", async () => {
    const { calls } = stubFetch({ "POST /api/projects/7/wbs/milestones": () => jsonOk(milestoneDto({ tasks: [], linkedTaskCount: 0 })) });
    await createMilestone({ projectId: 7, name: "오픈", targetDate: "2026-12-31", taskIds: [] });
    expect(calls[0].body).toEqual({ name: "오픈", targetDate: "2026-12-31", taskIds: [] });
  });

  it("등록이 403(PM 전용)이면 실패를 돌려준다", async () => {
    stubFetch({ "POST /api/projects/7/wbs/milestones": () => jsonFail(403, "프로젝트 PM만 할 수 있는 작업입니다") });
    const result = await createMilestone({ projectId: 7, name: "오픈", targetDate: "2026-12-31", taskIds: [] });
    expect(result).toMatchObject({ ok: false, failure: { kind: "http", status: 403 } });
  });

  it("수정은 name·targetDate·version만 PATCH로 보낸다", async () => {
    const { calls } = stubFetch({ "PATCH /api/projects/7/wbs/milestones/31": () => jsonOk(milestoneDto({ name: "분석 종료", version: 4 })) });
    const result = await updateMilestone({ projectId: 7, milestoneId: 31, name: " 분석 종료 ", targetDate: "2026-12-11", version: 3 });
    expect(result.ok === true && result.data.version).toBe(4);
    expect(calls[0].body).toEqual({ name: "분석 종료", targetDate: "2026-12-11", version: 3 });
  });

  it("수정이 409(version 충돌)면 실패를 돌려준다", async () => {
    stubFetch({ "PATCH /api/projects/7/wbs/milestones/31": () => jsonFail(409, "다른 사용자가 먼저 수정했습니다") });
    const result = await updateMilestone({ projectId: 7, milestoneId: 31, name: "x", targetDate: "2026-12-11", version: 0 });
    expect(result).toMatchObject({ ok: false, failure: { status: 409 } });
  });

  it("연결 교체는 PUT .../tasks로 taskIds·version을 보낸다(빈 배열이면 모두 해제)", async () => {
    const { calls } = stubFetch({ "PUT /api/projects/7/wbs/milestones/31/tasks": () => jsonOk(milestoneDto({ tasks: [], linkedTaskCount: 0, incompleteTaskCount: 0 })) });
    const result = await replaceMilestoneTasks({ projectId: 7, milestoneId: 31, taskIds: [], version: 3 });
    expect(result.ok === true && result.data.linkedTaskCount).toBe(0);
    expect(calls[0].body).toEqual({ taskIds: [], version: 3 });
  });

  it("연결 교체는 상한 200개를 그대로 보낸다(경계값)", async () => {
    const { calls } = stubFetch({ "PUT /api/projects/7/wbs/milestones/31/tasks": () => jsonOk(milestoneDto()) });
    const ids = Array.from({ length: MAX_MILESTONE_TASKS }, (_, i) => i + 1);
    await replaceMilestoneTasks({ projectId: 7, milestoneId: 31, taskIds: ids, version: 3 });
    expect((calls[0].body as { taskIds: number[] }).taskIds).toHaveLength(MAX_MILESTONE_TASKS);
  });

  it("삭제는 DELETE를 보내고 응답 본문(null)을 그대로 성공으로 본다", async () => {
    const { calls } = stubFetch({ "DELETE /api/projects/7/wbs/milestones/31": () => jsonOk(null) });
    expect(await deleteMilestone({ projectId: 7, milestoneId: 31 })).toEqual({ ok: true, data: null });
    expect(calls[0]).toMatchObject({ method: "DELETE", path: "/api/projects/7/wbs/milestones/31" });
  });

  it("삭제가 404(이미 삭제)면 실패를 돌려준다", async () => {
    stubFetch({ "DELETE /api/projects/7/wbs/milestones/31": () => jsonFail(404, "마일스톤을 찾을 수 없습니다") });
    expect(await deleteMilestone({ projectId: 7, milestoneId: 31 })).toMatchObject({ ok: false, failure: { status: 404 } });
  });
});
