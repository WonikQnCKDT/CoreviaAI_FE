import { apiRequest, type ApiFailure, type ApiResult } from "@/shared/api/client";
import type { MethodKey, RoleKey, StageKey, Visibility } from "@/types";

/**
 * 프로젝트 API (Confluence 03. 프로젝트 (API) v9, FR-PRJ-01·04·05, FR-AIR-03).
 * /api/projects/** 는 USER·EXECUTIVE만 호출한다(SYSTEM_ADMIN은 404). 볼 수 없는 프로젝트는 404 PROJECT_NOT_FOUND.
 * 오류 본문에는 code가 없어(공통 규약 6절) 화면은 HTTP status로 상황을 정한다.
 */

/* =====================================================================
 * 서버 DTO (API 명세 그대로)
 * ===================================================================== */

type VisibilityDto = "COMPANY" | "DEPARTMENT" | "MEMBERS_ONLY";
type TemplateDto = "EMPTY" | "IT_PROJECT";
type MethodologyDto = "NONE" | "WATERFALL" | "AGILE";
type DepartmentTypeDto = "SW" | "MANUFACTURING";
type ActorDto = "PM" | "BUSINESS_OWNER" | "DEVELOPER" | "QA" | "DEPT_STAFF" | "CUSTOMER_LIAISON";
type FeatureDto = "WBS" | "KANBAN" | "BOARD" | "MEETING" | "DELIVERABLE" | "ISSUE" | "FILE" | "GIT";
type ProjectStatusDto = "PLANNED" | "IN_PROGRESS" | "ON_HOLD" | "COMPLETED" | "CANCELLED";
type PhaseStatusDto = "NOT_STARTED" | "IN_PROGRESS" | "COMPLETED";
type GateStatusDto = "PENDING" | "PASSED" | "REJECTED";
type MemberChangeTypeDto = "INVITED" | "ROLE_CHANGED" | "REMOVED" | "PM_ADDED" | "PM_RELEASED" | "PM_REASSIGNED" | "PM_DELEGATED";
type TaskStatusDto = "TODO" | "IN_PROGRESS" | "REVIEW" | "DONE";

interface CursorPageDto<T> {
  items: T[];
  nextCursor: string | null;
  hasNext: boolean;
}

interface NamedRefDto {
  id: number;
  name: string;
}

interface ProjectSummaryDto {
  id: number;
  code: string;
  name: string;
  status: ProjectStatusDto;
  template: TemplateDto;
  methodology: MethodologyDto;
  visibility: VisibilityDto;
  departments: NamedRefDto[];
  pms: NamedRefDto[];
  startDate: string | null;
  endDate: string | null;
  createdAt: string;
}

interface ProjectDetailDto extends ProjectSummaryDto {
  departmentType: DepartmentTypeDto;
  createdBy: number;
  actors: ActorDto[];
  features: FeatureDto[];
  progress: number;
  updatedAt: string;
  version: number;
}

interface ProjectPhaseDto {
  id: number;
  name: string;
  phaseOrder: number;
  progress: number;
  status: PhaseStatusDto;
  gateStatus: GateStatusDto;
  gateApproverUserId: number | null;
  gateApproverName: string | null;
}

interface OptionDto<T extends string> {
  value: T;
  enabled: boolean;
}

interface CreationOptionsDto {
  templates: {
    value: TemplateDto;
    defaultMethodology: MethodologyDto;
    defaultActors: ActorDto[];
    defaultFeatures: FeatureDto[];
    defaultPhases?: string[];
  }[];
  methodologies: OptionDto<MethodologyDto>[];
  departmentTypes: (OptionDto<DepartmentTypeDto> & { actors: (OptionDto<ActorDto> & { required?: boolean })[] })[];
  features: (OptionDto<FeatureDto> & { methodologies: MethodologyDto[] })[];
}

interface ProjectMemberDto {
  userId: number;
  name: string;
  actor: ActorDto;
  assignedTaskCount: number;
}

interface MemberHistoryDto {
  id: number;
  userId: number;
  userName: string;
  changeType: MemberChangeTypeDto;
  beforeActor: ActorDto | null;
  afterActor: ActorDto | null;
  changedBy: number;
  changedByName: string;
  occurredAt: string;
}

interface OverloadDto {
  scope: "ASSIGNEES" | "DEPARTMENTS";
  thresholdPercent: number;
  runDate: string | null;
  assignees: { userId: number; name: string; allocationPercent: number; allocatedEffort: number | null; availableDays: number }[];
  departments: { departmentId: number | null; name: string; overloadedCount: number }[];
}

