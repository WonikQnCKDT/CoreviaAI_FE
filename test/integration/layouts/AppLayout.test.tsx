import { useEffect, type ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import AppLayout from "@/layouts/AppLayout";
import { AuthContext, type AuthContextValue } from "@/features/auth/authContext";
import { peekReturnTo, peekSessionNotice, SESSION_IDLE_LIMIT_MS } from "@/features/auth/utils/session";
import { DemoStoreProvider, useDemoStore } from "@/stores/DemoStore";
import { fakeAuth, jsonFail, stubFetch } from "@test/support/appHarness";

const SeedDemoSession = ({ children }: { children: ReactNode }) => {
  const { switchDemoUser } = useDemoStore();
  useEffect(() => {
    switchDemoUser("u1");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return <>{children}</>;
};

const LoginSpy = () => {
  const location = useLocation();
  const from = (location.state as { from?: string } | null)?.from ?? "";
  return <div data-testid="login-page" data-from={from}>로그인 화면</div>;
};

const renderProtected = (route: string, authOverrides: Partial<AuthContextValue> = {}, withDemoSession = false) =>
  render(
    <DemoStoreProvider>
      <AuthContext.Provider value={fakeAuth("api", authOverrides)}>
        {withDemoSession ? (
          <SeedDemoSession>
            <MemoryRouter initialEntries={[route]}>
              <Routes>
                <Route path="/login" element={<LoginSpy />} />
                <Route element={<AppLayout />}>
                  <Route path="/" element={<div>대시보드</div>} />
                  <Route path="/projects" element={<div>프로젝트 목록</div>} />
                  <Route path="/projects/:projectId/wbs" element={<div>WBS 화면</div>} />
                  <Route path="/mywork" element={<div>내 업무</div>} />
                  <Route path="/admin" element={<div>시스템 관리</div>} />
                </Route>
              </Routes>
            </MemoryRouter>
          </SeedDemoSession>
        ) : (
          <MemoryRouter initialEntries={[route]}>
            <Routes>
              <Route path="/login" element={<LoginSpy />} />
              <Route element={<AppLayout />}>
                <Route path="/" element={<div>대시보드</div>} />
                <Route path="/projects" element={<div>프로젝트 목록</div>} />
                <Route path="/projects/:projectId/wbs" element={<div>WBS 화면</div>} />
                <Route path="/mywork" element={<div>내 업무</div>} />
                <Route path="/admin" element={<div>시스템 관리</div>} />
              </Route>
            </Routes>
          </MemoryRouter>
        )}
      </AuthContext.Provider>
    </DemoStoreProvider>,
  );

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
  stubFetch({
    "GET /api/notifications": () => jsonFail(404, "Not Found"),
    "GET /api/notifications/unread-count": () => jsonFail(404, "Not Found"),
  });
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("AppLayout 접근 제어·세션 가드 (FR-ADM-01, NFR-04, SCRUM-96·100)", () => {
  it.each(["/", "/projects", "/projects/77/wbs", "/mywork", "/admin"])(
    "미인증(signedOut) 사용자는 보호 경로(%s)에 접근할 수 없고 /login으로 이동한다",
    (path) => {
      renderProtected(path, { status: "signedOut", account: null });

      const login = screen.getByTestId("login-page");
      expect(login).toBeTruthy();
      expect(login.getAttribute("data-from")).toBe(path);
      expect(screen.queryByText("대시보드")).toBeNull();
      expect(screen.queryByText("시스템 관리")).toBeNull();
    },
  );

  it("인증 확인 중(checking)에는 보호된 화면을 렌더링하지 않는다", () => {
    renderProtected("/projects", { status: "checking", account: null });

    expect(screen.queryByText("프로젝트 목록")).toBeNull();
    expect(screen.queryByTestId("login-page")).toBeNull();
  });

  it("서버 연결 불가(unreachable) 상태에서는 보호된 화면 대신 재시도 화면을 보여 준다", () => {
    renderProtected("/projects", { status: "unreachable", account: null });

    expect(screen.queryByText("프로젝트 목록")).toBeNull();
    expect(screen.getByRole("button", { name: /다시 시도/ })).toBeTruthy();
  });

  it("비밀번호 변경 강제(mustChangePassword=true) 계정이면 닫을 수 없는 비밀번호 변경 창을 띄운다", async () => {
    renderProtected("/projects", {
      status: "signedIn",
      mustChangePassword: true,
      account: { userId: 5, loginId: "hong.gd", name: "홍길동", systemRole: "user", mustChangePassword: true },
    });

    expect(await screen.findByLabelText("현재 비밀번호")).toBeTruthy();
    expect(screen.getByLabelText("새 비밀번호")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "취소" })).toBeNull();
  });

  it("30분 무활동 시간이 지나면 세션을 만료 처리하고 복귀 경로·만료 안내를 기록한 뒤 /login으로 이동한다", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-11-28T09:00:00Z"));
    const signOut = vi.fn(async () => undefined);

    renderProtected("/projects/77/wbs", { status: "signedIn", signOut }, true);
    expect(screen.getByText("WBS 화면")).toBeTruthy();

    await act(async () => {
      vi.advanceTimersByTime(SESSION_IDLE_LIMIT_MS + 20_000);
    });

    expect(signOut).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId("login-page")).toBeTruthy();
    expect(peekReturnTo()).toBe("/projects/77/wbs");
    expect(peekSessionNotice()?.reason).toBe("expired");
  });

  it("인증된 정상 사용자는 보호 경로 본문을 볼 수 있다", async () => {
    renderProtected("/projects", { status: "signedIn" });
    await waitFor(() => expect(screen.getByText("프로젝트 목록")).toBeTruthy());
  });
});
