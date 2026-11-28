import { apiRequest, type ApiResult } from "@/shared/api/client";

/**
 * 화면용 공통 코드 조회 API (Confluence 02-3, FR-ADM-07).
 * 로그인한 사용자 누구나 GET /api/codes/{groupCode}를 호출할 수 있다.
 * 표시 텍스트는 각 코드의 labelKey로 다국어 라벨(FR-ADM-06)에서 읽는다.
 */

export type CommonCodeGroup = "RISK_LEVEL" | "TASK_STATUS" | "REQUEST_RESULT" | "PROJECT_STATUS";

/** BE CommonCode.GROUP_CODE_PATTERN과 같은 검사(영문 대문자 시작, 대문자·숫자·밑줄 1~50자) */
const GROUP_CODE_PATTERN = /^[A-Z][A-Z0-9_]{0,49}$/;

interface CodeItemDto {
  code: string;
  labelKey: string;
  sortOrder: number;
}

interface GroupCodesDto {
  groupCode: string;
  labelKey: string;
  codes: CodeItemDto[];
}

export interface CommonCodeItem {
  code: string;
  labelKey: string;
  sortOrder: number;
}

export interface CommonCodeGroupData {
  groupCode: string;
  labelKey: string;
  codes: CommonCodeItem[];
}

const toCodeItem = (dto: CodeItemDto): CommonCodeItem | null => {
  if (!dto || typeof dto.code !== "string" || !dto.code || typeof dto.labelKey !== "string") return null;
  const sortOrder = Number(dto.sortOrder);
  return {
    code: dto.code,
    labelKey: dto.labelKey,
    sortOrder: Number.isFinite(sortOrder) ? sortOrder : 0,
  };
};

const toGroupCodes = (dto: GroupCodesDto): CommonCodeGroupData | null => {
  if (!dto || typeof dto.groupCode !== "string" || typeof dto.labelKey !== "string" || !Array.isArray(dto.codes)) {
    return null;
  }
  const codes = dto.codes
    .map(toCodeItem)
    .filter((item): item is CommonCodeItem => item !== null)
    .sort((a, b) => a.sortOrder - b.sortOrder || a.code.localeCompare(b.code));
  return {
    groupCode: dto.groupCode,
    labelKey: dto.labelKey,
    codes,
  };
};

/** GET /api/codes/{groupCode} — 사용 중인 코드만 정렬 순서 오름차순으로 조회한다. */
export const fetchCommonCodes = async function ({
  groupCode,
  signal,
}: {
  groupCode: CommonCodeGroup | string;
  signal?: AbortSignal;
}): Promise<ApiResult<CommonCodeGroupData>> {
  if (!GROUP_CODE_PATTERN.test(groupCode)) {
    return { ok: false, failure: { kind: "http", status: 400, code: null, message: null } };
  }
  const result = await apiRequest<GroupCodesDto>({
    path: `/codes/${encodeURIComponent(groupCode)}`,
    signal,
  });
  if (result.ok === false) return result;
  const parsed = toGroupCodes(result.data);
  if (!parsed) {
    return { ok: false, failure: { kind: "http", status: 200, code: null, message: null } };
  }
  return { ok: true, data: parsed };
};
