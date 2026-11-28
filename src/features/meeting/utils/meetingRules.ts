import type { ApiFailure } from "@/shared/api/client";
import type { MeetingDetail, MeetingInput } from "@/features/meeting/api/meetingApi";
import { MEETING_FORM_TEXT, MEETING_TEXT } from "@/features/meeting/i18n/ko";
import { kstDateOf, kstInstant, kstTimeOf } from "@/features/mywork/utils/scheduleRules";
import type { WbsViewer } from "@/features/wbs/utils/wbsRules";

/* =====================================================================
 * 권한 (BE MeetingAccessPolicy): 조회는 프로젝트를 볼 수 있으면, 작성은 멤버, 수정·삭제는 작성자 또는 PM.
 * 화면 표시용이다. 최종 판정은 서버가 하고 403이면 그 결과를 따른다.
 * ===================================================================== */

export const canCreateMeeting = (viewer: WbsViewer) => viewer.actor !== null;

export const canEditMeeting = (viewer: WbsViewer, meeting: Pick<MeetingDetail, "authorUserId">) =>
  viewer.actor !== null && viewer.userId !== null && (viewer.actor === "pm" || meeting.authorUserId === viewer.userId);

/**
 * AI 출처 결정사항, AI 출처·업무 전환/제외된 액션아이템이 있으면 서버가 수정·삭제를 409(MEETING_ITEMS_PROTECTED)로 막는다.
 * 수정은 배열 전체 교체라 이 항목들을 지우게 되므로 화면에서도 막는다.
 */
export const isProtectedMeeting = (meeting: Pick<MeetingDetail, "decisions" | "actionItems">) =>
  meeting.decisions.some((d) => d.source === "ai") || meeting.actionItems.some((a) => a.source === "ai" || a.status !== "open");

/* =====================================================================
 * 폼 (서버 CreateMeetingRequest 제약과 같게)
 * ===================================================================== */

export interface ActionRow {
  content: string;
  assigneeUserId: number | null;
  dueDate: string;
}

export interface MeetingForm {
  title: string;
  date: string;
  time: string;
  content: string;
  memberIds: number[];
  /** 한 줄에 한 명 */
  externals: string;
  decisions: string[];
  actions: ActionRow[];
}

const MAX_ITEMS = 100;

export const emptyMeetingForm = (date: string): MeetingForm => ({
  title: "",
  date,
  time: "10:00",
  content: "",
  memberIds: [],
  externals: "",
  decisions: [""],
  actions: [],
});

export const formFromMeeting = (meeting: MeetingDetail): MeetingForm => ({
  title: meeting.title,
  date: kstDateOf(meeting.heldAt),
  time: kstTimeOf(meeting.heldAt),
  content: meeting.content,
  memberIds: meeting.attendees.filter((a) => !a.external && a.userId !== null).map((a) => a.userId as number),
  externals: meeting.attendees.filter((a) => a.external).map((a) => a.name).join("\n"),
  decisions: meeting.decisions.length > 0 ? meeting.decisions.map((d) => d.content) : [""],
  actions: meeting.actionItems.map((a) => ({ content: a.content, assigneeUserId: a.assigneeUserId, dueDate: a.dueDate ?? "" })),
});

/**
 * 폼 → 요청. 빈 결정사항 줄은 뺀다. 담당자·사내 참석자는 화면이 서버 멤버 목록에서만 고르게 한다.
 * memberIds는 서버 멤버 ID 목록(allowedUserIds)에 있는 것만 보낸다.
 */