/* =====================================================================
 * 화면에서 쓰는 domain model
 * ===================================================================== */

export type ProjectStatus = "planned" | "inProgress" | "onHold" | "completed" | "cancelled";
export type ProjectTemplate = "empty" | "itProject";
export type PhaseStatus = "notStarted" | "inProgress" | "completed";
export type GateStatus = "pending" | "passed" | "rejected";
export type DepartmentType = "sw" | "manufacturing";
/** 화면이 아직 다루지 않는 액터(제조 부서 유형)는 원래 값을 그대로 둔다 */
export type ProjectActor = RoleKey | "deptStaff" | "customerLiaison";
export type ProjectFeature = "wbs" | "kanban" | "board" | "meeting" | "deliverable" | "issue" | "file" | "git";
export type MemberChangeType = "invited" | "roleChanged" | "removed" | "pmAdded" | "pmReleased" | "pmReassigned" | "pmDelegated";

export interface NamedRef {
  id: number;
  name: string;
}

export interface CursorPage<T> {
  items: T[];
  nextCursor: string | null;
  hasNext: boolean;
}

export interface ServerProjectSummary {
  id: number;
  code: string;
  name: string;
  status: ProjectStatus;
  template: ProjectTemplate;
  methodology: MethodKey;
  visibility: Visibility;
  /** 0~N개 주관 부서 */
  departments: NamedRef[];
  /** 현재 PM(복수 가능). 비어 있으면 활성 PM이 없는 상태 */
  pms: NamedRef[];
  /** 기간은 생성 후 입력할 수 있어 비어 있을 수 있다 */
  startDate: string | null;
  endDate: string | null;
  createdAt: string;
}

export interface ServerProjectDetail extends ServerProjectSummary {
  departmentType: DepartmentType;
  /** 최초 생성자. PM이 바뀌어도 그대로다. */
  createdBy: number;
  actors: ProjectActor[];
  features: ProjectFeature[];
  /** 예상 공수 가중 진척률(0~100) */
  progress: number;
  version: number;
}

export interface ServerProjectPhase {
  id: number;
  /** 사용자 정의 단계 이름(최대 20개). 기본 폭포수는 분석·설계·개발·테스트·이행 */
  name: string;
  /** 기본 폭포수 이름이면 화면의 고정 단계 키, 사용자 정의 이름이면 null */
  stage: StageKey | null;
  order: number;
  progress: number;
  status: PhaseStatus;
  gateStatus: GateStatus;
  gateApproverUserId: number | null;
  gateApproverName: string | null;
}

export interface ServerProjectMember {
  userId: number;
  name: string;
  actor: ProjectActor;
  /** 담당 업무 수 */
  assignedTaskCount: number;
}

export interface MemberHistory {
  id: number;
  userId: number;
  userName: string;
  changeType: MemberChangeType | string;
  beforeActor: ProjectActor | null;
  afterActor: ProjectActor | null;
  changedBy: number;
  changedByName: string;
  occurredAt: string;
}

export interface CreationOption<T> {
  value: T;
  enabled: boolean;
}

export interface CreationOptions {
  templates: {
    value: ProjectTemplate;
    defaultMethodology: MethodKey;
    defaultActors: ProjectActor[];
    defaultFeatures: ProjectFeature[];
    defaultPhases: string[];
  }[];
  methodologies: CreationOption<MethodKey>[];
  departmentTypes: (CreationOption<DepartmentType> & {
    actors: (CreationOption<ProjectActor> & { required: boolean })[];
  })[];
  /** methodologies: 이 기능을 고를 수 있는 운영 방식 */
  features: (CreationOption<ProjectFeature> & { methodologies: MethodKey[] })[];
}

/** 멤버 제외 409(MEMBER_HAS_ASSIGNED_TASKS)일 때 재배정해야 하는 업무 */
export interface AssignedTask {
  taskId: number;
  title: string;
  status: "todo" | "progress" | "review";
}

export interface RiskOverloads {
  scope: "assignees" | "departments";
  thresholdPercent: number;
  /** 최근 성공한 일일 배치 날짜. 없으면 null이고 두 목록은 비어 있다 */
  runDate: string | null;
  assignees: { userId: number; name: string; allocationPercent: number; allocatedEffort: number | null; availableDays: number }[];
  departments: { departmentId: number | null; name: string; overloadedCount: number }[];
}

