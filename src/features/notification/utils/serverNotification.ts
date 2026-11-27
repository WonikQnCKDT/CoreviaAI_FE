import type { ApiFailure } from "@/shared/api/client";
import type { ServerNotification, ServerNotificationType } from "@/features/notification/api/notificationApi";
import { SERVER_NOTIFICATION_MESSAGE, SERVER_NOTIFICATION_TEXT } from "@/features/notification/i18n/ko";
import { TASK_STATUS_LABEL } from "@/shared/i18n/catalog/status";
import { formatLabel } from "@/shared/i18n/store";
import type { NotificationType, TaskStatus } from "@/types";

/** 기존 알림 벨의 아이콘·색 종류로 */
export const STYLE_TYPE: Record<ServerNotificationType, NotificationType> = {
  assigned: "assign",
  mentioned: "mention",
  statusChanged: "status",
  dueSoon: "due",
  approvalRequested: "deliverable",
  missingTask: "missing",
  riskUp: "risk",
  projectInactive: "risk",
};

const FALLBACK: Record<ServerNotificationType, () => string> = {
  assigned: () => SERVER_NOTIFICATION_TEXT.fallbackAssigned,
  mentioned: () => SERVER_NOTIFICATION_TEXT.fallbackMentioned,
  statusChanged: () => SERVER_NOTIFICATION_TEXT.fallbackStatusChanged,
  dueSoon: () => SERVER_NOTIFICATION_TEXT.fallbackDueSoon,
  approvalRequested: () => SERVER_NOTIFICATION_TEXT.fallbackApprovalRequested,
  missingTask: () => SERVER_NOTIFICATION_TEXT.fallbackMissingTask,
  riskUp: () => SERVER_NOTIFICATION_TEXT.fallbackRiskUp,
  projectInactive: () => SERVER_NOTIFICATION_TEXT.fallbackProjectInactive,
};

/** 알고 있는 messageKey와 쓰는 params. 모르는 키는 종류별 기본 문구로 보인다 */
const KNOWN_MESSAGES: Record<string, { template: () => string; params: string[] }> = {
  "notification.assigned": { template: () => SERVER_NOTIFICATION_MESSAGE.assigned, params: ["taskName"] },
  "notification.statusChanged": { template: () => SERVER_NOTIFICATION_MESSAGE.statusChanged, params: ["taskName", "status"] },
  "notification.dueSoon": { template: () => SERVER_NOTIFICATION_MESSAGE.dueSoon, params: ["taskName", "endDate"] },
};

const STATUS_FROM_CODE: Record<string, TaskStatus> = { TODO: "todo", IN_PROGRESS: "progress", REVIEW: "review", DONE: "done" };

/**
 * 알림 본문. 템플릿은 FE 라벨(번역 가능), 값은 서버 params를 문자열로만 넣는다(HTML로 해석하지 않음).
 * 필요한 값이 빠졌으면 종류별 기본 문구를 쓴다('{taskName}'이 그대로 보이지 않게).
 */
export const notificationMessage = function (notification: Pick<ServerNotification, "type" | "messageKey" | "params">): string {
  const known = Object.hasOwn(KNOWN_MESSAGES, notification.messageKey) ? KNOWN_MESSAGES[notification.messageKey] : null;
  if (!known || known.params.some((p) => !notification.params[p])) return FALLBACK[notification.type]();
  const values: Record<string, string> = {};
  known.params.forEach((p) => {
    const raw = notification.params[p];
    values[p] = p === "status" && Object.hasOwn(STATUS_FROM_CODE, raw) ? TASK_STATUS_LABEL[STATUS_FROM_CODE[raw]] : raw;
  });
  return formatLabel(known.template(), values);
};

/**
 * 알림을 눌렀을 때 갈 화면. 서버가 준 URL은 쓰지 않고 숫자 ID로만 만든다(외부 주소로 보내지 않게).
 * 업무는 프로젝트 칸반, 프로젝트는 프로젝트 홈. 프로젝트를 모르면 이동하지 않는다.
 */
export const notificationPath = function (notification: Pick<ServerNotification, "projectId" | "targetType">): string | null {
  if (notification.projectId === null) return null;
  return notification.targetType === "task" ? `/projects/${notification.projectId}/kanban` : `/projects/${notification.projectId}`;
};

/** 목록을 최신순(id 내림차순)으로 합친다. 같은 id는 나중 값(읽음 반영 등)으로 */
export const mergeNotifications = function (current: ServerNotification[], incoming: ServerNotification[]): ServerNotification[] {
  const byId = new Map(current.map((n) => [n.id, n]));
  incoming.forEach((n) => byId.set(n.id, n));
  return [...byId.values()].sort((a, b) => b.id - a.id);
};

/** 서버에 알림 API가 아직 없음(develop 미반영)으로 보는 실패 */
export const isNotificationApiMissing = (failure: ApiFailure) => failure.kind === "http" && failure.status === 404;
