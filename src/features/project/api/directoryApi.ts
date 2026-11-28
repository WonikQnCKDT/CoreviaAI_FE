import { apiRequest, type ApiResult } from "@/shared/api/client";

/**
 * 일반 사용자용 조회 API(SCRUM-98 BE 계약). 프로젝트 생성 ①·⑤·⑥과 멤버 초대(SCRUM-106)가 함께 쓴다.
 * 접근 대상은 프로젝트 API와 같다(USER·EXECUTIVE, 시스템 관리자는 404).
 * - GET /api/departments: 활성 부서, 이름·ID 오름차순, 최대 1000건
 * - GET /api/users/search?keyword&size: 초대할 수 있는 사용자(활성 일반 사용자, 본인 제외) 이름 부분 일치, 최대 20건
 */

/* ===== 서버 DTO (BE DepartmentResponse·UserSearchResponse record 그대로) ===== */

interface DepartmentDto {
  id: number;
  parentId: number | null;
  name: string;
}

interface UserSearchDto {
  id: number;
  name: string;
  departmentName: string | null;
  jobTitle: string | null;
}

/* ===== 화면 모델 ===== */

export interface DirectoryDepartment {
  id: number;
  /** 상위 부서. 최상위면 null */
  parentId: number | null;
  name: string;
}

/** 초대 후보 한 명. 아이디·역할·상태는 서버가 주지 않는다(노출 최소화) */
export interface DirectoryUser {
  id: number;
  name: string;
  departmentName: string | null;
  jobTitle: string | null;
}

/** 검색어 규칙(BE UserSearchKeyword): 앞뒤 공백을 뺀 2~50자, 제어 문자 금지 */
export const USER_SEARCH_MIN_LENGTH = 2;
export const USER_SEARCH_MAX_LENGTH = 50;
/** 한 번에 받을 수 있는 최대 결과 수(BE UserDirectoryService.MAX_SIZE) */
export const USER_SEARCH_MAX_SIZE = 20;

// eslint-disable-next-line no-control-regex -- 제어 문자(C0·DEL·C1)를 거르려는 의도된 패턴
const CONTROL_CHARACTER = /[\u0000-\u001F\u007F-\u009F]/u;

/**
 * 서버로 보낼 검색어. 규칙에 맞지 않으면 null(요청하지 않는다).
 * 길이는 문자(code point) 단위로 센다(서버와 같은 기준).
 */
export const normalizeUserSearchKeyword = function (raw: string): string | null {
  const keyword = raw.trim();
  const length = [...keyword].length;
  if (length < USER_SEARCH_MIN_LENGTH || length > USER_SEARCH_MAX_LENGTH || CONTROL_CHARACTER.test(keyword)) return null;
  return keyword;
};

const mapResult = function <A, B>(result: ApiResult<A>, transform: (data: A) => B): ApiResult<B> {
  return result.ok === true ? { ok: true, data: transform(result.data) } : result;
};

const toDepartment = ({ id, parentId, name }: DepartmentDto): DirectoryDepartment => ({ id, parentId: parentId ?? null, name });

const toUser = ({ id, name, departmentName, jobTitle }: UserSearchDto): DirectoryUser => ({
  id,
  name,
  departmentName: departmentName ?? null,
  jobTitle: jobTitle ?? null,
});

/** GET /api/departments — 주관 부서 선택지 */
export const fetchDepartments = async function ({ signal }: { signal?: AbortSignal } = {}) {
  const result = await apiRequest<DepartmentDto[]>({ path: "/departments", signal });
  return mapResult(result, (items) => (items ?? []).map(toDepartment));
};

/**
 * GET /api/users/search — 이름으로 초대할 사람을 찾는다.
 * 검색어가 규칙에 맞지 않으면 요청하지 않고 빈 목록을 준다(서버 400을 피한다). size는 1~20으로 맞춘다.
 */
export const searchUsers = async function ({
  keyword,
  size = USER_SEARCH_MAX_SIZE,
  signal,
}: {
  keyword: string;
  size?: number;
  signal?: AbortSignal;
}): Promise<ApiResult<DirectoryUser[]>> {
  const normalized = normalizeUserSearchKeyword(keyword);
  if (normalized === null) return { ok: true, data: [] };
  const bounded = Math.min(USER_SEARCH_MAX_SIZE, Math.max(1, Math.trunc(Number.isFinite(size) ? size : USER_SEARCH_MAX_SIZE)));
  const query = new URLSearchParams({ keyword: normalized, size: String(bounded) }).toString();
  const result = await apiRequest<UserSearchDto[]>({ path: `/users/search?${query}`, signal });
  return mapResult(result, (items) => (items ?? []).map(toUser));
};

/** 부서 계층을 "상위 > 하위" 이름으로 보여 주기 위한 경로. 순환·없는 상위가 있어도 멈춘다 */
export const departmentPath = function (department: DirectoryDepartment, byId: ReadonlyMap<number, DirectoryDepartment>): string {
  const names = [department.name];
  const seen = new Set<number>([department.id]);
  let parentId = department.parentId;
  while (parentId !== null && !seen.has(parentId)) {
    const parent = byId.get(parentId);
    if (!parent) break;
    names.unshift(parent.name);
    seen.add(parent.id);
    parentId = parent.parentId;
  }
  return names.join(" > ");
};
