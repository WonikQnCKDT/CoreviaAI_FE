import { apiRequest, type ApiResult } from "@/shared/api/client";
import type { SystemRole } from "@/types";

/* =====================================================================
 * 서버 DTO (API 명세 그대로)
 * ===================================================================== */

type SystemRoleDto = "SYSTEM_ADMIN" | "EXECUTIVE" | "USER";
type StatusDto = "ACTIVE" | "INACTIVE";

interface CursorPageDto<T> {
  items: T[];
  nextCursor: string | null;
  hasNext: boolean;
}

interface AdminUserDto {
  id: number;
  loginId: string;
  name: string;
  systemRole: SystemRoleDto;
  status: StatusDto;
  departmentId: number | null;
  departmentName: string | null;
  jobTitle: string | null;
  lastLoginAt: string | null;
  createdAt: string;
  updatedAt: string;
}

interface UserHistoryDto {
  id: number;
  action: string;
  actorUserId: number;
  actorName: string;
  details: Record<string, { before?: unknown; after?: unknown } | unknown> | null;
  ipAddress: string;
  occurredAt: string;
}

interface AdminDepartmentDto {
  id: number;
  parentId: number | null;
  name: string;
  status: StatusDto;
  activeMemberCount: number;
  createdAt: string;
  updatedAt: string;
}

/* =====================================================================
 * 화면에서 쓰는 domain model
 * ===================================================================== */

export type RecordStatus = "active" | "inactive";

export interface CursorPage<T> {
  items: T[];
  nextCursor: string | null;
  hasNext: boolean;
}

export interface AdminUser {
  id: number;
  loginId: string;
  name: string;
  systemRole: SystemRole;
  status: RecordStatus;
  departmentId: number | null;
  departmentName: string | null;
  jobTitle: string | null;
  lastLoginAt: string | null;
  updatedAt: string;
}

export type UserHistoryAction =
  | "USER_CREATED"
  | "USER_PROFILE_CHANGED"
  | "USER_ROLE_CHANGED"
  | "USER_ACTIVATED"
  | "USER_DEACTIVATED"
  | "PASSWORD_RESET";

export interface HistoryChange {
  field: string;
  before: unknown;
  after: unknown;
}

export interface UserHistory {
  id: number;
  /** 알 수 없는 action도 그대로 보여주기 위해 string을 허용한다 */
  action: UserHistoryAction | string;
  actorName: string;
  changes: HistoryChange[];
  ipAddress: string;
  occurredAt: string;
}

export interface AdminDepartment {
  id: number;
  parentId: number | null;
  name: string;
  status: RecordStatus;
  activeMemberCount: number;
}

/* ===== DTO ↔ domain 변환 ===== */

const ROLE_FROM_DTO: Record<SystemRoleDto, SystemRole> = { SYSTEM_ADMIN: "admin", EXECUTIVE: "exec", USER: "user" };
const ROLE_TO_DTO: Record<SystemRole, SystemRoleDto> = { admin: "SYSTEM_ADMIN", exec: "EXECUTIVE", user: "USER" };
const STATUS_FROM_DTO: Record<StatusDto, RecordStatus> = { ACTIVE: "active", INACTIVE: "inactive" };
const STATUS_TO_DTO: Record<RecordStatus, StatusDto> = { active: "ACTIVE", inactive: "INACTIVE" };

const toUser = function ({
  id,
  loginId,
  name,
  systemRole,
  status,
  departmentId,
  departmentName,
  jobTitle,
  lastLoginAt,
  updatedAt,
}: AdminUserDto): AdminUser {
  return {
    id,
    loginId,
    name,
    systemRole: ROLE_FROM_DTO[systemRole] ?? "user",
    status: STATUS_FROM_DTO[status] ?? "inactive",
    departmentId,
    departmentName,
    jobTitle,
    lastLoginAt,
    updatedAt,
  };
};

const toChanges = function (details: UserHistoryDto["details"]): HistoryChange[] {
  if (!details || typeof details !== "object") return [];
  return Object.entries(details).map(([field, value]) => {
    const isPair = value !== null && typeof value === "object" && ("before" in value || "after" in value);
    const { before = null, after = null } = isPair ? (value as { before?: unknown; after?: unknown }) : { after: value };
    return { field, before, after };
  });
};

const toHistory = function ({ id, action, actorName, details, ipAddress, occurredAt }: UserHistoryDto): UserHistory {
  return { id, action, actorName, changes: toChanges(details), ipAddress, occurredAt };
};

