import type { ApiFailure } from "@/shared/api/client";
import { MAX_API_PATH_LENGTH, MAX_ERROR_TYPE_LENGTH, type ErrorLogQuery } from "@/features/admin/api/adminErrorLogApi";
import { ADMIN_ERROR_LOG_TEXT } from "@/features/admin/i18n/ko";
import { adminErrorMessage, failureStatus } from "@/features/admin/utils/adminFormat";

/** 화면 필터 입력 (날짜는 date input의 YYYY-MM-DD) */
export interface ErrorLogFilterInput {
  fromDate: string;
  toDate: string;
  errorType: string;
  apiPath: string;
}

export type FilterCheck = { ok: true; query: ErrorLogQuery } | { ok: false; message: string };

/** 날짜(YYYY-MM-DD)가 뜻하는 하루의 시작 시점. 기본은 브라우저 시간대(화면 표시 시간대)다. */
export type DayStart = (year: number, monthIndex: number, day: number) => Date;

const browserDayStart: DayStart = (year, monthIndex, day) => new Date(year, monthIndex, day);

const DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

const dayStartIso = function (text: string, dayStart: DayStart, { nextDay }: { nextDay: boolean }): string | null {
  const match = DATE_PATTERN.exec(text);
  if (!match) return null;
  const [, y, m, d] = match.map(Number);
  // Date는 2026-02-30을 3월 2일로 넘겨 버리므로, 달력에 있는 날짜인지 시간대와 상관없이 먼저 확인한다.
  const calendar = new Date(Date.UTC(y, m - 1, d));
  if (calendar.getUTCFullYear() !== y || calendar.getUTCMonth() !== m - 1 || calendar.getUTCDate() !== d) return null;
  const date = dayStart(y, m - 1, d + (nextDay ? 1 : 0));
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
};

/**
 * 화면 필터 → API 쿼리.
 * - 기간은 표시 시간대 기준 날짜로 받는다. 시작일 0시(포함) ~ 종료일 다음 날 0시(제외)를 UTC 시각으로 보낸다.
 *   서버 기준(from 포함, to 제외)과 같아 종료일 하루가 통째로 포함된다.
 * - 예외 유형은 정확히 일치, 경로는 앞부분 일치(서버 규칙). 길이는 서버 제한과 같게 막는다.
 */
export const toErrorLogQuery = function (
  { fromDate, toDate, errorType, apiPath }: ErrorLogFilterInput,
  dayStart: DayStart = browserDayStart,
): FilterCheck {
  const from = fromDate ? dayStartIso(fromDate, dayStart, { nextDay: false }) : null;
  const to = toDate ? dayStartIso(toDate, dayStart, { nextDay: true }) : null;
  if ((fromDate && !from) || (toDate && !to)) return { ok: false, message: ADMIN_ERROR_LOG_TEXT.invalidDate };
  if (from && to && from >= to) return { ok: false, message: ADMIN_ERROR_LOG_TEXT.invalidPeriod };
  const type = errorType.trim();
  const path = apiPath.trim();
  if (type.length > MAX_ERROR_TYPE_LENGTH) return { ok: false, message: ADMIN_ERROR_LOG_TEXT.errorTypeTooLong };
  if (path.length > MAX_API_PATH_LENGTH) return { ok: false, message: ADMIN_ERROR_LOG_TEXT.apiPathTooLong };
  return { ok: true, query: { from, to, errorType: type, apiPath: path } };
};

/** 예외 클래스 전체 이름에서 마지막 이름만 (목록에서 짧게 보여 주고 전체는 제목으로) */
export const shortTypeName = function (errorType: string): string {
  const parts = errorType.split(".");
  return parts[parts.length - 1] || errorType;
};

/**
 * 상세 조회 실패. 404는 ERROR_LOG_NOT_FOUND(또는 권한 없음)라 다시 시도해도 같다.
 * 그 밖의 실패는 서버 메시지·공통 문구를 보여 주고 다시 시도할 수 있게 한다.
 */
export const interpretDetailFailure = function (failure: ApiFailure): { message: string; retryable: boolean } {
  const status = failureStatus(failure);
  if (status === 404) return { message: adminErrorMessage(failure, { byStatus: { 404: ADMIN_ERROR_LOG_TEXT.notFound } }), retryable: false };
  return { message: adminErrorMessage(failure), retryable: failure.kind !== "aborted" };
};
