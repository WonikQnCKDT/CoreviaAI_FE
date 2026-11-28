import type { ApiFailure } from "@/shared/api/client";
import { assignedTasksOf, type AssignedTask } from "@/features/project/api/projectApi";
import { AUTH_TEXT } from "@/features/auth/i18n/ko";
import { PROJECT_MEMBER_TEXT } from "@/features/project/i18n/member";
import type { RoleChangeKind } from "@/features/project/utils/memberRules";

/**
 * 멤버 변경 API 실패 → 화면 동작 (03. 프로젝트 API, FR-PRJ-04).
 * 오류 본문에는 code가 없어(공통 규약 6절) 같은 API 안에서 HTTP status만으로 상황이 하나로 정해질 때만 FE 문구를 쓴다.
 * 한 status에 상황이 여럿이면 서버 메시지를 보여 주고, 없으면 FE 문구를 쓴다. 서버 메시지로 분기하지 않는다.
 */

export interface MemberFailureView {
  message: string;
  /** 화면의 멤버 목록이 낡았을 수 있어 다시 받아야 하는지 */
  stale: boolean;
  /** 제외 409(미완료 담당 업무)일 때 재배정해야 하는 업무 */
  tasks: AssignedTask[];
}

const commonMessage = function (failure: ApiFailure): string | null {
  if (failure.kind === "timeout") return AUTH_TEXT.timeout;
  if (failure.kind === "network") return AUTH_TEXT.network;
  if (failure.kind === "aborted") return "";
  return null;
};

const fallback = function (failure: ApiFailure, text: string) {
  if (failure.kind !== "http") return text;
  return failure.message || text;
};

/** 403 PROJECT_PM_ONLY·404(멤버 또는 프로젝트 없음)는 두 API에서 뜻이 같다. */
const staleView = function (failure: ApiFailure): MemberFailureView | null {
  if (failure.kind !== "http") return null;
  if (failure.status === 403) return { message: PROJECT_MEMBER_TEXT.pmOnly, stale: true, tasks: [] };
  if (failure.status === 404) return { message: PROJECT_MEMBER_TEXT.memberGone, stale: true, tasks: [] };
  return null;
};

const otherView = function (failure: ApiFailure): MemberFailureView {
  return { message: fallback(failure, AUTH_TEXT.unknown), stale: false, tasks: [] };
};

/**
 * PATCH .../members/{userId}/role
 * - 409는 LAST_PM_REQUIRED뿐이다(마지막 PM 해제).
 * - 400은 지정하지 않은 액터·비활성 사용자·게이트 승인자→PM 등 여럿이라 서버 메시지를 쓴다.
 */
export const interpretRoleChangeFailure = function (failure: ApiFailure, kind: RoleChangeKind): MemberFailureView {
  const common = commonMessage(failure);
  if (common !== null) return { message: common, stale: false, tasks: [] };
  const stale = staleView(failure);
  if (stale) return stale;
  if (failure.kind === "http" && failure.status === 409) return { message: PROJECT_MEMBER_TEXT.lastPm, stale: true, tasks: [] };
  if (failure.kind === "http" && failure.status === 400) {
    const text = kind === "pmAdd" ? PROJECT_MEMBER_TEXT.pmTargetRejected : PROJECT_MEMBER_TEXT.roleRejected;
    return { message: fallback(failure, text), stale: false, tasks: [] };
  }
  return otherView(failure);
};

/**
 * DELETE .../members/{userId}
 * - 409 + 업무 목록: MEMBER_HAS_ASSIGNED_TASKS(재배정할 업무를 함께 보여 준다)
 * - 409 그 밖: LAST_PM_REQUIRED 또는 GATE_APPROVER_NOT_REMOVABLE이라 서버 메시지를 쓴다.
 */
export const interpretRemoveFailure = function (failure: ApiFailure): MemberFailureView {
  const common = commonMessage(failure);
  if (common !== null) return { message: common, stale: false, tasks: [] };
  const stale = staleView(failure);
  if (stale) return stale;
  if (failure.kind === "http" && failure.status === 409) {
    const tasks = assignedTasksOf(failure);
    if (tasks.length > 0) return { message: PROJECT_MEMBER_TEXT.hasTasks, stale: false, tasks };
    return { message: fallback(failure, PROJECT_MEMBER_TEXT.removeConflict), stale: true, tasks: [] };
  }
  return otherView(failure);
};

/**
 * POST .../members (한 명이라도 거부되면 아무도 초대하지 않는다)
 * - 409는 ALREADY_PROJECT_MEMBER뿐이다(그 사이 다른 PM이 먼저 초대함) → 목록을 다시 받는다.
 * - 400은 초대할 수 없는 사용자(비활성·경영진·관리자)·PM 역할·지정 외 액터·중복 등 여럿이라 서버 메시지를 쓴다.
 */
export const interpretInviteFailure = function (failure: ApiFailure): MemberFailureView {
  const common = commonMessage(failure);
  if (common !== null) return { message: common, stale: false, tasks: [] };
  const stale = staleView(failure);
  if (stale) return stale;
  if (failure.kind === "http" && failure.status === 409) return { message: PROJECT_MEMBER_TEXT.alreadyMember, stale: true, tasks: [] };
  if (failure.kind === "http" && failure.status === 400) {
    return { message: fallback(failure, PROJECT_MEMBER_TEXT.inviteRejected), stale: false, tasks: [] };
  }
  return otherView(failure);
};

/** 목록·이력 조회 실패 문구 */
export const memberLoadFailureMessage = function (failure: ApiFailure, text: string): string {
  const common = commonMessage(failure);
  if (common !== null) return common;
  return text;
};
