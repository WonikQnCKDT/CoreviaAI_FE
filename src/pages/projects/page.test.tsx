// @vitest-environment jsdom
import { useEffect, useState, type ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, screen, waitFor, within } from "@testing-library/react";
import ProjectsPage from "@/pages/projects/page";
import TopBar from "@/layouts/TopBar";
import { useDemoStore } from "@/stores/DemoStore";
import { jsonFail, jsonOk, renderApp, stubFetch } from "@/test/appHarness";
import type { ServerProjectDetail } from "@/features/project/api/projectApi";
import { PROGRESS_FETCH_CONCURRENCY, PROJECT_TEXT } from "@/features/project/hooks/useServerProjects";

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

/** 상세 응답(ProjectDetailResponse) — 진척률은 여기에만 있다 */
const detailDto = (id: number, name: string, progress: number) => ({
  ...summaryDto(id, name), departmentType: "SW", createdBy: 5, actors: ["PM"], features: ["WBS"], progress, updatedAt: "2026-11-01T00:00:00Z", version: 0,
});
const listPage = (items: unknown[]) => ({ items, nextCursor: null, hasNext: false });
const renderList = () => renderApp({ mode: "api", route: "/projects", routes: [{ path: "/projects", element: <ProjectsPage /> }] });

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
  it("목록: 목록 응답에는 진척률이 없어 프로젝트마다 상세를 불러 서버 값을 보인다(0%도 그대로)", async () => {
    const { calls } = stubFetch({
      "GET /api/projects": () => jsonOk(listPage([summaryDto(77, "구매 발주"), summaryDto(78, "인사 개편")])),
      "GET /api/projects/77": () => jsonOk(detailDto(77, "구매 발주", 70)),
      "GET /api/projects/78": () => jsonOk(detailDto(78, "인사 개편", 0)),
    });
    renderList();
    await screen.findByText("구매 발주");
    await waitFor(() => expect(within(rowOf("구매 발주")).getByText("70%")).toBeTruthy());
    await waitFor(() => expect(within(rowOf("인사 개편")).getByText("0%")).toBeTruthy());
    expect(calls.filter((c) => c.path === "/api/projects/77").length).toBe(1);
  });

  it("목록: 상세를 받지 못한 프로젝트만 '-'로 남고 목록은 그대로 보인다", async () => {
    stubFetch({
      "GET /api/projects": () => jsonOk(listPage([summaryDto(77, "구매 발주"), summaryDto(78, "인사 개편")])),
      "GET /api/projects/77": () => jsonOk(detailDto(77, "구매 발주", 70)),
      "GET /api/projects/78": () => jsonFail(500, "서버 오류"),
    });
    renderList();
    await waitFor(() => expect(within(rowOf("구매 발주")).getByText("70%")).toBeTruthy());
    const failedRow = rowOf("인사 개편");
    expect(within(failedRow).getAllByText("-").length).toBeGreaterThan(0);
    // 데모 계산값(0% 등)으로 대신하지 않는다
    expect(failedRow.textContent).not.toMatch(/\d+%/);
    expect(screen.queryByText(PROJECT_TEXT.loadListFailed)).toBeNull();
  });

  it("목록: 상세는 한 번에 최대 PROGRESS_FETCH_CONCURRENCY개까지만 동시에 부르고, 전부 한 번씩 부른다", async () => {
    const ids = [71, 72, 73, 74, 75, 76, 77, 78, 79];
    let inFlight = 0;
    let maxInFlight = 0;
    const handlers: Record<string, () => Promise<Response>> = {
      "GET /api/projects": async () => jsonOk(listPage(ids.map((id) => summaryDto(id, `프로젝트 ${id}`)))),
    };
    ids.forEach((id) => {
      handlers[`GET /api/projects/${id}`] = async () => {
        inFlight += 1;
        maxInFlight = Math.max(maxInFlight, inFlight);
        await new Promise((resolve) => setTimeout(resolve, 5));
        inFlight -= 1;
        return jsonOk(detailDto(id, `프로젝트 ${id}`, id));
      };
    });
    const { calls } = stubFetch(handlers);
    renderList();
    await waitFor(() => expect(within(rowOf("프로젝트 79")).getByText("79%")).toBeTruthy());
    await waitFor(() => expect(within(rowOf("프로젝트 71")).getByText("71%")).toBeTruthy());
    expect(maxInFlight).toBeLessThanOrEqual(PROGRESS_FETCH_CONCURRENCY);
    expect(maxInFlight).toBeGreaterThan(1);
    ids.forEach((id) => expect(calls.filter((c) => c.path === `/api/projects/${id}`).length).toBe(1));
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