/* ===== DTO ↔ domain 변환 ===== */

const VISIBILITY_FROM_DTO: Record<VisibilityDto, Visibility> = { COMPANY: "company", DEPARTMENT: "department", MEMBERS_ONLY: "members" };
const VISIBILITY_TO_DTO: Record<Visibility, VisibilityDto> = { company: "COMPANY", department: "DEPARTMENT", members: "MEMBERS_ONLY" };
const TEMPLATE_FROM_DTO: Record<TemplateDto, ProjectTemplate> = { EMPTY: "empty", IT_PROJECT: "itProject" };
const TEMPLATE_TO_DTO: Record<ProjectTemplate, TemplateDto> = { empty: "EMPTY", itProject: "IT_PROJECT" };
const METHOD_FROM_DTO: Record<MethodologyDto, MethodKey> = { NONE: "none", WATERFALL: "waterfall", AGILE: "agile" };
const METHOD_TO_DTO: Record<MethodKey, MethodologyDto> = { none: "NONE", waterfall: "WATERFALL", agile: "AGILE" };
const DEPT_TYPE_FROM_DTO: Record<DepartmentTypeDto, DepartmentType> = { SW: "sw", MANUFACTURING: "manufacturing" };
const DEPT_TYPE_TO_DTO: Record<DepartmentType, DepartmentTypeDto> = { sw: "SW", manufacturing: "MANUFACTURING" };
const ACTOR_FROM_DTO: Record<ActorDto, ProjectActor> = {
  PM: "pm",
  BUSINESS_OWNER: "biz",
  DEVELOPER: "dev",
  QA: "qa",
  DEPT_STAFF: "deptStaff",
  CUSTOMER_LIAISON: "customerLiaison",
};
const ACTOR_TO_DTO: Record<ProjectActor, ActorDto> = {
  pm: "PM",
  biz: "BUSINESS_OWNER",
  dev: "DEVELOPER",
  qa: "QA",
  deptStaff: "DEPT_STAFF",
  customerLiaison: "CUSTOMER_LIAISON",
};
const FEATURE_FROM_DTO: Record<FeatureDto, ProjectFeature> = {
  WBS: "wbs",
  KANBAN: "kanban",
  BOARD: "board",
  MEETING: "meeting",
  DELIVERABLE: "deliverable",
  ISSUE: "issue",
  FILE: "file",
  GIT: "git",
};
const FEATURE_TO_DTO: Record<ProjectFeature, FeatureDto> = {
  wbs: "WBS",
  kanban: "KANBAN",
  board: "BOARD",
  meeting: "MEETING",
  deliverable: "DELIVERABLE",
  issue: "ISSUE",
  file: "FILE",
  git: "GIT",
};
const STATUS_FROM_DTO: Record<ProjectStatusDto, ProjectStatus> = {
  PLANNED: "planned",
  IN_PROGRESS: "inProgress",
  ON_HOLD: "onHold",
  COMPLETED: "completed",
  CANCELLED: "cancelled",
};
const STATUS_TO_DTO: Record<ProjectStatus, ProjectStatusDto> = {
  planned: "PLANNED",
  inProgress: "IN_PROGRESS",
  onHold: "ON_HOLD",
  completed: "COMPLETED",
  cancelled: "CANCELLED",
};
const PHASE_STATUS_FROM_DTO: Record<PhaseStatusDto, PhaseStatus> = { NOT_STARTED: "notStarted", IN_PROGRESS: "inProgress", COMPLETED: "completed" };
const GATE_STATUS_FROM_DTO: Record<GateStatusDto, GateStatus> = { PENDING: "pending", PASSED: "passed", REJECTED: "rejected" };
const CHANGE_TYPE_FROM_DTO: Record<MemberChangeTypeDto, MemberChangeType> = {
  INVITED: "invited",
  ROLE_CHANGED: "roleChanged",
  REMOVED: "removed",
  PM_ADDED: "pmAdded",
  PM_RELEASED: "pmReleased",
  PM_REASSIGNED: "pmReassigned",
  PM_DELEGATED: "pmDelegated",
};
const TASK_STATUS_FROM_DTO: Partial<Record<TaskStatusDto, AssignedTask["status"]>> = {
  TODO: "todo",
  IN_PROGRESS: "progress",
  REVIEW: "review",
};

