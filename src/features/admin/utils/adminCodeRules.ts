import type { ApiFailure } from "@/shared/api/client";
import { MAX_SORT_ORDER, MIN_SORT_ORDER, type AdminCode } from "@/features/admin/api/adminCodeApi";
import { ADMIN_CODE_TEXT } from "@/features/admin/i18n/ko";
import { adminErrorMessage, failureStatus } from "@/features/admin/utils/adminFormat";

/** 서버와 같은 순서: sortOrder 오름차순, 같으면 id 오름차순 (02-3 명세) */
export const sortCodes = function (codes: AdminCode[]): AdminCode[] {
  return codes.slice().sort((a, b) => a.sortOrder - b.sortOrder || a.id - b.id);
};

export type SortOrderCheck = { ok: true; value: number } | { ok: false; message: string };

/** 정렬 순서 입력 검사. 서버도 같은 범위(0~9999)를 검사하지만 보내기 전에 막아 둔다. */
export const parseSortOrder = function (input: string): SortOrderCheck {
  const text = input.trim();
  if (!text) return { ok: false, message: ADMIN_CODE_TEXT.sortOrderRequired };
  if (!/^\d+$/.test(text)) return { ok: false, message: ADMIN_CODE_TEXT.sortOrderRange };
  const value = Number(text);
  if (value < MIN_SORT_ORDER || value > MAX_SORT_ORDER) return { ok: false, message: ADMIN_CODE_TEXT.sortOrderRange };
  return { ok: true, value };
};

export interface CodeFailureView {
  message: string;
  /** 그룹이나 코드가 사라져 목록을 다시 받아야 하는지 */
  stale: boolean;
}

/**
 * PATCH .../codes/{code}와 GET .../codes 실패 해석.
 * 오류 본문에는 code가 없어(API 공통 규약 6절) status로 정한다.
 * 404는 CODE_GROUP_NOT_FOUND·CODE_NOT_FOUND이고, 400은 입력·경로 형식 문제라 서버 메시지만 보여 준다.
 */
export const interpretCodeFailure = function (failure: ApiFailure): CodeFailureView {
  return { message: adminErrorMessage(failure), stale: failureStatus(failure) === 404 };
};
