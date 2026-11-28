import type { ApiFailure } from "@/shared/api/client";
import type { ProjectActor } from "@/features/project/api/projectApi";
import type { ApplyDraftBody, DraftInput, DraftMilestone, DraftTask, WbsItem, WbsTaskFields } from "@/features/wbs/api/wbsApi";
import { WBS_DRAFT_TEXT, WBS_FORM_TEXT, WBS_TEXT } from "@/features/wbs/i18n/ko";
import { formatLabel } from "@/shared/i18n/store";

/* =====================================================================
 * 권한 (요구사항 명세서 3.3 WBS-01, BE WbsEditor)
 * 화면 표시용 판단일 뿐이다. 최종 판정은 서버가 하고, 서버가 403을 주면 그 결과를 따른다.
 * ===================================================================== */

export interface WbsViewer {
  /** 서버 사용자 ID */
  userId: number | null;
  /** 이 프로젝트에서의 역할. 멤버가 아니면 null */
  actor: ProjectActor | null;
}

const OWN_TASK_EDITORS: ProjectActor[] = ["dev", "qa"];

export const isWbsPm = (viewer: WbsViewer) => viewer.actor === "pm";

const isOwnTaskEditor = (viewer: WbsViewer, item: WbsItem) =>
  viewer.actor !== null &&
  OWN_TASK_EDITORS.includes(viewer.actor) &&
  viewer.userId !== null &&
  item.assignee?.id === viewer.userId;

/** 최상위 작업 등록·이동·삭제·담당자 변경: PM만 */
export const canManageWbs = isWbsPm;

/** 하위작업 추가: PM이거나 상위 작업을 담당한 개발자·QA. 하위작업 아래에는 만들 수 없다(2단계) */
export const canAddSubtask = (viewer: WbsViewer, parent: WbsItem) =>
  parent.parentTaskId === null && (isWbsPm(viewer) || isOwnTaskEditor(viewer, parent));

/** 기본 필드 수정: PM이거나 그 항목을 담당한 개발자·QA */
export const canEditItem = (viewer: WbsViewer, item: WbsItem) => isWbsPm(viewer) || isOwnTaskEditor(viewer, item);

/** 진척률: 하위작업이 없는 항목만, PM이거나 담당 개발자·QA */
export const canEditProgress = (viewer: WbsViewer, item: WbsItem) => item.subtasks.length === 0 && canEditItem(viewer, item);

/** 개발자·QA가 볼 안내. 현업 담당자·경영진·멤버 아닌 열람자는 조회만 */
export const viewerNote = function (viewer: WbsViewer): string | null {
  if (isWbsPm(viewer)) return null;
  if (viewer.actor !== null && OWN_TASK_EDITORS.includes(viewer.actor)) return WBS_TEXT.memberNote;
  return WBS_TEXT.viewerNote;
};

/* =====================================================================
 * 이동 (PUT .../position). index는 자신을 뺀 형제 목록에서의 위치
 * ===================================================================== */

export const siblingsOf = (tree: WbsItem[], item: WbsItem) =>
  item.parentTaskId === null ? tree.filter((t) => t.phaseId === item.phaseId) : (tree.find((t) => t.id === item.parentTaskId)?.subtasks ?? []);

/**
 * 같은 단계(또는 같은 상위 작업) 안에서 한 칸 위·아래로. 서버의 형제 목록은 단계와 상관없이 최상위 작업 전체라서
 * 화면의 이웃 항목 위치를 서버 형제 목록 기준 index로 바꿔 보낸다. 옮길 수 없으면 null.
 */
export const moveTarget = function (tree: WbsItem[], item: WbsItem, direction: "up" | "down"): { parentTaskId: number | null; index: number } | null {
  const visible = siblingsOf(tree, item);
  const at = visible.findIndex((t) => t.id === item.id);
  const neighbor = visible[direction === "up" ? at - 1 : at + 1];
  if (at < 0 || !neighbor) return null;
  const serverSiblings = (item.parentTaskId === null ? tree : visible).filter((t) => t.id !== item.id);
  const neighborIndex = serverSiblings.findIndex((t) => t.id === neighbor.id);
  return { parentTaskId: item.parentTaskId, index: direction === "up" ? neighborIndex : neighborIndex + 1 };
};