/**
 * 기본 폭포수 단계 이름(BE ProjectTemplate IT_PROJECT 기본값) → 화면의 고정 단계 키.
 * 단계 이름은 사용자 정의라 이 이름이 아니면 고정 단계로 보지 않는다.
 */
const DEFAULT_STAGE_BY_NAME: Record<string, StageKey> = { 분석: "analysis", 설계: "design", 개발: "dev", 테스트: "test", 이행: "deploy" };

const has = <T extends string>(map: Record<T, unknown>, value: unknown): value is T =>
  typeof value === "string" && Object.hasOwn(map, value);

const toActor = (actor: ActorDto | null | undefined): ProjectActor | null => (has(ACTOR_FROM_DTO, actor) ? ACTOR_FROM_DTO[actor] : null);
const toActors = (actors: ActorDto[] | null | undefined) =>
  (actors ?? []).map(toActor).filter((actor): actor is ProjectActor => actor !== null);
const toFeatures = (features: FeatureDto[] | null | undefined) =>
  (features ?? []).filter((feature) => has(FEATURE_FROM_DTO, feature)).map((feature) => FEATURE_FROM_DTO[feature]);
const toMethodologies = (values: MethodologyDto[] | null | undefined) =>
  (values ?? []).filter((value) => has(METHOD_FROM_DTO, value)).map((value) => METHOD_FROM_DTO[value]);
const toRefs = (refs: NamedRefDto[] | null | undefined): NamedRef[] => (refs ?? []).map(({ id, name }) => ({ id, name }));

const toSummary = function (dto: ProjectSummaryDto): ServerProjectSummary {
  const { id, code, name, status, template, methodology, visibility, departments, pms, startDate, endDate, createdAt } = dto;
  return {
    id,
    code,
    name,
    status: has(STATUS_FROM_DTO, status) ? STATUS_FROM_DTO[status] : "planned",
    template: has(TEMPLATE_FROM_DTO, template) ? TEMPLATE_FROM_DTO[template] : "empty",
    // 모르는 운영 방식은 단계 없음으로 본다(단계·게이트를 가정하지 않는 쪽이 안전하다).
    methodology: has(METHOD_FROM_DTO, methodology) ? METHOD_FROM_DTO[methodology] : "none",
    // 모르는 공개 범위는 가장 좁은 범위로 본다.
    visibility: has(VISIBILITY_FROM_DTO, visibility) ? VISIBILITY_FROM_DTO[visibility] : "members",
    departments: toRefs(departments),
    pms: toRefs(pms),
    startDate: startDate ?? null,
    endDate: endDate ?? null,
    createdAt,
  };
};

const toDetail = function (dto: ProjectDetailDto): ServerProjectDetail {
  const { departmentType, createdBy, actors, features, progress, version } = dto;
  return {
    ...toSummary(dto),
    departmentType: has(DEPT_TYPE_FROM_DTO, departmentType) ? DEPT_TYPE_FROM_DTO[departmentType] : "sw",
    createdBy,
    actors: toActors(actors),
    features: toFeatures(features),
    // 서버 계약은 int 0~100(ProjectDetailResponse.progress, ProgressCalculator)이라 그대로 쓴다
    progress,
    version,
  };
};

const toPhase = function (dto: ProjectPhaseDto): ServerProjectPhase {
  const { id, name, phaseOrder, progress, status, gateStatus, gateApproverUserId, gateApproverName } = dto;
  const trimmed = (name ?? "").trim();
  return {
    id,
    name: trimmed,
    stage: Object.hasOwn(DEFAULT_STAGE_BY_NAME, trimmed) ? DEFAULT_STAGE_BY_NAME[trimmed] : null,
    order: phaseOrder,
    progress: Number.isFinite(progress) ? progress : 0,
    status: has(PHASE_STATUS_FROM_DTO, status) ? PHASE_STATUS_FROM_DTO[status] : "notStarted",
    gateStatus: has(GATE_STATUS_FROM_DTO, gateStatus) ? GATE_STATUS_FROM_DTO[gateStatus] : "pending",
    gateApproverUserId: gateApproverUserId ?? null,
    gateApproverName: gateApproverName ?? null,
  };
};

/** 화면이 모르는 액터(새 부서 유형 등)의 멤버는 역할을 판단할 수 없어 목록에서 뺀다. */
const toMember = function ({ userId, name, actor, assignedTaskCount }: ProjectMemberDto): ServerProjectMember | null {
  const mapped = toActor(actor);
  return mapped ? { userId, name, actor: mapped, assignedTaskCount: Number(assignedTaskCount) || 0 } : null;
};

