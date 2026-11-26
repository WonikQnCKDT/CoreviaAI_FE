import type { Issue, Project, RoleKey, Task, User } from "@/types";
import { isAssignedTo } from "@/utils/assignee";

export const SYSTEM_ROLE_LABEL = {
  user: "일반 사용자",
  exec: "경영진",
  admin: "시스템 관리자",
} as const;

export function isSystemAdmin(user: User | undefined | null): boolean {
  return Boolean(user && user.systemRole === "admin");
}

export function isExecutive(user: User | undefined | null): boolean {
  return Boolean(user && user.systemRole === "exec");
}

export function isActive(user: User | undefined | null): boolean {
  return Boolean(user && user.active);
}

export function projectRole(project: Project | undefined | null, userId: string | undefined): RoleKey | null {
  if (!project || !userId) return null;
  return project.members.find((m) => m.userId === userId)?.role ?? null;
}

export function isProjectMember(project: Project | undefined | null, userId: string | undefined): boolean {
  return projectRole(project, userId) !== null;
}

export function isProjectPm(project: Project | undefined | null, userId: string | undefined): boolean {
  return projectRole(project, userId) === "pm";
}

/**
 * 프로젝트 조회 범위.
 * - 멤버는 항상 조회할 수 있습니다.
 * - 시스템 관리자라도 프로젝트 역할이 없으면 기본 조회 규칙만 적용됩니다.
 * - 경영진은 소속(scopeDepts) 범위의 프로젝트를 읽기 전용으로 조회합니다.
 */
export function canViewProject(project: Project | undefined | null, user: User | undefined | null): boolean {
  if (!project || !user || !user.active) return false;
  if (isProjectMember(project, user.id)) return true;
  if (project.visibility === "members") return false;

  if (isExecutive(user)) {
    const scope = user.scopeDepts && user.scopeDepts.length > 0 ? user.scopeDepts : [user.dept];
    return scope.includes(project.dept);
  }
  if (project.visibility === "company") return true;
  return project.dept === user.dept;
}

/** 경영진은 읽기 전용이므로 어떤 편집 권한도 갖지 않습니다. */
export function canEditProject(project: Project | undefined | null, user: User | undefined | null): boolean {
  if (!project || !user || isExecutive(user)) return false;
  return isProjectPm(project, user.id);
}

export function canManageMembers(project: Project | undefined | null, user: User | undefined | null): boolean {
  return canEditProject(project, user);
}

/** WBS 편집(업무 추가·삭제·일정/계층 변경)은 PM만 수행합니다. */
export function canEditWbs(project: Project | undefined | null, user: User | undefined | null): boolean {
  return canEditProject(project, user);
}

/** 개발자·QA는 본인 담당 업무만 수정하고 진척을 입력할 수 있습니다. */
export function canEditTask(
  project: Project | undefined | null,
  task: Task | undefined | null,
  user: User | undefined | null,
): boolean {
  if (!project || !task || !user || isExecutive(user)) return false;
  const role = projectRole(project, user.id);
  if (role === "pm") return true;
  if (role === "dev" || role === "qa") return isAssignedTo(task, user.id);
  return false;
}

/** 하위작업 추가: PM은 전체, 개발자·QA는 본인 담당 업무에만 가능합니다. */
export function canAddSubtask(
  project: Project | undefined | null,
  parentTask: Task | undefined | null,
  user: User | undefined | null,
): boolean {
  if (!project || !user || isExecutive(user)) return false;
  const role = projectRole(project, user.id);
  if (role === "pm") return true;
  if (role === "dev" || role === "qa") return isAssignedTo(parentTask, user.id);
  return false;
}

/** 칸반 상태 변경: PM 전체, 개발자·QA 본인 담당 업무만 가능합니다. */
export function canChangeTaskStatus(
  project: Project | undefined | null,
  task: Task | undefined | null,
  user: User | undefined | null,
): boolean {
  return canEditTask(project, task, user);
}

/** AI 리스크 대응 제안 승인은 PM만 가능합니다. */
export function canApproveRisk(project: Project | undefined | null, user: User | undefined | null): boolean {
  return canEditProject(project, user) && !isExecutive(user);
}

