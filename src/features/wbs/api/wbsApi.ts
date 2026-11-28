import { apiRequest, type ApiResult } from "@/shared/api/client";

/**
 * 04. WBS·일정 (API) — 계층형 WBS(FR-WBS-01, SCRUM-107), 진척률(SCRUM-119), AI WBS 초안(FR-PRJ-07, SCRUM-112).
 * 기준: Confluence 04. WBS·일정 (API) v12, BE develop 50f96d2 (WbsTaskController·TaskController·WbsAiDraftController DTO).
 * 서버 값은 신뢰하지 않는 입력이라 형태를 확인하고, 모르는 값은 안전한 기본값으로 바꾼다.
 */

/* ===== 서버 DTO ===== */

interface AssigneeDto {
  id: number;
  name: string | null;
}

interface WbsTaskDto {
  id: number;
  phaseId: number | null;
  parentTaskId: number | null;
  sortOrder: number;
  name: string;
  description: string | null;
  assignee: AssigneeDto | null;
  startDate: string;
  endDate: string;
  scheduleDerived: boolean;
  estimatedEffort: number | string | null;
  taskType: string;
  priority: string;
  progress: number;
  status: string;
  source: string;
  version: number;
  subtasks: WbsTaskDto[] | null;
}

interface WbsTreeDto {
  tasks: WbsTaskDto[] | null;
}

interface WbsTaskChangeDto {
  taskId: number;
  tasks: WbsTaskDto[] | null;
}

interface TaskDetailDto {
  id: number;
  progress: number;
  status: string;
  version: number;
}

interface ProposedSubtaskDto {
  tempId: string;
  name: string;
  description: string | null;
  estimatedPersonDays: number | string | null;
}

interface ProposedTaskDto {
  tempId: string;
  name: string;
  description: string | null;
  estimatedPersonDays: number | string | null;
  suggestedAssigneeId: number | null;
  suggestedRole: string | null;
  startDate: string | null;
  endDate: string | null;
  dependencies: string[] | null;
  subtasks: ProposedSubtaskDto[] | null;
  reason: string | null;
}

interface ProposedStageDto {
  phaseId: number | null;
  phaseName: string | null;
  tasks: ProposedTaskDto[] | null;
}

interface ProposedMilestoneDto {
  tempId: string;
  name: string;
  targetDate: string | null;
  relatedTaskIds: string[] | null;
  reason: string | null;
}

interface WbsDraftDto {
  status: string;
  draftToken: string;
  expiresAt: string;
  stages: ProposedStageDto[] | null;
  milestones: ProposedMilestoneDto[] | null;
  feasibility: { status: string; reason: string | null } | null;
  warnings: string[] | null;
  suggestions: string[] | null;
  assumptions: string[] | null;
  clarificationQuestions: string[] | null;
}

interface ApplyWbsDraftDto {
  taskIds: Record<string, number> | null;
  milestoneIds: Record<string, number> | null;
}

/* ===== 화면 모델 ===== */

export type WbsStatus = "todo" | "progress" | "review" | "done";
export type TaskType = "task" | "defect";
export type TaskPriority = "high" | "medium" | "low";

export const TASK_TYPE_TO_DTO: Record<TaskType, string> = { task: "TASK", defect: "DEFECT" };
export const TASK_PRIORITY_TO_DTO: Record<TaskPriority, string> = { high: "HIGH", medium: "MEDIUM", low: "LOW" };

export interface WbsItem {
  id: number;
  phaseId: number | null;
  parentTaskId: number | null;
  sortOrder: number;
  name: string;
  description: string;
  assignee: { id: number; name: string } | null;
  startDate: string;
  endDate: string;
  /** true면 기간이 하위작업 기간으로 산출된 값이라 직접 바꿀 수 없다 */
  scheduleDerived: boolean;
  /** 인일. 없으면 null */
  estimatedEffort: number | null;
  progress: number;
  status: WbsStatus;
  /** 직접 등록(MANUAL)·AI 초안(AI_DRAFT) */
  source: "manual" | "aiDraft";
  version: number;
  subtasks: WbsItem[];
}

export interface WbsChange {
  taskId: number;
  tasks: WbsItem[];
}

export interface ProgressResult {
  id: number;
  progress: number;
  status: WbsStatus;
  version: number;
}

export interface DraftSubtask {
  tempId: string;
  name: string;
  description: string;
  estimatedPersonDays: number | null;
}

export interface DraftTask {
  tempId: string;
  /** AI가 제안한 단계. 프로젝트에 없는 단계면 null */
  phaseId: number | null;
  name: string;
  description: string;
  estimatedPersonDays: number | null;
  suggestedAssigneeId: number | null;
  suggestedRole: string;
  startDate: string;
  endDate: string;
  dependencies: string[];
  subtasks: DraftSubtask[];
  reason: string;
}

