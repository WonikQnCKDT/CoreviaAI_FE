// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ADMIN_PROJECT_CODE_PATTERN, normalizeProjectCode, reassignProjectPm } from "@/features/admin/api/adminProjectApi";

const ok = (response: unknown) => new Response(JSON.stringify({ success: true, response, error: null }), { status: 200 });
const fail = (status: number, message: string) =>
  new Response(JSON.stringify({ success: false, response: null, error: { message, status } }), { status });

const fetchMock = vi.fn<typeof fetch>();

const lastRequest = () => {
  const [input, init] = fetchMock.mock.calls[fetchMock.mock.calls.length - 1];
  return { url: new URL(String(input), "http://localhost"), method: init?.method, body: init?.body ? JSON.parse(String(init.body)) : undefined };
};

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("reassignProjectPm (PUT /api/admin/projects/pm)", () => {
  it("코드를 대문자로 정규화해 보내고 재지정 후 PM 목록(ProjectPmResponse)을 받는다", async () => {
    fetchMock.mockResolvedValue(ok({ projectId: 77, projectCode: "PRT-2026-001", pms: [{ id: 21, name: "새PM" }] }));

    const result = await reassignProjectPm({ projectCode: "  prt-2026-001 ", newPmUserId: 21 });

    expect(lastRequest()).toMatchObject({ method: "PUT", body: { projectCode: "PRT-2026-001", newPmUserId: 21 } });
    expect(lastRequest().url.pathname).toBe("/api/admin/projects/pm");
    expect(result).toEqual({ ok: true, data: { projectId: 77, projectCode: "PRT-2026-001", pms: [{ id: 21, name: "새PM" }] } });
  });

  it("PM 목록이 비거나 이름이 없어도 빈 값으로 바꾼다", async () => {
    fetchMock.mockResolvedValue(ok({ projectId: 1, projectCode: "A1", pms: [{ id: 3, name: null }] }));
    expect(await reassignProjectPm({ projectCode: "a1", newPmUserId: 3 })).toMatchObject({ ok: true, data: { pms: [{ id: 3, name: "" }] } });

    fetchMock.mockResolvedValue(ok({ projectId: 1, projectCode: "A1", pms: null }));
    expect(await reassignProjectPm({ projectCode: "a1", newPmUserId: 3 })).toMatchObject({ ok: true, data: { pms: [] } });
  });

  it("활성 PM이 남아 있거나 코드가 없으면 409", async () => {
    fetchMock.mockResolvedValue(fail(409, "PM을 재지정할 수 없는 프로젝트입니다"));
    expect(await reassignProjectPm({ projectCode: "PRT-1", newPmUserId: 3 })).toMatchObject({ ok: false, failure: { kind: "http", status: 409 } });
  });
});

describe("프로젝트 코드 규칙", () => {
  it("영문·숫자로 시작하는 영문·숫자·하이픈 2~20자", () => {
    expect(ADMIN_PROJECT_CODE_PATTERN.test("A1")).toBe(true);
    expect(ADMIN_PROJECT_CODE_PATTERN.test("A".repeat(20))).toBe(true);
    expect(ADMIN_PROJECT_CODE_PATTERN.test("A")).toBe(false);
    expect(ADMIN_PROJECT_CODE_PATTERN.test("A".repeat(21))).toBe(false);
    expect(ADMIN_PROJECT_CODE_PATTERN.test("-AB")).toBe(false);
    expect(ADMIN_PROJECT_CODE_PATTERN.test("AB_1")).toBe(false);
  });

  it("앞뒤 공백을 지우고 대문자로 바꾼다", () => {
    expect(normalizeProjectCode(" prt-1 ")).toBe("PRT-1");
  });
});
