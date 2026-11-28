import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createAdminLabel, fetchAdminLabels, updateAdminLabel } from "@/features/admin/api/adminLabelApi";

const ok = (response: unknown) =>
  new Response(JSON.stringify({ success: true, response, error: null }), { status: 200 });

const fail = (status: number, message: string) =>
  new Response(JSON.stringify({ success: false, response: null, error: { message, status } }), { status });

/** 02-4 명세의 AdminLabelResponse */
const labelDto = (overrides: Record<string, unknown> = {}) => ({
  id: 3,
  labelKey: "button.save",
  textKo: "저장",
  textEn: "Save",
  textZhTw: null,
  version: 2,
  createdAt: "2026-11-21T00:00:00Z",
  updatedAt: "2026-11-22T00:00:00Z",
  ...overrides,
});

const fetchMock = vi.fn<typeof fetch>();

const lastRequest = () => {
  const [url, init] = fetchMock.mock.calls.at(-1) ?? [];
  return {
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

describe("fetchAdminLabels (GET /api/admin/i18n/labels)", () => {
  it("검색어·누락 필터·커서를 보내고 번역 누락을 null로 유지한다", async () => {
    fetchMock.mockResolvedValue(ok({ items: [labelDto()], nextCursor: "n1", hasNext: true }));
    const result = await fetchAdminLabels({ keyword: "  save ", missing: "zh-TW", cursor: "c0" });
    expect(lastRequest().url.pathname).toBe("/api/admin/i18n/labels");
    expect(Object.fromEntries(lastRequest().url.searchParams)).toEqual({ cursor: "c0", size: "20", keyword: "save", missing: "zh-TW" });
    expect(result).toEqual({
      ok: true,
      data: {
        items: [{ id: 3, labelKey: "button.save", textKo: "저장", textEn: "Save", textZhTw: null, version: 2, updatedAt: "2026-11-22T00:00:00Z" }],
        nextCursor: "n1",
        hasNext: true,
      },
    });
  });

  it("검색어는 100자까지만 보내고, 비면 보내지 않는다", async () => {
    fetchMock.mockImplementation(async () => ok({ items: [], nextCursor: null, hasNext: false }));
    await fetchAdminLabels({ keyword: "k".repeat(101) });
    expect(lastRequest().url.searchParams.get("keyword")).toHaveLength(100);
    await fetchAdminLabels({ keyword: "   " });
    expect(lastRequest().url.searchParams.has("keyword")).toBe(false);
  });

  it("400(잘못된 누락 언어·커서)은 실패로 돌려준다", async () => {
    fetchMock.mockResolvedValue(fail(400, "번역 누락 필터는 en 또는 zh-TW만 지정할 수 있습니다"));
    expect(await fetchAdminLabels({ cursor: "x" })).toMatchObject({ ok: false, failure: { status: 400 } });
  });
});

describe("createAdminLabel (POST)", () => {
  it("키와 문구의 앞뒤 공백을 지우고 빈 번역은 null로 보낸다", async () => {
    fetchMock.mockResolvedValue(ok(labelDto({ version: 0 })));
    await createAdminLabel({ labelKey: " button.save ", texts: { textKo: " 저장 ", textEn: "  ", textZhTw: "儲存" } });
    expect(lastRequest()).toMatchObject({
      method: "POST",
      body: { labelKey: "button.save", textKo: "저장", textEn: null, textZhTw: "儲存" },
    });
  });

  it("409 키 중복을 실패로 돌려준다", async () => {
    fetchMock.mockResolvedValue(fail(409, "이미 등록된 라벨 키입니다"));
    expect(
      await createAdminLabel({ labelKey: "button.save", texts: { textKo: "저장", textEn: "", textZhTw: "" } }),
    ).toMatchObject({ ok: false, failure: { status: 409 } });
  });
});

describe("updateAdminLabel (PATCH)", () => {
  it("세 언어 문구와 version만 보내고 라벨 키는 보내지 않는다", async () => {
    fetchMock.mockResolvedValue(ok(labelDto({ version: 3 })));
    const result = await updateAdminLabel({ labelId: 3, texts: { textKo: "저장", textEn: "Save", textZhTw: "" }, version: 2 });
    expect(lastRequest().url.pathname).toBe("/api/admin/i18n/labels/3");
    expect(lastRequest().body).toEqual({ textKo: "저장", textEn: "Save", textZhTw: null, version: 2 });
    expect(result.ok === true && result.data.version).toBe(3);
  });

  it("409 동시 수정을 실패로 돌려준다", async () => {
    fetchMock.mockResolvedValue(fail(409, "다른 사용자가 먼저 수정했습니다"));
    expect(
      await updateAdminLabel({ labelId: 3, texts: { textKo: "저장", textEn: "", textZhTw: "" }, version: 1 }),
    ).toMatchObject({ ok: false, failure: { status: 409 } });
  });
});
