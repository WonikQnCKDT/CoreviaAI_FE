import type { ApiFailure } from "@/shared/api/client";
import { translate } from "@/shared/i18n/store";
import { TASK_STATUS_LABEL } from "@/shared/i18n/catalog/status";
import type { BoardCard, BoardColumn, HistoryActivity, TaskPriority, TaskType } from "@/features/board/api/boardApi";
import { BOARD_COLUMN_TEXT, BOARD_TEXT, TASK_DETAIL_TEXT } from "@/features/board/i18n/ko";
import { isWbsPm, type WbsViewer } from "@/features/wbs/utils/wbsRules";

/* =====================================================================
 * 권한 (요구사항 명세서 3.3 TSK-01·TSK-02, BE WbsEditor)
 * 화면 표시용이다. 최종 판정은 서버가 하고 403이면 그 결과를 따른다.
 * ===================================================================== */

const isOwnTaskEditor = (viewer: WbsViewer, assigneeId: number | null | undefined) =>
  (viewer.actor === "dev" || viewer.actor === "qa") && viewer.userId !== null && assigneeId === viewer.userId;

/** 카드 이동: PM 전체, 개발자·QA는 본인 담당 카드만(현업 담당자는 담당이어도 조회만) */
export const canMoveCard = (viewer: WbsViewer, card: Pick<BoardCard, "assignee">) =>
  isWbsPm(viewer) || isOwnTaskEditor(viewer, card.assignee?.id);

/** 업무 속성(유형·우선순위·완료 조건) 수정: PM이거나 담당 개발자·QA */
export const canEditAttributes = canMoveCard;

/** 컬럼 관리: PM만 */
export const canManageColumns = isWbsPm;

export const boardViewerNote = function (viewer: WbsViewer): string | null {
  if (isWbsPm(viewer)) return null;
  if (viewer.actor === "dev" || viewer.actor === "qa") return BOARD_TEXT.memberNote;
  return BOARD_TEXT.viewerNote;
};

/* =====================================================================
 * 표시
 * ===================================================================== */

/** 사용자가 붙인 이름은 그대로, 기본 컬럼은 라벨 키의 번역(없으면 상태 라벨) */
export const columnTitle = function (column: Pick<BoardColumn, "name" | "labelKey" | "statusCategory">): string {
  if (column.name) return column.name;
  const fallback = TASK_STATUS_LABEL[column.statusCategory];
  return column.labelKey ? translate(column.labelKey, fallback) : fallback;
};

export const taskTypeLabel = (type: TaskType) => (type === "defect" ? TASK_DETAIL_TEXT.typeDefect : TASK_DETAIL_TEXT.typeTask);

export const taskPriorityLabel = (priority: TaskPriority) =>
  priority === "high" ? TASK_DETAIL_TEXT.priorityHigh : priority === "low" ? TASK_DETAIL_TEXT.priorityLow : TASK_DETAIL_TEXT.priorityMedium;

const ACTIVITY_LABEL: Record<HistoryActivity, () => string> = {
  created: () => TASK_DETAIL_TEXT.activityCreated,
  assigned: () => TASK_DETAIL_TEXT.activityAssigned,
  unassigned: () => TASK_DETAIL_TEXT.activityUnassigned,
  dateChanged: () => TASK_DETAIL_TEXT.activityDateChanged,
  detailsChanged: () => TASK_DETAIL_TEXT.activityDetailsChanged,
  moved: () => TASK_DETAIL_TEXT.activityMoved,
  deleted: () => TASK_DETAIL_TEXT.activityDeleted,
  statusChanged: () => TASK_DETAIL_TEXT.activityStatusChanged,
  boardColumnChanged: () => TASK_DETAIL_TEXT.activityBoardColumnChanged,
  progressChanged: () => TASK_DETAIL_TEXT.activityProgressChanged,
  other: () => TASK_DETAIL_TEXT.activityOther,
};

export const activityLabel = (activity: HistoryActivity) => ACTIVITY_LABEL[activity]();

/** 이력 한 줄에 보여 줄 값 길이 상한(전체 값은 title로) */
const SHOWN_VALUE = 80;

/**
 * 이력 before·after를 "필드: 전 → 후" 줄로. 바뀐 필드만(값이 같으면 뺀다).
 * 값은 사용자 입력이라 텍스트로만 그리며, 담당자 ID는 이름을 아는 경우 이름으로 바꾼다.
 */
export const historyLines = function ({
  before,
  after,
  userName,
}: {
  before: Record<string, string | null> | null;
  after: Record<string, string | null> | null;
  userName: (id: number) => string | null;
}): { field: string; from: string; to: string }[] {
  const keys = [...new Set([...Object.keys(before ?? {}), ...Object.keys(after ?? {})])];
  const show = (key: string, value: string | null | undefined) => {
    if (value === null || value === undefined || value === "") return TASK_DETAIL_TEXT.none;
    if (key === "assigneeUserId" && /^\d+$/.test(value)) return userName(Number(value)) ?? `#${value}`;
    return value.length > SHOWN_VALUE ? `${value.slice(0, SHOWN_VALUE)}…` : value;
  };
  return keys
    .filter((key) => (before?.[key] ?? null) !== (after?.[key] ?? null))
    .map((key) => ({ field: key, from: before ? show(key, before[key]) : "", to: after ? show(key, after[key]) : "" }));
};

