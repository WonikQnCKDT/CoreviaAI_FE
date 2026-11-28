import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  changeAdminDepartmentStatus,
  changeAdminUserRole,
  changeAdminUserStatus,
  createAdminDepartment,
  createAdminUser,
  fetchAdminUsers,
  fetchAllAdminDepartments,
  fetchUserHistories,
  updateAdminDepartment,
  updateAdminUserProfile,
} from "@/features/admin/api/adminApi";

/** 02-1 명세의 AdminUserResponse 예시 */
const userDto = (overrides: Record<string, unknown> = {}) => ({
  id: 7,
  loginId: "hong.gd",
  name: "홍길동",
  systemRole: "USER",
  status: "ACTIVE",
  departmentId: 3,
  departmentName: "개발팀",
  jobTitle: "백엔드 개발",
  lastLoginAt: null,
  createdAt: "2026-11-12T03:00:00Z",
  updatedAt: "2026-11-12T03:00:00Z",
  ...overrides,
});

const ok = (response: unknown) =>
  new Response(JSON.stringify({ success: true, response, error: null }), { status: 200 });

const fail = (status: number, message: string) =>
  new Response(JSON.stringify({ success: false, response: null, error: { message, status } }), { status });

const fetchMock = vi.fn<typeof fetch>();

const lastRequest = () => {
  const [url, init] = fetchMock.mock.calls.at(-1) ?? [];
  return {
    url: new URL(String(url), "http://localhost"),
    method: init?.method,
    body: init?.body ? JSON.parse(String(init.body)) : undefined,
  };
};

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
  // client는 브라우저의 window.setTimeout으로 시간 초과를 잰다.
  vi.stubGlobal("window", globalThis);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("fetchAdminUsers (GET /api/admin/users)", () => {
  it("필터를 서버 enum으로 바꾸고 빈 값은 보내지 않는다", async () => {
    fetchMock.mockResolvedValue(ok({ items: [], nextCursor: null, hasNext: false }));
    await fetchAdminUsers({ departmentId: 3, status: "inactive", systemRole: "exec", keyword: "  hong  " });
    const { url } = lastRequest();
    expect(url.pathname).toBe("/api/admin/users");
    expect(Object.fromEntries(url.searchParams)).toEqual({
      size: "20",
      departmentId: "3",
      status: "INACTIVE",
      systemRole: "EXECUTIVE",
      keyword: "hong",
    });
  });

  it("필터가 없으면 size만 보낸다", async () => {
    fetchMock.mockResolvedValue(ok({ items: [], nextCursor: null, hasNext: false }));
    await fetchAdminUsers({ departmentId: null, status: null, systemRole: null, keyword: "   " });
    expect(Object.fromEntries(lastRequest().url.searchParams)).toEqual({ size: "20" });
  });

  it("검색어는 50자까지만 보낸다 (경계값 50·51)", async () => {
    // Response 본문은 한 번만 읽을 수 있어 호출마다 새로 만든다.
    fetchMock.mockImplementation(async () => ok({ items: [], nextCursor: null, hasNext: false }));
    await fetchAdminUsers({ keyword: "a".repeat(50) });
    expect(lastRequest().url.searchParams.get("keyword")).toHaveLength(50);
    await fetchAdminUsers({ keyword: "b".repeat(51) });
    expect(lastRequest().url.searchParams.get("keyword")).toBe("b".repeat(50));
  });

  it("커서를 그대로 넘기고 응답을 화면 모델로 바꾼다", async () => {
    fetchMock.mockResolvedValue(
      ok({
        items: [userDto({ systemRole: "SYSTEM_ADMIN", status: "INACTIVE", departmentId: null, departmentName: null })],
        nextCursor: "opaque-2",
        hasNext: true,
      }),
    );
    const result = await fetchAdminUsers({ cursor: "opaque-1" });
    expect(lastRequest().url.searchParams.get("cursor")).toBe("opaque-1");
    expect(result).toEqual({
      ok: true,
      data: {
        items: [
          {
            id: 7,
            loginId: "hong.gd",
            name: "홍길동",
            systemRole: "admin",
            status: "inactive",
            departmentId: null,
            departmentName: null,
            jobTitle: "백엔드 개발",
            lastLoginAt: null,
            updatedAt: "2026-11-12T03:00:00Z",
          },
        ],
        nextCursor: "opaque-2",
        hasNext: true,
      },
    });
  });

  it("명세에서 빠진 canCreateProject가 와도 화면 모델에 넣지 않는다", async () => {
    fetchMock.mockResolvedValue(ok({ items: [userDto({ canCreateProject: true })], nextCursor: null, hasNext: false }));
    const result = await fetchAdminUsers({});
    expect(result.ok === true && result.data.items[0]).not.toHaveProperty("canCreateProject");
  });

  it("빈 목록과 items 누락을 같은 빈 페이지로 다룬다", async () => {
    fetchMock.mockResolvedValue(ok({ nextCursor: null, hasNext: false }));
    expect(await fetchAdminUsers({})).toEqual({ ok: true, data: { items: [], nextCursor: null, hasNext: false } });
  });

  it("400 INVALID_CURSOR는 status와 서버 메시지만 담은 실패로 돌려준다", async () => {
    fetchMock.mockResolvedValue(fail(400, "목록 조회 위치(cursor)가 올바르지 않습니다"));
    expect(await fetchAdminUsers({ cursor: "broken" })).toEqual({
      ok: false,
      failure: { kind: "http", status: 400, code: null, message: "목록 조회 위치(cursor)가 올바르지 않습니다" },
    });
  });
});

