import type { ApiFailure } from "@/shared/api/client";
import type { EventInput, PersonalEvent } from "@/features/mywork/api/scheduleApi";
import { SCHEDULE_TEXT, WORKLOG_TEXT } from "@/features/mywork/i18n/ko";
import { addDays } from "@/utils/date";

/* =====================================================================
 * 한국 날짜·시각. 서버는 업무 기간을 한국 날짜 00:00(+09:00) 기준 종일 항목으로 주고,
 * 오늘도 Asia/Seoul 날짜다. 화면도 같은 기준(+09:00 고정, 한국은 서머타임 없음)으로 바꾼다.
 * ===================================================================== */

const KST_OFFSET_MS = 9 * 60 * 60 * 1000;
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;

const kstShift = (iso: string | Date) => new Date((typeof iso === "string" ? Date.parse(iso) : iso.getTime()) + KST_OFFSET_MS).toISOString();

/** 지금의 한국 날짜 */
export const kstToday = (now: Date = new Date()) => kstShift(now).slice(0, 10);
/** UTC 시각 → 한국 날짜 */
export const kstDateOf = (iso: string) => kstShift(iso).slice(0, 10);
/** UTC 시각 → 한국 시각 HH:mm */
export const kstTimeOf = (iso: string) => kstShift(iso).slice(11, 16);
/** 한국 날짜 00:00 → UTC ISO */
export const kstDayStart = (date: string) => new Date(`${date}T00:00:00+09:00`).toISOString();
/** 한국 날짜·시각 → UTC ISO */
export const kstInstant = (date: string, time: string) => new Date(`${date}T${time}:00+09:00`).toISOString();

/** 그 달의 [1일 00:00, 다음 달 1일 00:00) 한국 기준 범위(UTC ISO) */
export const monthRange = function (year: number, month: number) {
  const first = `${year}-${String(month + 1).padStart(2, "0")}-01`;
  const next = month === 11 ? `${year + 1}-01-01` : `${year}-${String(month + 2).padStart(2, "0")}-01`;
  return { from: kstDayStart(first), to: kstDayStart(next), firstDate: first, nextDate: next };
};

/** 항목이 걸친 한국 날짜 목록(종료는 그 시각 직전까지). 너무 긴 항목은 범위 안으로만 */
export const coveredDates = function ({ startAt, endAt }: { startAt: string; endAt: string }, rangeFrom: string, rangeTo: string): string[] {
  const start = kstDateOf(startAt);
  const lastMs = Date.parse(endAt) - 1;
  if (Number.isNaN(lastMs) || lastMs < Date.parse(startAt)) return [start];
  const end = kstDateOf(new Date(lastMs).toISOString());
  const dates: string[] = [];
  let cursor = start < rangeFrom ? rangeFrom : start;
  const stop = end >= rangeTo ? addDays(rangeTo, -1) : end;
  for (let i = 0; cursor <= stop && i < 400; i += 1) {
    dates.push(cursor);
    cursor = addDays(cursor, 1);
  }
  return dates;
};

/* =====================================================================
 * 개인 일정 폼 (서버 ScheduleRequest: 제목 200자·제어 문자 금지, 메모 2000자, 시작 < 종료)
 * ===================================================================== */

export interface EventForm {
  title: string;
  allDay: boolean;
  startDate: string;
  startTime: string;
  endDate: string;
  endTime: string;
  memo: string;
}

// eslint-disable-next-line no-control-regex
const CONTROL_CHARS = /[\u0000-\u001F\u007F-\u009F]/;

export const emptyEventForm = (date: string): EventForm => ({
  title: "",
  allDay: false,
  startDate: date,
  startTime: "09:00",
  endDate: date,
  endTime: "10:00",
  memo: "",
});

/** 서버 일정 → 폼. 종일 일정의 종료는 '다음 날 00:00'이라 화면에는 그 전날로 보인다 */
export const formFromEvent = (event: PersonalEvent): EventForm => ({
  title: event.title,
  allDay: event.allDay,
  startDate: kstDateOf(event.startAt),
  startTime: kstTimeOf(event.startAt),
  endDate: event.allDay ? kstDateOf(new Date(Date.parse(event.endAt) - 1).toISOString()) : kstDateOf(event.endAt),
  endTime: kstTimeOf(event.endAt),
  memo: event.memo,
});