export interface DraftMilestone {
  tempId: string;
  name: string;
  targetDate: string;
  relatedTaskIds: string[];
  reason: string;
}

export type Feasibility = "feasible" | "atRisk" | "infeasible" | "insufficientInfo";

export interface WbsDraft {
  draftToken: string;
  expiresAt: string;
  tasks: DraftTask[];
  milestones: DraftMilestone[];
  feasibility: { status: Feasibility; reason: string } | null;
  warnings: string[];
  suggestions: string[];
  assumptions: string[];
  clarificationQuestions: string[];
}

/* ===== 변환 ===== */

const STATUS_FROM_DTO: Record<string, WbsStatus> = { TODO: "todo", IN_PROGRESS: "progress", REVIEW: "review", DONE: "done" };
const FEASIBILITY_FROM_DTO: Record<string, Feasibility> = {
  FEASIBLE: "feasible",
  AT_RISK: "atRisk",
  INFEASIBLE: "infeasible",
  INSUFFICIENT_INFO: "insufficientInfo",
};

/** 서버 목록이 비정상적으로 커도 화면이 멈추지 않도록 자르는 상한(서버 상한: 항목 2,000·초안 작업 200·하위작업 50) */
const MAX_TREE_ITEMS = 2000;
const MAX_DRAFT_TASKS = 200;
const MAX_DRAFT_SUBTASKS = 50;
const MAX_DRAFT_MILESTONES = 50;
const MAX_NOTES = 50;

const text = (value: unknown) => (typeof value === "string" ? value : "");
const isoDate = (value: unknown) => (typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : "");
const positiveId = (value: unknown) => (typeof value === "number" && Number.isInteger(value) && value > 0 ? value : null);
const strings = (value: unknown, limit = MAX_NOTES) =>
  (Array.isArray(value) ? value : []).filter((v): v is string => typeof v === "string").slice(0, limit);

/** BigDecimal은 숫자나 문자열로 올 수 있다. 0 이하·숫자가 아니면 없음 */
export const toEffort = function (value: unknown): number | null {
  const num = typeof value === "string" ? Number(value) : value;
  return typeof num === "number" && Number.isFinite(num) && num > 0 ? num : null;
};

const toProgress = (value: unknown) =>
  typeof value === "number" && Number.isFinite(value) ? Math.min(100, Math.max(0, Math.round(value))) : 0;

const toStatus = (value: unknown): WbsStatus =>
  typeof value === "string" && Object.hasOwn(STATUS_FROM_DTO, value) ? STATUS_FROM_DTO[value] : "todo";

const toItem = function (dto: WbsTaskDto, depth: number): WbsItem {
  const assigneeId = positiveId(dto.assignee?.id);
  return {
    id: dto.id,
    phaseId: positiveId(dto.phaseId),
    parentTaskId: positiveId(dto.parentTaskId),
    sortOrder: Number.isInteger(dto.sortOrder) ? dto.sortOrder : 0,
    name: text(dto.name),
    description: text(dto.description),
    assignee: assigneeId === null ? null : { id: assigneeId, name: text(dto.assignee?.name) },
    startDate: isoDate(dto.startDate),
    endDate: isoDate(dto.endDate),
    scheduleDerived: dto.scheduleDerived === true,
    estimatedEffort: toEffort(dto.estimatedEffort),
    progress: toProgress(dto.progress),
    status: toStatus(dto.status),
    source: dto.source === "AI_DRAFT" ? "aiDraft" : "manual",
    version: typeof dto.version === "number" ? dto.version : 0,
    // 2단계(작업 > 하위작업)만 있다. 서버가 더 깊게 보내도 하위작업 아래는 버린다.
    subtasks: depth === 0 ? toItems(dto.subtasks, 1) : [],
  };
};

const toItems = (list: WbsTaskDto[] | null | undefined, depth = 0): WbsItem[] =>
  (Array.isArray(list) ? list : [])
    .filter((dto) => dto && positiveId(dto.id) !== null)
    .slice(0, MAX_TREE_ITEMS)
    .map((dto) => toItem(dto, depth));

const toChange = (dto: WbsTaskChangeDto): WbsChange => ({ taskId: dto.taskId, tasks: toItems(dto.tasks) });

const toDraftTask = (dto: ProposedTaskDto, phaseId: number | null): DraftTask => ({
  tempId: text(dto.tempId),
  phaseId,
  name: text(dto.name),
  description: text(dto.description),
  estimatedPersonDays: toEffort(dto.estimatedPersonDays),
  suggestedAssigneeId: positiveId(dto.suggestedAssigneeId),
  suggestedRole: text(dto.suggestedRole),
  startDate: isoDate(dto.startDate),
  endDate: isoDate(dto.endDate),
  dependencies: strings(dto.dependencies),
  subtasks: (Array.isArray(dto.subtasks) ? dto.subtasks : [])
    .filter((s) => s && text(s.tempId))
    .slice(0, MAX_DRAFT_SUBTASKS)
    .map((s) => ({ tempId: s.tempId, name: text(s.name), description: text(s.description), estimatedPersonDays: toEffort(s.estimatedPersonDays) })),
  reason: text(dto.reason),
});

