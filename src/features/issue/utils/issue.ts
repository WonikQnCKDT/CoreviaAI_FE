import type { Issue, IssueKind, IssueSeverity, IssueStatus, User } from "@/types";
import { ISSUE_STATUS_LABEL } from "@/shared/i18n/catalog/status";

/** 이슈 문구는 다국어 라벨 카탈로그에 있다. 기존 import 경로를 유지하려고 다시 내보낸다. */
export { ISSUE_KIND_LABEL, ISSUE_SEVERITY_LABEL, ISSUE_STATUS_LABEL } from "@/shared/i18n/catalog/status";

export const ISSUE_KIND_CLASS: Record<IssueKind, string> = {
  defect: "bg-rose-50 text-rose-700 border-rose-200",
  issue: "bg-primary-50 text-primary-700 border-primary-200",
  request: "bg-accent-50 text-accent-700 border-accent-200",
};

export const ISSUE_SEVERITY_CLASS: Record<IssueSeverity, string> = {
  critical: "bg-rose-50 text-rose-700 border-rose-200",
  high: "bg-orange-50 text-orange-700 border-orange-200",
  medium: "bg-amber-50 text-amber-700 border-amber-200",
  low: "bg-background-100 text-foreground-500 border-background-300",
};

export const ISSUE_STATUS_CLASS: Record<IssueStatus, string> = {
  registered: "bg-secondary-100 text-secondary-600 border-secondary-200",
  confirmed: "bg-primary-50 text-primary-700 border-primary-200",
  fixing: "bg-amber-50 text-amber-700 border-amber-200",
  verifying: "bg-accent-50 text-accent-700 border-accent-200",
  closed: "bg-emerald-50 text-emerald-700 border-emerald-200",
};

export const ISSUE_FLOW: IssueStatus[] = ["registered", "confirmed", "fixing", "verifying", "closed"];

export function nextIssueStatus(status: IssueStatus): IssueStatus | null {
  const index = ISSUE_FLOW.indexOf(status);
  if (index < 0 || index >= ISSUE_FLOW.length - 1) return null;
  return ISSUE_FLOW[index + 1];
}

/** 다음 상태로 넘어갈 권한이 있는지 확인합니다. */
export function canMoveIssue(issue: Issue, user: User): { allowed: boolean; reason: string } {
  const next = nextIssueStatus(issue.status);
  if (!next) return { allowed: false, reason: "이미 종결된 이슈입니다." };
  if (next === "verifying" && issue.kind === "defect" && user.role !== "qa") {
    return { allowed: false, reason: "결함 검증은 QA만 수행할 수 있습니다." };
  }
  if (next === "closed") {
    if (issue.kind === "defect" && user.role !== "qa") {
      return { allowed: false, reason: "결함 종결은 QA만 수행할 수 있습니다." };
    }
    if (issue.kind !== "defect" && user.role !== "pm") {
      return { allowed: false, reason: "일반 이슈·요청 종결은 PM만 수행할 수 있습니다." };
    }
  }
  return { allowed: true, reason: "" };
}

export function canReopenIssue(issue: Issue, user: User): boolean {
  if (issue.status !== "closed") return false;
  if (issue.kind === "defect") return user.role === "qa" || user.role === "pm";
  return user.role === "pm";
}