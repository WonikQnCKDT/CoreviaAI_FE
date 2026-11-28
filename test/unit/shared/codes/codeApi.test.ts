import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fetchCommonCodes } from "@/shared/codes/codeApi";

const ok = (response: unknown) =>
  new Response(JSON.stringify({ success: true, response, error: null }), { status: 200 });

const fail = (status: number, message: string) =>
  new Response(JSON.stringify({ success: false, response: null, error: { message, status } }), { status });

const fetchMock = vi.fn<typeof fetch>();

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
  vi.stubGlobal("window", globalThis);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("fetchCommonCodes (GET /api/codes/{groupCode})", () => {
  it("그룹별 사용 중 코드를 sortOrder 오름차순으로 변환한다", async () => {
    fetchMock.mockResolvedValue(
      ok({
        groupCode: "RISK_LEVEL",
        labelKey: "codeGroup.RISK_LEVEL",
        codes: [
          { code: "DANGER", labelKey: "code.RISK_LEVEL.DANGER", sortOrder: 3 },
          { code: "NORMAL", labelKey: "code.RISK_LEVEL.NORMAL", sortOrder: 1 },
          { code: "CAUTION", labelKey: "code.RISK_LEVEL.CAUTION", sortOrder: 2 },
        ],
      }),
    );

    const result = await fetchCommonCodes({ groupCode: "RISK_LEVEL" });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url] = fetchMock.mock.calls[0];
    expect(new URL(String(url), "http://localhost").pathname).toBe("/api/codes/RISK_LEVEL");
    expect(result).toEqual({
      ok: true,
      data: {
        groupCode: "RISK_LEVEL",
        labelKey: "codeGroup.RISK_LEVEL",
        codes: [
          { code: "NORMAL", labelKey: "code.RISK_LEVEL.NORMAL", sortOrder: 1 },
          { code: "CAUTION", labelKey: "code.RISK_LEVEL.CAUTION", sortOrder: 2 },
          { code: "DANGER", labelKey: "code.RISK_LEVEL.DANGER", sortOrder: 3 },
        ],
      },
    });
  });

  it("유효하지 않은 groupCode 형식은 네트워크 요청 없이 400 실패를 돌려준다", async () => {
    const result = await fetchCommonCodes({ groupCode: "../bad" });
    expect(fetchMock).not.toHaveBeenCalled();
    expect(result).toMatchObject({ ok: false, failure: { kind: "http", status: 400 } });
  });

  it("서버가 404를 돌려주면 실패를 돌려준다", async () => {
    fetchMock.mockResolvedValue(fail(404, "코드 그룹을 찾을 수 없습니다"));
    const result = await fetchCommonCodes({ groupCode: "UNKNOWN_GROUP" });
    expect(result).toMatchObject({ ok: false, failure: { kind: "http", status: 404 } });
  });

  it("응답 형식이 올바르지 않으면 실패로 처리한다", async () => {
    fetchMock.mockResolvedValue(ok({ groupCode: "RISK_LEVEL" }));
    const result = await fetchCommonCodes({ groupCode: "RISK_LEVEL" });
    expect(result.ok).toBe(false);
  });
});
