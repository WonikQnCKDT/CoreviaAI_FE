import { apiRequest, type ApiResult } from "@/shared/api/client";
import type { WbsStatus } from "@/features/wbs/api/wbsApi";

/**
 * 05. 업무·보드 (API) — 업무 상세(FR-TSK-01, SCRUM-109), 칸반 보드(FR-TSK-02, SCRUM-110).
 * 기준: Confluence 05. 업무·보드 (API) v3, BE develop 50f96d2 (TaskController·BoardController DTO).
 * 서버 값은 신뢰하지 않는 입력이라 형태를 확인하고, 모르는 값은 안전한 기본값으로 바꾼다.
 */

/* ===== 서버 DTO ===== */

interface UserRefDto {
  id: number;
  name: string | null;
}

interface BoardCardDto {
  id: number;
  phaseId: number | null;
  parentTaskId: number | null;
  parentTaskName: string | null;
  name: string;
  taskType: string;
  priority: string;
  status: string;
  assignee: UserRefDto | null;
  startDate: string | null;
  endDate: string | null;
  progress: number;
  statusChangedAt: string | null;
  completedAt: string | null;
  version: number;
}

interface BoardColumnDto {
  id: number;
  name: string | null;
  labelKey: string | null;
  statusCategory: string;
  sortOrder: number;
  wipLimit: number | null;
  cardCount: number;
  wipExceeded: boolean;
  cards?: BoardCardDto[] | null;
}

interface BoardDto {
  columns: BoardColumnDto[] | null;
}

interface BoardCardMoveDto {
  card: BoardCardDto;
  column: BoardColumnDto;
  wipWarning: boolean;
}

interface BoardColumnsDto {
  columns: BoardColumnDto[] | null;
}

interface TaskDetailDto {
  id: number;
  projectId: number;
  phaseId: number | null;
  parentTaskId: number | null;
  name: string;
  description: string | null;
  taskType: string;
  priority: string;
  completionCriteria: string | null;
  assignee: UserRefDto | null;
  startDate: string | null;
  endDate: string | null;
  scheduleDerived: boolean;
  estimatedEffort: number | string | null;
  progress: number;
  status: string;
  source: string;
  completedAt: string | null;
  boardColumnId: number | null;
  statusChangedAt: string | null;
  createdBy: UserRefDto | null;
  createdAt: string | null;
  updatedAt: string | null;
  version: number;
}

interface TaskHistoryDto {
  id: number;
  activityType: string;
  before: unknown;
  after: unknown;
  actor: UserRefDto | null;
  occurredAt: string | null;
}

interface CursorPageDto<T> {
  items: T[] | null;
  nextCursor: string | null;
  hasNext: boolean;
}

/* ===== 화면 모델 ===== */

export type TaskType = "task" | "defect";
export type TaskPriority = "high" | "medium" | "low";

export interface UserRef {
  id: number;
  name: string;
}

export interface BoardCard {
  id: number;
  parentTaskId: number | null;
  parentTaskName: string;
  name: string;
  taskType: TaskType;
  priority: TaskPriority;
  status: WbsStatus;
  assignee: UserRef | null;
  startDate: string;
  endDate: string;
  progress: number;
  version: number;
}

export interface BoardColumn {
  id: number;
  /** 사용자가 붙인 이름. null이면 labelKey(기본 이름) */
  name: string | null;
  /** `code.TASK_STATUS.<상태>` 형식일 때만. 그 밖의 값은 버린다 */
  labelKey: string | null;
  statusCategory: WbsStatus;
  sortOrder: number;
  wipLimit: number | null;
  cardCount: number;
  wipExceeded: boolean;
  cards: BoardCard[];
}

export interface CardMoveResult {
  card: BoardCard;
  wipWarning: boolean;
}

export interface TaskDetail {
  id: number;
  parentTaskId: number | null;
  name: string;
  description: string;
  taskType: TaskType;
  priority: TaskPriority;
  completionCriteria: string;
  assignee: UserRef | null;
  startDate: string;
  endDate: string;
  scheduleDerived: boolean;
  estimatedEffort: number | null;
  progress: number;
  status: WbsStatus;
  source: "manual" | "aiDraft";
  completedAt: string;
  createdBy: UserRef | null;
  createdAt: string;
  updatedAt: string;
  version: number;
}

export type HistoryActivity =
  | "created"
  | "assigned"
  | "unassigned"
  | "dateChanged"
  | "detailsChanged"
  | "moved"
  | "deleted"
  | "statusChanged"
  | "boardColumnChanged"
  | "progressChanged"
  | "other";

/** 이력 값 한 칸. 사용자 입력이 섞여 있어 문자열로만 다룬다(화면은 텍스트로만 그린다) */
export type HistoryValues = Record<string, string | null>;

