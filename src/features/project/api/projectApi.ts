import { apiRequest, type ApiResult } from "@/shared/api/client";
import type { MethodKey, RoleKey, StageKey, Visibility } from "@/types";

/* =====================================================================
 * 서버 DTO (API 명세 그대로)
 * ===================================================================== */

type VisibilityDto = "COMPANY" | "DEPARTMENT" | "MEMBERS_ONLY";
type MethodologyDto = "WATERFALL" | "AGILE";
type DepartmentTypeDto = "SW" | "MANUFACTURING";
type ActorDto = "PM" | "BUSINESS_OWNER" | "DEVELOPER" | "QA" | "DEPT_STAFF" | "CUSTOMER_LIAISON";
/** 명세 미정의, 팀 확정 전 초안 */
type ProjectStatusDto = "PLANNED" | "IN_PROGRESS" | "ON_HOLD" | "COMPLETED" | "CANCELLED";
type PhaseTypeDto = "ANALYSIS" | "DESIGN" | "DEVELOPMENT" | "TEST" | "TRANSITION";
type PhaseStatusDto = "NOT_STARTED" | "IN_PROGRESS" | "COMPLETED";
type GateStatusDto = "PENDING" | "PASSED" | "REJECTED";

interface CursorPageDto<T> {
  items: T[];
  nextCursor: string | null;
  hasNext: boolean;
}

interface ProjectSummaryDto {
  id: number;
  code: string;
  name: string;
  status: ProjectStatusDto;
  methodology: MethodologyDto;
  visibility: VisibilityDto;
  departmentId: number;
  departmentName: string;
  pmUserId: number;
  pmName: string;
  startDate: string;
  endDate: string;
  createdAt: string;
}

interface ProjectDetailDto extends ProjectSummaryDto {
  departmentType: DepartmentTypeDto;
  createdBy: number;
  actors: ActorDto[];
  members: { userId: number; name: string; actor: ActorDto }[];
  updatedAt: string;
}

interface ProjectPhaseDto {
  id: number;
  phaseType: PhaseTypeDto;
  phaseOrder: number;
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
  methodologies: OptionDto<MethodologyDto>[];
  departmentTypes: (OptionDto<DepartmentTypeDto> & { actors: (OptionDto<ActorDto> & { required?: boolean })[] })[];
}

/* =====================================================================
 * 화면에서 쓰는 domain model
 * ===================================================================== */

export type ProjectStatus = "planned" | "inProgress" | "onHold" | "completed" | "cancelled";
export type PhaseStatus = "notStarted" | "inProgress" | "completed";
export type GateStatus = "pending" | "passed" | "rejected";
export type DepartmentType = "sw" | "manufacturing";
/** 화면이 아직 다루지 않는 액터(제조 부서 유형)는 원래 값을 그대로 둔다 */
export type ProjectActor = RoleKey | "deptStaff" | "customerLiaison";

export interface ServerProjectSummary {
  id: number;
  code: string;
  name: string;
  status: ProjectStatus;
  methodology: MethodKey;
  visibility: Visibility;
  departmentId: number;
  departmentName: string;
  pmUserId: number;
  pmName: string;
  startDate: string;
  endDate: string;
}

export interface ServerProjectMember {
  userId: number;
  name: string;
  actor: ProjectActor;
}

export interface ServerProjectDetail extends ServerProjectSummary {
  departmentType: DepartmentType;
  createdBy: number;
  actors: ProjectActor[];
  members: ServerProjectMember[];
}

export interface ServerProjectPhase {
  id: number;
  stage: StageKey;
  order: number;
  status: PhaseStatus;
  gateStatus: GateStatus;
  gateApproverUserId: number | null;
  gateApproverName: string | null;
}

export interface CreationOption<T> {
  value: T;
  enabled: boolean;
}

export interface CreationOptions {
  methodologies: CreationOption<MethodKey>[];
  departmentTypes: (CreationOption<DepartmentType> & {
    actors: (CreationOption<ProjectActor> & { required: boolean })[];
  })[];
}

/* ===== DTO ↔ domain 변환 ===== */

