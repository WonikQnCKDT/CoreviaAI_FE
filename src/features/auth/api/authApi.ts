import { apiRequest, type ApiResult } from "@/shared/api/client";
import type { SystemRole } from "@/types";

/* ===== 서버 DTO (API 명세 그대로) ===== */

type SystemRoleDto = "SYSTEM_ADMIN" | "EXECUTIVE" | "USER";

interface AccountDto {
  userId: number;
  loginId: string;
  name: string;
  systemRole: SystemRoleDto;
  mustChangePassword: boolean;
}

interface PasswordResetDto {
  temporaryPassword: string;
}

/* ===== 화면에서 쓰는 domain model ===== */

export interface AuthAccount {
  userId: number;
  loginId: string;
  name: string;
  systemRole: SystemRole;
  mustChangePassword: boolean;
}

const SYSTEM_ROLE_FROM_DTO: Record<SystemRoleDto, SystemRole> = {
  SYSTEM_ADMIN: "admin",
  EXECUTIVE: "exec",
  USER: "user",
};

const toAccount = function ({ userId, loginId, name, systemRole, mustChangePassword }: AccountDto): AuthAccount {
  return {
    userId,
    loginId,
    name,
    // 알 수 없는 역할은 가장 낮은 권한으로 본다. 실제 권한 판단은 서버가 한다.
    systemRole: SYSTEM_ROLE_FROM_DTO[systemRole] ?? "user",
    mustChangePassword: Boolean(mustChangePassword),
  };
};

const mapResult = function <A, B>(result: ApiResult<A>, transform: (data: A) => B): ApiResult<B> {
  return result.ok === true ? { ok: true, data: transform(result.data) } : result;
};

/* ===== API ===== */

/** POST /api/auth/login */
export const loginRequest = async function ({
  loginId,
  password,
  signal,
}: {
  loginId: string;
  password: string;
  signal?: AbortSignal;
}) {
  const result = await apiRequest<AccountDto>({
    method: "POST",
    path: "/auth/login",
    body: { loginId, password },
    signal,
    scope: "public",
  });
  return mapResult(result, toAccount);
};

/** POST /api/auth/logout — 멱등. 세션이 이미 끝났어도 호출할 수 있다. */
export const logoutRequest = function ({ signal }: { signal?: AbortSignal } = {}) {
  return apiRequest<null>({ method: "POST", path: "/auth/logout", signal, scope: "public", timeoutMs: 5_000 });
};

/** GET /api/auth/me — 새로고침 후 로그인 상태 확인 */
export const fetchMyAccount = async function ({ signal }: { signal?: AbortSignal } = {}) {
  const result = await apiRequest<AccountDto>({ method: "GET", path: "/auth/me", signal });
  return mapResult(result, toAccount);
};

/** PATCH /api/users/me/password — 성공하면 서버가 모든 세션을 끝내고 쿠키를 만료시킨다. */
export const changeMyPasswordRequest = function ({
  currentPassword,
  newPassword,
  signal,
}: {
  currentPassword: string;
  newPassword: string;
  signal?: AbortSignal;
}) {
  return apiRequest<null>({
    method: "PATCH",
    path: "/users/me/password",
    body: { currentPassword, newPassword },
    signal,
  });
};

/** POST /api/admin/users/{userId}/password-reset — 멱등 아님. 호출할 때마다 새 임시 비밀번호가 발급된다. */
export const resetUserPasswordRequest = async function ({ userId, signal }: { userId: number; signal?: AbortSignal }) {
  const result = await apiRequest<PasswordResetDto>({
    method: "POST",
    path: `/admin/users/${encodeURIComponent(String(userId))}/password-reset`,
    signal,
  });
  return mapResult(result, ({ temporaryPassword }) => ({ temporaryPassword }));
};