export interface TaskHistory {
  id: number;
  activity: HistoryActivity;
  before: HistoryValues | null;
  after: HistoryValues | null;
  actor: UserRef | null;
  occurredAt: string;
}

export interface CursorPage<T> {
  items: T[];
  nextCursor: string | null;
  hasNext: boolean;
}

/* ===== 변환 ===== */

const STATUS_FROM_DTO: Record<string, WbsStatus> = { TODO: "todo", IN_PROGRESS: "progress", REVIEW: "review", DONE: "done" };
export const STATUS_TO_DTO: Record<WbsStatus, string> = { todo: "TODO", progress: "IN_PROGRESS", review: "REVIEW", done: "DONE" };
const TYPE_FROM_DTO: Record<string, TaskType> = { TASK: "task", DEFECT: "defect" };
const TYPE_TO_DTO: Record<TaskType, string> = { task: "TASK", defect: "DEFECT" };
const PRIORITY_FROM_DTO: Record<string, TaskPriority> = { HIGH: "high", MEDIUM: "medium", LOW: "low" };
const PRIORITY_TO_DTO: Record<TaskPriority, string> = { high: "HIGH", medium: "MEDIUM", low: "LOW" };
const ACTIVITY_FROM_DTO: Record<string, HistoryActivity> = {
  CREATED: "created",
  ASSIGNED: "assigned",
  UNASSIGNED: "unassigned",
  DATE_CHANGED: "dateChanged",
  DETAILS_CHANGED: "detailsChanged",
  MOVED: "moved",
  DELETED: "deleted",
  STATUS_CHANGED: "statusChanged",
  BOARD_COLUMN_CHANGED: "boardColumnChanged",
  PROGRESS_CHANGED: "progressChanged",
};

/** 기본 컬럼 이름 라벨 키. 서버가 다른 값을 주면 쓰지 않는다 */
export const BOARD_LABEL_KEY_PATTERN = /^code\.TASK_STATUS\.[A-Z_]{1,30}$/;

/** 서버 목록이 비정상적으로 커도 화면이 멈추지 않게 자르는 상한(서버 상한: 컬럼 20·업무 2,000) */
const MAX_COLUMNS = 20;
const MAX_CARDS = 2000;
/** 이력 값 한 칸의 표시 상한(서버 입력 상한 2000자) */
const MAX_HISTORY_VALUE = 2000;
const MAX_HISTORY_FIELDS = 30;

const text = (value: unknown) => (typeof value === "string" ? value : "");
const isoDate = (value: unknown) => (typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : "");
const positiveId = (value: unknown) => (typeof value === "number" && Number.isInteger(value) && value > 0 ? value : null);
const pick = <T>(map: Record<string, T>, value: unknown, fallback: T): T =>
  typeof value === "string" && Object.hasOwn(map, value) ? map[value] : fallback;
const toUser = (dto: UserRefDto | null | undefined): UserRef | null => {
  const id = positiveId(dto?.id);
  return id === null ? null : { id, name: text(dto?.name) };
};
const toProgress = (value: unknown) =>
  typeof value === "number" && Number.isFinite(value) ? Math.min(100, Math.max(0, Math.round(value))) : 0;
const toEffort = (value: unknown) => {
  const num = typeof value === "string" ? Number(value) : value;
  return typeof num === "number" && Number.isFinite(num) && num > 0 ? num : null;
};

export const toCard = (dto: BoardCardDto): BoardCard => ({
  id: dto.id,
  parentTaskId: positiveId(dto.parentTaskId),
  parentTaskName: text(dto.parentTaskName),
  name: text(dto.name),
  taskType: pick(TYPE_FROM_DTO, dto.taskType, "task"),
  priority: pick(PRIORITY_FROM_DTO, dto.priority, "medium"),
  status: pick(STATUS_FROM_DTO, dto.status, "todo"),
  assignee: toUser(dto.assignee),
  startDate: isoDate(dto.startDate),
  endDate: isoDate(dto.endDate),
  progress: toProgress(dto.progress),
  version: typeof dto.version === "number" ? dto.version : 0,
});

const toColumn = (dto: BoardColumnDto): BoardColumn | null => {
  const status = pick<WbsStatus | null>(STATUS_FROM_DTO, dto.statusCategory, null);
  if (positiveId(dto.id) === null || status === null) return null;
  const name = text(dto.name).trim();
  return {
    id: dto.id,
    name: name || null,
    labelKey: typeof dto.labelKey === "string" && BOARD_LABEL_KEY_PATTERN.test(dto.labelKey) ? dto.labelKey : null,
    statusCategory: status,
    sortOrder: Number.isInteger(dto.sortOrder) ? dto.sortOrder : 0,
    wipLimit: positiveId(dto.wipLimit),
    cardCount: Number.isInteger(dto.cardCount) && dto.cardCount > 0 ? dto.cardCount : 0,
    wipExceeded: dto.wipExceeded === true,
    cards: (Array.isArray(dto.cards) ? dto.cards : [])
      .filter((card) => card && positiveId(card.id) !== null)
      .slice(0, MAX_CARDS)
      .map(toCard),
  };
};

