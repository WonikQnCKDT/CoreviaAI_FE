import type { Deliverable, DeliverableStatus, StageKey } from "@/types";
import { STAGES } from "@/utils/ui";

/** 산출물 상태 문구는 다국어 라벨 카탈로그에 있다. 기존 import 경로를 유지하려고 다시 내보낸다. */
export { DELIVERABLE_STATUS_LABEL } from "@/shared/i18n/catalog/status";

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