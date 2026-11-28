import type { ApiFailure } from "@/shared/api/client";
import {
  PROJECT_CODE_PATTERN,
  type CreationOptions,
  type NewProjectInput,
  type ProjectActor,
  type ProjectFeature,
  type ProjectTemplate,
} from "@/features/project/api/projectApi";
import { PROJECT_CREATE_TEXT } from "@/features/project/i18n/ko";
import { AUTH_TEXT } from "@/features/auth/i18n/ko";
import type { MethodKey, Visibility } from "@/types";

/**
 * api 모드 프로젝트 생성 규칙 (03. 프로젝트 API v9, FR-PRJ-01).
 * 선택값은 모두 서버가 준 생성 선택지에서만 고른다. 데모 샘플 데이터(부서·사용자 ID)는 쓰지 않는다.
 */

/** BE CreateProjectRequest 상한 */
export const MAX_CREATE_DEPARTMENTS = 20;
export const MAX_CREATE_MEMBERS = 100;

/** 생성 시 초대할 멤버. 화면 표시용 이름·부서를 함께 둔다(요청에는 userId·actor만 보낸다) */
export interface CreateMember {
  userId: number;
  name: string;
  departmentName: string | null;
  jobTitle: string | null;
  /** PM이 아닌, ③에서 지정한 액터 중 하나 */
  actor: ProjectActor;
}

export interface ServerCreateForm {
  name: string;
  code: string;
  startDate: string;
  endDate: string;
  visibility: Visibility;
  template: ProjectTemplate | null;
  methodology: MethodKey | null;
  actors: ProjectActor[];
  features: ProjectFeature[];
  /** ① 주관 부서 0~20개 */
  departmentIds: number[];
  /** ⑤ 초대 멤버(생성자 본인은 PM으로 자동 등록되어 여기에 없다) */
  members: CreateMember[];
  /** ⑥ 게이트 승인자. 단계가 있을 때만, members 중 한 명 또는 null */
  gateApproverUserId: number | null;
}

export type CreateField = "name" | "code" | "period" | "actors" | "departments" | "members" | "approver";
export type CreateErrors = Partial<Record<CreateField, string>>;

const MAX_NAME_LENGTH = 100;

const swDepartment = (options: CreationOptions) => options.departmentTypes.find(({ value, enabled }) => value === "sw" && enabled);

/** SW 부서 유형에서 고를 수 있는 액터 */
export const selectableActors = function (options: CreationOptions) {
  return (swDepartment(options)?.actors ?? []).filter(({ enabled }) => enabled);
};

/** 고를 수 있는(활성) 운영 방식 */
export const selectableMethodologies = function (options: CreationOptions): MethodKey[] {
  return options.methodologies.filter(({ enabled }) => enabled).map(({ value }) => value);
};

/**
 * 생성 요청에 담아 보낼 단계 이름. 단계 없음 운영 방식이면 빈 목록, 그 밖에는 선택한 템플릿의 기본 단계다.
 * BE는 이 목록이 비어 있지 않을 때만 "단계 있음"으로 보고 requiresPhases 기능·게이트 승인자를 허용한다
 * (ProjectCreationPolicy.validateFeatures·validateGateApprover). 서버가 템플릿 기본값을 대신 넣지 않도록 항상 명시해 보낸다.
 */
export const plannedPhases = function (form: Pick<ServerCreateForm, "template" | "methodology">, options: CreationOptions): string[] {
  if (!form.template || !form.methodology || form.methodology === "none") return [];
  return [...(options.templates.find(({ value }) => value === form.template)?.defaultPhases ?? [])];
};

export const hasPhases = (form: Pick<ServerCreateForm, "template" | "methodology">, options: CreationOptions) =>
  plannedPhases(form, options).length > 0;

/** 기능을 고를 수 없는 이유. disabled: 서버가 아직 열지 않은 기능(예: Git 연동), needsPhases: 단계가 있어야 하는 기능 */
export type FeatureBlock = "disabled" | "needsPhases" | null;

/** 기능 선택지 전체와 고를 수 있는지(BE ProjectFeature.selectableFor와 같은 규칙: enabled && (!requiresPhases || 단계 있음)) */
export const featureChoices = function (options: CreationOptions, withPhases: boolean): { value: ProjectFeature; block: FeatureBlock }[] {
  return options.features.map(({ value, enabled, requiresPhases }) => {
    let block: FeatureBlock = null;
    if (!enabled) block = "disabled";
    else if (requiresPhases && !withPhases) block = "needsPhases";
    return { value, block };
  });
};

/** 지금 단계 구성에서 고를 수 있는 기능 */
export const selectableFeatures = function (options: CreationOptions, withPhases: boolean): ProjectFeature[] {
  return featureChoices(options, withPhases)
    .filter(({ block }) => block === null)
    .map(({ value }) => value);
};