const toColumns = (list: BoardColumnDto[] | null | undefined) =>
  (Array.isArray(list) ? list : [])
    .filter(Boolean)
    .slice(0, MAX_COLUMNS)
    .map(toColumn)
    .filter((c): c is BoardColumn => c !== null)
    .sort((a, b) => a.sortOrder - b.sortOrder || a.id - b.id);

/** 이력 before·after: 객체의 값을 문자열(또는 null)로만 바꾼다. 중첩 객체는 JSON 문자열로 */
export const toHistoryValues = function (raw: unknown): HistoryValues | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const values: HistoryValues = {};
  Object.entries(raw as Record<string, unknown>)
    .slice(0, MAX_HISTORY_FIELDS)
    .forEach(([key, value]) => {
      if (value === null || value === undefined) values[key] = null;
      else if (typeof value === "string") values[key] = value.slice(0, MAX_HISTORY_VALUE);
      else if (typeof value === "number" || typeof value === "boolean") values[key] = String(value);
      else values[key] = JSON.stringify(value).slice(0, MAX_HISTORY_VALUE);
    });
  return values;
};

const toHistory = (dto: TaskHistoryDto): TaskHistory => ({
  id: dto.id,
  activity: pick(ACTIVITY_FROM_DTO, dto.activityType, "other"),
  before: toHistoryValues(dto.before),
  after: toHistoryValues(dto.after),
  actor: toUser(dto.actor),
  occurredAt: text(dto.occurredAt),
});

export const toTaskDetail = (dto: TaskDetailDto): TaskDetail => ({
  id: dto.id,
  parentTaskId: positiveId(dto.parentTaskId),
  name: text(dto.name),
  description: text(dto.description),
  taskType: pick(TYPE_FROM_DTO, dto.taskType, "task"),
  priority: pick(PRIORITY_FROM_DTO, dto.priority, "medium"),
  completionCriteria: text(dto.completionCriteria),
  assignee: toUser(dto.assignee),
  startDate: isoDate(dto.startDate),
  endDate: isoDate(dto.endDate),
  scheduleDerived: dto.scheduleDerived === true,
  estimatedEffort: toEffort(dto.estimatedEffort),
  progress: toProgress(dto.progress),
  status: pick(STATUS_FROM_DTO, dto.status, "todo"),
  source: dto.source === "AI_DRAFT" ? "aiDraft" : "manual",
  completedAt: text(dto.completedAt),
  createdBy: toUser(dto.createdBy),
  createdAt: text(dto.createdAt),
  updatedAt: text(dto.updatedAt),
  version: typeof dto.version === "number" ? dto.version : 0,
});

const mapResult = function <A, B>(result: ApiResult<A>, transform: (data: A) => B): ApiResult<B> {
  return result.ok === true ? { ok: true, data: transform(result.data) } : result;
};

const enc = (value: number) => encodeURIComponent(String(value));
const boardPath = (projectId: number) => `/projects/${enc(projectId)}/board`;
const taskPath = (projectId: number, taskId: number) => `/projects/${enc(projectId)}/tasks/${enc(taskId)}`;

/* ===== 칸반 보드 ===== */

/** GET /api/projects/{projectId}/board — assigneeUserId를 주면 그 담당자 카드만(카드 수·WIP는 컬럼 전체 기준) */
export const fetchBoard = async function ({
  projectId,
  assigneeUserId,
  signal,
}: {
  projectId: number;
  assigneeUserId?: number | null;
  signal?: AbortSignal;
}) {
  const query = assigneeUserId ? `?assigneeUserId=${enc(assigneeUserId)}` : "";
  const result = await apiRequest<BoardDto>({ path: `${boardPath(projectId)}${query}`, signal });
  return mapResult(result, (dto) => toColumns(dto?.columns));
};

/** PUT .../board/cards/{taskId}/column — 상태는 옮긴 컬럼의 상태가 된다. WIP 초과는 경고만 */
export const moveBoardCard = async function ({
  projectId,
  taskId,
  columnId,
  version,
  signal,
}: {
  projectId: number;
  taskId: number;
  columnId: number;
  version: number;
  signal?: AbortSignal;
}) {
  const result = await apiRequest<BoardCardMoveDto>({
    method: "PUT",
    path: `${boardPath(projectId)}/cards/${enc(taskId)}/column`,
    body: { columnId, version },
    signal,
  });
  return mapResult(result, (dto): CardMoveResult => ({ card: toCard(dto.card), wipWarning: dto.wipWarning === true }));
};

