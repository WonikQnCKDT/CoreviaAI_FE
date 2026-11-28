import { apiRequest, type ApiResult } from "@/shared/api/client";

/**
 * 06-2. 개인 일정·업무일지 (API) — 내 일정(FR-PSN-02, SCRUM-120), 업무일지(FR-PSN-03, SCRUM-121).
 * 기준: Confluence 06-2 v6, BE develop 50f96d2 (PersonalScheduleController·CalendarController·WorklogController·WorklogTaskController).
 * 모두 본인 것만 다룬다. 소유자는 서버가 세션으로 정하고 FE는 사용자 ID를 보내지 않는다.
 */

/* ===== 서버 DTO ===== */

interface ScheduleDto {
  id: number;
  title: string;
  startAt: string;
  endAt: string;
  allDay: boolean;
  memo: string | null;
}

interface SchedulePageDto {
  items: ScheduleDto[] | null;
  page: number;
  size: number;
  hasNext: boolean;
}

interface CalendarItemDto {
  id: number;
  source: string;
  title: string;
  startAt: string;
  endAt: string;
  allDay: boolean;
  projectId: number | null;
  taskStatus: string | null;
  progress: number | null;
  spentMinutes: number | null;
}

interface CalendarPageDto {
  items: CalendarItemDto[] | null;
  hasNext: boolean;
}

interface WorklogDto {
  logDate: string;
  content: string | null;
}

interface WorklogTaskDto {
  id: number;
  taskId: number;
  logDate: string;
  content: string | null;
  progress: number;
  spentMinutes: number;
  completed: boolean;
  version: number;
}

interface WorklogTaskPageDto {
  items: WorklogTaskDto[] | null;
  hasNext: boolean;
}

/* ===== 화면 모델 ===== */

export interface PersonalEvent {
  id: number;
  title: string;
  /** UTC ISO 시각 */
  startAt: string;
  endAt: string;
  allDay: boolean;
  memo: string;
}

export type CalendarTaskStatus = "todo" | "progress" | "review" | "done";

/** 캘린더의 담당 업무(종일 항목: 한국 날짜 시작일 00:00 ~ 종료일 다음 날 00:00) */
export interface CalendarTask {
  id: number;
  title: string;
  startAt: string;
  endAt: string;
  projectId: number;
  status: CalendarTaskStatus;
  progress: number;
  spentMinutes: number;
}

export interface Worklog {
  logDate: string;
  content: string;
}

export interface WorklogTaskEntry {
  taskId: number;
  content: string;
  progress: number;
  spentMinutes: number;
  completed: boolean;
  /** 연결 기록 version(새 기록은 0) */
  version: number;
}

/* ===== 변환 ===== */

const STATUS_FROM_DTO: Record<string, CalendarTaskStatus> = { TODO: "todo", IN_PROGRESS: "progress", REVIEW: "review", DONE: "done" };
/** offset 페이지를 끝까지 받을 때의 상한(100 × 20 = 2,000건) */
const MAX_PAGES = 20;
const PAGE_SIZE = 100;

const text = (value: unknown) => (typeof value === "string" ? value : "");
const isInstant = (value: unknown): value is string => typeof value === "string" && !Number.isNaN(Date.parse(value));
const positive = (value: unknown): value is number => typeof value === "number" && Number.isInteger(value) && value > 0;
const clamp = (value: unknown, max: number) => (typeof value === "number" && Number.isFinite(value) ? Math.min(max, Math.max(0, Math.round(value))) : 0);

const toEvent = (dto: ScheduleDto): PersonalEvent | null =>
  dto && positive(dto.id) && isInstant(dto.startAt) && isInstant(dto.endAt)
    ? { id: dto.id, title: text(dto.title), startAt: dto.startAt, endAt: dto.endAt, allDay: dto.allDay === true, memo: text(dto.memo) }
    : null;

export const toCalendarTask = (dto: CalendarItemDto): CalendarTask | null =>
  dto && dto.source === "TASK" && positive(dto.id) && positive(dto.projectId) && isInstant(dto.startAt) && isInstant(dto.endAt)
    ? {
        id: dto.id,
        title: text(dto.title),
        startAt: dto.startAt,
        endAt: dto.endAt,
        projectId: dto.projectId,
        status: typeof dto.taskStatus === "string" && Object.hasOwn(STATUS_FROM_DTO, dto.taskStatus) ? STATUS_FROM_DTO[dto.taskStatus] : "todo",
        progress: clamp(dto.progress, 100),
        spentMinutes: clamp(dto.spentMinutes, Number.MAX_SAFE_INTEGER),
      }
    : null;

const toEntry = (dto: WorklogTaskDto): WorklogTaskEntry | null =>
  dto && positive(dto.taskId)
    ? {
        taskId: dto.taskId,
        content: text(dto.content),
        progress: clamp(dto.progress, 100),
        spentMinutes: clamp(dto.spentMinutes, 1440),
        completed: dto.completed === true,
        version: typeof dto.version === "number" && dto.version >= 0 ? dto.version : 0,
      }
    : null;

const mapResult = function <A, B>(result: ApiResult<A>, transform: (data: A) => B): ApiResult<B> {
  return result.ok === true ? { ok: true, data: transform(result.data) } : result;
};

/** offset 페이지를 끝까지(상한까지) 이어 받는다 */
const collectPages = async function <D, T>(
  fetchPage: (page: number) => Promise<ApiResult<{ items: D[] | null; hasNext: boolean }>>,
  transform: (dto: D) => T | null,
): Promise<ApiResult<{ items: T[]; truncated: boolean }>> {
  const items: T[] = [];
  for (let page = 0; page < MAX_PAGES; page += 1) {
    const result = await fetchPage(page);
    if (result.ok === false) return result;
    (Array.isArray(result.data?.items) ? result.data.items : []).forEach((dto) => {
      const item = transform(dto);
      if (item !== null) items.push(item);
    });
    if (!result.data?.hasNext) return { ok: true, data: { items, truncated: false } };
  }
  return { ok: true, data: { items, truncated: true } };
};

