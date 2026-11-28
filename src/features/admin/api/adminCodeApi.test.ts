import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { changeCodeSortOrder, fetchCodeGroups, fetchGroupCodes } from "@/features/admin/api/adminCodeApi";

const ok = (response: unknown) =>
  new Response(JSON.stringify({ success: true, response, error: null }), { status: 200 });

const fail = (status: number, message: string) =>
  new Response(JSON.stringify({ success: false, response: null, error: { message, status } }), { status });

/** 02-3 명세의 AdminCodeResponse */
const codeDto = (overrides: Record<string, unknown> = {}) => ({
  id: 5,
  groupCode: "TASK_STATUS",
  code: "IN_PROGRESS",
  labelKey: "code.TASK_STATUS.IN_PROGRESS",
  sortOrder: 2,
  active: true,
  createdAt: "2026-11-21T00:00:00Z",
  updatedAt: "2026-11-21T00:00:00Z",
  ...overrides,
});

const fetchMock = vi.fn<typeof fetch>();

const lastRequest = () => {
  const [url, init] = fetchMock.mock.calls.at(-1) ?? [];
  return {
    // 인코딩을 확인하려고 URL 객체로 바꾸지 않은 원문도 둔다.
    raw: String(url),
    url: new URL(String(url), "http://localhost"),
    method: init?.method,
    body: init?.body ? JSON.parse(String(init.body)) : undefined,
  };
};

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
  vi.stubGlobal("window", globalThis);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("fetchCodeGroups (GET /api/admin/code-groups)", () => {
  it("그룹을 화면 모델로 바꾼다", async () => {
    fetchMock.mockResolvedValue(
      ok([{ id: 1, groupCode: "RISK_LEVEL", labelKey: "codeGroup.RISK_LEVEL", createdAt: "x", updatedAt: "y" }]),
    );
    expect(await fetchCodeGroups()).toEqual({ ok: true, data: [{ id: 1, groupCode: "RISK_LEVEL", labelKey: "codeGroup.RISK_LEVEL" }] });
    expect(lastRequest().url.pathname).toBe("/api/admin/code-groups");
  });

  it("빈 배열·null 응답을 빈 목록으로 다룬다", async () => {
    fetchMock.mockImplementationOnce(async () => ok([])).mockImplementationOnce(async () => ok(null));
    expect(await fetchCodeGroups()).toEqual({ ok: true, data: [] });
    expect(await fetchCodeGroups()).toEqual({ ok: true, data: [] });
  });

  it("시스템 관리자가 아니면 404 실패를 돌려준다", async () => {
    fetchMock.mockResolvedValue(fail(404, "페이지를 찾을 수 없습니다"));
    expect(await fetchCodeGroups()).toMatchObject({ ok: false, failure: { kind: "http", status: 404 } });
  });
});

describe("fetchGroupCodes (GET /api/admin/code-groups/{groupCode}/codes)", () => {
  it("사용 안 함 코드도 포함해 화면 모델로 바꾼다", async () => {
    fetchMock.mockResolvedValue(ok([codeDto(), codeDto({ id: 6, code: "REVIEW", active: false, sortOrder: 3 })]));
    const result = await fetchGroupCodes({ groupCode: "TASK_STATUS" });
    expect(lastRequest().url.pathname).toBe("/api/admin/code-groups/TASK_STATUS/codes");
    expect(result).toEqual({
      ok: true,
      data: [
        { id: 5, code: "IN_PROGRESS", labelKey: "code.TASK_STATUS.IN_PROGRESS", sortOrder: 2, active: true, updatedAt: "2026-11-21T00:00:00Z" },
        { id: 6, code: "REVIEW", labelKey: "code.TASK_STATUS.IN_PROGRESS", sortOrder: 3, active: false, updatedAt: "2026-11-21T00:00:00Z" },
      ],
    });
  });

  it("경로 조각을 인코딩한다", async () => {
    fetchMock.mockResolvedValue(ok([]));
    await fetchGroupCodes({ groupCode: "A/B?x" });
    expect(lastRequest().raw).toBe("/api/admin/code-groups/A%2FB%3Fx/codes");
  });
});

describe("changeCodeSortOrder (PATCH .../codes/{code})", () => {
  it("본문에 정렬 순서만 보낸다", async () => {
    fetchMock.mockResolvedValue(ok(codeDto({ sortOrder: 0 })));
    const result = await changeCodeSortOrder({ groupCode: "TASK_STATUS", code: "IN_PROGRESS", sortOrder: 0 });
    expect(lastRequest()).toMatchObject({ method: "PATCH", body: { sortOrder: 0 } });
    expect(Object.keys(lastRequest().body)).toEqual(["sortOrder"]);
    expect(lastRequest().url.pathname).toBe("/api/admin/code-groups/TASK_STATUS/codes/IN_PROGRESS");
    expect(result.ok === true && result.data.sortOrder).toBe(0);
  });

  it("없는 코드는 404 실패를 돌려준다", async () => {
    fetchMock.mockResolvedValue(fail(404, "코드를 찾을 수 없습니다"));
    expect(await changeCodeSortOrder({ groupCode: "TASK_STATUS", code: "GONE", sortOrder: 1 })).toEqual({
      ok: false,
      failure: { kind: "http", status: 404, code: null, message: "코드를 찾을 수 없습니다" },
    });
  });
});