const columnsResult = (result: ApiResult<BoardColumnsDto>) => mapResult(result, (dto) => toColumns(dto?.columns));

/** POST .../board/columns — 맨 뒤에 추가. 이름을 비우면 기본 이름 */
export const createBoardColumn = async function ({
  projectId,
  name,
  statusCategory,
  wipLimit,
  signal,
}: {
  projectId: number;
  name: string;
  statusCategory: WbsStatus;
  wipLimit: number | null;
  signal?: AbortSignal;
}) {
  const body = { name: name.trim() || null, statusCategory: STATUS_TO_DTO[statusCategory], wipLimit };
  return columnsResult(await apiRequest<BoardColumnsDto>({ method: "POST", path: `${boardPath(projectId)}/columns`, body, signal }));
};

/** PATCH .../board/columns/{columnId} — 두 값을 덮어쓴다(null = 기본 이름·한도 없음) */
export const updateBoardColumn = async function ({
  projectId,
  columnId,
  name,
  wipLimit,
  signal,
}: {
  projectId: number;
  columnId: number;
  name: string;
  wipLimit: number | null;
  signal?: AbortSignal;
}) {
  const body = { name: name.trim() || null, wipLimit };
  return columnsResult(
    await apiRequest<BoardColumnsDto>({ method: "PATCH", path: `${boardPath(projectId)}/columns/${enc(columnId)}`, body, signal }),
  );
};

/** PUT .../board/columns/order — 모든 컬럼 ID를 새 순서로 한 번씩 */
export const reorderBoardColumns = async function ({ projectId, columnIds, signal }: { projectId: number; columnIds: number[]; signal?: AbortSignal }) {
  return columnsResult(
    await apiRequest<BoardColumnsDto>({ method: "PUT", path: `${boardPath(projectId)}/columns/order`, body: { columnIds }, signal }),
  );
};

/** DELETE .../board/columns/{columnId} — 카드가 있거나 그 상태의 마지막 컬럼이면 409 */
export const deleteBoardColumn = async function ({ projectId, columnId, signal }: { projectId: number; columnId: number; signal?: AbortSignal }) {
  return columnsResult(await apiRequest<BoardColumnsDto>({ method: "DELETE", path: `${boardPath(projectId)}/columns/${enc(columnId)}`, signal }));
};

/* ===== 업무 상세 ===== */

/** GET /api/projects/{projectId}/tasks/{taskId} */
export const fetchTaskDetail = async function ({ projectId, taskId, signal }: { projectId: number; taskId: number; signal?: AbortSignal }) {
  return mapResult(await apiRequest<TaskDetailDto>({ path: taskPath(projectId, taskId), signal }), toTaskDetail);
};

/** PATCH /api/projects/{projectId}/tasks/{taskId} — 유형·우선순위·완료 조건을 덮어쓴다 */
export const updateTaskAttributes = async function ({
  projectId,
  taskId,
  taskType,
  priority,
  completionCriteria,
  version,
  signal,
}: {
  projectId: number;
  taskId: number;
  taskType: TaskType;
  priority: TaskPriority;
  completionCriteria: string;
  version: number;
  signal?: AbortSignal;
}) {
  const body = {
    taskType: TYPE_TO_DTO[taskType],
    priority: PRIORITY_TO_DTO[priority],
    completionCriteria: completionCriteria.trim() || null,
    version,
  };
  return mapResult(await apiRequest<TaskDetailDto>({ method: "PATCH", path: taskPath(projectId, taskId), body, signal }), toTaskDetail);
};

/** GET .../tasks/{taskId}/histories — 시간순 커서 */
export const fetchTaskHistories = async function ({
  projectId,
  taskId,
  cursor,
  size = 20,
  signal,
}: {
  projectId: number;
  taskId: number;
  cursor?: string | null;
  size?: number;
  signal?: AbortSignal;
}) {
  const search = new URLSearchParams({ size: String(size) });
  if (cursor) search.set("cursor", cursor);
  const result = await apiRequest<CursorPageDto<TaskHistoryDto>>({ path: `${taskPath(projectId, taskId)}/histories?${search}`, signal });
  return mapResult(
    result,
    (dto): CursorPage<TaskHistory> => ({
      items: (Array.isArray(dto?.items) ? dto.items : []).filter((h) => h && positiveId(h.id) !== null).map(toHistory),
      nextCursor: typeof dto?.nextCursor === "string" && dto.nextCursor ? dto.nextCursor : null,
      hasNext: dto?.hasNext === true,
    }),
  );
};