/* =====================================================================
 * 입력 검증 (서버 DTO 제약과 같게)
 * ===================================================================== */

// eslint-disable-next-line no-control-regex
const CONTROL_CHARS = /[\u0000-\u001F\u007F-\u009F]/;

export const validateColumnInput = function ({ name, wipLimit }: { name: string; wipLimit: string }):
  | { ok: true; name: string; wipLimit: number | null }
  | { ok: false; message: string } {
  const trimmed = name.trim();
  if (CONTROL_CHARS.test(name)) return { ok: false, message: BOARD_COLUMN_TEXT.nameControl };
  if (trimmed.length > 50) return { ok: false, message: BOARD_COLUMN_TEXT.nameTooLong };
  const wip = wipLimit.trim();
  if (!wip) return { ok: true, name: trimmed, wipLimit: null };
  if (!/^\d{1,3}$/.test(wip) || Number(wip) < 1) return { ok: false, message: BOARD_COLUMN_TEXT.wipInvalid };
  return { ok: true, name: trimmed, wipLimit: Number(wip) };
};

/** 컬럼 순서: 한 칸 앞·뒤로 옮긴 전체 ID 목록. 옮길 수 없으면 null */
export const reorderedIds = function (columns: Pick<BoardColumn, "id">[], columnId: number, direction: "left" | "right"): number[] | null {
  const ids = columns.map((c) => c.id);
  const at = ids.indexOf(columnId);
  const to = direction === "left" ? at - 1 : at + 1;
  if (at < 0 || to < 0 || to >= ids.length) return null;
  [ids[at], ids[to]] = [ids[to], ids[at]];
  return ids;
};

/** 상태마다 컬럼이 하나 이상 남아야 한다(서버 409 BOARD_COLUMN_LAST_OF_STATUS). 카드가 있어도 삭제 불가 */
export const canDeleteColumn = (columns: BoardColumn[], column: BoardColumn) =>
  column.cardCount === 0 && columns.filter((c) => c.statusCategory === column.statusCategory).length > 1;

/* =====================================================================
 * 실패 해석 (status 기준, 오류 본문에 code 없음)
 * ===================================================================== */

export type BoardAction = "load" | "move" | "createColumn" | "updateColumn" | "reorderColumns" | "deleteColumn" | "loadTask" | "updateTask";

export interface BoardFailureView {
  message: string;
  /** 최신 상태를 다시 받아야 하는지 */
  reload: boolean;
}

const commonMessage = function (failure: ApiFailure): string {
  if (failure.kind === "network") return BOARD_TEXT.network;
  if (failure.kind === "timeout") return BOARD_TEXT.timeout;
  if (failure.kind === "http" && failure.status >= 500) return BOARD_TEXT.serverError;
  return BOARD_TEXT.unknown;
};

export const interpretBoardFailure = function (action: BoardAction, failure: ApiFailure): BoardFailureView {
  if (failure.kind !== "http") return { message: commonMessage(failure), reload: false };
  const { status } = failure;
  if (action === "load") return { message: status === 404 ? BOARD_TEXT.unavailable : commonMessage(failure), reload: false };
  if (action === "loadTask") return { message: status === 404 ? TASK_DETAIL_TEXT.notFound : commonMessage(failure), reload: false };
  if (status === 400) {
    // 컬럼 순서 400(INVALID_BOARD_COLUMN_ORDER)은 다른 사용자가 컬럼을 바꾼 경우라 다시 받는다
    return { message: failure.message || BOARD_TEXT.invalid, reload: action === "reorderColumns" };
  }
  if (status === 403) return { message: action === "updateTask" ? TASK_DETAIL_TEXT.forbidden : BOARD_TEXT.forbidden, reload: true };
  // 404: WBS_TASK_NOT_FOUND·BOARD_COLUMN_NOT_FOUND — 다른 사용자가 지웠을 수 있다
  if (status === 404) return { message: action === "updateTask" ? TASK_DETAIL_TEXT.notFound : BOARD_TEXT.notFound, reload: true };
  if (status === 409) {
    if (action === "createColumn") return { message: BOARD_COLUMN_TEXT.limitExceeded, reload: false };
    if (action === "deleteColumn") return { message: BOARD_COLUMN_TEXT.cannotDelete, reload: true };
    // move·updateTask: CONCURRENT_MODIFICATION
    return { message: action === "updateTask" ? TASK_DETAIL_TEXT.concurrent : BOARD_TEXT.concurrent, reload: true };
  }
  return { message: commonMessage(failure), reload: false };
};
