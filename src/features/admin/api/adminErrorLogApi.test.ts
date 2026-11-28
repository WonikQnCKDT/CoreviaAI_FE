import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fetchErrorLog, fetchErrorLogs } from "@/features/admin/api/adminErrorLogApi";

const ok = (response: unknown) =>
  new Response(JSON.stringify({ success: true, response, error: null }), { status: 200 });

const fail = (status: number, message: string) =>
  new Response(JSON.stringify({ success: false, response: null, error: { message, status } }), { status });

/** 02-5 명세의 AdminErrorLogResponse */
const logDto = (overrides: Record<string, unknown> = {}) => ({
  id: 42,
  occurredAt: "2026-11-21T06:10:03.120Z",
  httpMethod: "POST",
  apiPath: "/api/projects/7/wbs/tasks",
  userId: 15,
  errorType: "org.springframework.dao.DataIntegrityViolationException",
  message: "could not execute statement; Key (code)=(****) already exists.",
  ...overrides,
});

const fetchMock = vi.fn<typeof fetch>();

const lastRequest = () => {
  const [url] = fetchMock.mock.calls.at(-1) ?? [];
  return { raw: String(url), url: new URL(String(url), "http://localhost") };
};

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
  vi.stubGlobal("window", globalThis);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("fetchErrorLogs (GET /api/admin/error-logs)", () => {
  it("기간·유형·경로·커서를 쿼리로 보내고 목록을 바꾼다", async () => {
    fetchMock.mockResolvedValue(ok({ items: [logDto()], nextCursor: "NDI", hasNext: true }));
    const result = await fetchErrorLogs({
      cursor: "c1",
      from: "2026-10-31T15:00:00.000Z",
      to: "2026-11-21T15:00:00.000Z",
      errorType: " java.lang.IllegalStateException ",
      apiPath: "/api/projects",
    });
    expect(lastRequest().url.pathname).toBe("/api/admin/error-logs");
    expect(Object.fromEntries(lastRequest().url.searchParams)).toEqual({
      cursor: "c1",
      size: "20",
      from: "2026-10-31T15:00:00.000Z",
      to: "2026-11-21T15:00:00.000Z",
      errorType: "java.lang.IllegalStateException",
      apiPath: "/api/projects",
    });
    expect(result).toEqual({ ok: true, data: { items: [logDto()], nextCursor: "NDI", hasNext: true } });
  });

  it("빈 조건은 보내지 않는다", async () => {
    fetchMock.mockResolvedValue(ok({ items: [], nextCursor: null, hasNext: false }));
    await fetchErrorLogs({ from: null, to: null, errorType: "  ", apiPath: "" });
    expect(Object.fromEntries(lastRequest().url.searchParams)).toEqual({ size: "20" });
  });

  it("경로의 %·_·& 같은 글자도 인코딩해 그대로 보낸다", async () => {
    fetchMock.mockResolvedValue(ok({ items: [], nextCursor: null, hasNext: false }));
    await fetchErrorLogs({ apiPath: "/api/a_b%c&x=1" });
    expect(lastRequest().url.searchParams.get("apiPath")).toBe("/api/a_b%c&x=1");
    expect(lastRequest().raw).not.toContain("&x=1");
  });

  it("로그인 전 요청(사용자·메서드·경로 없음)과 메시지 없음을 null로 둔다", async () => {
    fetchMock.mockResolvedValue(
      ok({ items: [logDto({ userId: null, httpMethod: null, apiPath: null, message: null })], nextCursor: null, hasNext: false }),
    );
    const result = await fetchErrorLogs({});
    expect(result.ok === true && result.data.items[0]).toMatchObject({ userId: null, httpMethod: null, apiPath: null, message: null });
  });

  it("400 INVALID_PERIOD를 실패로 돌려준다", async () => {
    fetchMock.mockResolvedValue(fail(400, "조회 시작 시각은 종료 시각보다 앞서야 합니다"));
    expect(await fetchErrorLogs({ from: "b", to: "a" })).toMatchObject({ ok: false, failure: { status: 400 } });
  });
});

describe("fetchErrorLog (GET /api/admin/error-logs/{errorLogId})", () => {
  it("스택 트레이스를 포함한 상세를 받는다", async () => {
    fetchMock.mockResolvedValue(ok({ ...logDto(), stackTrace: "java.lang.IllegalStateException: x\n\tat a.b" }));
    const result = await fetchErrorLog({ errorLogId: 42 });
    expect(lastRequest().url.pathname).toBe("/api/admin/error-logs/42");
    expect(result.ok === true && result.data.stackTrace).toBe("java.lang.IllegalStateException: x\n\tat a.b");
  });

  it("스택 트레이스가 없으면 null이다", async () => {
    fetchMock.mockResolvedValue(ok({ ...logDto(), stackTrace: null }));
    expect((await fetchErrorLog({ errorLogId: 42 })).ok === true).toBe(true);
  });

  it("없는 로그는 404 실패를 돌려준다", async () => {
    fetchMock.mockResolvedValue(fail(404, "에러 로그를 찾을 수 없습니다"));
    expect(await fetchErrorLog({ errorLogId: 9 })).toMatchObject({ ok: false, failure: { status: 404 } });
  });
});
