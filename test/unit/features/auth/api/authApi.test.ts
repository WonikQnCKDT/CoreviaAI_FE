import { afterEach, describe, expect, it, vi } from "vitest";
import {
  changeMyPasswordRequest,
  fetchMyAccount,
  loginRequest,
  logoutRequest,
  resetUserPasswordRequest,
} from "@/features/auth/api/authApi";
import { jsonFail, jsonOk, stubFetch } from "@test/support/appHarness";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("authApi 계약", () => {
  it("loginRequest는 POST /api/auth/login을 호출하고 서버 DTO를 AuthAccount로 변환한다", async () => {
    const { calls, unexpected } = stubFetch({
      "POST /api/auth/login": () =>
        jsonOk({
          userId: 12,
          loginId: "admin.core",
          name: "관리자",
          systemRole: "SYSTEM_ADMIN",
          mustChangePassword: true,
        }),
    });

    const result = await loginRequest({ loginId: "admin.core", password: "Password1!" });

    expect(unexpected).toEqual([]);
    expect(calls[0]).toMatchObject({
      method: "POST",
      path: "/api/auth/login",
      body: { loginId: "admin.core", password: "Password1!" },
    });
    expect(result).toEqual({
      ok: true,
      data: {
        userId: 12,
        loginId: "admin.core",
        name: "관리자",
        systemRole: "admin",
        mustChangePassword: true,
      },
    });
  });

  it("fetchMyAccount는 알 수 없는 systemRole을 가장 낮은 권한(user)으로 낮춘다", async () => {
    stubFetch({
      "GET /api/auth/me": () =>
        jsonOk({
          userId: 5,
          loginId: "hong.gd",
          name: "홍길동",
          systemRole: "UNKNOWN_ROLE",
          mustChangePassword: false,
        }),
    });

    const result = await fetchMyAccount();
    expect(result).toMatchObject({
      ok: true,
      data: { userId: 5, systemRole: "user", mustChangePassword: false },
    });
  });

  it("loginRequest는 423 잠금 등 HTTP 실패를 그대로 돌려준다", async () => {
    stubFetch({
      "POST /api/auth/login": () => jsonFail(423, "계정이 잠겨 있습니다."),
    });

    const result = await loginRequest({ loginId: "hong.gd", password: "wrong" });
    expect(result).toMatchObject({
      ok: false,
      failure: { kind: "http", status: 423, message: "계정이 잠겨 있습니다." },
    });
  });

  it("logoutRequest는 POST /api/auth/logout을 호출한다", async () => {
    const { calls, unexpected } = stubFetch({
      "POST /api/auth/logout": () => jsonOk(null),
    });

    const result = await logoutRequest();
    expect(unexpected).toEqual([]);
    expect(calls[0]).toMatchObject({ method: "POST", path: "/api/auth/logout" });
    expect(result).toEqual({ ok: true, data: null });
  });

  it("changeMyPasswordRequest는 PATCH /api/users/me/password에 현재·새 비밀번호를 보낸다", async () => {
    const { calls, unexpected } = stubFetch({
      "PATCH /api/users/me/password": () => jsonOk(null),
    });

    const result = await changeMyPasswordRequest({ currentPassword: "Old1!pass", newPassword: "New1!pass" });
    expect(unexpected).toEqual([]);
    expect(calls[0]).toMatchObject({
      method: "PATCH",
      path: "/api/users/me/password",
      body: { currentPassword: "Old1!pass", newPassword: "New1!pass" },
    });
    expect(result).toEqual({ ok: true, data: null });
  });

  it("resetUserPasswordRequest는 임시 비밀번호를 돌려준다", async () => {
    const { calls, unexpected } = stubFetch({
      "POST /api/admin/users/42/password-reset": () => jsonOk({ temporaryPassword: "Temp1!password" }),
    });

    const result = await resetUserPasswordRequest({ userId: 42 });
    expect(unexpected).toEqual([]);
    expect(calls[0]).toMatchObject({ method: "POST", path: "/api/admin/users/42/password-reset" });
    expect(result).toEqual({ ok: true, data: { temporaryPassword: "Temp1!password" } });
  });
});