const toDepartment = function ({ id, parentId, name, status, activeMemberCount }: AdminDepartmentDto): AdminDepartment {
  return { id, parentId, name, status: STATUS_FROM_DTO[status] ?? "inactive", activeMemberCount };
};

const toPage = function <A, B>({ items, nextCursor, hasNext }: CursorPageDto<A>, transform: (item: A) => B): CursorPage<B> {
  return { items: (items ?? []).map(transform), nextCursor: nextCursor ?? null, hasNext: Boolean(hasNext) };
};

const mapResult = function <A, B>(result: ApiResult<A>, transform: (data: A) => B): ApiResult<B> {
  return result.ok === true ? { ok: true, data: transform(result.data) } : result;
};

const toQuery = function (params: Record<string, string | number | null | undefined>) {
  const search = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value === null || value === undefined || value === "") return;
    search.set(key, String(value));
  });
  const text = search.toString();
  return text ? `?${text}` : "";
};

const userPath = (userId: number) => `/admin/users/${encodeURIComponent(String(userId))}`;
const departmentPath = (departmentId: number) => `/admin/departments/${encodeURIComponent(String(departmentId))}`;

/* =====================================================================
 * 사용자 API
 * ===================================================================== */

export interface UserListQuery {
  cursor?: string | null;
  size?: number;
  departmentId?: number | null;
  status?: RecordStatus | null;
  systemRole?: SystemRole | null;
  keyword?: string;
}

/** GET /api/admin/users — id 내림차순 커서 목록 */
export const fetchAdminUsers = async function ({
  cursor,
  size = 20,
  departmentId,
  status,
  systemRole,
  keyword,
  signal,
}: UserListQuery & { signal?: AbortSignal }) {
  const query = toQuery({
    cursor,
    size,
    departmentId,
    status: status ? STATUS_TO_DTO[status] : null,
    systemRole: systemRole ? ROLE_TO_DTO[systemRole] : null,
    keyword: keyword?.trim().slice(0, 50),
  });
  const result = await apiRequest<CursorPageDto<AdminUserDto>>({ path: `/admin/users${query}`, signal });
  return mapResult(result, (page) => toPage(page, toUser));
};

/** GET /api/admin/users/{userId} */
export const fetchAdminUser = async function ({ userId, signal }: { userId: number; signal?: AbortSignal }) {
  const result = await apiRequest<AdminUserDto>({ path: userPath(userId), signal });
  return mapResult(result, toUser);
};

export interface NewUserInput {
  loginId: string;
  name: string;
  systemRole: SystemRole;
  departmentId: number | null;
  jobTitle: string;
}

interface AdminUserCreatedDto extends AdminUserDto {
  temporaryPassword?: string | null;
}

export interface AdminUserCreated {
  user: AdminUser;
  /** 생성 응답에 1회만 포함되는 초기 임시 비밀번호. 없으면 null */
  temporaryPassword: string | null;
}

/** POST /api/admin/users — 계정을 만들고 응답에 초기 임시 비밀번호가 있으면 함께 돌려준다. */
export const createAdminUser = async function ({
  input: { loginId, name, systemRole, departmentId, jobTitle },
  signal,
}: {
  input: NewUserInput;
  signal?: AbortSignal;
}) {
  const result = await apiRequest<AdminUserCreatedDto>({
    method: "POST",
    path: "/admin/users",
    body: {
      loginId: loginId.trim(),
      name: name.trim(),
      systemRole: ROLE_TO_DTO[systemRole],
      departmentId,
      jobTitle: jobTitle.trim() || null,
    },
    signal,
  });
  return mapResult(result, (dto): AdminUserCreated => ({
    user: toUser(dto),
    temporaryPassword: typeof dto.temporaryPassword === "string" && dto.temporaryPassword.length > 0
      ? dto.temporaryPassword
      : null,
  }));
};

export interface UserProfileInput {
  name: string;
  departmentId: number | null;
  jobTitle: string;
}

/** PATCH /api/admin/users/{userId} — 보낸 값으로 덮어쓴다 */
export const updateAdminUserProfile = async function ({
  userId,
  input: { name, departmentId, jobTitle },
  signal,
}: {
  userId: number;
  input: UserProfileInput;
  signal?: AbortSignal;
}) {
  const result = await apiRequest<AdminUserDto>({
    method: "PATCH",
    path: userPath(userId),
    body: { name: name.trim(), departmentId, jobTitle: jobTitle.trim() || null },
    signal,
  });
  return mapResult(result, toUser);
};

