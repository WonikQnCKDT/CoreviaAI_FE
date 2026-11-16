import type { Deliverable, GateRecord, Project, StageKey, User } from "@/types";
import { STAGES } from "@/utils/ui";

export type GateStateKey = "unassigned" | "waiting" | "rejected" | "ready" | "approved" | "in_progress";

export interface GateStateMeta {
  key: GateStateKey;
  label: string;
  className: string;
}

export const GATE_STATE_CLASS: Record<GateStateKey, string> = {
  unassigned: "border-rose-200 bg-rose-50 text-rose-700",
  waiting: "border-primary-200 bg-primary-50 text-primary-700",
  rejected: "border-rose-200 bg-rose-50 text-rose-700",
  ready: "border-emerald-200 bg-emerald-50 text-emerald-700",
  approved: "border-emerald-200 bg-emerald-50 text-emerald-700",
  in_progress: "border-background-300 bg-background-100 text-foreground-600",
};

/**
 * 단계(게이트)에 실제로 지정된 승인자를 반환합니다.
 * - 직무·역할로 자동 지정하지 않습니다. 지정된 값만 사용합니다.
 * - 현재 PM은 승인자가 될 수 없으므로 미지정으로 취급합니다.
 * - 프로젝트 멤버가 아닌 사용자도 승인자로 인정하지 않습니다.
 * - 승인자가 없으면 null이며, 자동 승인으로 처리하지 않습니다.
 */
export function gateApproverId(
  project: Project | null | undefined,
  stage: StageKey,
  deliverable?: Deliverable | null,
): string | null {
  if (!project) return null;
  const raw = project.gateApprovers?.[stage] || deliverable?.gateApproverId || null;
  if (!raw) return null;
  if (raw === project.pmId) return null;
  if (!project.members.some((member) => member.userId === raw)) return null;
  return raw;
}

export interface GateStageInfo {
  stage: StageKey;
  label: string;
  approverId: string | null;
  approver: User | null;
  state: GateStateMeta;
  requiredTotal: number;
  approvedCount: number;
  pendingCount: number;
  rejectedCount: number;
  decided: boolean;
  isCurrent: boolean;
}

/** 단계별 승인자와 승인 상태를 한 번에 계산합니다. */
export function gateStageInfo(
  project: Project,
  stage: StageKey,
  deliverables: Deliverable[],
  gateRecords: GateRecord[],
  users: User[],
): GateStageInfo {
  const stageItems = deliverables.filter((d) => d.projectId === project.id && d.stage === stage);
  const requiredItems = stageItems.filter((d) => d.required);
  const approvedCount = requiredItems.filter((d) => d.status === "approved").length;
  const pendingCount = stageItems.filter((d) => d.status === "submitted").length;
  const rejectedCount = stageItems.filter((d) => d.status === "rejected").length;
  const approverId = gateApproverId(project, stage);
  const decided = gateRecords.some(
    (record) => record.projectId === project.id && record.stage === stage && record.decision === "approved",
  );

  let state: GateStateMeta;
  if (decided) {
    state = { key: "approved", label: "승인 완료", className: GATE_STATE_CLASS.approved };
  } else if (!approverId) {
    state = { key: "unassigned", label: "승인자 미지정", className: GATE_STATE_CLASS.unassigned };
  } else if (pendingCount > 0) {
    state = { key: "waiting", label: `검수 대기 ${pendingCount}건`, className: GATE_STATE_CLASS.waiting };
  } else if (rejectedCount > 0) {
    state = { key: "rejected", label: `반려 ${rejectedCount}건`, className: GATE_STATE_CLASS.rejected };
  } else if (requiredItems.length > 0 && approvedCount === requiredItems.length) {
    state = { key: "ready", label: "전환 가능", className: GATE_STATE_CLASS.ready };
  } else {
    state = { key: "in_progress", label: "진행 중", className: GATE_STATE_CLASS.in_progress };
  }

  return {
    stage,
    label: STAGES.find((item) => item.key === stage)?.label || stage,
    approverId,
    approver: users.find((user) => user.id === approverId) || null,
    state,
    requiredTotal: requiredItems.length,
    approvedCount,
    pendingCount,
    rejectedCount,
    decided,
    isCurrent: project.stage === stage,
  };
}

export function gateStageInfos(
  project: Project,
  deliverables: Deliverable[],
  gateRecords: GateRecord[],
  users: User[],
): GateStageInfo[] {
  return STAGES.map((stage) => gateStageInfo(project, stage.key, deliverables, gateRecords, users));
}

/** 게이트 승인자로 지정할 수 있는 후보 (프로젝트 멤버 중 현재 PM 제외) */
export function gateApproverCandidates(project: Project, users: User[]): User[] {
  return project.members
    .filter((member) => member.userId !== project.pmId)
    .map((member) => users.find((user) => user.id === member.userId))
    .filter((user): user is User => Boolean(user) && Boolean(user?.active));
}

export interface ApprovalRequestItem {
  deliverable: Deliverable;
  project: Project;
  stage: StageKey;
  approverId: string;
  requestedAt: string;
  submittedBy: string | null;
}

/**
 * 나에게 온 승인 요청 목록입니다.
 * 업무 담당자 배정과는 완전히 별개이며, 지정된 게이트 승인자에게만 요청이 표시됩니다.
 */
export function approvalRequestsForUser(
  projects: Project[],
  deliverables: Deliverable[],
  userId: string | undefined,
): ApprovalRequestItem[] {
  if (!userId) return [];
  const result: ApprovalRequestItem[] = [];
  deliverables
    .filter((deliverable) => deliverable.status === "submitted")
    .forEach((deliverable) => {
      const project = projects.find((item) => item.id === deliverable.projectId);
      if (!project) return;
      const approverId = gateApproverId(project, deliverable.stage, deliverable);
      if (approverId !== userId) return;
      const latest = deliverable.versions[deliverable.versions.length - 1];
      result.push({
        deliverable,
        project,
        stage: deliverable.stage,
        approverId,
        requestedAt: latest?.submittedAt || deliverable.plannedDate,
        submittedBy: latest?.submitterId || null,
      });
    });
  return result.sort((a, b) => (a.requestedAt < b.requestedAt ? 1 : -1));
}

export interface GateAssignResult {
  ok: boolean;
  message: string;
}

/** 승인자 지정 값 검증 (PM·비멤버·비활성 계정 차단) */
export function validateGateApprover(
  project: Project,
  users: User[],
  approverId: string,
): GateAssignResult {
  if (approverId === project.pmId) {
    return {
      ok: false,
      message: "현재 PM은 게이트 승인자로 지정할 수 없습니다. 다른 프로젝트 멤버를 선택해 주세요.",
    };
  }
  const member = project.members.find((item) => item.userId === approverId);
  if (!member) {
    return { ok: false, message: "프로젝트 멤버만 게이트 승인자로 지정할 수 있습니다." };
  }
  const user = users.find((item) => item.id === approverId);
  if (!user || !user.active) {
    return { ok: false, message: "비활성화된 계정은 게이트 승인자로 지정할 수 없습니다." };
  }
  return { ok: true, message: "" };
}