/* =====================================================================
 * 입력 검증 (서버 DTO 제약과 같게)
 * ===================================================================== */

export interface WbsFormValues {
  name: string;
  description: string;
  phaseId: number | null;
  assigneeUserId: number | null;
  startDate: string;
  endDate: string;
  /** 입력칸 그대로(빈 문자열 = 미입력) */
  effort: string;
}

export const EFFORT_PATTERN = /^\d{1,5}(\.\d)?$/;

export const parseEffort = function (raw: string): { ok: true; value: number | null } | { ok: false } {
  const value = raw.trim();
  if (!value) return { ok: true, value: null };
  if (!EFFORT_PATTERN.test(value)) return { ok: false };
  const num = Number(value);
  return num >= 0.1 ? { ok: true, value: num } : { ok: false };
};

export const validateWbsForm = function (values: WbsFormValues): { ok: true; fields: WbsTaskFields } | { ok: false; message: string } {
  const name = values.name.trim();
  if (!name) return { ok: false, message: WBS_FORM_TEXT.nameRequired };
  if (name.length > 200) return { ok: false, message: WBS_FORM_TEXT.nameTooLong };
  if (values.description.trim().length > 2000) return { ok: false, message: WBS_FORM_TEXT.descriptionTooLong };
  if (!values.startDate || !values.endDate) return { ok: false, message: WBS_FORM_TEXT.dateRequired };
  if (values.startDate > values.endDate) return { ok: false, message: WBS_FORM_TEXT.dateOrder };
  const effort = parseEffort(values.effort);
  if (!effort.ok) return { ok: false, message: WBS_FORM_TEXT.effortInvalid };
  return {
    ok: true,
    fields: {
      name,
      description: values.description,
      assigneeUserId: values.assigneeUserId,
      startDate: values.startDate,
      endDate: values.endDate,
      estimatedEffort: effort.value,
    },
  };
};

export const parseProgress = function (raw: string): number | null {
  const value = raw.trim();
  if (!/^\d{1,3}$/.test(value)) return null;
  const num = Number(value);
  return num <= 100 ? num : null;
};

/* =====================================================================
 * 실패 해석. 오류 본문에 code가 없어(공통 규약 6절) API마다 HTTP status로 정한다.
 * 한 status에 여러 상황이 있는 400은 서버 메시지를 보여 준다.
 * ===================================================================== */

export type WbsAction = "load" | "create" | "update" | "move" | "delete" | "progress";

export interface WbsFailureView {
  message: string;
  /** 서버의 최신 트리를 다시 받아야 하는지(권한·version·대상 변화) */
  reload: boolean;
}

/** 네트워크·timeout·5xx 등 API와 상관없는 공통 실패 문구 */
export const commonMessage = function (failure: ApiFailure): string {
  if (failure.kind === "network") return WBS_TEXT.network;
  if (failure.kind === "timeout") return WBS_TEXT.timeout;
  if (failure.kind === "http" && failure.status >= 500) return WBS_TEXT.serverError;
  return WBS_TEXT.unknown;
};