/** PATCH /api/admin/users/{userId}/system-role — 대상 사용자의 모든 세션이 끊긴다 */
export const changeAdminUserRole = async function ({
  userId,
  systemRole,
  signal,
}: {
  userId: number;
  systemRole: SystemRole;
  signal?: AbortSignal;
}) {
  const result = await apiRequest<AdminUserDto>({
    method: "PATCH",
    path: `${userPath(userId)}/system-role`,
    body: { systemRole: ROLE_TO_DTO[systemRole] },
    signal,
  });
  return mapResult(result, toUser);
};

/** PATCH /api/admin/users/{userId}/status — 비활성화하면 대상 사용자의 모든 세션이 끊긴다 */
export const changeAdminUserStatus = async function ({
  userId,
  status,
  signal,
}: {
  userId: number;
  status: RecordStatus;
  signal?: AbortSignal;
}) {
  const result = await apiRequest<AdminUserDto>({
    method: "PATCH",
    path: `${userPath(userId)}/status`,
    body: { status: STATUS_TO_DTO[status] },
    signal,
  });
  return mapResult(result, toUser);
};

/** GET /api/admin/users/{userId}/histories — id 내림차순 커서 목록 */
export const fetchUserHistories = async function ({
  userId,
  cursor,
  size = 20,
  signal,
}: {
  userId: number;
  cursor?: string | null;
  size?: number;
  signal?: AbortSignal;
}) {
  const result = await apiRequest<CursorPageDto<UserHistoryDto>>({
    path: `${userPath(userId)}/histories${toQuery({ cursor, size })}`,
    signal,
  });
  return mapResult(result, (page) => toPage(page, toHistory));
};

/* =====================================================================
 * 부서 API
 * ===================================================================== */

/** GET /api/admin/departments — id 오름차순 커서 목록 (상위가 먼저 와서 이어 받으며 트리를 만들 수 있다) */
export const fetchAdminDepartments = async function ({
  cursor,
  size = 100,
  status,
  signal,
}: {
  cursor?: string | null;
  size?: number;
  status?: RecordStatus | null;
  signal?: AbortSignal;
}) {
  const result = await apiRequest<CursorPageDto<AdminDepartmentDto>>({
    path: `/admin/departments${toQuery({ cursor, size, status: status ? STATUS_TO_DTO[status] : null })}`,
    signal,
  });
  return mapResult(result, (page) => toPage(page, toDepartment));
};

/** 부서는 트리로 보여줘야 하므로 모든 페이지를 이어 받는다. */
export const fetchAllAdminDepartments = async function ({ signal }: { signal?: AbortSignal } = {}): Promise<
  ApiResult<AdminDepartment[]>
> {
  const collected: AdminDepartment[] = [];
  let cursor: string | null = null;
  // 서버가 nextCursor를 잘못 돌려줘도 무한 반복하지 않도록 상한을 둔다.
  for (let page = 0; page < 50; page += 1) {
    const result = await fetchAdminDepartments({ cursor, size: 100, signal });
    if (result.ok === false) return result;
    const { items, nextCursor, hasNext } = result.data;
    collected.push(...items);
    if (!hasNext || !nextCursor) break;
    cursor = nextCursor;
  }
  return { ok: true, data: collected };
};

export interface DepartmentInput {
  name: string;
  parentId: number | null;
}

/** POST /api/admin/departments */
export const createAdminDepartment = async function ({
  input: { name, parentId },
  signal,
}: {
  input: DepartmentInput;
  signal?: AbortSignal;
}) {
  const result = await apiRequest<AdminDepartmentDto>({
    method: "POST",
    path: "/admin/departments",
    body: { name: name.trim(), parentId },
    signal,
  });
  return mapResult(result, toDepartment);
};

/** PATCH /api/admin/departments/{departmentId} — 이름 변경·상위 부서 이동 (parentId null이면 최상위) */
export const updateAdminDepartment = async function ({
  departmentId,
  input: { name, parentId },
  signal,
}: {
  departmentId: number;
  input: DepartmentInput;
  signal?: AbortSignal;
}) {
  const result = await apiRequest<AdminDepartmentDto>({
    method: "PATCH",
    path: departmentPath(departmentId),
    body: { name: name.trim(), parentId },
    signal,
  });
  return mapResult(result, toDepartment);
};

/** PATCH /api/admin/departments/{departmentId}/status */
export const changeAdminDepartmentStatus = async function ({
  departmentId,
  status,
  signal,
}: {
  departmentId: number;
  status: RecordStatus;
  signal?: AbortSignal;
}) {
  const result = await apiRequest<AdminDepartmentDto>({
    method: "PATCH",
    path: `${departmentPath(departmentId)}/status`,
    body: { status: STATUS_TO_DTO[status] },
    signal,
  });
  return mapResult(result, toDepartment);
};
