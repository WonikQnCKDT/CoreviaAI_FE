import { apiRequest, type ApiResult } from "@/shared/api/client";
import type { CursorPage } from "@/features/admin/api/adminApi";

/**
 * 에러 로그 조회 API (Confluence 02-5. 에러 로그, FR-ADM-09). SYSTEM_ADMIN만 호출할 수 있다(그 외 404).
 * append-only라 조회만 있다. 메시지·스택 트레이스는 서버가 저장 전에 마스킹한 값이다.
 * 화면은 이 값을 메모리에만 두고 브라우저 저장소에 남기지 않는다.
 */

interface ErrorLogDto {
  id: number;
  occurredAt: string;
  httpMethod: string | null;
  apiPath: string | null;
  userId: number | null;
  errorType: string;
  message: string | null;
}

interface ErrorLogDetailDto extends ErrorLogDto {
  stackTrace: string | null;
}

interface CursorPageDto<T> {
  items: T[];
  nextCursor: string | null;
  hasNext: boolean;
}

export interface ErrorLog {
  id: number;
  occurredAt: string;
  httpMethod: string | null;
  apiPath: string | null;
  userId: number | null;
  errorType: string;
  message: string | null;
}

export interface ErrorLogDetail extends ErrorLog {
  stackTrace: string | null;
}

/** 목록 필터. from·to는 ISO-8601 UTC 시각(from 포함, to 제외) */
export interface ErrorLogQuery {
  from?: string | null;
  to?: string | null;
  errorType?: string;
  apiPath?: string;
}

export const MAX_ERROR_TYPE_LENGTH = 200;
export const MAX_API_PATH_LENGTH = 300;

const toErrorLog = ({ id, occurredAt, httpMethod, apiPath, userId, errorType, message }: ErrorLogDto): ErrorLog => ({
  id,
  occurredAt,
  httpMethod: httpMethod ?? null,
  apiPath: apiPath ?? null,
  userId: userId ?? null,
  errorType,
  message: message ?? null,
});

const mapResult = function <A, B>(result: ApiResult<A>, transform: (data: A) => B): ApiResult<B> {
  return result.ok === true ? { ok: true, data: transform(result.data) } : result;
};

/** GET /api/admin/error-logs — id 내림차순(최신순) 커서 목록. 스택 트레이스는 없다. */
export const fetchErrorLogs = async function ({
  cursor,
  size = 20,
  from,
  to,
  errorType,
  apiPath,
  signal,
}: ErrorLogQuery & { cursor?: string | null; size?: number; signal?: AbortSignal }): Promise<ApiResult<CursorPage<ErrorLog>>> {
  const search = new URLSearchParams();
  if (cursor) search.set("cursor", cursor);
  search.set("size", String(size));
  if (from) search.set("from", from);
  if (to) search.set("to", to);
  const type = errorType?.trim().slice(0, MAX_ERROR_TYPE_LENGTH);
  if (type) search.set("errorType", type);
  const path = apiPath?.trim().slice(0, MAX_API_PATH_LENGTH);
  if (path) search.set("apiPath", path);
  const result = await apiRequest<CursorPageDto<ErrorLogDto>>({ path: `/admin/error-logs?${search.toString()}`, signal });
  return mapResult(result, ({ items, nextCursor, hasNext }) => ({
    items: (items ?? []).map(toErrorLog),
    nextCursor: nextCursor ?? null,
    hasNext: Boolean(hasNext),
  }));
};

/** GET /api/admin/error-logs/{errorLogId} — 스택 트레이스 포함 */
export const fetchErrorLog = async function ({ errorLogId, signal }: { errorLogId: number; signal?: AbortSignal }) {
  const result = await apiRequest<ErrorLogDetailDto>({ path: `/admin/error-logs/${encodeURIComponent(String(errorLogId))}`, signal });
  return mapResult(result, (dto): ErrorLogDetail => ({ ...toErrorLog(dto), stackTrace: dto.stackTrace ?? null }));
};
