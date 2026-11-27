// @vitest-environment jsdom
import { useEffect, useState, type ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, screen, within } from "@testing-library/react";
import ProjectsPage from "@/pages/projects/page";
import TopBar from "@/layouts/TopBar";
import { useDemoStore } from "@/stores/DemoStore";
import { jsonFail, jsonOk, renderApp, stubFetch } from "@/test/appHarness";
import type { ServerProjectDetail } from "@/features/project/api/projectApi";

/** 목록 응답(ProjectSummaryResponse)에는 진척률이 없다 */
const summaryDto = (id: number, name: string) => ({
  id, code: `PRJ-${id}`, name, status: "IN_PROGRESS", template: "IT_PROJECT", methodology: "WATERFALL", visibility: "COMPANY",
  departments: [], pms: [{ id: 5, name: "홍길동" }], startDate: "2026-11-01", endDate: "2027-03-31", createdAt: "2026-11-01T00:00:00Z",
});

const detail = (id: number, name: string, progress: number): ServerProjectDetail => ({
  id, code: `PRJ-${id}`, name, status: "inProgress", template: "itProject", methodology: "waterfall", visibility: "company",
  departments: [], pms: [{ id: 5, name: "홍길동" }], startDate: "2026-11-01", endDate: "2027-03-31", createdAt: "2026-11-01T00:00:00Z",
  departmentType: "sw", createdBy: 5, actors: ["pm"], features: ["wbs"], progress, version: 0,
});

/** 상세를 받은 서버 프로젝트를 저장소에 넣는다(상세 화면을 먼저 연 상태) */
const SeedDetail = ({ children, details }: { children: ReactNode; details: ServerProjectDetail[] }) => {
  const { syncServerProjectDetail } = useDemoStore();
  const [ready, setReady] = useState(false);
  useEffect(() => {
    details.forEach((d) => syncServerProjectDetail({ detail: d, phases: [], members: [] }));
    setReady(true);
    // 처음 한 번만 넣는다.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return ready ? <>{children}</> : null;
};

const rowOf = (name: string) => screen.getByText(name).closest("tr") as HTMLElement;

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("서버 프로젝트 진척률 표시 (PR #2 P2)", () => {
  it("목록: 상세를 받은 프로젝트는 서버 값, 아직 모르는 프로젝트는 '-'(데모 계산 0%가 아님)", async () => {
    stubFetch({ "GET /api/projects": () => jsonOk({ items: [summaryDto(77, "구매 발주"), summaryDto(78, "인사 개편")], nextCursor: null, hasNext: false }) });
    renderApp({
      mode: "api",
      route: "/projects",
      routes: [{ path: "/projects", element: <ProjectsPage /> }],
      wrap: (tree) => <SeedDetail details={[detail(77, "구매 발주", 70)]}>{tree}</SeedDetail>,
    });
    expect(within(await screen.findByText("구매 발주").then(() => rowOf("구매 발주"))).getByText("70%")).toBeTruthy();
    // 진척률 칸은 '-'이고, 그 행 어디에도 데모 계산값(0% 등) 퍼센트가 없다
    const unknownRow = rowOf("인사 개편");
    expect(within(unknownRow).getAllByText("-").length).toBeGreaterThan(0);
    expect(unknownRow.textContent).not.toMatch(/\d+%/);
  });

  it("상세 상단: 서버 진척률을 보인다", async () => {
    stubFetch({
      "GET /api/notifications": () => jsonFail(404, "Not Found"),
      "GET /api/notifications/unread-count": () => jsonFail(404, "Not Found"),
    });
    renderApp({
      mode: "api",
      route: "/projects/77",
      routes: [{ path: "/projects/:projectId", element: <TopBar onOpenMenu={() => undefined} /> }],
      wrap: (tree) => <SeedDetail details={[detail(77, "구매 발주", 70)]}>{tree}</SeedDetail>,
    });
    expect((await screen.findByText("70%")).closest("p")?.textContent).toContain("진척률");
  });
});
