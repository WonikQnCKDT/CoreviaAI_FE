import { apiRequest, type ApiResult } from "@/shared/api/client";
import type { CursorPage } from "@/features/admin/api/adminApi";

/**
 * 다국어 라벨 관리 API (Confluence 02-4. 다국어 라벨, FR-ADM-06). SYSTEM_ADMIN만 호출할 수 있다(그 외 404).
 * 라벨 키는 바꾸거나 지울 수 없고, 문구만 고친다. 번역 누락은 null이다.
 */

interface AdminLabelDto {
  id: number;
  labelKey: string;
  textKo: string;
  textEn: string | null;
  textZhTw: string | null;
  version: number;
  createdAt: string;
  updatedAt: string;
}

interface CursorPageDto<T> {
  items: T[];
  nextCursor: string | null;
  hasNext: boolean;
}

interface AdminLabelHistoryDto {
  id: number;
  action: string;
  actorUserId: number | null;
  actorName: string | null;
  details: {
    labelKey?: string;
    lang?: string;
    text?: { before?: string | null; after?: string | null } | null;
    textKo?: string | null;
    textEn?: string | null;
    textZhTw?: string | null;
  } | null;
  ipAddress: string | null;
  occurredAt: string;
}

export interface AdminLabel {
  id: number;
  labelKey: string;
  textKo: string;
  /** null = 번역 누락 */
  textEn: string | null;
  textZhTw: string | null;
  /** 낙관적 잠금 값. 수정 요청에 그대로 보낸다. */
  version: number;
  updatedAt: string;
}

export type LabelHistoryDetail =
  | {
      kind: "created";
      textKo: string | null;
      textEn: string | null;
      textZhTw: string | null;
    }
  | {
      kind: "changed";
      lang: string;
      before: string | null;
      after: string | null;
    };

export interface LabelHistory {
  id: number;
  action: "I18N_LABEL_CREATED" | "I18N_LABEL_CHANGED" | string;
  actorUserId: number | null;
  actorName: string | null;
  detail: LabelHistoryDetail | null;
  ipAddress: string | null;
  occurredAt: string;
}

/** 번역 누락 필터. ko는 서버가 400으로 거부하므로 두지 않는다. */
export type MissingLanguage = "en" | "zh-TW";

export interface LabelTexts {
  textKo: string;
  textEn: string;
  textZhTw: string;
}

const toLabel = ({ id, labelKey, textKo, textEn, textZhTw, version, updatedAt }: AdminLabelDto): AdminLabel => ({
  id,
  labelKey,
  textKo,
  textEn: textEn ?? null,
  textZhTw: textZhTw ?? null,
  version,
  updatedAt,
});

const mapResult = function <A, B>(result: ApiResult<A>, transform: (data: A) => B): ApiResult<B> {
  return result.ok === true ? { ok: true, data: transform(result.data) } : result;
};

/** 문구는 앞뒤 공백을 지우고, 영어·번체 중국어가 비면 null(번역 누락)로 보낸다. 서버도 같은 규칙으로 저장한다. */
export const normalizeTexts = function ({ textKo, textEn, textZhTw }: LabelTexts) {
  return { textKo: textKo.trim(), textEn: textEn.trim() || null, textZhTw: textZhTw.trim() || null };
};

/** GET /api/admin/i18n/labels — id 오름차순 커서 목록 */
export const fetchAdminLabels = async function ({
  cursor,
  size = 20,
  keyword,
  missing,
  signal,
}: {
  cursor?: string | null;
  size?: number;
  keyword?: string;
  missing?: MissingLanguage | null;
  signal?: AbortSignal;
}): Promise<ApiResult<CursorPage<AdminLabel>>> {
  const search = new URLSearchParams();
  if (cursor) search.set("cursor", cursor);
  search.set("size", String(size));
  const trimmed = keyword?.trim().slice(0, 100);
  if (trimmed) search.set("keyword", trimmed);
  if (missing) search.set("missing", missing);
  const result = await apiRequest<CursorPageDto<AdminLabelDto>>({ path: `/admin/i18n/labels?${search.toString()}`, signal });
  return mapResult(result, ({ items, nextCursor, hasNext }) => ({
    items: (items ?? []).map(toLabel),
    nextCursor: nextCursor ?? null,
    hasNext: Boolean(hasNext),
  }));
};