const toHistory = function (dto: MemberHistoryDto): MemberHistory {
  const { id, userId, userName, changeType, beforeActor, afterActor, changedBy, changedByName, occurredAt } = dto;
  return {
    id,
    userId,
    userName,
    // 모르는 변경 유형도 원래 값으로 보여 줄 수 있게 남긴다.
    changeType: has(CHANGE_TYPE_FROM_DTO, changeType) ? CHANGE_TYPE_FROM_DTO[changeType] : changeType,
    beforeActor: toActor(beforeActor),
    afterActor: toActor(afterActor),
    changedBy,
    changedByName,
    occurredAt,
  };
};

const toCreationOptions = function ({ templates, methodologies, departmentTypes, features }: CreationOptionsDto): CreationOptions {
  return {
    templates: (templates ?? [])
      .filter(({ value }) => has(TEMPLATE_FROM_DTO, value))
      .map(({ value, defaultMethodology, defaultActors, defaultFeatures, defaultPhases }) => ({
        value: TEMPLATE_FROM_DTO[value],
        defaultMethodology: has(METHOD_FROM_DTO, defaultMethodology) ? METHOD_FROM_DTO[defaultMethodology] : "none",
        defaultActors: toActors(defaultActors),
        defaultFeatures: toFeatures(defaultFeatures),
        defaultPhases: (defaultPhases ?? []).filter((phase): phase is string => typeof phase === "string"),
      })),
    methodologies: (methodologies ?? [])
      .filter(({ value }) => has(METHOD_FROM_DTO, value))
      .map(({ value, enabled }) => ({ value: METHOD_FROM_DTO[value], enabled: Boolean(enabled) })),
    departmentTypes: (departmentTypes ?? [])
      .filter(({ value }) => has(DEPT_TYPE_FROM_DTO, value))
      .map(({ value, enabled, actors }) => ({
        value: DEPT_TYPE_FROM_DTO[value],
        enabled: Boolean(enabled),
        actors: (actors ?? [])
          .filter(({ value: actor }) => has(ACTOR_FROM_DTO, actor))
          .map(({ value: actor, enabled: actorEnabled, required }) => ({
            value: ACTOR_FROM_DTO[actor],
            enabled: Boolean(actorEnabled),
            required: Boolean(required),
          })),
      })),
    features: (features ?? [])
      .filter(({ value }) => has(FEATURE_FROM_DTO, value))
      .map(({ value, enabled, methodologies: allowed }) => ({
        value: FEATURE_FROM_DTO[value],
        enabled: Boolean(enabled),
        methodologies: toMethodologies(allowed),
      })),
  };
};

const toOverloads = function ({ scope, thresholdPercent, runDate, assignees, departments }: OverloadDto): RiskOverloads {
  return {
    scope: scope === "DEPARTMENTS" ? "departments" : "assignees",
    thresholdPercent: Number(thresholdPercent) || 0,
    runDate: runDate ?? null,
    assignees: (assignees ?? []).map(({ userId, name, allocationPercent, allocatedEffort, availableDays }) => ({
      userId,
      name,
      allocationPercent: Number(allocationPercent),
      allocatedEffort: allocatedEffort === null || allocatedEffort === undefined ? null : Number(allocatedEffort),
      availableDays: Number(availableDays),
    })),
    departments: (departments ?? []).map(({ departmentId, name, overloadedCount }) => ({
      departmentId: departmentId ?? null,
      name,
      overloadedCount: Number(overloadedCount),
    })),
  };
};

const toPage = function <A, B>({ items, nextCursor, hasNext }: CursorPageDto<A>, transform: (item: A) => B | null): CursorPage<B> {
  return {
    items: (items ?? []).map(transform).filter((item): item is B => item !== null),
    nextCursor: nextCursor ?? null,
    hasNext: Boolean(hasNext),
  };
};

const mapResult = function <A, B>(result: ApiResult<A>, transform: (data: A) => B): ApiResult<B> {
  return result.ok === true ? { ok: true, data: transform(result.data) } : result;
};

const toQuery = function (params: Record<string, string | number | null | undefined>) {
  const search = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value === null || value === undefined || value === "") return;
    search.set(key, String(value));
  });
  const text = search.toString();
  return text ? `?${text}` : "";
};

