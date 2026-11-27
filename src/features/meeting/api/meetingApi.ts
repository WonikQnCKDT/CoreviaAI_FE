import { apiRequest, type ApiResult } from "@/shared/api/client";

/**
 * 08. 회의록·산출물·게시판·파일 (API) — 회의록(FR-DOC-01, SCRUM-122).
 * 기준: Confluence 08 v2, BE develop 50f96d2 (MeetingController, 7a47b78·dd76972).
 * 산출물·게시판·파일 API는 아직 명세·BE에 없다.
 */

interface MeetingSummaryDto {
  id: number;
  title: string;
  heldAt: string;
  authorUserId: number;
  authorName: string | null;
  version: number;
}

interface AttendeeDto {
  id: number;
  userId: number | null;
  name: string | null;
  external: boolean;
}

interface DecisionDto {
  id: number;
  content: string;
  sortOrder: number;
  source: string;
}

interface ActionItemDto {
  id: number;
  content: string;
  assigneeUserId: number | null;
  assigneeName: string | null;
  dueDate: string | null;
  status: string;
  source: string;
  taskId: number | null;
}

interface MeetingDetailDto extends MeetingSummaryDto {
  projectId: number;
  content: string | null;
  attendees: AttendeeDto[] | null;
  decisions: DecisionDto[] | null;
  actionItems: ActionItemDto[] | null;
}

interface CursorPageDto<T> {
  items: T[] | null;
  nextCursor: string | null;
  hasNext: boolean;
}

export interface MeetingSummary {
  id: number;
  title: string;
  heldAt: string;
  authorUserId: number;
  authorName: string;
}

export type ItemSource = "manual" | "ai";
export type ActionItemStatus = "open" | "converted" | "dismissed";

export interface MeetingAttendee {
  userId: number | null;
  name: string;
  external: boolean;
}

export interface MeetingDecision {
  content: string;
  source: ItemSource;
}

export interface MeetingActionItem {
  content: string;
  assigneeUserId: number | null;
  assigneeName: string;
  dueDate: string | null;
  status: ActionItemStatus;
  source: ItemSource;
  taskId: number | null;
}

export interface MeetingDetail extends MeetingSummary {
  content: string;
  version: number;
  attendees: MeetingAttendee[];
  decisions: MeetingDecision[];
  actionItems: MeetingActionItem[];
}

const STATUS_FROM_DTO: Record<string, ActionItemStatus> = { OPEN: "open", CONVERTED: "converted", DISMISSED: "dismissed" };
const MAX_ITEMS = 100;
const MAX_CURSOR = 512;

const text = (value: unknown) => (typeof value === "string" ? value : "");
const positiveOrNull = (value: unknown) => (typeof value === "number" && Number.isInteger(value) && value > 0 ? value : null);
const isInstant = (value: unknown): value is string => typeof value === "string" && !Number.isNaN(Date.parse(value));
const toSource = (value: unknown): ItemSource => (value === "AI" ? "ai" : "manual");

const toSummary = (dto: MeetingSummaryDto): MeetingSummary | null =>
  dto && positiveOrNull(dto.id) !== null && isInstant(dto.heldAt)
    ? { id: dto.id, title: text(dto.title), heldAt: dto.heldAt, authorUserId: positiveOrNull(dto.authorUserId) ?? 0, authorName: text(dto.authorName) }
    : null;

export const toDetail = function (dto: MeetingDetailDto): MeetingDetail {
  const summary = toSummary(dto) ?? { id: dto.id, title: text(dto.title), heldAt: "", authorUserId: 0, authorName: "" };
  return {
    ...summary,
    content: text(dto.content),
    version: typeof dto.version === "number" && dto.version >= 0 ? dto.version : 0,
    attendees: (Array.isArray(dto.attendees) ? dto.attendees : []).slice(0, MAX_ITEMS).filter(Boolean).map((a) => ({
      userId: a.external === true ? null : positiveOrNull(a.userId),
      name: text(a.name),
      external: a.external === true,
    })),
    decisions: (Array.isArray(dto.decisions) ? dto.decisions : [])
      .slice(0, MAX_ITEMS)
      .filter(Boolean)
      .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))
      .map((d) => ({ content: text(d.content), source: toSource(d.source) })),
    actionItems: (Array.isArray(dto.actionItems) ? dto.actionItems : []).slice(0, MAX_ITEMS).filter(Boolean).map((a) => ({
      content: text(a.content),
      assigneeUserId: positiveOrNull(a.assigneeUserId),
      assigneeName: text(a.assigneeName),
      dueDate: typeof a.dueDate === "string" && /^\d{4}-\d{2}-\d{2}$/.test(a.dueDate) ? a.dueDate : null,
      status: typeof a.status === "string" && Object.hasOwn(STATUS_FROM_DTO, a.status) ? STATUS_FROM_DTO[a.status] : "open",
      source: toSource(a.source),
      taskId: positiveOrNull(a.taskId),
    })),
  };
};

