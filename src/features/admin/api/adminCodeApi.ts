import { apiRequest, type ApiResult } from "@/shared/api/client";

/**
 * 공통 코드 관리 API (Confluence 02-3. 공통 코드, FR-ADM-07).
 * 코드 값·라벨 키·사용 여부는 마이그레이션으로만 바뀌고, 관리자는 정렬 순서만 바꾼다.
 * 목록은 페이지 없이 전체를 준다(공통 규약 8절 예외).
 */

/* ===== 서버 DTO (API 명세 그대로) ===== */

interface AdminCodeGroupDto {
  id: number;
  groupCode: string;
  labelKey: string;
  createdAt: string;
  updatedAt: string;
}

interface AdminCodeDto {
  id: number;
  groupCode: string;
  code: string;
  labelKey: string;
  sortOrder: number;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

/* ===== 화면에서 쓰는 domain model ===== */

export interface CodeGroup {
  id: number;
  groupCode: string;
  labelKey: string;
}

export interface AdminCode {
  id: number;
  code: string;
  labelKey: string;
  sortOrder: number;
  active: boolean;
  updatedAt: string;
}

export const MIN_SORT_ORDER = 0;
export const MAX_SORT_ORDER = 9999;

const toGroup = ({ id, groupCode, labelKey }: AdminCodeGroupDto): CodeGroup => ({ id, groupCode, labelKey });

const toCode = ({ id, code, labelKey, sortOrder, active, updatedAt }: AdminCodeDto): AdminCode => ({
  id,
  code,
  labelKey,
  sortOrder,
  active: Boolean(active),
  updatedAt,
});

const mapResult = function <A, B>(result: ApiResult<A>, transform: (data: A) => B): ApiResult<B> {
  return result.ok === true ? { ok: true, data: transform(result.data) } : result;
};

const groupPath = (groupCode: string) => `/admin/code-groups/${encodeURIComponent(groupCode)}`;

/** GET /api/admin/code-groups — id 오름차순 */
export const fetchCodeGroups = async function ({ signal }: { signal?: AbortSignal } = {}) {
  const result = await apiRequest<AdminCodeGroupDto[]>({ path: "/admin/code-groups", signal });
  return mapResult(result, (groups) => (groups ?? []).map(toGroup));
};

/** GET /api/admin/code-groups/{groupCode}/codes — 사용 안 함 코드 포함, sortOrder → id 오름차순 */
export const fetchGroupCodes = async function ({ groupCode, signal }: { groupCode: string; signal?: AbortSignal }) {
  const result = await apiRequest<AdminCodeDto[]>({ path: `${groupPath(groupCode)}/codes`, signal });
  return mapResult(result, (codes) => (codes ?? []).map(toCode));
};

/** PATCH /api/admin/code-groups/{groupCode}/codes/{code} — 정렬 순서만 보낸다. 같은 값이면 서버가 변경·이력을 남기지 않는다. */
export const changeCodeSortOrder = async function ({
  groupCode,
  code,
  sortOrder,
  signal,
}: {
  groupCode: string;
  code: string;
  sortOrder: number;
  signal?: AbortSignal;
}) {
  const result = await apiRequest<AdminCodeDto>({
    method: "PATCH",
    path: `${groupPath(groupCode)}/codes/${encodeURIComponent(code)}`,
    body: { sortOrder },
    signal,
  });
  return mapResult(result, toCode);
};