/**
 * 산출물 승인·반려는 해당 게이트에 지정된 승인자만 가능합니다.
 * 직무(현업 담당자 등)를 이유로 자동 부여하지 않으며,
 * 승인자 미지정 상태에서는 누구도 승인할 수 없습니다(자동 승인 없음).
 */
export function canReviewDeliverable(
  project: Project | undefined | null,
  user: User | undefined | null,
  gateApproverId?: string | null,
): boolean {
  if (!project || !user || isExecutive(user)) return false;
  if (!gateApproverId) return false;
  if (gateApproverId === project.pmId) return false;
  return gateApproverId === user.id;
}

/** 게이트 승인자 지정·변경은 현재 PM만 수행합니다. */
export function canAssignGateApprover(
  project: Project | undefined | null,
  user: User | undefined | null,
): boolean {
  return canEditProject(project, user);
}

/** 단계 전환(게이트 실행)은 PM만 가능합니다. */
export function canTransitionStage(project: Project | undefined | null, user: User | undefined | null): boolean {
  return canEditProject(project, user);
}

/** 결함 검증·종결은 QA, 일반 이슈·요청 종결은 PM만 가능합니다. */
export function canAdvanceIssue(
  project: Project | undefined | null,
  issue: Issue | undefined | null,
  user: User | undefined | null,
): boolean {
  if (!project || !issue || !user || isExecutive(user)) return false;
  const role = projectRole(project, user.id);
  if (role === "pm") return true;
  if (issue.kind === "defect") {
    if (issue.status === "verifying" || issue.status === "fixing") return role === "qa";
    if (issue.status === "confirmed") return role === "qa" || issue.assigneeId === user.id;
    return issue.assigneeId === user.id;
  }
  if (issue.status === "closed") return false;
  if (role === "qa") return true;
  return issue.assigneeId === user.id;
}

export function canReopenIssue(
  project: Project | undefined | null,
  issue: Issue | undefined | null,
  user: User | undefined | null,
): boolean {
  if (!project || !issue || !user || isExecutive(user)) return false;
  if (projectRole(project, user.id) === "pm") return true;
  if (projectRole(project, user.id) === "qa" && issue.kind === "defect") return true;
  return issue.reporterId === user.id;
}

/** 포트폴리오: PM이 하나 이상 있거나 경영진인 경우 조회합니다. */
export function canViewPortfolio(projects: Project[], user: User | undefined | null): boolean {
  if (!user || !user.active) return false;
  if (isExecutive(user)) return true;
  return projects.some((project) => projectRole(project, user.id) === "pm");
}

/** 경영진에게는 개인 단위 업무량·일지·순위를 노출하지 않습니다. */
export function canViewIndividualWorkload(user: User | undefined | null): boolean {
  return !isExecutive(user);
}

/** 개인 TODO·일정은 본인만 조회합니다. */
export function canViewPersonalWork(targetUserId: string, viewer: User | undefined | null): boolean {
  return Boolean(viewer && viewer.id === targetUserId);
}

/** 업무일지는 본인만 조회하고, PM은 연결된 업무 항목에 한해서만 확인합니다. */
export function canViewJournal(
  journalUserId: string,
  viewer: User | undefined | null,
  isLinkedTaskOfViewersProject: boolean,
): boolean {
  if (!viewer) return false;
  if (journalUserId === viewer.id) return true;
  return isLinkedTaskOfViewersProject;
}

/**
 * 프로젝트 생성(FR-PRJ-01, 권한 매트릭스 3.3 PRJ-01): 별도 생성 권한 없이 활성 일반 사용자 전원이 만들 수 있다.
 * 경영진은 조회만, 시스템 관리자는 프로젝트 데이터에 접근하지 않는다. 최종 판단은 서버가 한다(403 PROJECT_CREATION_FORBIDDEN).
 */
export function canCreateProject(user: User | undefined | null): boolean {
  return Boolean(user && user.active && user.systemRole === "user");
}

export function canUseSystemAdmin(user: User | undefined | null): boolean {
  return isSystemAdmin(user);
}

/** 프로젝트에서 수행 가능한 역할 목록(액터 지정 결과)을 반환합니다. */
export function availableRoles(project: Project): RoleKey[] {
  return project.actors;
}