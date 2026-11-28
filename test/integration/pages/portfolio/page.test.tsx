// @vitest-environment jsdom
import { useEffect, useState, type ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, screen, waitFor } from "@testing-library/react";
import PortfolioPage from "@/pages/portfolio/page";
import { useDemoStore } from "@/stores/DemoStore";
import { PROJECT_TEXT } from "@/features/project/hooks/useServerProjects";
import { PORTFOLIO_TEXT } from "@/features/project/i18n/ko";
import { jsonFail, jsonOk, renderApp, stubFetch } from "@test/support/appHarness";

/** 목록 응답(ProjectSummaryResponse)에는 진척률이 없다. PM은 서버 사용자 5(로그인한 사람) */
const summaryDto = (id: number, name: string) => ({
  id, code: `PRJ-${id}`, name, status: "IN_PROGRESS", template: "IT_PROJECT", methodology: "WATERFALL", visibility: "COMPANY",
  departments: [], pms: [{ id: 5, name: "홍길동" }], startDate: "2026-11-01", endDate: "2099-03-31", createdAt: "2026-11-01T00:00:00Z",
});
const detailDto = (id: number, name: string, progress: number) => ({
  ...summaryDto(id, name), departmentType: "SW", createdBy: 5, actors: ["PM"], features: ["WBS"], progress, updatedAt: "2026-11-01T00:00:00Z", version: 0,
});
const listPage = (items: unknown[]) => ({ items, nextCursor: null, hasNext: false });

/** 서버 계정(5)을 화면 사용자로 연결한 뒤 화면을 그린다(실제 앱의 로그인 직후 상태) */
const SignedIn = ({ children }: { children: ReactNode }) => {
  const { signInWithAccount } = useDemoStore();
  const [ready, setReady] = useState(false);
  useEffect(() => {
    signInWithAccount({ userId: 5, loginId: "hong.gd", name: "홍길동", systemRole: "user", mustChangePassword: false });
    setReady(true);
    // 처음 한 번만 연결한다.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return ready ? <>{children}</> : null;
};

const ROUTES = [{ path: "/portfolio", element: <PortfolioPage /> }];
const renderApi = () => renderApp({ mode: "api", route: "/portfolio", routes: ROUTES, wrap: (tree) => <SignedIn>{tree}</SignedIn> });

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("api 모드 포트폴리오 — 서버 목록·진척률을 직접 불러온다", () => {
  it("목록을 받고 프로젝트마다 상세의 진척률을 채워, 부서 평균도 서버 값으로 계산한다", async () => {
    const { calls } = stubFetch({
      "GET /api/projects": () => jsonOk(listPage([summaryDto(77, "구매 발주"), summaryDto(78, "인사 개편")])),
      "GET /api/projects/77": () => jsonOk(detailDto(77, "구매 발주", 70)),
      "GET /api/projects/78": () => jsonOk(detailDto(78, "인사 개편", 30)),
    });
    renderApi();
    expect((await screen.findAllByText("구매 발주")).length).toBeGreaterThan(0);
    await waitFor(() => expect(screen.getAllByText("70%").length).toBeGreaterThan(0));
    expect(screen.getAllByText("30%").length).toBeGreaterThan(0);
    // 같은 부서 두 프로젝트의 평균 (70 + 30) / 2
    expect(screen.getAllByText("50%").length).toBeGreaterThan(0);
    expect(calls.some((c) => c.path.startsWith("/api/projects?"))).toBe(true);
    // 데모 프로젝트는 섞지 않는다(서버 프로젝트 2건만)
    expect(screen.getByText(/PM · 참여 프로젝트 2건/)).toBeTruthy();
  });

  it("상세를 받지 못한 프로젝트는 '-'이고 부서 평균에서 빠진다(0%로 계산하지 않는다)", async () => {
    stubFetch({
      "GET /api/projects": () => jsonOk(listPage([summaryDto(77, "구매 발주"), summaryDto(78, "인사 개편")])),
      "GET /api/projects/77": () => jsonOk(detailDto(77, "구매 발주", 70)),
      "GET /api/projects/78": () => jsonFail(500, "서버 오류"),
    });
    renderApi();
    // 77의 70%가 프로젝트 행과 부서 평균에 함께 나온다(평균이 35%가 아니다)
    await waitFor(() => expect(screen.getAllByText("70%").length).toBeGreaterThan(1));
    expect(screen.queryByText("35%")).toBeNull();
    expect(screen.getAllByText("-").length).toBeGreaterThan(0);
  });

  it("목록 조회가 실패하면 '권한 없음' 대신 오류와 다시 시도를 보이고, 다시 시도하면 회복한다", async () => {
    let fail = true;
    stubFetch({
      "GET /api/projects": () => (fail ? jsonFail(500, "서버 오류") : jsonOk(listPage([summaryDto(77, "구매 발주")]))),
      "GET /api/projects/77": () => jsonOk(detailDto(77, "구매 발주", 70)),
    });
    renderApi();
    expect(await screen.findByText(PROJECT_TEXT.loadListFailed)).toBeTruthy();
    expect(screen.queryByText(PORTFOLIO_TEXT.noAccessTitle)).toBeNull();
    fail = false;
    fireEvent.click(screen.getByRole("button", { name: PROJECT_TEXT.retry }));
    await waitFor(() => expect(screen.getAllByText("70%").length).toBeGreaterThan(0));
  });

  it("볼 수 있는 서버 프로젝트가 없으면(PM이 아님) 권한 없음 안내를 보인다", async () => {
    stubFetch({ "GET /api/projects": () => jsonOk(listPage([])) });
    renderApi();
    expect(await screen.findByText(PORTFOLIO_TEXT.noAccessTitle)).toBeTruthy();
  });

  it("데모 모드는 서버를 부르지 않는다", async () => {
    const { calls } = stubFetch({});
    renderApp({ mode: "demo", route: "/portfolio", routes: ROUTES });
    await screen.findByRole("heading", { name: PORTFOLIO_TEXT.deptProgressTitle });
    expect(calls).toHaveLength(0);
  });
});
