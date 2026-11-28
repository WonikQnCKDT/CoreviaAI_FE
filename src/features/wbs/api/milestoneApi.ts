import { apiRequest, type ApiResult } from "@/shared/api/client";
import type { WbsStatus } from "@/features/wbs/api/wbsApi";

/**
 * 04. WBS·일정 (API) — 마일스톤(FR-WBS-04, SCRUM-108).
 * 기준: BE develop 11925a3 MilestoneController·MilestoneResponse·CreateMilestoneRequest·UpdateMilestoneRequest·ReplaceMilestoneTasksRequest.
 * dDay·delayed·incompleteTaskCount는 서버가 업무 시간대(Asia/Seoul) 기준 오늘로 계산한 값이라 FE가 다시 계산하지 않는다.
 * 서버 값은 신뢰하지 않는 입력이라 형태를 확인하고, 모르는 값은 안전한 기본값으로 바꾼다.
 */

/* ===== 서버 DTO (MilestoneResponse 그대로) ===== */

interface LinkedTaskDto {
  id: number;
  parentTaskId: number | null;
  name: string;
  status: string;
  endDate: string | null;
}

interface MilestoneDto {
  id: number;
  name: string;
  targetDate: string;
  source: string;
  dDay: number;
  delayed: boolean;
  linkedTaskCount: number;
  incompleteTaskCount: number;
  tasks: LinkedTaskDto[] | null;
  version: number;
}

interface MilestoneListDto {
  milestones: MilestoneDto[] | null;
}

/* ===== 화면 모델 ===== */

export interface MilestoneTask {
  id: number;
  /** 하위작업이면 상위 작업 ID */
  parentTaskId: number | null;
  name: string;
  status: WbsStatus;
  endDate: string;
}

export interface Milestone {
  id: number;
  name: string;
  targetDate: string;
  source: "manual" | "aiDraft";
  /** 오늘부터 목표일까지 일수(서버 계산). 양수 D-n, 0 D-day, 음수 D+n. 형식이 틀리면 null */
  dDay: number | null;
  /** 연결 작업이 미완료인데 목표일이 도래함(당일 포함, 서버 계산) */
  delayed: boolean;
  linkedTaskCount: number;
  incompleteTaskCount: number;
  tasks: MilestoneTask[];
  version: number;
}

/** 서버 상한(MilestoneService): 프로젝트당 마일스톤 200개, 마일스톤당 연결 작업 200개 */
export const MAX_MILESTONES = 200;
export const MAX_MILESTONE_TASKS = 200;

/* ===== 변환 ===== */

const STATUS_FROM_DTO: Record<string, WbsStatus> = { TODO: "todo", IN_PROGRESS: "progress", REVIEW: "review", DONE: "done" };

const text = (value: unknown) => (typeof value === "string" ? value : "");
const isoDate = (value: unknown) => (typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : "");
const positiveId = (value: unknown) => (typeof value === "number" && Number.isInteger(value) && value > 0 ? value : null);
const count = (value: unknown) => (typeof value === "number" && Number.isInteger(value) && value >= 0 ? value : 0);

const toTask = (dto: LinkedTaskDto): MilestoneTask => ({
  id: dto.id,
  parentTaskId: positiveId(dto.parentTaskId),
  name: text(dto.name),
  status: typeof dto.status === "string" && Object.hasOwn(STATUS_FROM_DTO, dto.status) ? STATUS_FROM_DTO[dto.status] : "todo",
  endDate: isoDate(dto.endDate),
});

export const toMilestone = function (dto: MilestoneDto): Milestone {
  const tasks = (Array.isArray(dto.tasks) ? dto.tasks : [])
    .filter((t) => t && positiveId(t.id) !== null)
    .slice(0, MAX_MILESTONE_TASKS)
    .map(toTask);
  return {
    id: dto.id,
    name: text(dto.name),
    targetDate: isoDate(dto.targetDate),
    source: dto.source === "AI_DRAFT" ? "aiDraft" : "manual",
    dDay: typeof dto.dDay === "number" && Number.isInteger(dto.dDay) ? dto.dDay : null,
    delayed: dto.delayed === true,
    linkedTaskCount: count(dto.linkedTaskCount),
    incompleteTaskCount: count(dto.incompleteTaskCount),
    tasks,
    version: typeof dto.version === "number" ? dto.version : 0,
  };
};