export const validateMeetingForm = function (form: MeetingForm, allowedUserIds: number[]): { ok: true; input: MeetingInput } | { ok: false; message: string } {
  if (!form.title.trim()) return { ok: false, message: MEETING_FORM_TEXT.titleRequired };
  if (form.title.length > 200) return { ok: false, message: MEETING_FORM_TEXT.titleTooLong };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(form.date) || !/^([01]\d|2[0-3]):[0-5]\d$/.test(form.time)) return { ok: false, message: MEETING_FORM_TEXT.dateRequired };
  if (form.content.length > 50000) return { ok: false, message: MEETING_FORM_TEXT.contentTooLong };

  const allowed = new Set(allowedUserIds);
  const memberIds = [...new Set(form.memberIds)].filter((id) => allowed.has(id));
  const externals = form.externals.split("\n").map((n) => n.trim()).filter(Boolean);
  if (externals.some((n) => n.length > 50)) return { ok: false, message: MEETING_FORM_TEXT.externalTooLong };
  if (new Set(externals).size !== externals.length) return { ok: false, message: MEETING_FORM_TEXT.duplicateAttendee };

  const decisions = form.decisions.filter((d) => d.trim());
  if (decisions.some((d) => d.length > 1000)) return { ok: false, message: MEETING_FORM_TEXT.decisionTooLong };

  if (form.actions.some((a) => !a.content.trim())) return { ok: false, message: MEETING_FORM_TEXT.actionRequired };
  if (form.actions.some((a) => a.content.length > 1000)) return { ok: false, message: MEETING_FORM_TEXT.actionTooLong };

  const attendees = [...memberIds.map((userId) => ({ userId })), ...externals.map((externalName) => ({ externalName }))];
  if (attendees.length > MAX_ITEMS || decisions.length > MAX_ITEMS || form.actions.length > MAX_ITEMS) return { ok: false, message: MEETING_FORM_TEXT.tooMany };

  return {
    ok: true,
    input: {
      title: form.title.trim(),
      heldAt: kstInstant(form.date, form.time),
      content: form.content,
      attendees,
      decisions,
      actionItems: form.actions.map((a) => ({
        content: a.content.trim(),
        assigneeUserId: a.assigneeUserId !== null && allowed.has(a.assigneeUserId) ? a.assigneeUserId : null,
        dueDate: /^\d{4}-\d{2}-\d{2}$/.test(a.dueDate) ? a.dueDate : null,
      })),
    },
  };
};

/** 같은 입력의 재시도면 같은 requestId(서버가 기존 회의록을 돌려준다), 아니면 새 키 */
export const sameMeetingInput = (a: MeetingInput, b: MeetingInput) => JSON.stringify(a) === JSON.stringify(b);

/* =====================================================================
 * 실패 해석 (status 기준, 오류 본문에 code 없음)
 * ===================================================================== */

export type MeetingAction = "load" | "create" | "update" | "delete";

export interface MeetingFailureView {
  message: string;
  reload: boolean;
  /** 등록: 다음 시도에 새 requestId를 써야 하는지 */
  resetRequest: boolean;
}

const common = function (failure: ApiFailure): string {
  if (failure.kind === "network") return MEETING_TEXT.network;
  if (failure.kind === "timeout") return MEETING_TEXT.timeout;
  if (failure.kind === "http" && failure.status >= 500) return MEETING_TEXT.serverError;
  return MEETING_TEXT.unknown;
};

export const interpretMeetingFailure = function (action: MeetingAction, failure: ApiFailure): MeetingFailureView {
  if (failure.kind !== "http") return { message: common(failure), reload: false, resetRequest: false };
  const { status } = failure;
  if (action === "load") return { message: status === 404 ? MEETING_TEXT.unavailable : common(failure), reload: false, resetRequest: false };
  if (status === 400) return { message: failure.message || MEETING_TEXT.invalid, reload: false, resetRequest: action === "create" };
  if (status === 403) return { message: MEETING_TEXT.forbidden, reload: true, resetRequest: action === "create" };
  if (status === 404) return { message: MEETING_TEXT.notFound, reload: true, resetRequest: false };
  if (status === 409) {
    // 등록: MEETING_REQUEST_CONFLICT·MEETING_REQUEST_DELETED / 삭제: MEETING_ITEMS_PROTECTED / 수정: CONCURRENT_MODIFICATION·MEETING_ITEMS_PROTECTED
    if (action === "create") return { message: MEETING_TEXT.createConflict, reload: true, resetRequest: true };
    if (action === "delete") return { message: MEETING_TEXT.protected, reload: true, resetRequest: false };
    return { message: MEETING_TEXT.concurrent, reload: true, resetRequest: false };
  }
  return { message: common(failure), reload: false, resetRequest: false };
};