const VISIBILITY_FROM_DTO: Record<VisibilityDto, Visibility> = {
  COMPANY: "company",
  DEPARTMENT: "department",
  MEMBERS_ONLY: "members",
};
const VISIBILITY_TO_DTO: Record<Visibility, VisibilityDto> = {
  company: "COMPANY",
  department: "DEPARTMENT",
  members: "MEMBERS_ONLY",
};
const METHOD_FROM_DTO: Record<MethodologyDto, MethodKey> = { WATERFALL: "waterfall", AGILE: "agile" };
const METHOD_TO_DTO: Record<MethodKey, MethodologyDto> = { waterfall: "WATERFALL", agile: "AGILE" };
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
const STATUS_FROM_DTO: Record<ProjectStatusDto, ProjectStatus> = {
  PLANNED: "planned",
  IN_PROGRESS: "inProgress",
  ON_HOLD: "onHold",
  COMPLETED: "completed",
  CANCELLED: "cancelled",
};
const STAGE_FROM_DTO: Record<PhaseTypeDto, StageKey> = {
  ANALYSIS: "analysis",
  DESIGN: "design",
  DEVELOPMENT: "dev",
  TEST: "test",
  TRANSITION: "deploy",
};
const PHASE_STATUS_FROM_DTO: Record<PhaseStatusDto, PhaseStatus> = {
  NOT_STARTED: "notStarted",
  IN_PROGRESS: "inProgress",
  COMPLETED: "completed",
};
const GATE_STATUS_FROM_DTO: Record<GateStatusDto, GateStatus> = { PENDING: "pending", PASSED: "passed", REJECTED: "rejected" };

const toSummary = function ({
  id,
  code,
  name,
  status,
  methodology,
  visibility,
  departmentId,
  departmentName,
  pmUserId,
  pmName,
  startDate,
  endDate,
}: ProjectSummaryDto): ServerProjectSummary {
  return {
    id,
    code,
    name,
    // 상태 값은 팀 확정 전 초안이라 모르는 값이 오면 '계획'으로 본다.
    status: STATUS_FROM_DTO[status] ?? "planned",
    methodology: METHOD_FROM_DTO[methodology] ?? "waterfall",
    visibility: VISIBILITY_FROM_DTO[visibility] ?? "members",
    departmentId,
    departmentName,
    pmUserId,
    pmName,
    startDate,
    endDate,
  };
};

const toActor = (actor: ActorDto): ProjectActor | null => ACTOR_FROM_DTO[actor] ?? null;

const toDetail = function (dto: ProjectDetailDto): ServerProjectDetail {
  const { departmentType, createdBy, actors, members } = dto;
  return {
    ...toSummary(dto),
    departmentType: DEPT_TYPE_FROM_DTO[departmentType] ?? "sw",
    createdBy,
    actors: (actors ?? []).map(toActor).filter((actor): actor is ProjectActor => actor !== null),
    members: (members ?? [])
      .map(({ userId, name, actor }) => ({ userId, name, actor: toActor(actor) }))
      .filter((member): member is ServerProjectMember => member.actor !== null),
  };
};

const toPhase = function ({
  id,
  phaseType,
  phaseOrder,
  status,
  gateStatus,
  gateApproverUserId,
  gateApproverName,
}: ProjectPhaseDto): ServerProjectPhase {
  return {
    id,
    stage: STAGE_FROM_DTO[phaseType] ?? "analysis",
    order: phaseOrder,
    status: PHASE_STATUS_FROM_DTO[status] ?? "notStarted",
    gateStatus: GATE_STATUS_FROM_DTO[gateStatus] ?? "pending",
    gateApproverUserId,
    gateApproverName,
  };
};

