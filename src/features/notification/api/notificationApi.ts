import { API_BASE_URL, apiRequest, type ApiResult } from "@/shared/api/client";

/**
 * 12. 알림 (API) — 인앱 알림(FR-NTF-01, SCRUM-124).
 * 기준: Confluence 12. 알림 (API) v1. BE는 로컬 브랜치 feature/SCRUM-124-in-app-notification에만 있고 develop에 없다(2026-11-27 확인).
 * 그래서 명세 계약으로 만들고, 서버가 404를 주면 '준비 중'으로 다룬다. BE가 합쳐지면 DTO와 다시 대조해야 한다.
 */

export interface NotificationDto {
  id: number;
  notificationType: string;
  projectId: number | null;
  targetType: string | null;
  targetId: number | null;
  messageKey: string;
  messageParams: Record<string, unknown> | null;
  channel: string;
  readAt: string | null;
  createdAt: string;
}

interface CursorPageDto<T> {
  items: T[] | null;
  nextCursor: string | null;
  hasNext: boolean;
}

export type ServerNotificationType =
  | "assigned"
  | "mentioned"
  | "statusChanged"
  | "dueSoon"
  | "approvalRequested"
  | "missingTask"
  | "riskUp"
  | "projectInactive";

export interface ServerNotification {
  id: number;
  type: ServerNotificationType;
  projectId: number | null;
  targetType: "task" | "project" | null;
  targetId: number | null;
  messageKey: string;
  /** 사용자 입력(업무명 등)이 섞여 있어 문자열로만 다룬다 */
  params: Record<string, string>;
  read: boolean;
  createdAt: string;
}

const TYPE_FROM_DTO: Record<string, ServerNotificationType> = {
  ASSIGNED: "assigned",
  MENTIONED: "mentioned",
  STATUS_CHANGED: "statusChanged",
  DUE_SOON: "dueSoon",
  APPROVAL_REQUESTED: "approvalRequested",
  MISSING_TASK: "missingTask",
  RISK_UP: "riskUp",
  PROJECT_INACTIVE: "projectInactive",
};

const MAX_PARAM = 200;
const MAX_PARAMS = 10;
const MAX_CURSOR = 512;

const positiveOrNull = (value: unknown) => (typeof value === "number" && Number.isInteger(value) && value > 0 ? value : null);

const toParams = function (raw: unknown): Record<string, string> {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const params: Record<string, string> = {};
  Object.entries(raw as Record<string, unknown>)
    .slice(0, MAX_PARAMS)
    .forEach(([key, value]) => {
      if (typeof value === "string") params[key] = value.slice(0, MAX_PARAM);
      else if (typeof value === "number" && Number.isFinite(value)) params[key] = String(value);
    });
  return params;
};

/** 서버(목록·읽음 응답, SSE data) 항목 → 화면 모델. 형태가 맞지 않으면 null */
export const toNotification = function (raw: unknown): ServerNotification | null {
  if (!raw || typeof raw !== "object") return null;
  const dto = raw as Partial<NotificationDto>;
  const id = positiveOrNull(dto.id);
  if (id === null || typeof dto.notificationType !== "string" || !Object.hasOwn(TYPE_FROM_DTO, dto.notificationType)) return null;
  return {
    id,
    type: TYPE_FROM_DTO[dto.notificationType],
    projectId: positiveOrNull(dto.projectId),
    targetType: dto.targetType === "TASK" ? "task" : dto.targetType === "PROJECT" ? "project" : null,
    targetId: positiveOrNull(dto.targetId),
    messageKey: typeof dto.messageKey === "string" ? dto.messageKey : "",
    params: toParams(dto.messageParams),
    read: typeof dto.readAt === "string" && dto.readAt.length > 0,
    createdAt: typeof dto.createdAt === "string" ? dto.createdAt : "",
  };
};

/** SSE data 문자열 → 화면 모델. JSON이 아니거나 형태가 다르면 null(무시) */
export const parseStreamData = function (data: unknown): ServerNotification | null {
  if (typeof data !== "string" || data.length > 20_000) return null;
  try {
    return toNotification(JSON.parse(data));
  } catch {
    return null;
  }
};

const mapResult = function <A, B>(result: ApiResult<A>, transform: (data: A) => B): ApiResult<B> {
  return result.ok === true ? { ok: true, data: transform(result.data) } : result;
};

/** GET /api/notifications — 최신순 커서 페이지 */
export const fetchNotifications = async function ({
  cursor,
  size = 20,
  unreadOnly = false,
  signal,
}: {
  cursor?: string | null;
  size?: number;
  unreadOnly?: boolean;
  signal?: AbortSignal;
} = {}) {
  const search = new URLSearchParams({ size: String(size), unreadOnly: String(unreadOnly) });
  if (cursor) search.set("cursor", cursor);
  const result = await apiRequest<CursorPageDto<NotificationDto>>({ path: `/notifications?${search}`, signal });
  return mapResult(result, (dto) => ({
    items: (Array.isArray(dto?.items) ? dto.items : []).map(toNotification).filter((n): n is ServerNotification => n !== null),
    nextCursor: typeof dto?.nextCursor === "string" && dto.nextCursor && dto.nextCursor.length <= MAX_CURSOR ? dto.nextCursor : null,
    hasNext: dto?.hasNext === true,
  }));
};

/** GET /api/notifications/unread-count */
export const fetchUnreadCount = async function ({ signal }: { signal?: AbortSignal } = {}) {
  const result = await apiRequest<{ unreadCount: number }>({ path: "/notifications/unread-count", signal });
  return mapResult(result, (dto) => (typeof dto?.unreadCount === "number" && Number.isInteger(dto.unreadCount) && dto.unreadCount > 0 ? dto.unreadCount : 0));
};

/** POST /api/notifications/{id}/read — 반복 호출해도 같은 결과 */
export const markNotificationRead = async function ({ notificationId, signal }: { notificationId: number; signal?: AbortSignal }) {
  const result = await apiRequest<NotificationDto>({ method: "POST", path: `/notifications/${encodeURIComponent(String(notificationId))}/read`, signal });
  return mapResult(result, (dto) => toNotification(dto));
};

/**
 * GET /api/notifications/stream — 인앱 SSE. 같은 출처 쿠키로 인증한다.
 * 브라우저에 EventSource가 없으면 null(목록 주기 조회만 쓴다). 돌려준 함수로 연결을 닫는다.
 */
export const openNotificationStream = function ({
  onNotification,
  onReady,
  onError,
}: {
  onNotification: (notification: ServerNotification) => void;
  onReady?: () => void;
  onError?: () => void;
}): (() => void) | null {
  if (typeof EventSource === "undefined") return null;
  const source = new EventSource(`${API_BASE_URL}/notifications/stream`, { withCredentials: true });
  source.addEventListener("ready", () => onReady?.());
  source.addEventListener("notification", (event) => {
    const notification = parseStreamData((event as MessageEvent).data);
    if (notification) onNotification(notification);
  });
  source.onerror = () => onError?.();
  return () => source.close();
};
