import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createMeeting, deleteMeeting, fetchMeeting, fetchMeetings, updateMeeting, type MeetingInput } from "@/features/meeting/api/meetingApi";
import { jsonFail, jsonOk, stubFetch } from "@test/support/appHarness";

const detailDto = (overrides: Record<string, unknown> = {}) => ({
  id: 1, projectId: 77, title: "주간 회의", heldAt: "2026-12-01T01:00:00Z", content: null, authorUserId: 11, authorName: "이개발", version: 2,
  attendees: [{ id: 1, userId: 11, name: "이개발", external: false }, { id: 2, userId: null, name: "김부장", external: true }],
  decisions: [{ id: 2, content: "둘째", sortOrder: 2, source: "MANUAL" }, { id: 1, content: "첫째", sortOrder: 1, source: "AI" }],
  actionItems: [{ id: 1, content: "견적", assigneeUserId: 11, assigneeName: "이개발", dueDate: "2026-12-05", status: "CONVERTED", source: "MANUAL", taskId: 9 }],
  createdAt: "", updatedAt: "", ...overrides,
});

const input: MeetingInput = {
  title: " 주간 회의 ",
  heldAt: "2026-12-01T01:00:00.000Z",
  content: "  ",
  attendees: [{ userId: 11 }, { externalName: "김부장" }],
  decisions: ["범위 확정"],
  actionItems: [{ content: "견적", assigneeUserId: null, dueDate: null }],
};

beforeEach(() => vi.stubGlobal("window", globalThis));
afterEach(() => vi.unstubAllGlobals());

describe("회의록 API", () => {
  it("목록: 검색어·커서·크기를 쿼리로, 다듬은 검색어(200자까지)", async () => {
    const { calls } = stubFetch({
      "GET /api/projects/77/meetings": () => jsonOk({ items: [{ id: 1, title: "t", heldAt: "2026-12-01T01:00:00Z", authorUserId: 11, authorName: "이개발", version: 0 }, { id: 2, heldAt: "bad" }], nextCursor: "c2", hasNext: true }),
    });
    const result = await fetchMeetings({ projectId: 77, keyword: " 100%_견적 ", cursor: "c1" });
    const url = new URL(calls[0].path, "http://x");
    expect(url.searchParams.get("keyword")).toBe("100%_견적");
    expect(url.searchParams.get("cursor")).toBe("c1");
    expect(result).toMatchObject({ ok: true, data: { items: [{ id: 1 }], nextCursor: "c2", hasNext: true } });
  });

  it("상세: 결정사항은 순서대로, 출처·상태를 화면 값으로", async () => {
    stubFetch({ "GET /api/projects/77/meetings/1": () => jsonOk(detailDto()) });
    const result = await fetchMeeting({ projectId: 77, meetingId: 1 });
    if (result.ok !== true) throw new Error("성공해야 한다");
    expect(result.data.decisions).toEqual([{ content: "첫째", source: "ai" }, { content: "둘째", source: "manual" }]);
    expect(result.data.attendees[1]).toEqual({ userId: null, name: "김부장", external: true });
    expect(result.data.actionItems[0]).toMatchObject({ status: "converted", taskId: 9 });
    expect(result.data.content).toBe("");
  });

  it("작성은 requestId를, 수정은 version을 함께 보내고 빈 본문은 null", async () => {
    const { calls } = stubFetch({
      "POST /api/projects/77/meetings": () => jsonOk(detailDto()),
      "PATCH /api/projects/77/meetings/1": () => jsonOk(detailDto({ version: 3 })),
    });
    await createMeeting({ projectId: 77, requestId: "k1", input });
    await updateMeeting({ projectId: 77, meetingId: 1, version: 2, input });
    const common = { title: "주간 회의", heldAt: input.heldAt, content: null, attendees: input.attendees, decisions: input.decisions, actionItems: input.actionItems };
    expect(calls[0].body).toEqual({ requestId: "k1", ...common });
    expect(calls[1].body).toEqual({ version: 2, ...common });
  });

  it("삭제 204 성공, 409는 그대로 실패", async () => {
    stubFetch({ "DELETE /api/projects/77/meetings/1": () => new Response(null, { status: 204 }) });
    expect(await deleteMeeting({ projectId: 77, meetingId: 1 })).toEqual({ ok: true, data: null });
    stubFetch({ "DELETE /api/projects/77/meetings/1": () => jsonFail(409, "연결된 회의록 항목은 이 기능에서 수정하거나 삭제할 수 없습니다") });
    expect(await deleteMeeting({ projectId: 77, meetingId: 1 })).toMatchObject({ ok: false, failure: { status: 409 } });
  });
});
