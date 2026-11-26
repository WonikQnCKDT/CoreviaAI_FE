import type { ApiFailure } from "@/shared/api/client";
import { AUTH_TEXT } from "@/features/auth/i18n/ko";

/**
 * 실패 → 화면 문구.
 * 서버 오류 본문은 message·status만 준다(API 공통 규약 6절). 상황별로 FE 문구가 필요하면 호출하는 쪽이
 * status로 골라 `byStatus`로 넘기고, 없으면 서버 메시지, 마지막으로 공통 문구를 쓴다.
 * 서버 메시지는 보여 주기만 하고 분기 조건으로 쓰지 않는다(문구는 바뀔 수 있다).
 */
export const adminErrorMessage = function (
  failure: ApiFailure,
  { byStatus = {} }: { byStatus?: Partial<Record<number, string>> } = {},
): string {
  if (failure.kind === "timeout") return AUTH_TEXT.timeout;
  if (failure.kind === "network") return AUTH_TEXT.network;
  if (failure.kind === "aborted") return "";
  const { status, message } = failure;
  const override = byStatus[status];
  if (override) return override;
  if (message) return message;
  if (status === 503) return AUTH_TEXT.serviceUnavailable;
  return AUTH_TEXT.unknown;
};

export const failureStatus = function (failure: ApiFailure): number | null {
  return failure.kind === "http" ? failure.status : null;
};

/**
 * 서버가 오류 본문에 code를 주지 않아 지금은 항상 null이다.
 * 부서 화면(DepartmentFormDialog·ServerDepartmentsPanel)이 아직 쓰고 있어 남겨 둔다. 새 코드에서는 failureStatus를 쓴다.
 */
export const failureCode = function (failure: ApiFailure): string | null {
  return failure.kind === "http" ? failure.code : null;
};

const pageLocale = function () {
  if (typeof document === "undefined") return "ko-KR";
  return document.documentElement.lang || "ko-KR";
};

/** 서버 시각(UTC ISO)을 화면 locale 기준 날짜·시각으로 표시한다. */
export const formatDateTime = function ({ iso, locale = pageLocale() }: { iso: string | null; locale?: string }) {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "short" }).format(date);
};

export const formatCount = function ({ value, locale = pageLocale() }: { value: number; locale?: string }) {
  return new Intl.NumberFormat(locale).format(value);
};