const projectPath = (projectId: number) => `/projects/${encodeURIComponent(String(projectId))}`;
const memberPath = (projectId: number, userId: number) => `${projectPath(projectId)}/members/${encodeURIComponent(String(userId))}`;
const phasePath = (projectId: number, phaseId: number) => `${projectPath(projectId)}/phases/${encodeURIComponent(String(phaseId))}`;

/** 커서 목록을 끝까지 이어 받는다. 서버가 커서를 잘못 줘도 무한 반복하지 않도록 상한을 둔다. */
const collectAll = async function <T>(fetchPage: (cursor: string | null) => Promise<ApiResult<CursorPage<T>>>): Promise<ApiResult<T[]>> {
  const collected: T[] = [];
  let cursor: string | null = null;
  for (let page = 0; page < 50; page += 1) {
    const result = await fetchPage(cursor);
    if (result.ok === false) return result;
    const { items, nextCursor, hasNext } = result.data;
    collected.push(...items);
    if (!hasNext || !nextCursor) break;
    cursor = nextCursor;
  }
  return { ok: true, data: collected };
};

/* =====================================================================
 * 프로젝트 조회
 * ===================================================================== */

export interface ProjectListQuery {
  cursor?: string | null;
  size?: number;
  status?: ProjectStatus | null;
  /** 주관 부서 중 하나와 일치 */
  departmentId?: number | null;
  /** PM 중 한 명과 일치 */
  pmUserId?: number | null;
}

/** GET /api/projects — id 내림차순 커서 목록. 볼 수 없는 프로젝트는 서버가 빼고 준다. */
export const fetchProjects = async function ({
  cursor,
  size = 100,
  status,
  departmentId,
  pmUserId,
  signal,
}: ProjectListQuery & { signal?: AbortSignal }) {
  const query = toQuery({ cursor, size, status: status ? STATUS_TO_DTO[status] : null, departmentId, pmUserId });
  const result = await apiRequest<CursorPageDto<ProjectSummaryDto>>({ path: `/projects${query}`, signal });
  return mapResult(result, (page) => toPage(page, toSummary));
};

/**
 * 목록 화면은 정렬·필터·통계를 화면에서 계산하므로 모든 페이지를 이어 받는다
 * (서버는 종료일·이름순 정렬과 리스크 등급 필터를 제공하지 않는다).
 */
export const fetchAllProjects = function ({ signal }: { signal?: AbortSignal } = {}) {
  return collectAll((cursor) => fetchProjects({ cursor, signal }));
};

/** GET /api/projects/{projectId} — 운영 방식과 무관한 공통 정보. 멤버·단계는 별도 API */
export const fetchProjectDetail = async function ({ projectId, signal }: { projectId: number; signal?: AbortSignal }) {
  const result = await apiRequest<ProjectDetailDto>({ path: projectPath(projectId), signal });
  return mapResult(result, toDetail);
};

/** GET /api/projects/{projectId}/phases — 단계 순서대로. 단계가 없으면 빈 배열 */
export const fetchProjectPhases = async function ({ projectId, signal }: { projectId: number; signal?: AbortSignal }) {
  const result = await apiRequest<ProjectPhaseDto[]>({ path: `${projectPath(projectId)}/phases`, signal });
  return mapResult(result, (phases) => (phases ?? []).map(toPhase).sort((a, b) => a.order - b.order));
};

/* =====================================================================
 * 생성
 * ===================================================================== */

/** GET /api/projects/creation-options — FE는 값을 하드코딩하지 않고 enabled를 따른다 */
export const fetchCreationOptions = async function ({ signal }: { signal?: AbortSignal } = {}) {
  const result = await apiRequest<CreationOptionsDto>({ path: "/projects/creation-options", signal });
  return mapResult(result, toCreationOptions);
};

/** 프로젝트 코드 규칙(BE CreateProjectRequest.CODE_PATTERN): 영문·숫자로 시작하는 영문·숫자·하이픈 2~20자 */
export const PROJECT_CODE_PATTERN = /^[A-Za-z0-9][A-Za-z0-9-]{1,19}$/;

/** GET /api/projects/code-availability — 참고용. 최종 판정은 생성 요청 시점. code는 대문자로 정규화돼 온다 */
export const checkProjectCode = async function ({ code, signal }: { code: string; signal?: AbortSignal }) {
  const result = await apiRequest<{ code: string; available: boolean }>({
    path: `/projects/code-availability${toQuery({ code: code.trim() })}`,
    signal,
  });
  return mapResult(result, ({ code: normalized, available }) => ({ code: normalized, available: Boolean(available) }));
};