export const toDraft = function (dto: WbsDraftDto): WbsDraft {
  const tasks = (Array.isArray(dto.stages) ? dto.stages : [])
    .flatMap((stage) => (Array.isArray(stage?.tasks) ? stage.tasks : []).map((task) => ({ task, phaseId: positiveId(stage.phaseId) })))
    .filter(({ task }) => task && text(task.tempId))
    .slice(0, MAX_DRAFT_TASKS)
    .map(({ task, phaseId }) => toDraftTask(task, phaseId));
  const milestones = (Array.isArray(dto.milestones) ? dto.milestones : [])
    .filter((m) => m && text(m.tempId))
    .slice(0, MAX_DRAFT_MILESTONES)
    .map((m) => ({ tempId: m.tempId, name: text(m.name), targetDate: isoDate(m.targetDate), relatedTaskIds: strings(m.relatedTaskIds, MAX_DRAFT_TASKS), reason: text(m.reason) }));
  const feasibilityStatus = dto.feasibility?.status;
  return {
    draftToken: text(dto.draftToken),
    expiresAt: text(dto.expiresAt),
    tasks,
    milestones,
    feasibility:
      typeof feasibilityStatus === "string" && Object.hasOwn(FEASIBILITY_FROM_DTO, feasibilityStatus)
        ? { status: FEASIBILITY_FROM_DTO[feasibilityStatus], reason: text(dto.feasibility?.reason) }
        : null,
    warnings: strings(dto.warnings),
    suggestions: strings(dto.suggestions),
    assumptions: strings(dto.assumptions),
    clarificationQuestions: strings(dto.clarificationQuestions),
  };
};

const mapResult = function <A, B>(result: ApiResult<A>, transform: (data: A) => B): ApiResult<B> {
  return result.ok === true ? { ok: true, data: transform(result.data) } : result;
};

const wbsPath = (projectId: number) => `/projects/${encodeURIComponent(String(projectId))}/wbs`;
const taskPath = (projectId: number, taskId: number) => `${wbsPath(projectId)}/tasks/${encodeURIComponent(String(taskId))}`;

/* ===== 요청 ===== */

export interface WbsTaskFields {
  name: string;
  description: string;
  assigneeUserId: number | null;
  startDate: string;
  endDate: string;
  estimatedEffort: number | null;
}

/** 업무 등록 시 함께 보내는 업무 속성(FR-TSK-01). 수정은 업무 상세 API(PATCH /tasks/{taskId})로 한다 */
export interface WbsTaskCreateAttributes {
  taskType: TaskType;
  priority: TaskPriority;
  completionCriteria: string;
}

const fieldsBody = (fields: WbsTaskFields) => ({
  name: fields.name.trim(),
  description: fields.description.trim() || null,
  assigneeUserId: fields.assigneeUserId,
  startDate: fields.startDate,
  endDate: fields.endDate,
  estimatedEffort: fields.estimatedEffort,
});

/** GET /api/projects/{projectId}/wbs/tasks — 트리 전체(작업 > 하위작업). 페이지 없음 */
export const fetchWbsTree = async function ({ projectId, signal }: { projectId: number; signal?: AbortSignal }) {
  const result = await apiRequest<WbsTreeDto>({ path: `${wbsPath(projectId)}/tasks`, signal });
  return mapResult(result, (dto) => toItems(dto?.tasks));
};

/** POST /api/projects/{projectId}/wbs/tasks — parentTaskId가 있으면 하위작업(phaseId는 상위 상속이라 보내지 않는다) */
export const createWbsTask = async function ({
  projectId,
  parentTaskId,
  phaseId,
  fields,
  attributes,
  signal,
}: {
  projectId: number;
  parentTaskId: number | null;
  phaseId: number | null;
  fields: WbsTaskFields;
  attributes?: WbsTaskCreateAttributes;
  signal?: AbortSignal;
}) {
  const body = {
    ...fieldsBody(fields),
    parentTaskId,
    phaseId: parentTaskId === null ? phaseId : null,
    ...(attributes
      ? {
          taskType: TASK_TYPE_TO_DTO[attributes.taskType],
          priority: TASK_PRIORITY_TO_DTO[attributes.priority],
          completionCriteria: attributes.completionCriteria.trim() || null,
        }
      : {}),
  };
  const result = await apiRequest<WbsTaskChangeDto>({ method: "POST", path: `${wbsPath(projectId)}/tasks`, body, signal });
  return mapResult(result, toChange);
};

