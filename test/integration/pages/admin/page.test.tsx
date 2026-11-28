// @vitest-environment jsdom
import { useEffect, useState, type ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, screen, waitFor, within } from "@testing-library/react";
import AdminPage from "@/pages/admin/page";
import { useDemoStore } from "@/stores/DemoStore";
import { ADMIN_PM_TEXT } from "@/features/admin/i18n/pmReassign";
import { ADMIN_TAB_TEXT } from "@/shared/i18n/catalog/menu";
import { formatLabel } from "@/shared/i18n/store";
import { jsonFail, jsonOk, renderApp, stubFetch } from "@test/support/appHarness";

/** 실제 BE AdminUserResponse 형식 */
const USER = {
  id: 21,
  loginId: "kim.pm",
  name: "김새피엠",
  systemRole: "USER",
  status: "ACTIVE",
  departmentId: 3,
  departmentName: "개발1팀",
  jobTitle: "책임",
  lastLoginAt: null,
  createdAt: "2026-01-01T00:00:00Z",
  updatedAt: "2026-01-01T00:00:00Z",
};

const AsSystemAdmin = ({ children, admin }: { children: ReactNode; admin: boolean }) => {
  const { updateUser, currentUser } = useDemoStore();
  const [ready, setReady] = useState(false);
  useEffect(() => {
    updateUser(currentUser.id, { systemRole: admin ? "admin" : "user" });
    setReady(true);
    // 처음 한 번만 바꾼다.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return ready ? <>{children}</> : null;
};

const ROUTES = [{ path: "/admin", element: <AdminPage /> }];

const render = (handlers: Parameters<typeof stubFetch>[0], admin = true) => {
  const stub = stubFetch({
    "GET /api/admin/users": () => jsonOk({ items: [USER], nextCursor: null, hasNext: false }),
    ...handlers,
  });
  renderApp({ mode: "api", route: "/admin", routes: ROUTES, wrap: (tree) => <AsSystemAdmin admin={admin}>{tree}</AsSystemAdmin> });
  return stub;
};

const openTab = async () => fireEvent.click(await screen.findByRole("tab", { name: new RegExp(ADMIN_TAB_TEXT.pmReassign) }));

const fillAndSubmit = async (code: string) => {
  fireEvent.change(screen.getByLabelText(ADMIN_PM_TEXT.code), { target: { value: code } });
  fireEvent.click(await screen.findByRole("radio", { name: /김새피엠/ }));
  fireEvent.click(screen.getByRole("button", { name: new RegExp(`^\\s*${ADMIN_PM_TEXT.submit}`) }));
};

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("시스템 관리 › PM 재지정 (api 모드)", () => {
  it("활성 일반 사용자만 후보로 찾고, 확인 후 코드·새 PM으로 재지정한다", async () => {
    const { calls } = render({
      "PUT /api/admin/projects/pm": () => jsonOk({ projectId: 77, projectCode: "PRT-2026-001", pms: [{ id: 21, name: "김새피엠" }] }),
    });
    await openTab();

    await fillAndSubmit("prt-2026-001");
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByText(formatLabel(ADMIN_PM_TEXT.confirmBody, { code: "PRT-2026-001", name: "김새피엠 (kim.pm)" }))).toBeTruthy();
    fireEvent.click(within(dialog).getByRole("button", { name: ADMIN_PM_TEXT.submit }));

    expect(await screen.findByText(formatLabel(ADMIN_PM_TEXT.done, { code: "PRT-2026-001", names: "김새피엠" }))).toBeTruthy();
    expect(calls.find(({ method }) => method === "PUT")?.body).toEqual({ projectCode: "PRT-2026-001", newPmUserId: 21 });
    // 첫 탭(사용자)도 같은 API를 부르므로 재지정 후보 검색만 고른다
    expect(
      calls.some(({ path }) => path.startsWith("/api/admin/users?") && path.includes("status=ACTIVE") && path.includes("systemRole=USER")),
    ).toBe(true);
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("409면 활성 PM이 남아 있거나 코드가 없다고 안내하고 창을 열어 둔다", async () => {
    render({ "PUT /api/admin/projects/pm": () => jsonFail(409, "PM을 재지정할 수 없는 프로젝트입니다") });
    await openTab();

    await fillAndSubmit("PRT-9");
    const dialog = await screen.findByRole("dialog");
    fireEvent.click(within(dialog).getByRole("button", { name: ADMIN_PM_TEXT.submit }));

    expect(await within(dialog).findByText(ADMIN_PM_TEXT.notAllowed)).toBeTruthy();
    expect(screen.queryByText(/재지정했습니다/)).toBeNull();
  });

  it("코드·새 PM을 비우거나 코드 형식이 틀리면 요청하지 않고 이유를 보여 준다", async () => {
    const { calls } = render({});
    await openTab();

    fireEvent.click(screen.getByRole("button", { name: new RegExp(`^\\s*${ADMIN_PM_TEXT.submit}`) }));
    expect(screen.getByText(ADMIN_PM_TEXT.codeRequired)).toBeTruthy();
    expect(screen.getByText(ADMIN_PM_TEXT.userRequired)).toBeTruthy();

    fireEvent.change(screen.getByLabelText(ADMIN_PM_TEXT.code), { target: { value: "-A" } });
    fireEvent.click(screen.getByRole("button", { name: new RegExp(`^\\s*${ADMIN_PM_TEXT.submit}`) }));
    expect(screen.getByText(ADMIN_PM_TEXT.codeFormat)).toBeTruthy();
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(calls.some(({ method }) => method === "PUT")).toBe(false);
  });

  it("검색 결과가 없으면 빈 상태, 사용자 목록 실패면 오류를 보여 준다", async () => {
    render({ "GET /api/admin/users": () => jsonOk({ items: [], nextCursor: null, hasNext: false }) });
    await openTab();
    expect(await screen.findByText(ADMIN_PM_TEXT.userEmpty)).toBeTruthy();
    cleanup();

    render({ "GET /api/admin/users": () => jsonFail(500, "x") });
    await openTab();
    expect(await screen.findByText(new RegExp(ADMIN_PM_TEXT.userFailed))).toBeTruthy();
  });

  it("시스템 관리자가 아니면 화면과 탭을 보여 주지 않고 요청도 보내지 않는다", async () => {
    const { fetchMock } = render({}, false);

    await waitFor(() => expect(screen.queryByRole("tab", { name: new RegExp(ADMIN_TAB_TEXT.pmReassign) })).toBeNull());
    expect(screen.getByText("시스템 관리 권한이 없습니다")).toBeTruthy();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