export interface NewProjectInput {
  name: string;
  code: string;
  /** YYYY-MM-DD. 비우면 생성 후 입력 */
  startDate: string | null;
  endDate: string | null;
  /** 0~20개 주관 부서 */
  departmentIds: number[];
  visibility: Visibility;
  template: ProjectTemplate;
  methodology: MethodKey;
  departmentType: DepartmentType;
  actors: ProjectActor[];
  features: ProjectFeature[];
  members: { userId: number; actor: ProjectActor }[];
  gateApproverUserId: number | null;
  /** 생략하면 템플릿 기본 단계, 빈 배열이면 단계 없음, 문자열 배열이면 사용자 정의 단계(최대 20개) */
  phases?: string[];
}

/** POST /api/projects — 단계형 화면의 입력을 모아 마지막에 한 번 호출한다. 코드 중복이면 409 */
export const createProject = async function ({ input, signal }: { input: NewProjectInput; signal?: AbortSignal }) {
  const { name, code, startDate, endDate, departmentIds, visibility, template, methodology, departmentType, actors, features, members, gateApproverUserId, phases } =
    input;
  const result = await apiRequest<ProjectDetailDto>({
    method: "POST",
    path: "/projects",
    body: {
      name: name.trim(),
      code: code.trim().toUpperCase(),
      startDate: startDate || null,
      endDate: endDate || null,
      departmentIds: [...new Set(departmentIds)],
      visibility: VISIBILITY_TO_DTO[visibility],
      template: TEMPLATE_TO_DTO[template],
      methodology: METHOD_TO_DTO[methodology],
      departmentType: DEPT_TYPE_TO_DTO[departmentType],
      actors: [...new Set(actors)].map((actor) => ACTOR_TO_DTO[actor]),
      features: [...new Set(features)].map((feature) => FEATURE_TO_DTO[feature]),
      members: members.map(({ userId, actor }) => ({ userId, actor: ACTOR_TO_DTO[actor] })),
      gateApproverUserId,
      ...(phases === undefined ? {} : { phases: phases.map((phase) => phase.trim()) }),
    },
    signal,
  });
  return mapResult(result, toDetail);
};

/* =====================================================================
 * 멤버 (FR-PRJ-04) — 변경은 현재 PM만(아니면 403 PROJECT_PM_ONLY)
 * ===================================================================== */

/** GET /api/projects/{projectId}/members — id 오름차순(등록순). PM은 actor로 구분한다 */
export const fetchProjectMembers = async function ({
  projectId,
  cursor,
  size = 100,
  signal,
}: {
  projectId: number;
  cursor?: string | null;
  size?: number;
  signal?: AbortSignal;
}) {
  const result = await apiRequest<CursorPageDto<ProjectMemberDto>>({
    path: `${projectPath(projectId)}/members${toQuery({ cursor, size })}`,
    signal,
  });
  return mapResult(result, (page) => toPage(page, toMember));
};

export const fetchAllProjectMembers = function ({ projectId, signal }: { projectId: number; signal?: AbortSignal }) {
  return collectAll((cursor) => fetchProjectMembers({ projectId, cursor, signal }));
};

/** POST /api/projects/{projectId}/members — 1~100명. 한 명이라도 거부되면 아무도 추가하지 않는다 */
export const inviteProjectMembers = async function ({
  projectId,
  members,
  signal,
}: {
  projectId: number;
  members: { userId: number; actor: ProjectActor }[];
  signal?: AbortSignal;
}) {
  const result = await apiRequest<ProjectMemberDto[]>({
    method: "POST",
    path: `${projectPath(projectId)}/members`,
    body: { members: members.map(({ userId, actor }) => ({ userId, actor: ACTOR_TO_DTO[actor] })) },
    signal,
  });
  return mapResult(result, (items) => (items ?? []).map(toMember).filter((member): member is ServerProjectMember => member !== null));
};

/**
 * PATCH .../members/{userId}/role — PM 추가·해제도 이 API로 한다. 마지막 PM 해제는 409 LAST_PM_REQUIRED.
 * 성공했는데 data가 null이면 서버가 화면이 모르는 역할을 돌려준 경우다(변경은 반영됨). 멤버 목록을 다시 받는다.
 */
