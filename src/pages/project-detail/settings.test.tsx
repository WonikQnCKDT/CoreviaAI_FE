// @vitest-environment jsdom
import { useEffect, useState, type ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, screen } from "@testing-library/react";
import ProjectSettingsPage from "@/pages/project-detail/settings";
import { useDemoStore } from "@/stores/DemoStore";
import { PROJECT_DIRECTORY_TEXT, PROJECT_SETTINGS_TEXT } from "@/features/project/i18n/ko";
import { BUTTON_TEXT } from "@/shared/i18n/catalog/button";
import { renderApp, stubFetch } from "@/test/appHarness";
import type { ServerProjectDetail } from "@/features/project/api/projectApi";

const serverDetail = (pmId: number): ServerProjectDetail => ({
  id: 77,
  code: "PRT-2026-001",
  name: "서버 프로젝트",
  status: "planned",
  template: "itProject",
  methodology: "waterfall",
  visibility: "company",
  departments: [],
  pms: [{ id: pmId, name: "홍길동" }],
  startDate: null,
  endDate: null,
  createdAt: "2026-11-26T00:00:00Z",
  departmentType: "sw",
  createdBy: pmId,
  actors: ["pm", "dev"],
  features: ["wbs"],
  progress: 0,
  version: 0,
});

/** 서버 프로젝트를 저장소에 넣고, 현재 데모 사용자(u1)를 그 프로젝트의 PM과 같은 사람으로 맞춘다. */
const SeedServerProject = ({ children, asPm }: { children: ReactNode; asPm: boolean }) => {
  const { syncServerProjectDetail, updateUser, currentUser } = useDemoStore();
  const [ready, setReady] = useState(false);
  useEffect(() => {
    if (asPm) updateUser(currentUser.id, { serverUserId: 5 });
    syncServerProjectDetail({
      detail: serverDetail(5),
      phases: [],
      members: [
        { userId: 5, name: "홍길동", actor: "pm", assignedTaskCount: 0 },
        { userId: 11, name: "이개발", actor: "dev", assignedTaskCount: 0 },
      ],
    });
    setReady(true);
    // 처음 한 번만 넣는다.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return ready ? <>{children}</> : null;
};

const ROUTES = [{ path: "/projects/:projectId/settings", element: <ProjectSettingsPage /> }];

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("api 모드 멤버·설정 (서버 프로젝트)", () => {
  it("PM에게 멤버 초대를 보여 주되, 사용자 검색 API가 없어 비활성으로 두고 이유를 표시한다", async () => {
    const { fetchMock } = stubFetch({});
    renderApp({ mode: "api", route: "/projects/77/settings", routes: ROUTES, wrap: (tree) => <SeedServerProject asPm>{tree}</SeedServerProject> });

    const invite = await screen.findByRole("button", { name: new RegExp(PROJECT_SETTINGS_TEXT.inviteTitle) });
    expect(invite).toHaveProperty("disabled", true);
    expect(screen.getByText(PROJECT_DIRECTORY_TEXT.usersUnavailable)).toBeTruthy();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("PM이 아니면 초대는 PM만 할 수 있다는 이유를 표시한다", async () => {
    stubFetch({});
    renderApp({ mode: "api", route: "/projects/77/settings", routes: ROUTES, wrap: (tree) => <SeedServerProject asPm={false}>{tree}</SeedServerProject> });

    expect(await screen.findByText(PROJECT_SETTINGS_TEXT.pmOnlyInvite)).toBeTruthy();
  });

  it("서버에 반영되지 않는 PM 위임·승인자 변경은 막고 이유를 표시한다(가짜 성공 방지)", async () => {
    stubFetch({});
    renderApp({ mode: "api", route: "/projects/77/settings", routes: ROUTES, wrap: (tree) => <SeedServerProject asPm>{tree}</SeedServerProject> });

    expect(await screen.findByText(PROJECT_SETTINGS_TEXT.pmChangeNotConnected)).toBeTruthy();
    expect(screen.getByText(PROJECT_SETTINGS_TEXT.approverNotConnected)).toBeTruthy();
    expect(screen.queryByRole("button", { name: new RegExp(BUTTON_TEXT.delegatePm) })).toBeNull();
  });

  it("멤버 목록은 서버 멤버 API로 받은 멤버를 보여 준다", async () => {
    stubFetch({});
    renderApp({ mode: "api", route: "/projects/77/settings", routes: ROUTES, wrap: (tree) => <SeedServerProject asPm>{tree}</SeedServerProject> });

    expect(await screen.findByText("현재 멤버 (2명)")).toBeTruthy();
    expect(screen.getAllByText("이개발").length).toBeGreaterThan(0);
  });
});

describe("데모 모드 멤버·설정 (기존 시연 유지)", () => {
  it("데모 프로젝트는 PM 위임을 그대로 쓰고 초대 비활성 안내를 보이지 않는다", async () => {
    stubFetch({});
    renderApp({ mode: "demo", route: "/projects/p1/settings", routes: ROUTES });

    expect(await screen.findByRole("button", { name: new RegExp(BUTTON_TEXT.delegatePm) })).toBeTruthy();
    expect(screen.queryByText(PROJECT_DIRECTORY_TEXT.usersUnavailable)).toBeNull();
  });
});