describe("createAdminUser (POST /api/admin/users)", () => {
  it("명세의 5개 필드만 보내고 앞뒤 공백을 지우며 빈 직무는 null로 보낸다", async () => {
    fetchMock.mockResolvedValue(ok(userDto({ jobTitle: null })));
    await createAdminUser({
      input: { loginId: " hong.gd ", name: " 홍길동 ", systemRole: "user", departmentId: 3, jobTitle: "   " },
    });
    const { method, body, url } = lastRequest();
    expect(method).toBe("POST");
    expect(url.pathname).toBe("/api/admin/users");
    expect(body).toEqual({ loginId: "hong.gd", name: "홍길동", systemRole: "USER", departmentId: 3, jobTitle: null });
  });

  it("시스템 관리자는 부서 없이 보낼 수 있다", async () => {
    fetchMock.mockResolvedValue(ok(userDto({ systemRole: "SYSTEM_ADMIN", departmentId: null })));
    await createAdminUser({
      input: { loginId: "admin2", name: "관리자", systemRole: "admin", departmentId: null, jobTitle: "" },
    });
    expect(lastRequest().body).toMatchObject({ systemRole: "SYSTEM_ADMIN", departmentId: null });
  });

  it("응답에 temporaryPassword가 있으면 사용자 정보와 함께 돌려준다", async () => {
    fetchMock.mockResolvedValue(ok({ ...userDto({ id: 9 }), temporaryPassword: "Tmp!Password99" }));
    const result = await createAdminUser({
      input: { loginId: "hong.gd", name: "홍길동", systemRole: "user", departmentId: 3, jobTitle: "" },
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.user.id).toBe(9);
      expect(result.data.temporaryPassword).toBe("Tmp!Password99");
    }
  });

  it("409 아이디 중복을 실패로 돌려준다", async () => {
    fetchMock.mockResolvedValue(fail(409, "이미 사용 중인 아이디입니다"));
    const result = await createAdminUser({
      input: { loginId: "hong.gd", name: "홍길동", systemRole: "user", departmentId: 3, jobTitle: "" },
    });
    expect(result).toEqual({
      ok: false,
      failure: { kind: "http", status: 409, code: null, message: "이미 사용 중인 아이디입니다" },
    });
  });
});

describe("사용자 변경 API", () => {
  it("정보 수정은 이름·부서·직무를 덮어쓰고 부서·직무를 비울 수 있다", async () => {
    fetchMock.mockResolvedValue(ok(userDto({ departmentId: null, jobTitle: null })));
    await updateAdminUserProfile({ userId: 7, input: { name: "홍길동", departmentId: null, jobTitle: "" } });
    expect(lastRequest()).toMatchObject({
      method: "PATCH",
      body: { name: "홍길동", departmentId: null, jobTitle: null },
    });
    expect(lastRequest().url.pathname).toBe("/api/admin/users/7");
  });

  it("역할 변경은 system-role 경로로 서버 enum을 보낸다", async () => {
    fetchMock.mockResolvedValue(ok(userDto({ systemRole: "EXECUTIVE" })));
    const result = await changeAdminUserRole({ userId: 7, systemRole: "exec" });
    expect(lastRequest()).toMatchObject({ method: "PATCH", body: { systemRole: "EXECUTIVE" } });
    expect(lastRequest().url.pathname).toBe("/api/admin/users/7/system-role");
    expect(result.ok === true && result.data.systemRole).toBe("exec");
  });

  it("상태 변경은 status 경로로 보낸다", async () => {
    fetchMock.mockResolvedValue(ok(userDto({ status: "INACTIVE" })));
    await changeAdminUserStatus({ userId: 7, status: "inactive" });
    expect(lastRequest()).toMatchObject({ method: "PATCH", body: { status: "INACTIVE" } });
    expect(lastRequest().url.pathname).toBe("/api/admin/users/7/status");
  });
});

const departmentDto = (overrides: Record<string, unknown> = {}) => ({
  id: 2,
  parentId: 1,
  name: "개발팀",
  status: "ACTIVE",
  activeMemberCount: 3,
  createdAt: "2026-11-12T03:00:00Z",
  updatedAt: "2026-11-12T03:00:00Z",
  ...overrides,
});