const toMilestones = (list: MilestoneDto[] | null | undefined): Milestone[] =>
  (Array.isArray(list) ? list : [])
    .filter((dto) => dto && positiveId(dto.id) !== null)
    .slice(0, MAX_MILESTONES)
    .map(toMilestone);

const mapResult = function <A, B>(result: ApiResult<A>, transform: (data: A) => B): ApiResult<B> {
  return result.ok === true ? { ok: true, data: transform(result.data) } : result;
};

const milestonesPath = (projectId: number) => `/projects/${encodeURIComponent(String(projectId))}/wbs/milestones`;
const milestonePath = (projectId: number, milestoneId: number) => `${milestonesPath(projectId)}/${encodeURIComponent(String(milestoneId))}`;

/** 중복을 빼고 순서를 지킨다(서버도 중복을 한 번만 연결한다) */
const distinctIds = (ids: number[]) => [...new Set(ids)];

/* ===== 요청 ===== */

/** GET /api/projects/{projectId}/wbs/milestones — 목표일 순 전체(상한 200, 페이지 없음) */
export const fetchMilestones = async function ({ projectId, signal }: { projectId: number; signal?: AbortSignal }) {
  const result = await apiRequest<MilestoneListDto>({ path: milestonesPath(projectId), signal });
  return mapResult(result, (dto) => toMilestones(dto?.milestones));
};

/** POST .../milestones — PM만. 연결 작업은 선택 */
export const createMilestone = async function ({
  projectId,
  name,
  targetDate,
  taskIds,
  signal,
}: {
  projectId: number;
  name: string;
  targetDate: string;
  taskIds: number[];
  signal?: AbortSignal;
}) {
  const body = { name: name.trim(), targetDate, taskIds: distinctIds(taskIds) };
  const result = await apiRequest<MilestoneDto>({ method: "POST", path: milestonesPath(projectId), body, signal });
  return mapResult(result, toMilestone);
};

/** PATCH .../milestones/{milestoneId} — 이름·목표일 덮어쓰기. version이 다르면 409 */
export const updateMilestone = async function ({
  projectId,
  milestoneId,
  name,
  targetDate,
  version,
  signal,
}: {
  projectId: number;
  milestoneId: number;
  name: string;
  targetDate: string;
  version: number;
  signal?: AbortSignal;
}) {
  const body = { name: name.trim(), targetDate, version };
  const result = await apiRequest<MilestoneDto>({ method: "PATCH", path: milestonePath(projectId, milestoneId), body, signal });
  return mapResult(result, toMilestone);
};

/** PUT .../milestones/{milestoneId}/tasks — 연결 작업 전체 교체. 빈 배열이면 모두 해제 */
export const replaceMilestoneTasks = async function ({
  projectId,
  milestoneId,
  taskIds,
  version,
  signal,
}: {
  projectId: number;
  milestoneId: number;
  taskIds: number[];
  version: number;
  signal?: AbortSignal;
}) {
  const body = { taskIds: distinctIds(taskIds), version };
  const result = await apiRequest<MilestoneDto>({ method: "PUT", path: `${milestonePath(projectId, milestoneId)}/tasks`, body, signal });
  return mapResult(result, toMilestone);
};

/** DELETE .../milestones/{milestoneId} — PM만. 연결 정보만 지우고 작업은 남는다 */
export const deleteMilestone = async function ({ projectId, milestoneId, signal }: { projectId: number; milestoneId: number; signal?: AbortSignal }) {
  const result = await apiRequest<null>({ method: "DELETE", path: milestonePath(projectId, milestoneId), signal });
  return mapResult(result, () => null);
};
