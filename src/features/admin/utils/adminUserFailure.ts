import type { ApiFailure } from "@/shared/api/client";
import { ADMIN_ERROR_TEXT } from "@/features/admin/i18n/ko";
import { adminErrorMessage, failureStatus } from "@/features/admin/utils/adminFormat";

/**
 * 사용자 관리 API(02-1) 실패를 화면 동작으로 바꾼다.
 * 오류 본문에는 code가 없으므로, 같은 API 안에서 HTTP status만으로 상황이 하나로 정해질 때만 분기한다.
 * 400처럼 한 status에 여러 상황이 있으면 서버 메시지를 그대로 보여 준다.
 */

export type UserFormField = "loginId" | "name" | "departmentId" | "jobTitle";

export interface UserFailureView {
  message: string;
  /** 오류를 붙일 입력칸. 없으면 폼 전체 오류로 보여 준다. */
  field: UserFormField | null;
  /** 화면 값이 낡았을 수 있어 대상 사용자를 다시 받아야 하는지 */
  stale: boolean;
}

/** POST /api/admin/users — 409는 DUPLICATE_LOGIN_ID, 404는 DEPARTMENT_NOT_FOUND뿐이다. */
export const interpretCreateUserFailure = function (failure: ApiFailure): UserFailureView {
  const status = failureStatus(failure);
  const message = adminErrorMessage(failure);
  if (status === 409) return { message, field: "loginId", stale: false };
  if (status === 404) return { message, field: "departmentId", stale: false };
  return { message, field: null, stale: false };
};

/** PATCH /api/admin/users/{userId} — 409는 CONCURRENT_MODIFICATION, 404는 USER_NOT_FOUND 또는 DEPARTMENT_NOT_FOUND */
export const interpretUpdateProfileFailure = function (failure: ApiFailure): UserFailureView {
  const status = failureStatus(failure);
  const message = adminErrorMessage(failure, { byStatus: { 409: ADMIN_ERROR_TEXT.concurrentModification } });
  return { message, field: null, stale: status === 409 || status === 404 };
};

/**
 * PATCH /api/admin/users/{userId}/system-role, /status
 * 503은 DB에는 반영됐지만 세션을 끊지 못한 경우라 같은 요청을 다시 보내면 된다(멱등).
 * 404(USER_NOT_FOUND)·409(LAST_SYSTEM_ADMIN)는 목록 값이 낡았을 수 있어 대상 사용자를 다시 받는다.
 */
export const interpretAccountChangeFailure = function (failure: ApiFailure): UserFailureView {
  const status = failureStatus(failure);
  const message = adminErrorMessage(failure, { byStatus: { 503: ADMIN_ERROR_TEXT.sessionRevokeFailed } });
  return { message, field: null, stale: status === 404 || status === 409 };
};