/**
 * 서버 선택지로 고를 수 없는 필수 항목. 하나라도 있으면 만들 수 없다.
 * (선택 항목인 부서·멤버·승인자는 여기에 넣지 않는다.)
 */
export const requiredBlockers = function (options: CreationOptions): string[] {
  const blockers: string[] = [];
  if (options.templates.length === 0) blockers.push(PROJECT_CREATE_TEXT.noTemplate);
  if (selectableMethodologies(options).length === 0) blockers.push(PROJECT_CREATE_TEXT.noMethodology);
  if (!swDepartment(options)) blockers.push(PROJECT_CREATE_TEXT.noDepartmentType);
  else if (!selectableActors(options).some(({ value }) => value === "pm")) blockers.push(PROJECT_CREATE_TEXT.noPmActor);
  return blockers;
};

/** 멤버 역할로 쓰고 있는 액터. 이 액터는 해제할 수 없다(BE 설정 변경의 ACTOR_HAS_MEMBERS와 같은 원칙) */
export const actorsInUse = (form: Pick<ServerCreateForm, "members">): Set<ProjectActor> => new Set(form.members.map(({ actor }) => actor));

/** 단계가 없으면 승인자를 지울 수 있도록, 바뀐 폼에서 승인자 조건을 다시 맞춘다 */
const keepValidApprover = function (form: ServerCreateForm, options: CreationOptions): ServerCreateForm {
  const valid =
    form.gateApproverUserId !== null && hasPhases(form, options) && form.members.some(({ userId }) => userId === form.gateApproverUserId);
  return valid || form.gateApproverUserId === null ? form : { ...form, gateApproverUserId: null };
};

/**
 * 템플릿 기본값(운영 방식·액터·기능)을 서버가 허용하는 범위로 줄여 적용한다.
 * 초대한 멤버가 쓰는 액터는 템플릿 기본값에 없어도 남겨 멤버 역할이 사라지지 않게 한다.
 * 단계가 없는 템플릿이 되면 게이트 승인자는 지운다.
 */
export const applyTemplate = function (form: ServerCreateForm, template: ProjectTemplate, options: CreationOptions): ServerCreateForm {
  const found = options.templates.find(({ value }) => value === template);
  const methodologies = selectableMethodologies(options);
  const methodology = found && methodologies.includes(found.defaultMethodology) ? found.defaultMethodology : (methodologies[0] ?? null);
  const actorValues = selectableActors(options).map(({ value }) => value);
  const wanted = new Set<ProjectActor>(["pm", ...(found?.defaultActors ?? []), ...actorsInUse(form)]);
  const actors = actorValues.filter((actor) => wanted.has(actor));
  const allowedFeatures = selectableFeatures(options, hasPhases({ template, methodology }, options));
  const features = (found?.defaultFeatures ?? []).filter((feature) => allowedFeatures.includes(feature));
  return keepValidApprover({ ...form, template, methodology, actors, features }, options);
};

/** 화면 첫 값. 서버가 준 첫 템플릿의 기본값을 쓴다. */
export const initialForm = function (options: CreationOptions, suggestedCode: string): ServerCreateForm {
  const base: ServerCreateForm = {
    name: "",
    code: suggestedCode,
    startDate: "",
    endDate: "",
    visibility: "company",
    template: null,
    methodology: selectableMethodologies(options)[0] ?? null,
    actors: ["pm"],
    features: [],
    departmentIds: [],
    members: [],
    gateApproverUserId: null,
  };
  const first = options.templates[0]?.value;
  return first ? applyTemplate(base, first, options) : base;
};

/** 운영 방식을 바꿔 단계가 없어지면 단계가 필요한 기능(예: 산출물·게이트)을 선택 해제하고 게이트 승인자를 지운다. */
export const changeMethodology = function (form: ServerCreateForm, methodology: MethodKey, options: CreationOptions): ServerCreateForm {
  const allowed = selectableFeatures(options, hasPhases({ template: form.template, methodology }, options));
  return keepValidApprover({ ...form, methodology, features: form.features.filter((feature) => allowed.includes(feature)) }, options);
};

/** PM은 해제할 수 없고, 멤버 역할로 쓰는 액터도 해제할 수 없다(멤버 역할을 먼저 바꾸거나 제외). 막히면 그대로 돌려준다. */
export const toggleActor = function (form: ServerCreateForm, actor: ProjectActor): ServerCreateForm {
  if (!form.actors.includes(actor)) return { ...form, actors: [...form.actors, actor] };
  if (actor === "pm" || actorsInUse(form).has(actor)) return form;
  return { ...form, actors: form.actors.filter((item) => item !== actor) };
};

