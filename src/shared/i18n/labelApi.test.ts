import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { subscribeAuthEvents } from "@/shared/api/authEvents";
import { fetchMyLabels, fetchMyLanguage, fetchPublicLabels, updateMyLanguage } from "@/shared/i18n/labelApi";

const ok = (response: unknown) =>
  new Response(JSON.stringify({ success: true, response, error: null }), { status: 200 });

const fail = (status: number, message: string) =>
  new Response(JSON.stringify({ success: false, response: null, error: { message, status } }), { status });

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

describe("fetchPublicLabels (GET /api/i18n/labels)", () => {
  it("지원 언어만 lang 쿼리로 보내고, 서버가 적용한 언어를 쓴다", async () => {
    fetchMock.mockResolvedValue(ok({ lang: "zh-TW", labels: { "button.save": "儲存" } }));
    const result = await fetchPublicLabels({ language: "zh-TW" });
    expect(lastRequest().url.pathname).toBe("/api/i18n/labels");
    expect(lastRequest().url.searchParams.get("lang")).toBe("zh-TW");
    expect(result.ok === true && result.data.language).toBe("zh-TW");
    expect(result.ok === true && { ...result.data.labels }).toEqual({ "button.save": "儲存" });
  });

  it("언어가 없거나 허용 목록 밖이면 lang을 보내지 않고 브라우저 언어(Accept-Language)를 따른다", async () => {
    fetchMock.mockImplementation(async () => ok({ lang: "ko", labels: {} }));
    await fetchPublicLabels();
    expect(lastRequest().url.search).toBe("");
    await fetchPublicLabels({ language: "ja" as never });
    expect(lastRequest().url.search).toBe("");
  });

  it("서버가 모르는 언어를 돌려주면 한국어로 보고, 문자열이 아닌 문구는 버린다", async () => {
    fetchMock.mockResolvedValue(ok({ lang: "xx", labels: { a: "A", b: 3, c: { html: "<b>" } } }));
    const result = await fetchPublicLabels();
    expect(result.ok === true && result.data.language).toBe("ko");
    expect(result.ok === true && { ...result.data.labels }).toEqual({ a: "A" });
  });

  it("공개 API라 401이 와도 로그아웃 처리(세션 종료 이벤트)를 하지 않는다", async () => {
    const events: unknown[] = [];
    const unsubscribe = subscribeAuthEvents((event) => events.push(event));
    fetchMock.mockResolvedValue(fail(401, "로그인이 필요합니다"));
    const result = await fetchPublicLabels();
    unsubscribe();
    expect(result.ok).toBe(false);
    expect(events).toEqual([]);
  });

  it("응답 본문이 비면 실패로 돌려준다", async () => {
    fetchMock.mockResolvedValue(new Response("", { status: 200 }));
    expect((await fetchPublicLabels()).ok).toBe(false);
  });
});

describe("사용자 언어 (/api/me/language)", () => {
  it("저장한 언어의 묶음을 받는다", async () => {
    fetchMock.mockResolvedValue(ok({ lang: "en", labels: { "menu.myWork": "My work" } }));
    const result = await fetchMyLabels();
    expect(lastRequest().url.pathname).toBe("/api/me/language/labels");
    expect(result.ok === true && result.data.language).toBe("en");
  });

  it("설정 조회는 저장값·적용 언어·version을 바꿔 준다 (저장 안 함은 null)", async () => {
    fetchMock.mockResolvedValue(ok({ preferredLanguage: null, effectiveLanguage: "ko", version: 4 }));
    expect(await fetchMyLanguage()).toEqual({ ok: true, data: { preferred: null, effective: "ko", version: 4 } });
  });

  it("저장은 PUT으로 정규화한 언어와 version만 보낸다", async () => {
    fetchMock.mockResolvedValue(ok({ preferredLanguage: "zh-TW", effectiveLanguage: "zh-TW", version: 5 }));
    await updateMyLanguage({ language: "zh-TW", version: 4 });
    expect(lastRequest()).toMatchObject({ method: "PUT", body: { language: "zh-TW", version: 4 } });
    expect(Object.keys(lastRequest().body)).toEqual(["language", "version"]);
  });

  it("version이 다르면 409 실패를 돌려준다", async () => {
    fetchMock.mockResolvedValue(fail(409, "다른 사용자가 먼저 수정했습니다"));
    expect(await updateMyLanguage({ language: "en", version: 1 })).toMatchObject({ ok: false, failure: { status: 409 } });
  });
});