describe("부서 API (02-2)", () => {
  it("전체 목록은 다음 페이지가 없을 때까지 커서를 이어 받는다", async () => {
    fetchMock
      .mockImplementationOnce(async () => ok({ items: [departmentDto({ id: 1, parentId: null })], nextCursor: "c1", hasNext: true }))
      .mockImplementationOnce(async () => ok({ items: [departmentDto({ status: "INACTIVE" })], nextCursor: null, hasNext: false }));
    const result = await fetchAllAdminDepartments();
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(Object.fromEntries(lastRequest().url.searchParams)).toEqual({ cursor: "c1", size: "100" });
    expect(result).toEqual({
      ok: true,
      data: [
        { id: 1, parentId: null, name: "개발팀", status: "active", activeMemberCount: 3 },
        { id: 2, parentId: 1, name: "개발팀", status: "inactive", activeMemberCount: 3 },
      ],
    });
  });

  it("중간 페이지가 실패하면 받은 것까지 버리고 실패를 돌려준다", async () => {
    fetchMock
      .mockImplementationOnce(async () => ok({ items: [departmentDto()], nextCursor: "c1", hasNext: true }))
      .mockImplementationOnce(async () => fail(400, "목록 조회 위치(cursor)가 올바르지 않습니다"));
    expect(await fetchAllAdminDepartments()).toMatchObject({ ok: false, failure: { status: 400 } });
  });

  it("서버가 hasNext=true에 nextCursor=null을 주면 멈춘다", async () => {
    fetchMock.mockImplementation(async () => ok({ items: [departmentDto()], nextCursor: null, hasNext: true }));
    await fetchAllAdminDepartments();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("커서가 끝없이 와도 50페이지에서 멈춘다", async () => {
    fetchMock.mockImplementation(async () => ok({ items: [], nextCursor: "again", hasNext: true }));
    await fetchAllAdminDepartments();
    expect(fetchMock).toHaveBeenCalledTimes(50);
  });

  it("추가는 이름 앞뒤 공백을 지우고 상위가 없으면 null로 보낸다", async () => {
    fetchMock.mockResolvedValue(ok(departmentDto({ parentId: null })));
    await createAdminDepartment({ input: { name: "  개발팀  ", parentId: null } });
    expect(lastRequest()).toMatchObject({ method: "POST", body: { name: "개발팀", parentId: null } });
    expect(lastRequest().url.pathname).toBe("/api/admin/departments");
  });

  it("수정은 이름과 상위 부서를 덮어쓴다", async () => {
    fetchMock.mockResolvedValue(ok(departmentDto({ parentId: 4 })));
    await updateAdminDepartment({ departmentId: 2, input: { name: "개발팀", parentId: 4 } });
    expect(lastRequest()).toMatchObject({ method: "PATCH", body: { name: "개발팀", parentId: 4 } });
    expect(lastRequest().url.pathname).toBe("/api/admin/departments/2");
  });

  it("상태 변경은 status 경로로 서버 enum을 보낸다", async () => {
    fetchMock.mockResolvedValue(ok(departmentDto({ status: "INACTIVE" })));
    const result = await changeAdminDepartmentStatus({ departmentId: 2, status: "inactive" });
    expect(lastRequest()).toMatchObject({ method: "PATCH", body: { status: "INACTIVE" } });
    expect(lastRequest().url.pathname).toBe("/api/admin/departments/2/status");
    expect(result.ok === true && result.data.status).toBe("inactive");
  });

  it("409 사용 중인 부서를 실패로 돌려준다", async () => {
    fetchMock.mockResolvedValue(fail(409, "소속 사용자나 활성 하위 부서가 있어 비활성화할 수 없습니다"));
    expect(await changeAdminDepartmentStatus({ departmentId: 2, status: "inactive" })).toEqual({
      ok: false,
      failure: { kind: "http", status: 409, code: null, message: "소속 사용자나 활성 하위 부서가 있어 비활성화할 수 없습니다" },
    });
  });
});

describe("fetchUserHistories (GET /api/admin/users/{userId}/histories)", () => {
  it("details의 전·후 값을 변경 목록으로 펼치고, details가 null인 비밀번호 초기화는 빈 목록이다", async () => {
    fetchMock.mockResolvedValue(
      ok({
        items: [
          {
            id: 12,
            action: "USER_ROLE_CHANGED",
            actorUserId: 1,
            actorName: "관리자",
            details: { systemRole: { before: "USER", after: "EXECUTIVE" } },
            ipAddress: "10.0.0.1",
            occurredAt: "2026-11-20T01:00:00Z",
          },
          {
            id: 11,
            action: "PASSWORD_RESET",
            actorUserId: 1,
            actorName: "관리자",
            details: null,
            ipAddress: "10.0.0.1",
            occurredAt: "2026-11-19T01:00:00Z",
          },
        ],
        nextCursor: null,
        hasNext: false,
      }),
    );
    const result = await fetchUserHistories({ userId: 7, size: 1 });
    expect(Object.fromEntries(lastRequest().url.searchParams)).toEqual({ size: "1" });
    expect(result.ok === true && result.data.items.map(({ action, changes }) => ({ action, changes }))).toEqual([
      { action: "USER_ROLE_CHANGED", changes: [{ field: "systemRole", before: "USER", after: "EXECUTIVE" }] },
      { action: "PASSWORD_RESET", changes: [] },
    ]);
  });
});
