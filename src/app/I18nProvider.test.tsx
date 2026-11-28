// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import I18nProvider from "@/app/I18nProvider";
import { AuthContext } from "@/features/auth/authContext";
import { useI18n } from "@/shared/i18n/i18nContext";
import { resetLabels } from "@/shared/i18n/store";
import NotFound from "@/pages/NotFound";
import { fakeAuth, jsonFail, jsonOk, stubFetch } from "@/test/appHarness";

const LanguageSwitchProbe = function () {
  const { language, changeLanguage } = useI18n();
  return (
    <div>
      <span data-testid="lang">{language}</span>
      <button type="button" onClick={() => void changeLanguage("zh-TW")}>
        switch-zh
      </button>
    </div>
  );
};

beforeEach(() => {
  resetLabels();
  localStorage.clear();
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  resetLabels();
  localStorage.clear();
});

describe("I18nProvider 번역 전환 및 누락 시 한국어 폴백 (FR-ADM-06)", () => {
  it("부분 번역 묶음을 받으면 번역된 문구는 해당 언어로, 누락·빈 문구는 한국어로 폴백한다", async () => {
    stubFetch({
      "GET /api/me/language/labels": () =>
        jsonOk({
          lang: "en",
          labels: {
            "common.ui.notFoundTitle": "Page not found",
            // 빈 문자열은 누락으로 보고 한국어 폴백
            "common.ui.goToMyWork": "",
            // common.ui.goToProjects는 키 자체가 없음 -> 한국어 폴백
          },
        }),
    });

    render(
      <AuthContext.Provider value={fakeAuth("api")}>
        <I18nProvider>
          <MemoryRouter initialEntries={["/unknown"]}>
            <NotFound />
          </MemoryRouter>
        </I18nProvider>
      </AuthContext.Provider>,
    );

    expect(await screen.findByText("Page not found")).toBeTruthy();
    expect(screen.getByText("내 업무로 이동")).toBeTruthy();
    expect(screen.getByText("프로젝트 목록")).toBeTruthy();
  });

  it("언어 전환 시 재배포 없이 화면 문구가 즉시 새 언어로 바뀌고 누락 키는 한국어를 유지한다", async () => {
    let currentLang = "en";
    stubFetch({
      "GET /api/me/language/labels": () =>
        jsonOk(
          currentLang === "en"
            ? { lang: "en", labels: { "common.ui.notFoundTitle": "Page not found" } }
            : { lang: "zh-TW", labels: { "common.ui.notFoundTitle": "找不到頁面" } },
        ),
      "GET /api/me/language": () => jsonOk({ preferredLanguage: currentLang, effectiveLanguage: currentLang, version: 1 }),
      "PUT /api/me/language": ({ body }) => {
        const next = (body as { language: string }).language;
        currentLang = next;
        return jsonOk({ preferredLanguage: next, effectiveLanguage: next, version: 2 });
      },
    });

    render(
      <AuthContext.Provider value={fakeAuth("api")}>
        <I18nProvider>
          <MemoryRouter initialEntries={["/unknown"]}>
            <LanguageSwitchProbe />
            <NotFound />
          </MemoryRouter>
        </I18nProvider>
      </AuthContext.Provider>,
    );

    expect(await screen.findByText("Page not found")).toBeTruthy();
    expect(screen.getByTestId("lang").textContent).toBe("en");

    fireEvent.click(screen.getByRole("button", { name: "switch-zh" }));

    expect(await screen.findByText("找不到頁面")).toBeTruthy();
    expect(screen.getByTestId("lang").textContent).toBe("zh-TW");
    // 번역이 없는 링크 문구는 한국어 폴백 유지
    expect(screen.getByText("내 업무로 이동")).toBeTruthy();
  });

  it("라벨 묶음 조회에 실패해도 한국어 기본 문구로 화면이 정상 표시된다", async () => {
    stubFetch({
      "GET /api/me/language/labels": () => jsonFail(500, "서버 오류"),
    });

    render(
      <AuthContext.Provider value={fakeAuth("api")}>
        <I18nProvider>
          <MemoryRouter initialEntries={["/unknown"]}>
            <NotFound />
          </MemoryRouter>
        </I18nProvider>
      </AuthContext.Provider>,
    );

    await waitFor(() => expect(screen.getByText("페이지를 찾을 수 없습니다")).toBeTruthy());
    expect(screen.getByText("내 업무로 이동")).toBeTruthy();
  });
});
