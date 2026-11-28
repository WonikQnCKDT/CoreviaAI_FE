// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import { AuthContext } from "@/features/auth/authContext";
import { fakeAuth, jsonFail, jsonOk, stubFetch } from "@/test/appHarness";
import { invalidateCodeCache, resetCodeCache } from "@/shared/codes/codeStore";
import { useCommonCodes } from "@/shared/codes/useCommonCodes";
import { applyLabels, resetLabels } from "@/shared/i18n/store";
import type { CommonCodeGroup } from "@/shared/codes/codeApi";

const Probe = function ({ groupCode }: { groupCode: CommonCodeGroup }) {
  const { codes, labelOf, source, loading } = useCommonCodes(groupCode);
  return (
    <div>
      <span data-testid="source">{source}</span>
      <span data-testid="loading">{String(loading)}</span>
      <span data-testid="single">{labelOf("DANGER")}</span>
      <ul>
        {codes.map((item) => (
          <li key={item.code} data-testid={`item-${item.code}`}>
            {item.code}:{item.label}
          </li>
        ))}
      </ul>
    </div>
  );
};

beforeEach(() => {
  resetCodeCache();
  resetLabels();
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  resetCodeCache();
  resetLabels();
});

describe("useCommonCodes (FR-ADM-07)", () => {
  it("데모 모드에서는 API를 호출하지 않고 정적 폴백 라벨을 사용한다", () => {
    const { calls } = stubFetch({});
    render(
      <AuthContext.Provider value={fakeAuth("demo")}>
        <Probe groupCode="RISK_LEVEL" />
      </AuthContext.Provider>,
    );
    expect(calls).toHaveLength(0);
    expect(screen.getByTestId("source").textContent).toBe("fallback");
    expect(screen.getAllByRole("listitem").map((el) => el.textContent)).toEqual([
      "NORMAL:정상",
      "CAUTION:주의",
      "DANGER:위험",
    ]);
  });

  it("서버 모드에서는 GET /api/codes/{groupCode}를 조회해 정렬 순서를 반영하고 캐시한다", async () => {
    const { calls } = stubFetch({
      "GET /api/codes/RISK_LEVEL": () =>
        jsonOk({
          groupCode: "RISK_LEVEL",
          labelKey: "codeGroup.RISK_LEVEL",
          codes: [
            { code: "DANGER", labelKey: "code.RISK_LEVEL.DANGER", sortOrder: 1 },
            { code: "CAUTION", labelKey: "code.RISK_LEVEL.CAUTION", sortOrder: 2 },
            { code: "NORMAL", labelKey: "code.RISK_LEVEL.NORMAL", sortOrder: 3 },
          ],
        }),
    });

    const { unmount } = render(
      <AuthContext.Provider value={fakeAuth("api")}>
        <Probe groupCode="RISK_LEVEL" />
      </AuthContext.Provider>,
    );

    await waitFor(() => expect(screen.getByTestId("source").textContent).toBe("server"));
    expect(screen.getAllByRole("listitem").map((el) => el.textContent)).toEqual([
      "DANGER:위험",
      "CAUTION:주의",
      "NORMAL:정상",
    ]);
    expect(calls).toHaveLength(1);

    // 두 번째 마운트는 캐시에서 즉시 읽고 네트워크를 다시 부르지 않는다.
    unmount();
    render(
      <AuthContext.Provider value={fakeAuth("api")}>
        <Probe groupCode="RISK_LEVEL" />
      </AuthContext.Provider>,
    );
    expect(screen.getByTestId("source").textContent).toBe("server");
    expect(calls).toHaveLength(1);
  });

  it("서버 조회에 실패하면 기존 라벨 폴백으로 안전하게 표시한다", async () => {
    stubFetch({
      "GET /api/codes/RISK_LEVEL": () => jsonFail(500, "서버 오류"),
    });

    render(
      <AuthContext.Provider value={fakeAuth("api")}>
        <Probe groupCode="RISK_LEVEL" />
      </AuthContext.Provider>,
    );

    await waitFor(() => expect(screen.getByTestId("loading").textContent).toBe("false"));
    expect(screen.getByTestId("source").textContent).toBe("fallback");
    expect(screen.getByTestId("single").textContent).toBe("위험");
  });

  it("다국어 라벨이 적용되면 code.<GROUP>.<CODE> 키로 번역 문구를 표시한다", async () => {
    applyLabels({
      language: "en",
      labels: {
        "code.RISK_LEVEL.NORMAL": "Normal",
        "code.RISK_LEVEL.CAUTION": "Caution",
        // DANGER는 일부러 누락 -> 한국어 폴백 확인
      },
    });
    stubFetch({
      "GET /api/codes/RISK_LEVEL": () =>
        jsonOk({
          groupCode: "RISK_LEVEL",
          labelKey: "codeGroup.RISK_LEVEL",
          codes: [
            { code: "NORMAL", labelKey: "code.RISK_LEVEL.NORMAL", sortOrder: 1 },
            { code: "CAUTION", labelKey: "code.RISK_LEVEL.CAUTION", sortOrder: 2 },
            { code: "DANGER", labelKey: "code.RISK_LEVEL.DANGER", sortOrder: 3 },
          ],
        }),
    });

    render(
      <AuthContext.Provider value={fakeAuth("api")}>
        <Probe groupCode="RISK_LEVEL" />
      </AuthContext.Provider>,
    );

    await waitFor(() => expect(screen.getByTestId("source").textContent).toBe("server"));
    expect(screen.getAllByRole("listitem").map((el) => el.textContent)).toEqual([
      "NORMAL:Normal",
      "CAUTION:Caution",
      "DANGER:위험",
    ]);
  });

  it("캐시 무효화(invalidateCodeCache) 후 다시 서버에서 조회한다", async () => {
    let callCount = 0;
    stubFetch({
      "GET /api/codes/RISK_LEVEL": () => {
        callCount += 1;
        return jsonOk({
          groupCode: "RISK_LEVEL",
          labelKey: "codeGroup.RISK_LEVEL",
          codes:
            callCount === 1
              ? [{ code: "NORMAL", labelKey: "code.RISK_LEVEL.NORMAL", sortOrder: 1 }]
              : [
                  { code: "DANGER", labelKey: "code.RISK_LEVEL.DANGER", sortOrder: 1 },
                  { code: "NORMAL", labelKey: "code.RISK_LEVEL.NORMAL", sortOrder: 2 },
                ],
        });
      },
    });

    render(
      <AuthContext.Provider value={fakeAuth("api")}>
        <Probe groupCode="RISK_LEVEL" />
      </AuthContext.Provider>,
    );

    await waitFor(() => expect(screen.getAllByRole("listitem")).toHaveLength(1));
    await act(async () => {
      invalidateCodeCache("RISK_LEVEL");
    });
    await waitFor(() => expect(screen.getAllByRole("listitem")).toHaveLength(2));
    expect(callCount).toBe(2);
  });
});
