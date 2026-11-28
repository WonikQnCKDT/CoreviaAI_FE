import type { ReactNode } from "react";
import { render } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { vi } from "vitest";
import { AuthContext, type AuthContextValue, type AuthMode } from "@/features/auth/authContext";
import { DemoStoreProvider } from "@/stores/DemoStore";

/**
 * 화면 테스트용 껍데기. 실제 데모 저장소와 라우터를 쓰고, 인증 상태만 가짜로 넣는다.
 * (테스트에서만 쓴다. 앱 코드는 이 파일을 불러오지 않는다.)
 */

export const fakeAuth = function (mode: AuthMode, overrides: Partial<AuthContextValue> = {}): AuthContextValue {
  return {
    mode,
    status: "signedIn",
    account: mode === "api" ? { userId: 5, loginId: "hong.gd", name: "홍길동", systemRole: "user", mustChangePassword: false } : null,
    mustChangePassword: false,
    signIn: vi.fn(),
    signOut: vi.fn(async () => undefined),
    changePassword: vi.fn(),
    resetPassword: vi.fn(),
    recheck: vi.fn(),
    ...overrides,
  };
};

export const renderApp = function ({
  mode,
  route,
  routes,
  wrap,
}: {
  mode: AuthMode;
  route: string;
  routes: { path: string; element: ReactNode }[];
  /** 저장소 안에서 화면을 감쌀 때(예: 서버 프로젝트를 미리 넣기) */
  wrap?: (children: ReactNode) => ReactNode;
}) {
  const tree = (
    <MemoryRouter initialEntries={[route]}>
      <Routes>
        {routes.map(({ path, element }) => (
          <Route key={path} path={path} element={element} />
        ))}
      </Routes>
    </MemoryRouter>
  );
  return render(
    <DemoStoreProvider>
      <AuthContext.Provider value={fakeAuth(mode)}>{wrap ? wrap(tree) : tree}</AuthContext.Provider>
    </DemoStoreProvider>,
  );
};

export const jsonOk = (response: unknown) => new Response(JSON.stringify({ success: true, response, error: null }), { status: 200 });

export const jsonFail = (status: number, message: string, response: unknown = null) =>
  new Response(JSON.stringify({ success: false, response, error: { message, status } }), { status });

type Handler = (request: { url: URL; method: string; body: unknown }) => Response | Promise<Response>;

/**
 * "METHOD /api/path" 별 응답을 정한 fetch. 정하지 않은 요청은 실패로 기록해 테스트가 알아채게 한다.
 * calls로 보낸 요청(메서드·경로·본문)을 확인한다.
 */
export const stubFetch = function (handlers: Record<string, Handler>) {
  const calls: { method: string; path: string; body: unknown }[] = [];
  const unexpected: string[] = [];
  const fetchMock = vi.fn(async (...[input, init]: Parameters<typeof fetch>) => {
    const url = new URL(String(input), "http://localhost");
    const method = init?.method ?? "GET";
    const body = init?.body ? JSON.parse(String(init.body)) : undefined;
    calls.push({ method, path: url.pathname + url.search, body });
    const handler = handlers[`${method} ${url.pathname}`];
    if (!handler) {
      unexpected.push(`${method} ${url.pathname}`);
      return jsonFail(500, "테스트에서 정하지 않은 요청");
    }
    return handler({ url, method, body });
  });
  vi.stubGlobal("fetch", fetchMock);
  return { calls, unexpected, fetchMock };
};