const query = (params: Record<string, string | number>) => new URLSearchParams(Object.entries(params).map(([k, v]) => [k, String(v)])).toString();
const enc = (value: string | number) => encodeURIComponent(String(value));

/* ===== 개인 일정 ===== */

/** GET /api/me/events — [from, to)와 겹치는 본인 일정(UTC 시각, 366일 이내) */
export const fetchEvents = function ({ from, to, signal }: { from: string; to: string; signal?: AbortSignal }) {
  return collectPages(
    (page) => apiRequest<SchedulePageDto>({ path: `/me/events?${query({ from, to, page, size: PAGE_SIZE })}`, signal }),
    toEvent,
  );
};

/** GET /api/me/calendar — 개인 일정 + 현재 담당 업무. 화면은 담당 업무만 쓴다(일정은 메모가 있는 /me/events로) */
export const fetchCalendarTasks = function ({ from, to, signal }: { from: string; to: string; signal?: AbortSignal }) {
  return collectPages(
    (page) => apiRequest<CalendarPageDto>({ path: `/me/calendar?${query({ from, to, page, size: PAGE_SIZE })}`, signal }),
    toCalendarTask,
  );
};

export interface EventInput {
  title: string;
  startAt: string;
  endAt: string;
  allDay: boolean;
  memo: string;
}

const eventBody = (input: EventInput) => ({
  title: input.title.trim(),
  startAt: input.startAt,
  endAt: input.endAt,
  allDay: input.allDay,
  memo: input.memo.trim() || null,
});

/** POST /api/me/events (201) */
export const createEvent = async function ({ input, signal }: { input: EventInput; signal?: AbortSignal }) {
  const result = await apiRequest<ScheduleDto>({ method: "POST", path: "/me/events", body: eventBody(input), signal });
  return mapResult(result, (dto) => toEvent(dto));
};

/** PATCH /api/me/events/{eventId} — 보낸 값으로 덮어쓴다. 삭제 API는 없다(보류) */
export const updateEvent = async function ({ eventId, input, signal }: { eventId: number; input: EventInput; signal?: AbortSignal }) {
  const result = await apiRequest<ScheduleDto>({ method: "PATCH", path: `/me/events/${enc(eventId)}`, body: eventBody(input), signal });
  return mapResult(result, (dto) => toEvent(dto));
};

/* ===== 업무일지 ===== */

/** GET /api/me/worklogs?from&to — 저장한 날짜만, 날짜 오름차순 */
export const fetchWorklogDates = async function ({ from, to, signal }: { from: string; to: string; signal?: AbortSignal }) {
  const result = await apiRequest<WorklogDto[]>({ path: `/me/worklogs?${query({ from, to })}`, signal });
  return mapResult(result, (list) => (Array.isArray(list) ? list : []).map((w) => text(w?.logDate)).filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d)));
};

/** GET /api/me/worklogs/{logDate} — 그날 일지가 없으면 404를 빈 일지로 바꾼다 */
export const fetchWorklog = async function ({ logDate, signal }: { logDate: string; signal?: AbortSignal }): Promise<ApiResult<Worklog>> {
  const result = await apiRequest<WorklogDto>({ path: `/me/worklogs/${enc(logDate)}`, signal });
  if (result.ok === false && result.failure.kind === "http" && result.failure.status === 404) return { ok: true, data: { logDate, content: "" } };
  return mapResult(result, (dto) => ({ logDate, content: text(dto?.content) }));
};

/** PUT /api/me/worklogs/{logDate} — 없으면 만들고 있으면 덮어쓴다(같은 내용 재전송은 변화 없음) */
export const saveWorklog = async function ({ logDate, content, signal }: { logDate: string; content: string; signal?: AbortSignal }) {
  const result = await apiRequest<WorklogDto>({ method: "PUT", path: `/me/worklogs/${enc(logDate)}`, body: { content }, signal });
  return mapResult(result, (dto) => ({ logDate, content: text(dto?.content) }));
};

/** GET /api/me/worklogs/{date}/tasks — 그날 본인의 업무별 기록 */
export const fetchWorklogTasks = function ({ logDate, signal }: { logDate: string; signal?: AbortSignal }) {
  return collectPages(
    (page) => apiRequest<WorklogTaskPageDto>({ path: `/me/worklogs/${enc(logDate)}/tasks?${query({ page, size: PAGE_SIZE })}`, signal }),
    toEntry,
  );
};

export interface WorklogTaskInput {
  projectId: number;
  content: string;
  progress: number;
  spentMinutes: number;
  completed: boolean;
  /** 업무 version(업무 상세에서 저장 직전에 받는다) */
  taskVersion: number;
  /** 연결 기록 version(새 기록은 0) */
  version: number;
}

/** PUT /api/me/worklogs/{date}/tasks/{taskId} — 본인 담당 업무만. 진척률·완료가 업무에 반영된다 */
export const saveWorklogTask = async function ({ logDate, taskId, input, signal }: { logDate: string; taskId: number; input: WorklogTaskInput; signal?: AbortSignal }) {
  const result = await apiRequest<WorklogTaskDto>({
    method: "PUT",
    path: `/me/worklogs/${enc(logDate)}/tasks/${enc(taskId)}`,
    body: { ...input, content: input.content.trim() || null },
    signal,
  });
  return mapResult(result, (dto) => toEntry(dto));
};
