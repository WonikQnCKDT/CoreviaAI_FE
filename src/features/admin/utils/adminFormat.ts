import type { ApiFailure } from "@/shared/api/client";
import { AUTH_TEXT } from "@/features/auth/i18n/ko";
import { ADMIN_ERROR_TEXT } from "@/features/admin/i18n/ko";

/** 실패 → 화면 문구. 오류 코드 표를 먼저 보고, 없으면 서버 검증 메시지, 마지막으로 공통 문구를 쓴다. */
export const adminErrorMessage = function (failure: ApiFailure): string {
  if (failure.kind === "timeout") return AUTH_TEXT.timeout;
  if (failure.kind === "network") return AUTH_TEXT.network;
  if (failure.kind === "aborted") return "";
  const { status, code, message } = failure;
  if (code && ADMIN_ERROR_TEXT[code]) return ADMIN_ERROR_TEXT[code];
  if (status === 400 && message) return message;
  if (status === 503) return AUTH_TEXT.serviceUnavailable;
  return AUTH_TEXT.unknown;
};

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