const mapResult = function <A, B>(result: ApiResult<A>, transform: (data: A) => B): ApiResult<B> {
  return result.ok === true ? { ok: true, data: transform(result.data) } : result;
};

const meetingsPath = (projectId: number) => `/projects/${encodeURIComponent(String(projectId))}/meetings`;
const meetingPath = (projectId: number, meetingId: number) => `${meetingsPath(projectId)}/${encodeURIComponent(String(meetingId))}`;

/** GET .../meetings — 회의 일시 내림차순, 검색어는 제목·본문·결정사항·액션아이템 부분 검색 */
export const fetchMeetings = async function ({
  projectId,
  keyword,
  cursor,
  size = 20,
  signal,
}: {
  projectId: number;
  keyword?: string;
  cursor?: string | null;
  size?: number;
  signal?: AbortSignal;
}) {
  const search = new URLSearchParams({ size: String(size) });
  const trimmed = keyword?.trim();
  if (trimmed) search.set("keyword", trimmed.slice(0, 200));
  if (cursor) search.set("cursor", cursor);
  const result = await apiRequest<CursorPageDto<MeetingSummaryDto>>({ path: `${meetingsPath(projectId)}?${search}`, signal });
  return mapResult(result, (dto) => ({
    items: (Array.isArray(dto?.items) ? dto.items : []).map(toSummary).filter((m): m is MeetingSummary => m !== null),
    nextCursor: typeof dto?.nextCursor === "string" && dto.nextCursor && dto.nextCursor.length <= MAX_CURSOR ? dto.nextCursor : null,
    hasNext: dto?.hasNext === true,
  }));
};

/** GET .../meetings/{meetingId} */
export const fetchMeeting = async function ({ projectId, meetingId, signal }: { projectId: number; meetingId: number; signal?: AbortSignal }) {
  return mapResult(await apiRequest<MeetingDetailDto>({ path: meetingPath(projectId, meetingId), signal }), toDetail);
};

export interface MeetingInput {
  title: string;
  /** UTC ISO 시각 */
  heldAt: string;
  content: string;
  attendees: ({ userId: number } | { externalName: string })[];
  decisions: string[];
  actionItems: { content: string; assigneeUserId: number | null; dueDate: string | null }[];
}

const body = (input: MeetingInput) => ({
  title: input.title.trim(),
  heldAt: input.heldAt,
  content: input.content.trim() ? input.content : null,
  attendees: input.attendees,
  decisions: input.decisions,
  actionItems: input.actionItems,
});

/** POST .../meetings (201) — requestId는 같은 입력을 다시 보낼 때만 재사용한다 */
export const createMeeting = async function ({ projectId, requestId, input, signal }: { projectId: number; requestId: string; input: MeetingInput; signal?: AbortSignal }) {
  const result = await apiRequest<MeetingDetailDto>({ method: "POST", path: meetingsPath(projectId), body: { requestId, ...body(input) }, signal });
  return mapResult(result, toDetail);
};

/** PATCH .../meetings/{meetingId} — 전체 교체(빠진 항목은 삭제). version이 다르면 409 */
export const updateMeeting = async function ({
  projectId,
  meetingId,
  version,
  input,
  signal,
}: {
  projectId: number;
  meetingId: number;
  version: number;
  input: MeetingInput;
  signal?: AbortSignal;
}) {
  const result = await apiRequest<MeetingDetailDto>({ method: "PATCH", path: meetingPath(projectId, meetingId), body: { version, ...body(input) }, signal });
  return mapResult(result, toDetail);
};

/** DELETE .../meetings/{meetingId} (204) */
export const deleteMeeting = async function ({ projectId, meetingId, signal }: { projectId: number; meetingId: number; signal?: AbortSignal }) {
  return mapResult(await apiRequest<null>({ method: "DELETE", path: meetingPath(projectId, meetingId), signal }), () => null);
};
