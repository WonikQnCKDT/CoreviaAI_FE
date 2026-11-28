import type { ApiFailure } from "@/shared/api/client";
import type { ChangePasswordOutcome, ResetPasswordOutcome, SignInOutcome } from "@/features/auth/authContext";
import { AUTH_TEXT } from "@/features/auth/i18n/ko";

/**
 * 인증 API 실패 → 화면 결과.
 * 서버 오류 본문에는 code가 없다(error는 message·status뿐, 공통 규약 6절·BE ApiResponse.ApiError).
 * 그래서 API마다 HTTP status로 상황을 정하고, 한 status에 여러 상황이 있으면 서버 메시지를 보여 준다.
 */

/** 서버 오류 코드와 상관없이 공통으로 쓰는 실패 문구 */
export const commonFailureMessage = function (failure: ApiFailure): string {
  if (failure.kind === "timeout") return AUTH_TEXT.timeout;
  if (failure.kind === "network") return AUTH_TEXT.network;
  if (failure.kind === "http" && failure.status === 503) return AUTH_TEXT.serviceUnavailable;
  return AUTH_TEXT.unknown;
};

/**
 * POST /api/auth/login
 * - 400: INVALID_CREDENTIALS. 아이디·비밀번호 형식은 화면이 먼저 검사하므로 400은 자격 증명 불일치로 본다.
 *   아이디가 없는지 비밀번호가 틀렸는지는 알려 주지 않는다(같은 문구).
 * - 403: ACCOUNT_DISABLED (로그인에서 403은 이것뿐)
 * - 423: ACCOUNT_LOCKED
 */
export const toSignInOutcome = function (failure: ApiFailure): SignInOutcome {
  if (failure.kind === "aborted") return { kind: "aborted" };
  if (failure.kind !== "http") return { kind: "failed", message: commonFailureMessage(failure) };
  if (failure.status === 400) return { kind: "rejected", field: "password", message: AUTH_TEXT.invalidCredentials };
  if (failure.status === 403) return { kind: "rejected", field: "account", message: AUTH_TEXT.accountDisabled };
  if (failure.status === 423) return { kind: "locked", message: AUTH_TEXT.accountLocked };
  return { kind: "failed", message: commonFailureMessage(failure) };
};

/**
 * PATCH /api/users/me/password
 * - 400: INVALID_PASSWORD(현재 비밀번호 불일치)·INVALID_NEW_PASSWORD·SAME_AS_CURRENT_PASSWORD·입력 검증이 모두 400이라
 *   어느 칸 문제인지 status로 알 수 없다. 서버 메시지를 폼 오류로 보여 준다.
 * - 404: USER_NOT_FOUND
 * (401은 공통 client가 재발급·세션 종료로 처리한다)
 */
export const toChangePasswordOutcome = function (failure: ApiFailure): ChangePasswordOutcome {
  if (failure.kind === "aborted") return { kind: "aborted" };
  if (failure.kind !== "http") return { kind: "failed", message: commonFailureMessage(failure) };
  if (failure.status === 400) return { kind: "rejected", field: "form", message: failure.message || AUTH_TEXT.unknown };
  if (failure.status === 404) return { kind: "failed", message: AUTH_TEXT.accountNotFound };
  return { kind: "failed", message: commonFailureMessage(failure) };
};

/**
 * POST /api/admin/users/{userId}/password-reset (시스템 관리자 화면에서만 부른다)
 * - 404: USER_NOT_FOUND. 권한 없는 호출의 404 NOT_FOUND와 status가 같지만, 이 API는 관리자 화면에서만 불러 대상 사용자 없음으로 본다.
 * - 403: 관리자 본인이 비밀번호 변경 강제 상태(PASSWORD_CHANGE_REQUIRED)
 * - 400: 대상 ID 형식
 */
export const toResetOutcome = function (failure: ApiFailure): ResetPasswordOutcome {
  if (failure.kind === "aborted") return { kind: "aborted" };
  if (failure.kind !== "http") return { kind: "failed", message: commonFailureMessage(failure) };
  if (failure.status === 404) return { kind: "failed", message: AUTH_TEXT.resetUserNotFound };
  if (failure.status === 403) return { kind: "failed", message: AUTH_TEXT.forcedChangeDescription };
  if (failure.status === 400) return { kind: "failed", message: failure.message || AUTH_TEXT.resetUserIdInvalid };
  return { kind: "failed", message: commonFailureMessage(failure) };
};
