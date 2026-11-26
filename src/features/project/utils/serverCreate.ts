import type { ApiFailure } from "@/shared/api/client";
import {
  PROJECT_CODE_PATTERN,
  type CreationOptions,
  type NewProjectInput,
  type ProjectActor,
  type ProjectFeature,
  type ProjectTemplate,
} from "@/features/project/api/projectApi";
import { PROJECT_CREATE_TEXT, PROJECT_DIRECTORY_TEXT } from "@/features/project/i18n/ko";
import { AUTH_TEXT } from "@/features/auth/i18n/ko";
import type { MethodKey, Visibility } from "@/types";

/**
 * api 모드 프로젝트 생성 규칙 (03. 프로젝트 API v9, FR-PRJ-01).
 * 선택값은 모두 서버가 준 생성 선택지에서만 고른다. 데모 샘플 데이터(부서·사용자 ID)는 쓰지 않는다.
 */

/**
 * 서버에 있는 조회 API. USER가 부를 수 있는 부서 목록·사용자 검색 API가 없어(시스템 관리자 전용만 있음)
 * 주관 부서·멤버·게이트 승인자는 고를 수 없다. 셋 다 선택 항목이라 비운 채로 만든다.
 * 서버에 API가 생기면 여기를 바꾸고 선택 화면을 연결한다.
 */
export const SERVER_DIRECTORY = {
  departments: { available: false, reason: () => PROJECT_DIRECTORY_TEXT.departmentsUnavailable },
  users: { available: false, reason: () => PROJECT_DIRECTORY_TEXT.usersUnavailable },
} as const;

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
}

export type CreateField = "name" | "code" | "period" | "actors";
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

/** 선택한 운영 방식에서 고를 수 있는 기능 */
export const selectableFeatures = function (options: CreationOptions, methodology: MethodKey | null): ProjectFeature[] {
  if (!methodology) return [];
  return options.features.filter(({ enabled, methodologies }) => enabled && methodologies.includes(methodology)).map(({ value }) => value);
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

/** 템플릿 기본값(운영 방식·액터·기능)을 서버가 허용하는 범위로 줄여 적용한다. */
export const applyTemplate = function (form: ServerCreateForm, template: ProjectTemplate, options: CreationOptions): ServerCreateForm {
  const found = options.templates.find(({ value }) => value === template);
  const methodologies = selectableMethodologies(options);
  const methodology = found && methodologies.includes(found.defaultMethodology) ? found.defaultMethodology : (methodologies[0] ?? null);
  const actorValues = selectableActors(options).map(({ value }) => value);
  const actors = [...new Set<ProjectActor>(["pm", ...(found?.defaultActors ?? [])])].filter((actor) => actorValues.includes(actor));
  const allowedFeatures = selectableFeatures(options, methodology);
  const features = (found?.defaultFeatures ?? []).filter((feature) => allowedFeatures.includes(feature));
  return { ...form, template, methodology, actors, features };
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
  };
  const first = options.templates[0]?.value;
  return first ? applyTemplate(base, first, options) : base;
};

/** 운영 방식을 바꾸면 그 방식에서 쓸 수 없는 기능을 뺀다(예: 산출물은 폭포수만). */
export const changeMethodology = function (form: ServerCreateForm, methodology: MethodKey, options: CreationOptions): ServerCreateForm {
  const allowed = selectableFeatures(options, methodology);
  return { ...form, methodology, features: form.features.filter((feature) => allowed.includes(feature)) };
};

export const validateCreateForm = function (form: ServerCreateForm): CreateErrors {
  const errors: CreateErrors = {};
  const name = form.name.trim();
  if (!name) errors.name = PROJECT_CREATE_TEXT.nameRequired;
  else if (name.length > MAX_NAME_LENGTH) errors.name = PROJECT_CREATE_TEXT.nameTooLong;
  const code = form.code.trim();
  if (!code) errors.code = PROJECT_CREATE_TEXT.codeRequired;
  else if (!PROJECT_CODE_PATTERN.test(code)) errors.code = PROJECT_CREATE_TEXT.codeFormat;
  if (form.startDate && form.endDate && form.startDate > form.endDate) errors.period = PROJECT_CREATE_TEXT.periodInvalid;
  if (!form.actors.includes("pm")) errors.actors = PROJECT_CREATE_TEXT.actorsRequired;
  return errors;
};

/**
 * 화면 입력 → 생성 요청. 서버 선택지로 고른 값만 담는다.
 * 부서·멤버·승인자는 조회 API가 없어 항상 비운다(샘플 ID를 서버로 보내지 않는다). 단계는 템플릿 기본값을 따른다.
 */
export const toCreateInput = function (form: ServerCreateForm): NewProjectInput | null {
  if (!form.template || !form.methodology) return null;
  return {
    name: form.name,
    code: form.code,
    startDate: form.startDate || null,
    endDate: form.endDate || null,
    departmentIds: [],
    visibility: form.visibility,
    template: form.template,
    methodology: form.methodology,
    departmentType: "sw",
    actors: form.actors,
    features: form.features,
    members: [],
    gateApproverUserId: null,
  };
};

export interface CreateFailureView {
  message: string;
  field: CreateField | null;
}

/**
 * POST /api/projects 실패. 오류 본문에 code가 없어(공통 규약 6절) status로 정한다.
 * 409는 DUPLICATE_PROJECT_CODE뿐이라 코드 칸에, 403은 생성 권한 없음, 400은 서버 검증 메시지.
 */
export const interpretCreateFailure = function (failure: ApiFailure): CreateFailureView {
  if (failure.kind === "timeout") return { message: AUTH_TEXT.timeout, field: null };
  if (failure.kind === "network") return { message: AUTH_TEXT.network, field: null };
  if (failure.kind === "aborted") return { message: "", field: null };
  if (failure.status === 409) return { message: failure.message || PROJECT_CREATE_TEXT.codeTakenGeneric, field: "code" };
  if (failure.status === 403) return { message: PROJECT_CREATE_TEXT.forbidden, field: null };
  return { message: failure.message || AUTH_TEXT.unknown, field: null };
};

/** 조회 실패(생성 선택지·코드 확인) 문구 */
export const lookupFailureMessage = function (failure: ApiFailure): string {
  if (failure.kind === "timeout") return AUTH_TEXT.timeout;
  if (failure.kind === "network") return AUTH_TEXT.network;
  if (failure.kind === "aborted") return "";
  return failure.message || AUTH_TEXT.unknown;
};
