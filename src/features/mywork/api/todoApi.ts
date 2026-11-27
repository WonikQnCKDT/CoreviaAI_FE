import { apiRequest, type ApiResult } from "@/shared/api/client";

/**
 * 06. 개인 업무 (API) — 내 TODO(FR-PSN-01, SCRUM-111).
 * 기준: Confluence 06. 개인 업무 (API) v3, BE develop 50f96d2 (PersonalTodoController DTO).
 * 소유자는 서버가 세션으로 정한다. FE는 사용자 ID를 보내지 않는다.
 */

interface TodoItemDto {
  id: number;
  source: string;
  title: string;
  dueDate: string | null;
  done: boolean;
  doneAt: string | null;
  projectId: number | null;
  taskStatus: string | null;
  urgency: number;
  overdue: boolean;
}

interface PersonalTodoDto {
  id: number;
  title: string;
  dueDate: string | null;
  done: boolean;
  doneAt: string | null;
  createdAt: string | null;
  updatedAt: string | null;
}

interface CursorPageDto<T> {
  items: T[] | null;
  nextCursor: string | null;
  hasNext: boolean;
}

export type TodoSource = "personal" | "task";
export type TodoTaskStatus = "todo" | "progress" | "review" | "done";
/** 정렬 그룹: 0 오늘, 1 임박, 2 지연, 3 이후, 4 마감 없음 */
export type TodoUrgency = 0 | 1 | 2 | 3 | 4;

export interface TodoItem {
  id: number;
  source: TodoSource;
  /** source·id가 함께 식별자다(개인 TODO와 배정 업무 ID가 겹칠 수 있다) */
  key: string;
  title: string;
  dueDate: string | null;
  done: boolean;
  projectId: number | null;
  taskStatus: TodoTaskStatus | null;
  urgency: TodoUrgency;
  overdue: boolean;
}

export interface PersonalTodo {
  id: number;
  title: string;
  dueDate: string | null;
  done: boolean;
}

const STATUS_FROM_DTO: Record<string, TodoTaskStatus> = { TODO: "todo", IN_PROGRESS: "progress", REVIEW: "review", DONE: "done" };

/** 목록을 끝까지 이어 받을 때의 상한(서버 페이지 최대 100 × 20 = 2,000건) */
const MAX_PAGES = 20;
const PAGE_SIZE = 100;
/** 서버 커서 최대 길이 */
const MAX_CURSOR = 256;

const isoDate = (value: unknown) => (typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : null);
const text = (value: unknown) => (typeof value === "string" ? value : "");

export const toTodoItem = function (dto: TodoItemDto): TodoItem | null {
  if (!dto || !Number.isInteger(dto.id) || dto.id < 1) return null;
  const source: TodoSource | null = dto.source === "PERSONAL" ? "personal" : dto.source === "TASK" ? "task" : null;
  if (source === null) return null;
  const urgency = Number.isInteger(dto.urgency) && dto.urgency >= 0 && dto.urgency <= 4 ? (dto.urgency as TodoUrgency) : 4;
  return {
    id: dto.id,
    source,
    key: `${source}-${dto.id}`,
    title: text(dto.title),
    dueDate: isoDate(dto.dueDate),
    done: source === "personal" && dto.done === true,
    projectId: source === "task" && Number.isInteger(dto.projectId) && (dto.projectId ?? 0) > 0 ? dto.projectId : null,
    taskStatus: source === "task" && typeof dto.taskStatus === "string" && Object.hasOwn(STATUS_FROM_DTO, dto.taskStatus) ? STATUS_FROM_DTO[dto.taskStatus] : null,
    urgency,
    overdue: dto.overdue === true,
  };
};

const toPersonal = (dto: PersonalTodoDto): PersonalTodo => ({
  id: dto.id,
  title: text(dto.title),
  dueDate: isoDate(dto.dueDate),
  done: dto.done === true,
});