/** 멤버 역할 선택지: ③에서 지정한 액터 중 PM을 뺀 것(지정하지 않은 액터는 목록에 없다). 서버 선택지 순서를 따른다. */
export const memberRoleOptions = function (form: Pick<ServerCreateForm, "actors">, options: CreationOptions): ProjectActor[] {
  return selectableActors(options)
    .map(({ value }) => value)
    .filter((actor) => actor !== "pm" && form.actors.includes(actor));
};

export const toggleDepartment = function (form: ServerCreateForm, departmentId: number): ServerCreateForm {
  if (form.departmentIds.includes(departmentId)) return { ...form, departmentIds: form.departmentIds.filter((id) => id !== departmentId) };
  if (form.departmentIds.length >= MAX_CREATE_DEPARTMENTS) return form;
  return { ...form, departmentIds: [...form.departmentIds, departmentId] };
};

/** 검색에서 고른 사용자를 첫 역할 선택지로 추가한다. 이미 있거나, 상한이거나, 고를 역할이 없으면 그대로 돌려준다. */
export const addMember = function (
  form: ServerCreateForm,
  user: Pick<CreateMember, "userId" | "name" | "departmentName" | "jobTitle">,
  options: CreationOptions,
): ServerCreateForm {
  const [firstRole] = memberRoleOptions(form, options);
  if (!firstRole || form.members.length >= MAX_CREATE_MEMBERS || form.members.some(({ userId }) => userId === user.userId)) return form;
  return { ...form, members: [...form.members, { ...user, actor: firstRole }] };
};

/** 멤버를 빼면 그 사람이 승인자였을 때 승인자도 지운다. */
export const removeMember = function (form: ServerCreateForm, userId: number): ServerCreateForm {
  return {
    ...form,
    members: form.members.filter((member) => member.userId !== userId),
    gateApproverUserId: form.gateApproverUserId === userId ? null : form.gateApproverUserId,
  };
};

/** 역할은 memberRoleOptions 안에서만 바꾼다. 아니면 그대로 돌려준다. */
export const changeMemberRole = function (form: ServerCreateForm, userId: number, actor: ProjectActor, options: CreationOptions): ServerCreateForm {
  if (!memberRoleOptions(form, options).includes(actor)) return form;
  return { ...form, members: form.members.map((member) => (member.userId === userId ? { ...member, actor } : member)) };
};

/** 게이트 승인자: 단계가 있을 때만, 초대 멤버(PM 아님) 중 한 명. null이면 지정 안 함. 조건에 맞지 않으면 그대로 돌려준다. */
export const setGateApprover = function (form: ServerCreateForm, userId: number | null, options: CreationOptions): ServerCreateForm {
  if (userId === null) return { ...form, gateApproverUserId: null };
  if (!hasPhases(form, options) || !form.members.some((member) => member.userId === userId)) return form;
  return { ...form, gateApproverUserId: userId };
};

export const validateCreateForm = function (form: ServerCreateForm, options: CreationOptions): CreateErrors {
  const errors: CreateErrors = {};
  const name = form.name.trim();
  if (!name) errors.name = PROJECT_CREATE_TEXT.nameRequired;
  else if (name.length > MAX_NAME_LENGTH) errors.name = PROJECT_CREATE_TEXT.nameTooLong;
  const code = form.code.trim();
  if (!code) errors.code = PROJECT_CREATE_TEXT.codeRequired;
  else if (!PROJECT_CODE_PATTERN.test(code)) errors.code = PROJECT_CREATE_TEXT.codeFormat;
  if (form.startDate && form.endDate && form.startDate > form.endDate) errors.period = PROJECT_CREATE_TEXT.periodInvalid;
  if (!form.actors.includes("pm")) errors.actors = PROJECT_CREATE_TEXT.actorsRequired;
  if (form.departmentIds.length > MAX_CREATE_DEPARTMENTS) errors.departments = PROJECT_CREATE_TEXT.departmentsLimit;
  const roles = memberRoleOptions(form, options);
  if (form.members.length > MAX_CREATE_MEMBERS) errors.members = PROJECT_CREATE_TEXT.membersLimit;
  else if (form.members.some(({ actor }) => !roles.includes(actor))) errors.members = PROJECT_CREATE_TEXT.memberRoleInvalid;
  if (form.gateApproverUserId !== null) {
    if (!hasPhases(form, options)) errors.approver = PROJECT_CREATE_TEXT.approverNoPhases;
    else if (!form.members.some(({ userId }) => userId === form.gateApproverUserId)) errors.approver = PROJECT_CREATE_TEXT.approverNotMember;
  }
  return errors;
};