export const changeProjectMemberRole = async function ({
  projectId,
  userId,
  actor,
  signal,
}: {
  projectId: number;
  userId: number;
  actor: ProjectActor;
  signal?: AbortSignal;
}) {
  const result = await apiRequest<ProjectMemberDto>({
    method: "PATCH",
    path: `${memberPath(projectId, userId)}/role`,
    body: { actor: ACTOR_TO_DTO[actor] },
    signal,
  });
  return mapResult(result, (dto) => toMember(dto));
};

/** DELETE .../members/{userId} — 미완료 담당 업무가 있으면 409와 재배정할 업무 목록(assignedTasksOf) */
export const removeProjectMember = async function ({ projectId, userId, signal }: { projectId: number; userId: number; signal?: AbortSignal }) {
  return apiRequest<null>({ method: "DELETE", path: memberPath(projectId, userId), signal });
};

/**
 * 멤버 제외 409의 재배정 업무 목록(공통 규약 2절 보조 데이터, 03 C안).
 * 409가 아니거나 목록이 없으면 빈 배열. 모르는 상태 값의 항목은 버린다.
 */
export const assignedTasksOf = function (failure: ApiFailure): AssignedTask[] {
  if (failure.kind !== "http" || failure.status !== 409 || !Array.isArray(failure.data)) return [];
  return failure.data.flatMap((item: unknown) => {
    if (!item || typeof item !== "object") return [];
    const { taskId, title, status } = item as { taskId?: unknown; title?: unknown; status?: unknown };
    const mapped = has(TASK_STATUS_FROM_DTO as Record<TaskStatusDto, unknown>, status) ? TASK_STATUS_FROM_DTO[status] : undefined;
    if (typeof taskId !== "number" || typeof title !== "string" || !mapped) return [];
    return [{ taskId, title, status: mapped }];
  });
};

/** GET .../members/histories — id 내림차순(최신순) */
export const fetchMemberHistories = async function ({
  projectId,
  cursor,
  size = 20,
  signal,
}: {
  projectId: number;
  cursor?: string | null;
  size?: number;
  signal?: AbortSignal;
}) {
  const result = await apiRequest<CursorPageDto<MemberHistoryDto>>({
    path: `${projectPath(projectId)}/members/histories${toQuery({ cursor, size })}`,
    signal,
  });
  return mapResult(result, (page) => toPage(page, toHistory));
};

/* =====================================================================
 * 단계 편집 (11-23 사용자 정의 단계, PM만) — WBS 작업이 연결된 단계 삭제는 409 PROJECT_PHASE_IN_USE
 * ===================================================================== */

export const createProjectPhase = async function ({ projectId, name, signal }: { projectId: number; name: string; signal?: AbortSignal }) {
  const result = await apiRequest<ProjectPhaseDto>({ method: "POST", path: `${projectPath(projectId)}/phases`, body: { name: name.trim() }, signal });
  return mapResult(result, toPhase);
};

export const renameProjectPhase = function ({
  projectId,
  phaseId,
  name,
  signal,
}: {
  projectId: number;
  phaseId: number;
  name: string;
  signal?: AbortSignal;
}) {
  return apiRequest<null>({ method: "PATCH", path: phasePath(projectId, phaseId), body: { name: name.trim() }, signal });
};

/** PUT .../phases/order — 모든 단계 ID를 새 순서대로 보낸다 */
export const reorderProjectPhases = function ({ projectId, phaseIds, signal }: { projectId: number; phaseIds: number[]; signal?: AbortSignal }) {
  return apiRequest<null>({ method: "PUT", path: `${projectPath(projectId)}/phases/order`, body: { phaseIds }, signal });
};

export const deleteProjectPhase = function ({ projectId, phaseId, signal }: { projectId: number; phaseId: number; signal?: AbortSignal }) {
  return apiRequest<null>({ method: "DELETE", path: phasePath(projectId, phaseId), signal });
};

/* =====================================================================
 * 인력 편중 (FR-AIR-03) — 최근 일일 배치 결과만. PM은 담당자 전원, 개발자·QA는 본인, 경영진은 부서별 인원 수
 * ===================================================================== */

/** GET /api/projects/{projectId}/risk-overloads — 허용되지 않은 프로젝트 역할은 403 OVERLOAD_VIEW_FORBIDDEN */
export const fetchRiskOverloads = async function ({ projectId, signal }: { projectId: number; signal?: AbortSignal }) {
  const result = await apiRequest<OverloadDto>({ path: `${projectPath(projectId)}/risk-overloads`, signal });
  return mapResult(result, toOverloads);
};