/** POST /api/admin/i18n/labels — 같은 키가 있으면 409 DUPLICATE_LABEL_KEY */
export const createAdminLabel = async function ({
  labelKey,
  texts,
  signal,
}: {
  labelKey: string;
  texts: LabelTexts;
  signal?: AbortSignal;
}) {
  const result = await apiRequest<AdminLabelDto>({
    method: "POST",
    path: "/admin/i18n/labels",
    body: { labelKey: labelKey.trim(), ...normalizeTexts(texts) },
    signal,
  });
  return mapResult(result, toLabel);
};

/** PATCH /api/admin/i18n/labels/{labelId} — version이 다르면 409 CONCURRENT_MODIFICATION. 라벨 키는 보내지 않는다. */
export const updateAdminLabel = async function ({
  labelId,
  texts,
  version,
  signal,
}: {
  labelId: number;
  texts: LabelTexts;
  version: number;
  signal?: AbortSignal;
}) {
  const result = await apiRequest<AdminLabelDto>({
    method: "PATCH",
    path: `/admin/i18n/labels/${encodeURIComponent(String(labelId))}`,
    body: { ...normalizeTexts(texts), version },
    signal,
  });
  return mapResult(result, toLabel);
};

const toLabelHistoryDetail = function (action: string, details: AdminLabelHistoryDto["details"]): LabelHistoryDetail | null {
  if (!details || typeof details !== "object") return null;
  if (action === "I18N_LABEL_CREATED") {
    return {
      kind: "created",
      textKo: typeof details.textKo === "string" ? details.textKo : null,
      textEn: typeof details.textEn === "string" ? details.textEn : null,
      textZhTw: typeof details.textZhTw === "string" ? details.textZhTw : null,
    };
  }
  if (action === "I18N_LABEL_CHANGED" && typeof details.lang === "string") {
    const pair = details.text;
    return {
      kind: "changed",
      lang: details.lang,
      before: typeof pair?.before === "string" ? pair.before : null,
      after: typeof pair?.after === "string" ? pair.after : null,
    };
  }
  return null;
};

const toLabelHistory = ({
  id,
  action,
  actorUserId,
  actorName,
  details,
  ipAddress,
  occurredAt,
}: AdminLabelHistoryDto): LabelHistory => ({
  id,
  action,
  actorUserId: actorUserId ?? null,
  actorName: actorName ?? null,
  detail: toLabelHistoryDetail(action, details),
  ipAddress: ipAddress ?? null,
  occurredAt,
});

/** GET /api/admin/i18n/labels/{labelId}/histories — 최신순 커서 목록 */
export const fetchLabelHistories = async function ({
  labelId,
  cursor,
  size = 20,
  signal,
}: {
  labelId: number;
  cursor?: string | null;
  size?: number;
  signal?: AbortSignal;
}): Promise<ApiResult<CursorPage<LabelHistory>>> {
  const search = new URLSearchParams();
  if (cursor) search.set("cursor", cursor);
  search.set("size", String(size));
  const result = await apiRequest<CursorPageDto<AdminLabelHistoryDto>>({
    path: `/admin/i18n/labels/${encodeURIComponent(String(labelId))}/histories?${search.toString()}`,
    signal,
  });
  return mapResult(result, ({ items, nextCursor, hasNext }) => ({
    items: (items ?? []).map(toLabelHistory),
    nextCursor: nextCursor ?? null,
    hasNext: Boolean(hasNext),
  }));
};
