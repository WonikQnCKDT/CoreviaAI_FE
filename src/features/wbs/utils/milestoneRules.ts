import type { ApiFailure } from "@/shared/api/client";
import type { Milestone } from "@/features/wbs/api/milestoneApi";
import { MILESTONE_TEXT } from "@/features/wbs/i18n/ko";
import { commonMessage, isWbsPm, type WbsViewer } from "@/features/wbs/utils/wbsRules";
import { formatLabel } from "@/shared/i18n/store";

/* =====================================================================
 * 권한 (요구사항 명세서 3.3 WBS-04: PM C·U·D, 그 외 R, BE MilestoneService.requirePm)
 * 화면 표시용 판단일 뿐이다. 최종 판정은 서버가 한다.
 * ===================================================================== */

export const canManageMilestones = (viewer: WbsViewer) => isWbsPm(viewer);

/* =====================================================================
 * D-day 표기. 서버가 준 dDay(목표일 - 오늘, Asia/Seoul)를 그대로 쓴다. FE에서 날짜를 다시 빼지 않는다.
 * ===================================================================== */

export const dDayLabel = function (dDay: number | null): string {
  if (dDay === null || !Number.isInteger(dDay)) return MILESTONE_TEXT.dDayUnknown;
  if (dDay === 0) return MILESTONE_TEXT.dDayToday;
  return dDay > 0 ? formatLabel(MILESTONE_TEXT.dDayLeft, { days: dDay }) : formatLabel(MILESTONE_TEXT.dDayPassed, { days: -dDay });
};

/** 배지 색 구분: 지연 경고 > 당일·지난 날 > 남은 날 */
export type MilestoneTone = "delayed" | "due" | "upcoming";

export const milestoneTone = function (milestone: Pick<Milestone, "dDay" | "delayed">): MilestoneTone {
  if (milestone.delayed) return "delayed";
  if (milestone.dDay !== null && milestone.dDay <= 0) return "due";
  return "upcoming";
};

/** 연결 작업 요약. 연결이 없으면 지연 판단 근거가 없다는 안내 */
export const taskSummaryLabel = (milestone: Pick<Milestone, "linkedTaskCount" | "incompleteTaskCount">) =>
  milestone.linkedTaskCount === 0
    ? MILESTONE_TEXT.noTasks
    : formatLabel(MILESTONE_TEXT.taskSummary, { incomplete: milestone.incompleteTaskCount, linked: milestone.linkedTaskCount });

/* =====================================================================
 * 입력 검증 (CreateMilestoneRequest·UpdateMilestoneRequest 제약과 같게)
 * ===================================================================== */

export const MILESTONE_NAME_MAX = 200;

export const validateMilestoneForm = function (values: { name: string; targetDate: string }): { ok: true; name: string } | { ok: false; message: string } {
  const name = values.name.trim();
  if (!name) return { ok: false, message: MILESTONE_TEXT.nameRequired };
  if (name.length > MILESTONE_NAME_MAX) return { ok: false, message: MILESTONE_TEXT.nameTooLong };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(values.targetDate)) return { ok: false, message: MILESTONE_TEXT.dateRequired };
  return { ok: true, name };
};

/* =====================================================================
 * 실패 해석. 오류 본문에 code가 없어 HTTP status로 정한다(wbsRules와 같은 방식).
 * ===================================================================== */

export type MilestoneAction = "load" | "create" | "update" | "tasks" | "delete";

export interface MilestoneFailureView {
  message: string;
  /** 서버의 최신 마일스톤 목록을 다시 받아야 하는지(권한·version·대상 변화) */
  reload: boolean;
}

export const interpretMilestoneFailure = function (action: MilestoneAction, failure: ApiFailure): MilestoneFailureView {
  if (failure.kind !== "http") return { message: commonMessage(failure), reload: false };
  const { status } = failure;
  if (action === "load") {
    // 404: PROJECT_NOT_FOUND·FEATURE_DISABLED(WBS 기능 꺼짐)
    return { message: status === 404 ? MILESTONE_TEXT.unavailable : commonMessage(failure), reload: false };
  }
  // 400: 이름·목표일(프로젝트 기간 밖)·연결 작업(INVALID_MILESTONE_TASK) 등 상황이 여럿이라 서버 메시지를 보여 준다
  if (status === 400) return { message: failure.message || MILESTONE_TEXT.invalid, reload: false };
  // 403: PROJECT_PM_ONLY — 역할이 바뀌었을 수 있다
  if (status === 403) return { message: MILESTONE_TEXT.pmOnly, reload: true };
  // 404: MILESTONE_NOT_FOUND 등 — 다른 사용자가 지웠을 수 있다
  if (status === 404) return { message: MILESTONE_TEXT.notFound, reload: true };
  if (status === 409) {
    // create: MILESTONE_LIMIT_EXCEEDED, update·tasks: CONCURRENT_MODIFICATION
    return action === "create" ? { message: MILESTONE_TEXT.limitExceeded, reload: false } : { message: MILESTONE_TEXT.concurrent, reload: true };
  }
  return { message: commonMessage(failure), reload: false };
};