export const interpretWbsFailure = function (action: WbsAction, failure: ApiFailure): WbsFailureView {
  if (failure.kind !== "http") return { message: commonMessage(failure), reload: false };
  const { status } = failure;
  if (action === "load") {
    // 404: PROJECT_NOT_FOUND·FEATURE_DISABLED — 화면이 따로 안내한다
    return { message: status === 404 ? WBS_TEXT.unavailable : commonMessage(failure), reload: false };
  }
  if (status === 400) return { message: failure.message || WBS_TEXT.invalid, reload: false };
  // 403: PROJECT_PM_ONLY·WBS_TASK_ASSIGNEE_ONLY — 역할·담당이 바뀌었을 수 있다
  if (status === 403) return { message: WBS_TEXT.forbidden, reload: true };
  // 404: WBS_TASK_NOT_FOUND·PROJECT_PHASE_NOT_FOUND 등 — 다른 사용자가 지웠을 수 있다
  if (status === 404) return { message: WBS_TEXT.notFound, reload: true };
  if (status === 409) {
    if (action === "delete") return { message: WBS_TEXT.inUse, reload: true };
    if (action === "create") return { message: WBS_TEXT.limitExceeded, reload: false };
    // update·move·progress: CONCURRENT_MODIFICATION
    return { message: WBS_TEXT.concurrent, reload: true };
  }
  return { message: commonMessage(failure), reload: false };
};

/* =====================================================================
 * AI 초안
 * ===================================================================== */

export const validateDraftInput = function (input: DraftInput): string | null {
  const purpose = input.projectPurpose.trim();
  const requirements = input.requirementsText.trim();
  if (!purpose && !requirements) return WBS_DRAFT_TEXT.inputRequired;
  if (purpose.length > 2000) return WBS_DRAFT_TEXT.purposeTooLong;
  if (requirements.length > 20000) return WBS_DRAFT_TEXT.requirementsTooLong;
  const constraints = input.constraints.map((c) => c.trim()).filter(Boolean);
  if (constraints.length > 20 || constraints.some((c) => c.length > 200)) return WBS_DRAFT_TEXT.constraintsInvalid;
  if (input.userInstruction.trim().length > 1000) return WBS_DRAFT_TEXT.instructionTooLong;
  return null;
};

export type DraftAction = "generate" | "apply";

export interface DraftFailureView {
  message: string;
  /** 초안을 버리고 다시 만들어야 하는지(토큰 만료·이미 반영) */
  discardDraft: boolean;
}

export const interpretDraftFailure = function (action: DraftAction, failure: ApiFailure): DraftFailureView {
  if (failure.kind !== "http") return { message: commonMessage(failure), discardDraft: false };
  const { status } = failure;
  if (status === 400) return { message: failure.message || WBS_TEXT.invalid, discardDraft: false };
  if (status === 403) return { message: WBS_DRAFT_TEXT.pmOnly, discardDraft: false };
  if (status === 404) {
    // apply의 404는 AI_DRAFT_EXPIRED가 가장 흔하다(PROJECT_NOT_FOUND·FEATURE_DISABLED·PHASES_NOT_AVAILABLE과 status가 같다)
    return action === "apply" ? { message: WBS_DRAFT_TEXT.expired, discardDraft: true } : { message: WBS_DRAFT_TEXT.waterfallOnly, discardDraft: false };
  }
  if (status === 409) {
    return action === "apply" ? { message: WBS_DRAFT_TEXT.alreadyApplied, discardDraft: true } : { message: commonMessage(failure), discardDraft: false };
  }
  if (status === 502) return { message: WBS_DRAFT_TEXT.aiFailed, discardDraft: false };
  if (status === 503) return { message: WBS_DRAFT_TEXT.aiUnavailable, discardDraft: false };
  if (status === 504) return { message: WBS_DRAFT_TEXT.aiTimeout, discardDraft: false };
  return { message: commonMessage(failure), discardDraft: false };
};

/** 검토 화면에서 PM이 고르고 고친 작업 */
export interface ReviewTask extends DraftTask {
  selected: boolean;
  /** 반영할 담당자(프로젝트 멤버만) */
  assigneeUserId: number | null;
}

export interface ReviewMilestone extends DraftMilestone {
  selected: boolean;
}

