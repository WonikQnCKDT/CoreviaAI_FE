import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  createEvent,
  fetchCalendarTasks,
  fetchEvents,
  fetchWorklog,
  fetchWorklogDates,
  fetchWorklogTasks,
  saveWorklog,
  saveWorklogTask,
  updateEvent,
} from "@/features/mywork/api/scheduleApi";
import { jsonFail, jsonOk, stubFetch } from "@/test/appHarness";

const event = (overrides: Record<string, unknown> = {}) => ({
  id: 1, title: "회의", startAt: "2026-12-01T00:00:00Z", endAt: "2026-12-01T01:00:00Z", allDay: false, memo: null, createdAt: "", updatedAt: "", ...overrides,
});

beforeEach(() => vi.stubGlobal("window", globalThis));
afterEach(() => vi.unstubAllGlobals());

describe("개인 일정", () => {
  it("offset 페이지를 끝까지 받는다(page 0부터)", async () => {
    const { calls } = stubFetch({
      "GET /api/me/events": ({ url }) =>
        jsonOk({ items: [event({ id: Number(url.searchParams.get("page")) + 1 })], page: 0, size: 100, hasNext: url.searchParams.get("page") === "0" }),
    });
    const result = await fetchEvents({ from: "2026-11-30T15:00:00.000Z", to: "2026-12-31T15:00:00.000Z" });
    expect(calls.map((c) => new URL(c.path, "http://x").searchParams.get("page"))).toEqual(["0", "1"]);
    expect(result).toMatchObject({ ok: true, data: { items: [{ id: 1, memo: "" }, { id: 2 }], truncated: false } });
  });

  it("시각이 잘못된 항목은 버린다", async () => {
    stubFetch({ "GET /api/me/events": () => jsonOk({ items: [event({ startAt: "nope" }), event({ id: 2 })], page: 0, size: 100, hasNext: false }) });
    const result = await fetchEvents({ from: "a", to: "b" });
    if (result.ok !== true) throw new Error("성공해야 한다");
    expect(result.data.items.map((e) => e.id)).toEqual([2]);
  });

  it("등록·수정은 다듬은 제목과 빈 메모 null을 보낸다", async () => {
    const { calls } = stubFetch({
      "POST /api/me/events": () => jsonOk(event()),
      "PATCH /api/me/events/1": () => jsonOk(event()),
    });
    const input = { title: " 회의 ", startAt: "2026-12-01T00:00:00.000Z", endAt: "2026-12-01T01:00:00.000Z", allDay: false, memo: "  " };
    await createEvent({ input });
    await updateEvent({ eventId: 1, input });
    expect(calls.map((c) => c.body)).toEqual([
      { title: "회의", startAt: input.startAt, endAt: input.endAt, allDay: false, memo: null },
      { title: "회의", startAt: input.startAt, endAt: input.endAt, allDay: false, memo: null },
    ]);
  });
});

describe("통합 캘린더", () => {
  it("담당 업무(TASK)만 쓴다", async () => {
    stubFetch({
      "GET /api/me/calendar": () =>
        jsonOk({
          items: [
            { id: 1, source: "PERSONAL", title: "회의", startAt: "2026-12-01T00:00:00Z", endAt: "2026-12-01T01:00:00Z", allDay: false, projectId: null, taskStatus: null, progress: null, spentMinutes: null },
            { id: 7, source: "TASK", title: "API 설계", startAt: "2026-11-30T15:00:00Z", endAt: "2026-12-03T15:00:00Z", allDay: true, projectId: 77, taskStatus: "IN_PROGRESS", progress: 40, spentMinutes: 90 },
          ],
          hasNext: false,
        }),
    });
    const result = await fetchCalendarTasks({ from: "a", to: "b" });
    expect(result).toMatchObject({ ok: true, data: { items: [{ id: 7, projectId: 77, status: "progress", progress: 40, spentMinutes: 90 }] } });
  });
});

describe("업무일지", () => {
  it("그날 일지가 없으면(404) 빈 일지로 본다, 다른 실패는 그대로", async () => {
    stubFetch({ "GET /api/me/worklogs/2026-12-01": () => jsonFail(404, "업무일지를 찾을 수 없습니다") });
    expect(await fetchWorklog({ logDate: "2026-12-01" })).toEqual({ ok: true, data: { logDate: "2026-12-01", content: "" } });
    stubFetch({ "GET /api/me/worklogs/2026-12-01": () => jsonFail(500, "x") });
    expect(await fetchWorklog({ logDate: "2026-12-01" })).toMatchObject({ ok: false });
  });

  it("저장·기간 목록", async () => {
    const { calls } = stubFetch({
      "PUT /api/me/worklogs/2026-12-01": () => jsonOk({ logDate: "2026-12-01", content: "# 오늘", createdAt: "", updatedAt: "" }),
      "GET /api/me/worklogs": () => jsonOk([{ logDate: "2026-11-30", content: "" }, { logDate: "bad" }]),
    });
    expect(await saveWorklog({ logDate: "2026-12-01", content: "# 오늘" })).toEqual({ ok: true, data: { logDate: "2026-12-01", content: "# 오늘" } });
    expect(calls[0].body).toEqual({ content: "# 오늘" });
    expect(await fetchWorklogDates({ from: "2026-11-01", to: "2026-12-01" })).toEqual({ ok: true, data: ["2026-11-30"] });
    expect(calls[1].path).toBe("/api/me/worklogs?from=2026-11-01&to=2026-12-01");
  });

  it("업무 기록: 조회와 저장 본문(업무·연결 기록 version 포함)", async () => {
    const { calls } = stubFetch({
      "GET /api/me/worklogs/2026-12-01/tasks": () => jsonOk({ items: [{ id: 3, taskId: 7, userId: 5, logDate: "2026-12-01", content: null, progress: 40, spentMinutes: 30, completed: false, version: 2 }], hasNext: false }),
      "PUT /api/me/worklogs/2026-12-01/tasks/7": () => jsonOk({ id: 3, taskId: 7, userId: 5, logDate: "2026-12-01", content: "메모", progress: 100, spentMinutes: 60, completed: true, version: 3 }),
    });
    expect(await fetchWorklogTasks({ logDate: "2026-12-01" })).toMatchObject({ ok: true, data: { items: [{ taskId: 7, content: "", version: 2 }] } });
    const saved = await saveWorklogTask({
      logDate: "2026-12-01",
      taskId: 7,
      input: { projectId: 77, content: " ", progress: 100, spentMinutes: 60, completed: true, taskVersion: 5, version: 2 },
    });
    expect(calls[1].body).toEqual({ projectId: 77, content: null, progress: 100, spentMinutes: 60, completed: true, taskVersion: 5, version: 2 });
    expect(saved).toMatchObject({ ok: true, data: { completed: true, version: 3 } });
  });
});