/**
 * 화면 입력 → 생성 요청. 서버 선택지·조회 API로 고른 값만 담는다.
 * 단계는 plannedPhases로 명시하고, 지금 단계 구성에서 쓸 수 없는 기능은 보내지 않는다.
 * 멤버는 BE InitialMemberRequest(userId, actor)만, 승인자는 단계가 있을 때만 보낸다.
 */
export const toCreateInput = function (form: ServerCreateForm, options: CreationOptions): NewProjectInput | null {
  if (!form.template || !form.methodology) return null;
  const phases = plannedPhases(form, options);
  const allowedFeatures = selectableFeatures(options, phases.length > 0);
  const approverIsMember = form.members.some(({ userId }) => userId === form.gateApproverUserId);
  return {
    name: form.name,
    code: form.code,
    startDate: form.startDate || null,
    endDate: form.endDate || null,
    departmentIds: form.departmentIds,
    visibility: form.visibility,
    template: form.template,
    methodology: form.methodology,
    departmentType: "sw",
    actors: form.actors,
    features: form.features.filter((feature) => allowedFeatures.includes(feature)),
    members: form.members.map(({ userId, actor }) => ({ userId, actor })),
    gateApproverUserId: phases.length > 0 && approverIsMember ? form.gateApproverUserId : null,
    phases,
  };
};

export interface CreateFailureView {
  message: string;
  field: CreateField | null;
}

/**
 * 400 메시지 → 관련 입력 칸. 오류 본문에 code가 없어(공통 규약 6절) BE ErrorCode 메시지의 앞부분으로 칸만 정한다.
 * 맞는 것이 없어도 메시지는 그대로 화면 아래에 보인다(칸 연결은 보조 기능).
 */
const FIELD_BY_SERVER_MESSAGE: [prefix: string, field: CreateField][] = [
  ["프로젝트에 지정하지 않은 액터는 멤버 역할로", "members"], // MEMBER_ACTOR_NOT_ASSIGNED
  ["프로젝트 멤버로 초대할 수 없는 사용자", "members"], // INVALID_PROJECT_MEMBER(비활성·관리자 등)
  ["같은 사용자를 멤버로 두 번", "members"], // DUPLICATE_PROJECT_MEMBER
  ["생성자는 PM으로 자동 등록", "members"], // CREATOR_ALREADY_PM
  ["게이트 승인자", "approver"], // GATE_APPROVER_NOT_MEMBER·NOT_AVAILABLE
  ["PM은 게이트 승인자로", "approver"], // GATE_APPROVER_CANNOT_BE_PM
  ["단계가 없는 운영 방식에서는 게이트 승인자", "approver"], // GATE_APPROVER_NOT_AVAILABLE
  ["주관 부서", "departments"], // INVALID_PROJECT_DEPARTMENT·DUPLICATE_PROJECT_DEPARTMENT
  ["같은 주관 부서", "departments"],
];

const fieldOfServerMessage = function (message: string | null): CreateField | null {
  if (!message) return null;
  return FIELD_BY_SERVER_MESSAGE.find(([prefix]) => message.startsWith(prefix))?.[1] ?? null;
};

/**
 * POST /api/projects 실패. 오류 본문에 code가 없어(공통 규약 6절) status로 정한다.
 * 409는 DUPLICATE_PROJECT_CODE뿐이라 코드 칸에, 403은 생성 권한 없음,
 * 400은 서버 검증 메시지(멤버 역할·승인자·주관 부서 거부는 해당 칸에 붙인다).
 */
export const interpretCreateFailure = function (failure: ApiFailure): CreateFailureView {
  if (failure.kind === "timeout") return { message: AUTH_TEXT.timeout, field: null };
  if (failure.kind === "network") return { message: AUTH_TEXT.network, field: null };
  if (failure.kind === "aborted") return { message: "", field: null };
  if (failure.status === 409) return { message: failure.message || PROJECT_CREATE_TEXT.codeTakenGeneric, field: "code" };
  if (failure.status === 403) return { message: PROJECT_CREATE_TEXT.forbidden, field: null };
  if (failure.status === 400 && failure.message) return { message: failure.message, field: fieldOfServerMessage(failure.message) };
  if (failure.status >= 500) return { message: AUTH_TEXT.unknown, field: null };
  return { message: failure.message || AUTH_TEXT.unknown, field: null };
};

/** 조회 실패(생성 선택지·코드 확인) 문구 */
export const lookupFailureMessage = function (failure: ApiFailure): string {
  if (failure.kind === "timeout") return AUTH_TEXT.timeout;
  if (failure.kind === "network") return AUTH_TEXT.network;
  if (failure.kind === "aborted") return "";
  return failure.message || AUTH_TEXT.unknown;
};