/**
 * AI 제안을 검토 상태로. AI 값은 신뢰하지 않는다:
 * - 단계는 프로젝트에 있는 단계만, 없으면 첫 단계
 * - 담당자는 프로젝트 멤버일 때만 미리 채운다
 * 처음에는 아무것도 선택하지 않는다(PM이 직접 승인, NFR-07·08).
 */
export const toReview = function ({
  tasks,
  milestones,
  phaseIds,
  memberIds,
}: {
  tasks: DraftTask[];
  milestones: DraftMilestone[];
  phaseIds: number[];
  memberIds: number[];
}): { tasks: ReviewTask[]; milestones: ReviewMilestone[] } {
  const firstPhase = phaseIds[0] ?? null;
  return {
    tasks: tasks.map((task) => ({
      ...task,
      phaseId: task.phaseId !== null && phaseIds.includes(task.phaseId) ? task.phaseId : firstPhase,
      assigneeUserId: task.suggestedAssigneeId !== null && memberIds.includes(task.suggestedAssigneeId) ? task.suggestedAssigneeId : null,
      selected: false,
    })),
    milestones: milestones.map((m) => ({ ...m, selected: false })),
  };
};

/**
 * 선택한 항목만 반영 요청으로. 선택하지 않은 작업을 가리키는 선행·마일스톤 연결은 뺀다
 * (서버는 요청에 없는 tempId를 400 INVALID_WBS_DRAFT_REFERENCE로 거부한다).
 */
export const buildApplyBody = function ({
  draftToken,
  tasks,
  milestones,
}: {
  draftToken: string;
  tasks: ReviewTask[];
  milestones: ReviewMilestone[];
}): { ok: true; body: ApplyDraftBody } | { ok: false; message: string } {
  const chosenTasks = tasks.filter((t) => t.selected);
  const chosenMilestones = milestones.filter((m) => m.selected);
  if (chosenTasks.length === 0 && chosenMilestones.length === 0) return { ok: false, message: WBS_DRAFT_TEXT.nothingSelected };
  for (const task of chosenTasks) {
    if (!task.name.trim()) return { ok: false, message: WBS_DRAFT_TEXT.taskNameRequired };
    if (!task.startDate || !task.endDate) return { ok: false, message: formatLabel(WBS_DRAFT_TEXT.taskDateRequired, { name: task.name.trim() }) };
    if (task.startDate > task.endDate) return { ok: false, message: formatLabel(WBS_DRAFT_TEXT.taskDateOrder, { name: task.name.trim() }) };
  }
  for (const milestone of chosenMilestones) {
    if (!milestone.targetDate) return { ok: false, message: formatLabel(WBS_DRAFT_TEXT.milestoneDateRequired, { name: milestone.name.trim() }) };
  }
  const chosenIds = new Set(chosenTasks.map((t) => t.tempId));
  return {
    ok: true,
    body: {
      draftToken,
      tasks: chosenTasks.map((task) => ({
        tempId: task.tempId,
        phaseId: task.phaseId,
        name: task.name.trim(),
        description: task.description.trim() || null,
        startDate: task.startDate,
        endDate: task.endDate,
        estimatedPersonDays: task.estimatedPersonDays,
        assigneeUserId: task.assigneeUserId,
        dependencies: task.dependencies.filter((id) => id !== task.tempId && chosenIds.has(id)),
        subtasks: task.subtasks
          .filter((s) => s.name.trim())
          .map((s) => ({
            tempId: s.tempId,
            name: s.name.trim(),
            description: s.description.trim() || null,
            startDate: null,
            endDate: null,
            estimatedPersonDays: s.estimatedPersonDays,
            assigneeUserId: null,
          })),
      })),
      milestones: chosenMilestones.map((m) => ({
        tempId: m.tempId,
        name: m.name.trim(),
        targetDate: m.targetDate,
        relatedTaskIds: m.relatedTaskIds.filter((id) => chosenIds.has(id)),
      })),
      rejectedCount: Math.min(1000, tasks.length - chosenTasks.length + (milestones.length - chosenMilestones.length)),
    },
  };
};