/** PATCH /api/projects/{projectId}/wbs/tasks/{taskId} — 모든 필드를 덮어쓴다. 산출 기간이면 조회한 기간을 그대로 보낸다 */
export const updateWbsTask = async function ({
  projectId,
  taskId,
  phaseId,
  fields,
  version,
  signal,
}: {
  projectId: number;
  taskId: number;
  phaseId: number | null;
  fields: WbsTaskFields;
  version: number;
  signal?: AbortSignal;
}) {
  const body = { ...fieldsBody(fields), phaseId, version };
  const result = await apiRequest<WbsTaskChangeDto>({ method: "PATCH", path: taskPath(projectId, taskId), body, signal });
  return mapResult(result, toChange);
};

/** PUT .../position — index는 옮길 곳의 형제 목록(자신 제외)에서 0부터 */
export const moveWbsTask = async function ({
  projectId,
  taskId,
  parentTaskId,
  index,
  version,
  signal,
}: {
  projectId: number;
  taskId: number;
  parentTaskId: number | null;
  index: number;
  version: number;
  signal?: AbortSignal;
}) {
  const result = await apiRequest<WbsTaskChangeDto>({
    method: "PUT",
    path: `${taskPath(projectId, taskId)}/position`,
    body: { parentTaskId, index, version },
    signal,
  });
  return mapResult(result, toChange);
};

/** DELETE .../tasks/{taskId} — 하위작업·선후행·마일스톤 연결이 있으면 409 */
export const deleteWbsTask = async function ({ projectId, taskId, signal }: { projectId: number; taskId: number; signal?: AbortSignal }) {
  const result = await apiRequest<WbsTaskChangeDto>({ method: "DELETE", path: taskPath(projectId, taskId), signal });
  return mapResult(result, toChange);
};

/** PATCH /api/projects/{projectId}/tasks/{taskId}/progress — 하위작업이 없는 항목만. 응답은 업무 상세 */
export const updateTaskProgress = async function ({
  projectId,
  taskId,
  progress,
  version,
  signal,
}: {
  projectId: number;
  taskId: number;
  progress: number;
  version: number;
  signal?: AbortSignal;
}) {
  const result = await apiRequest<TaskDetailDto>({
    method: "PATCH",
    path: `/projects/${encodeURIComponent(String(projectId))}/tasks/${encodeURIComponent(String(taskId))}/progress`,
    body: { progress, version },
    signal,
  });
  return mapResult(result, (dto): ProgressResult => ({ id: dto.id, progress: toProgress(dto.progress), status: toStatus(dto.status), version: dto.version }));
};

export interface DraftInput {
  projectPurpose: string;
  requirementsText: string;
  constraints: string[];
  userInstruction: string;
}

/** POST .../wbs/ai-draft — WBS는 바뀌지 않는다. 재전송하면 새 초안·새 토큰 */
export const generateWbsDraft = async function ({ projectId, input, signal }: { projectId: number; input: DraftInput; signal?: AbortSignal }) {
  const body = {
    projectPurpose: input.projectPurpose.trim() || null,
    requirementsText: input.requirementsText.trim() || null,
    constraints: input.constraints.map((c) => c.trim()).filter(Boolean),
    userInstruction: input.userInstruction.trim() || null,
  };
  const result = await apiRequest<WbsDraftDto>({ method: "POST", path: `${wbsPath(projectId)}/ai-draft`, body, signal });
  return mapResult(result, toDraft);
};

export interface ApplyDraftBody {
  draftToken: string;
  tasks: {
    tempId: string;
    phaseId: number | null;
    name: string;
    description: string | null;
    startDate: string;
    endDate: string;
    estimatedPersonDays: number | null;
    assigneeUserId: number | null;
    dependencies: string[];
    subtasks: {
      tempId: string;
      name: string;
      description: string | null;
      startDate: null;
      endDate: null;
      estimatedPersonDays: number | null;
      assigneeUserId: null;
    }[];
  }[];
  milestones: { tempId: string; name: string; targetDate: string; relatedTaskIds: string[] }[];
  rejectedCount: number;
}

/** POST .../wbs/ai-draft/apply — 토큰은 한 번만 쓴다. 응답은 tempId → 정식 ID */
export const applyWbsDraft = async function ({ projectId, body, signal }: { projectId: number; body: ApplyDraftBody; signal?: AbortSignal }) {
  const result = await apiRequest<ApplyWbsDraftDto>({ method: "POST", path: `${wbsPath(projectId)}/ai-draft/apply`, body, signal });
  return mapResult(result, (dto) => ({
    taskCount: Object.keys(dto?.taskIds ?? {}).length,
    milestoneCount: Object.keys(dto?.milestoneIds ?? {}).length,
  }));
};