export const validateEventForm = function (form: EventForm): { ok: true; input: EventInput } | { ok: false; message: string } {
  if (!form.title.trim()) return { ok: false, message: SCHEDULE_TEXT.titleRequired };
  if (form.title.length > 200) return { ok: false, message: SCHEDULE_TEXT.titleTooLong };
  if (CONTROL_CHARS.test(form.title)) return { ok: false, message: SCHEDULE_TEXT.titleControl };
  if (form.memo.length > 2000) return { ok: false, message: SCHEDULE_TEXT.memoTooLong };
  if (!DATE.test(form.startDate) || !DATE.test(form.endDate)) return { ok: false, message: SCHEDULE_TEXT.dateRequired };
  if (!form.allDay && (!TIME.test(form.startTime) || !TIME.test(form.endTime))) return { ok: false, message: SCHEDULE_TEXT.timeRequired };
  const startAt = form.allDay ? kstDayStart(form.startDate) : kstInstant(form.startDate, form.startTime);
  const endAt = form.allDay ? kstDayStart(addDays(form.endDate, 1)) : kstInstant(form.endDate, form.endTime);
  if (Date.parse(startAt) >= Date.parse(endAt)) return { ok: false, message: SCHEDULE_TEXT.periodInvalid };
  return { ok: true, input: { title: form.title.trim(), startAt, endAt, allDay: form.allDay, memo: form.memo } };
};

/* =====================================================================
 * 업무일지 (본문 10,000자, 업무별 진척률 0~100·소요 시간 0~1,440분, 완료는 진척률 100)
 * ===================================================================== */

export const WORKLOG_MAX = 10000;

export interface TaskLogForm {
  content: string;
  progress: string;
  spentMinutes: string;
  completed: boolean;
}

export const validateTaskLog = function (form: TaskLogForm): { ok: true; progress: number; spentMinutes: number } | { ok: false; message: string } {
  if (form.content.length > WORKLOG_MAX) return { ok: false, message: WORKLOG_TEXT.contentTooLong };
  if (!/^\d{1,3}$/.test(form.progress.trim()) || Number(form.progress) > 100) return { ok: false, message: WORKLOG_TEXT.progressInvalid };
  if (!/^\d{1,4}$/.test(form.spentMinutes.trim()) || Number(form.spentMinutes) > 1440) return { ok: false, message: WORKLOG_TEXT.minutesInvalid };
  const progress = Number(form.progress);
  if (form.completed && progress !== 100) return { ok: false, message: WORKLOG_TEXT.completedNeeds100 };
  return { ok: true, progress, spentMinutes: Number(form.spentMinutes) };
};

/* =====================================================================
 * 실패 해석 (status 기준, 오류 본문에 code 없음)
 * ===================================================================== */

export type ScheduleAction = "load" | "saveEvent" | "saveWorklog" | "saveTaskLog";

export interface ScheduleFailureView {
  message: string;
  reload: boolean;
}

const common = function (failure: ApiFailure): string {
  if (failure.kind === "network") return SCHEDULE_TEXT.network;
  if (failure.kind === "timeout") return SCHEDULE_TEXT.timeout;
  if (failure.kind === "http" && failure.status >= 500) return SCHEDULE_TEXT.serverError;
  return SCHEDULE_TEXT.unknown;
};

export const interpretScheduleFailure = function (action: ScheduleAction, failure: ApiFailure): ScheduleFailureView {
  if (failure.kind !== "http") return { message: common(failure), reload: false };
  const { status } = failure;
  if (status === 400) return { message: failure.message || SCHEDULE_TEXT.invalid, reload: false };
  if (action === "load") return { message: common(failure), reload: false };
  // 404: 일정 없음(SCHEDULE_NOT_FOUND), 업무 없음(WBS_TASK_NOT_FOUND), 기능 꺼짐
  if (status === 404) return { message: action === "saveEvent" ? SCHEDULE_TEXT.notFound : WORKLOG_TEXT.taskNotFound, reload: true };
  // 403: 담당이 아닌 업무(WBS_TASK_ASSIGNEE_ONLY) — 재배정됐을 수 있다
  if (status === 403) return { message: WORKLOG_TEXT.notAssignee, reload: true };
  // 409: 업무·연결 기록 version 불일치, 잠금 실패
  if (status === 409) return { message: action === "saveTaskLog" ? WORKLOG_TEXT.concurrent : SCHEDULE_TEXT.concurrent, reload: true };
  return { message: common(failure), reload: false };
};
