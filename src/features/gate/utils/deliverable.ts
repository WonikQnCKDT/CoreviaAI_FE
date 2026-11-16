import type { Deliverable, DeliverableStatus, StageKey } from "@/types";
import { STAGES } from "@/utils/ui";

export const DELIVERABLE_STATUS_LABEL: Record<DeliverableStatus, string> = {
  pending: "미제출",
  submitted: "검수 대기",
  approved: "승인",
  rejected: "반려",
};

export const DELIVERABLE_STATUS_CLASS: Record<DeliverableStatus, string> = {
  pending: "bg-background-100 text-foreground-500 border-background-300",
  submitted: "bg-primary-50 text-primary-700 border-primary-200",
  approved: "bg-emerald-50 text-emerald-700 border-emerald-200",
  rejected: "bg-rose-50 text-rose-700 border-rose-200",
};

export function nextStage(stage: StageKey): StageKey | null {
  const index = STAGES.findIndex((s) => s.key === stage);
  if (index < 0 || index >= STAGES.length - 1) return null;
  return STAGES[index + 1].key;
}

/** 현재 단계에서 다음 단계로 넘어가기 위해 승인이 필요한 산출물 */
export function blockingDeliverables(
  projectId: string,
  stage: StageKey,
  deliverables: Deliverable[],
): Deliverable[] {
  return deliverables.filter(
    (d) => d.projectId === projectId && d.stage === stage && d.required && d.status !== "approved",
  );
}

export function bumpVersion(current: string): string {
  if (!current || current === "-") return "v1.0";
  const match = current.match(/^v(\d+)\.(\d+)$/);
  if (!match) return "v1.0";
  const major = Number(match[1]);
  const minor = Number(match[2]);
  return `v${major}.${minor + 1}`;
}