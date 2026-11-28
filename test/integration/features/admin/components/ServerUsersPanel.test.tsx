import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import ServerUsersPanel from "@/features/admin/components/ServerUsersPanel";
import { AuthContext } from "@/features/auth/authContext";
import { BUTTON_TEXT } from "@/shared/i18n/catalog/button";
import { fakeAuth, jsonOk, stubFetch } from "@test/support/appHarness";

const adminAccount = {
  userId: 1,
  loginId: "admin.sys",
  name: "관리자",
  systemRole: "admin" as const,
  mustChangePassword: false,
};

const userDto = (overrides: Record<string, unknown> = {}) => ({
  id: 7,
  loginId: "hong.gd",
  name: "홍길동",
  systemRole: "USER",
  status: "ACTIVE",
  departmentId: 3,
  departmentName: "개발팀",
  jobTitle: "백엔드 개발",
  lastLoginAt: "2026-11-20T09:00:00Z",
  createdAt: "2026-11-12T03:00:00Z",
  updatedAt: "2026-11-12T03:00:00Z",
  ...overrides,
});

const renderPanel = () =>
  render(
    <AuthContext.Provider value={fakeAuth("api", { account: adminAccount })}>
      <ServerUsersPanel />
    </AuthContext.Provider>,
  );

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("ServerUsersPanel 사용자·조직 관리 (FR-ADM-02, SCRUM-97)", () => {
  it("사용자 목록을 조회하고 비활성화 확인 시 PATCH /api/admin/users/{id}/status(INACTIVE)를 호출한다", async () => {
    const { calls, unexpected } = stubFetch({
      "GET /api/admin/departments": () =>
        jsonOk({ items: [{ id: 3, parentId: null, name: "개발팀", status: "ACTIVE", activeMemberCount: 1 }], nextCursor: null, hasNext: false }),
      "GET /api/admin/users": () => jsonOk({ items: [userDto()], nextCursor: null, hasNext: false }),
      "PATCH /api/admin/users/7/status": () => jsonOk(userDto({ status: "INACTIVE" })),
    });

    renderPanel();
    const row = (await screen.findByText("홍길동")).closest("tr") as HTMLElement;
    expect(within(row).getByText("개발팀")).toBeTruthy();

    fireEvent.click(within(row).getByRole("button", { name: BUTTON_TEXT.deactivate }));
    const dialog = await screen.findByRole("dialog");
    fireEvent.click(within(dialog).getByRole("button", { name: BUTTON_TEXT.deactivate }));

    await waitFor(() => expect(within(row).getByRole("button", { name: BUTTON_TEXT.activate })).toBeTruthy());
    expect(unexpected).toEqual([]);
    expect(calls.find((c) => c.method === "PATCH" && c.path === "/api/admin/users/7/status")).toMatchObject({
      body: { status: "INACTIVE" },
    });
  });

  it("시스템 역할을 변경하고 확인하면 PATCH /api/admin/users/{id}/system-role을 호출한다", async () => {
    const { calls, unexpected } = stubFetch({
      "GET /api/admin/departments": () => jsonOk({ items: [], nextCursor: null, hasNext: false }),
      "GET /api/admin/users": () => jsonOk({ items: [userDto()], nextCursor: null, hasNext: false }),
      "PATCH /api/admin/users/7/system-role": () => jsonOk(userDto({ systemRole: "EXECUTIVE" })),
    });

    renderPanel();
    const roleSelect = (await screen.findByLabelText("홍길동 시스템 역할")) as HTMLSelectElement;
    fireEvent.change(roleSelect, { target: { value: "exec" } });

    const dialog = await screen.findByRole("dialog");
    fireEvent.click(within(dialog).getByRole("button", { name: /변경/ }));

    await waitFor(() => expect(roleSelect.value).toBe("exec"));
    expect(unexpected).toEqual([]);
    expect(calls.find((c) => c.method === "PATCH" && c.path === "/api/admin/users/7/system-role")).toMatchObject({
      body: { systemRole: "EXECUTIVE" },
    });
  });

  it("변경 이력 버튼을 누르면 GET /api/admin/users/{id}/histories로 전·후 변경 값을 조회한다", async () => {
    const { unexpected } = stubFetch({
      "GET /api/admin/departments": () => jsonOk({ items: [], nextCursor: null, hasNext: false }),
      "GET /api/admin/users": () => jsonOk({ items: [userDto()], nextCursor: null, hasNext: false }),
      "GET /api/admin/users/7/histories": () =>
        jsonOk({
          items: [
            {
              id: 101,
              action: "SYSTEM_ROLE_CHANGED",
              actorId: 1,
              actorName: "관리자",
              ipAddress: "127.0.0.1",
              occurredAt: "2026-11-21T09:00:00Z",
              details: { systemRole: { before: "USER", after: "EXECUTIVE" } },
            },
          ],
          nextCursor: null,
          hasNext: false,
        }),
    });

    renderPanel();
    const row = (await screen.findByText("홍길동")).closest("tr") as HTMLElement;
    fireEvent.click(within(row).getByRole("button", { name: BUTTON_TEXT.history }));

    const dialog = await screen.findByRole("dialog");
    expect(await within(dialog).findByText(/관리자/)).toBeTruthy();
    expect(within(dialog).getByText(/일반 사용자/)).toBeTruthy();
    expect(within(dialog).getByText(/경영진/)).toBeTruthy();
    expect(unexpected).toEqual([]);
  });
});