const toCreationOptions = function ({ methodologies, departmentTypes }: CreationOptionsDto): CreationOptions {
  return {
    methodologies: (methodologies ?? [])
      .filter(({ value }) => value in METHOD_FROM_DTO)
      .map(({ value, enabled }) => ({ value: METHOD_FROM_DTO[value], enabled: Boolean(enabled) })),
    departmentTypes: (departmentTypes ?? [])
      .filter(({ value }) => value in DEPT_TYPE_FROM_DTO)
      .map(({ value, enabled, actors }) => ({
        value: DEPT_TYPE_FROM_DTO[value],
        enabled: Boolean(enabled),
        actors: (actors ?? [])
          .filter(({ value: actor }) => actor in ACTOR_FROM_DTO)
          .map(({ value: actor, enabled: actorEnabled, required }) => ({
            value: ACTOR_FROM_DTO[actor],
            enabled: Boolean(actorEnabled),
            required: Boolean(required),
          })),
      })),
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

/* =====================================================================
 * 조회 API
 * ===================================================================== */

/** GET /api/projects — id 내림차순 커서 목록. 볼 수 없는 프로젝트는 서버가 빼고 준다. */
export const fetchProjects = async function ({
  cursor,
  size = 100,
  signal,
}: {
  cursor?: string | null;
  size?: number;
  signal?: AbortSignal;
}) {
  const result = await apiRequest<CursorPageDto<ProjectSummaryDto>>({ path: `/projects${toQuery({ cursor, size })}`, signal });
  return mapResult(result, ({ items, nextCursor, hasNext }) => ({
    items: (items ?? []).map(toSummary),
    nextCursor: nextCursor ?? null,
    hasNext: Boolean(hasNext),
  }));
};

/**
 * 목록 화면은 기존처럼 정렬·필터·통계를 화면에서 계산하므로 모든 페이지를 이어 받는다.
 * (서버 정렬·필터 확장이 후속이라 지금은 이 방식이 화면 동작과 맞다)
 */
export const fetchAllProjects = async function ({ signal }: { signal?: AbortSignal } = {}): Promise<
  ApiResult<ServerProjectSummary[]>
> {
  const collected: ServerProjectSummary[] = [];
  let cursor: string | null = null;
  for (let page = 0; page < 50; page += 1) {
    const result = await fetchProjects({ cursor, signal });
    if (result.ok === false) return result;
    const { items, nextCursor, hasNext } = result.data;
    collected.push(...items);
    if (!hasNext || !nextCursor) break;
    cursor = nextCursor;
  }
  return { ok: true, data: collected };
};

/** GET /api/projects/{projectId} — 운영 방식과 무관한 공통 정보 */
export const fetchProjectDetail = async function ({ projectId, signal }: { projectId: number; signal?: AbortSignal }) {
  const result = await apiRequest<ProjectDetailDto>({ path: projectPath(projectId), signal });
  return mapResult(result, toDetail);
};

/** GET /api/projects/{projectId}/phases — 폭포수 5단계. 폭포수가 아니면 404 PHASES_NOT_AVAILABLE */
export const fetchProjectPhases = async function ({ projectId, signal }: { projectId: number; signal?: AbortSignal }) {
  const result = await apiRequest<ProjectPhaseDto[]>({ path: `${projectPath(projectId)}/phases`, signal });
  return mapResult(result, (phases) =>
    (phases ?? [])
      .map(toPhase)
      .slice()
      .sort((a, b) => a.order - b.order),
  );
};

/* =====================================================================
 * 생성 API (생성 화면 연결은 부서 목록·사용자 검색 API가 생긴 뒤)
 * ===================================================================== */

/** GET /api/projects/creation-options — FE는 값을 하드코딩하지 않고 enabled를 따른다 */
export const fetchCreationOptions = async function ({ signal }: { signal?: AbortSignal } = {}) {
  const result = await apiRequest<CreationOptionsDto>({ path: "/projects/creation-options", signal });
  return mapResult(result, toCreationOptions);
};

/** GET /api/projects/code-availability — 참고용. 최종 판정은 생성 요청 시점 */
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
  startDate: string;
  endDate: string;
  departmentId: number;
  visibility: Visibility;
  methodology: MethodKey;
  departmentType: DepartmentType;
  actors: ProjectActor[];
  members: { userId: number; actor: ProjectActor }[];
  gateApproverUserId: number | null;
}

/** POST /api/projects — 단계형 화면의 입력을 모아 마지막에 한 번 호출한다 */
export const createProject = async function ({
  input: { name, code, startDate, endDate, departmentId, visibility, methodology, departmentType, actors, members, gateApproverUserId },
  signal,
}: {
  input: NewProjectInput;
  signal?: AbortSignal;
}) {
  const result = await apiRequest<ProjectDetailDto>({
    method: "POST",
    path: "/projects",
    body: {
      name: name.trim(),
      code: code.trim(),
      startDate,
      endDate,
      departmentId,
      visibility: VISIBILITY_TO_DTO[visibility],
      methodology: METHOD_TO_DTO[methodology],
      departmentType: DEPT_TYPE_TO_DTO[departmentType],
      actors: actors.map((actor) => ACTOR_TO_DTO[actor]),
      members: members.map(({ userId, actor }) => ({ userId, actor: ACTOR_TO_DTO[actor] })),
      gateApproverUserId,
    },
    signal,
  });
  return mapResult(result, toDetail);
};