const mapResult = function <A, B>(result: ApiResult<A>, transform: (data: A) => B): ApiResult<B> {
  return result.ok === true ? { ok: true, data: transform(result.data) } : result;
};

const todoPath = (todoId: number) => `/me/todos/${encodeURIComponent(String(todoId))}`;

/** GET /api/me/todos 한 페이지 */
export const fetchTodoPage = async function ({
  done,
  cursor,
  size = PAGE_SIZE,
  signal,
}: {
  done: boolean;
  cursor?: string | null;
  size?: number;
  signal?: AbortSignal;
}) {
  const search = new URLSearchParams({ size: String(size), done: String(done) });
  if (cursor) search.set("cursor", cursor);
  const result = await apiRequest<CursorPageDto<TodoItemDto>>({ path: `/me/todos?${search}`, signal });
  return mapResult(result, (dto) => ({
    items: (Array.isArray(dto?.items) ? dto.items : []).map(toTodoItem).filter((item): item is TodoItem => item !== null),
    nextCursor: typeof dto?.nextCursor === "string" && dto.nextCursor && dto.nextCursor.length <= MAX_CURSOR ? dto.nextCursor : null,
    hasNext: dto?.hasNext === true,
  }));
};

/**
 * 목록 전체(상한까지). 화면이 오늘·임박·지연 수를 세고 필터를 바꾸므로 끝까지 받는다.
 * 커서가 400(INVALID_CURSOR, KST 자정 경계 등)이면 첫 페이지부터 한 번만 다시 받는다.
 */
export const fetchAllTodos = async function ({ done, signal }: { done: boolean; signal?: AbortSignal }): Promise<ApiResult<{ items: TodoItem[]; truncated: boolean }>> {
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const items: TodoItem[] = [];
    const seen = new Set<string>();
    let cursor: string | null = null;
    let restart = false;
    for (let page = 0; page < MAX_PAGES; page += 1) {
      const result = await fetchTodoPage({ done, cursor, signal });
      if (result.ok === false) {
        const { failure } = result;
        if (cursor !== null && attempt === 0 && failure.kind === "http" && failure.status === 400) {
          restart = true;
          break;
        }
        return result;
      }
      result.data.items.forEach((item) => {
        if (!seen.has(item.key)) {
          seen.add(item.key);
          items.push(item);
        }
      });
      if (!result.data.hasNext || !result.data.nextCursor) return { ok: true, data: { items, truncated: false } };
      cursor = result.data.nextCursor;
    }
    if (!restart) return { ok: true, data: { items, truncated: true } };
  }
  return { ok: true, data: { items: [], truncated: true } };
};

export interface TodoInput {
  title: string;
  dueDate: string | null;
}

/** POST /api/me/todos — requestId는 같은 입력을 다시 보낼 때만 재사용한다(멱등 키) */
export const createTodo = async function ({ requestId, input, signal }: { requestId: string; input: TodoInput; signal?: AbortSignal }) {
  const body = { requestId, title: input.title.trim(), dueDate: input.dueDate };
  return mapResult(await apiRequest<PersonalTodoDto>({ method: "POST", path: "/me/todos", body, signal }), toPersonal);
};

/** PATCH /api/me/todos/{todoId} — 제목·마감·완료를 덮어쓴다(마감 null = 해제) */
export const updateTodo = async function ({ todoId, input, done, signal }: { todoId: number; input: TodoInput; done: boolean; signal?: AbortSignal }) {
  const body = { title: input.title.trim(), dueDate: input.dueDate, done };
  return mapResult(await apiRequest<PersonalTodoDto>({ method: "PATCH", path: todoPath(todoId), body, signal }), toPersonal);
};

/** DELETE /api/me/todos/{todoId} — 소프트 삭제, 204 */
export const deleteTodo = async function ({ todoId, signal }: { todoId: number; signal?: AbortSignal }) {
  return mapResult(await apiRequest<null>({ method: "DELETE", path: todoPath(todoId), signal }), () => null);
};
