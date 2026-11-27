import type { ApiFailure } from "@/shared/api/client";
import type { TodoInput, TodoItem } from "@/features/mywork/api/todoApi";
import { TODO_TEXT } from "@/features/mywork/i18n/ko";
import type { TaskFilter } from "@/features/mywork/utils/filters";

/* ===== 입력 검증 (서버 CreateTodoRequest·UpdateTodoRequest와 같게) ===== */

// eslint-disable-next-line no-control-regex
const CONTROL_CHARS = /[\u0000-\u001F\u007F-\u009F]/;

export const validateTodoInput = function (raw: { title: string; dueDate: string }): { ok: true; input: TodoInput } | { ok: false; message: string } {
  if (!raw.title.trim()) return { ok: false, message: TODO_TEXT.titleRequired };
  // 서버는 다듬기 전 값으로 길이를 잰다
  if (raw.title.length > 200) return { ok: false, message: TODO_TEXT.titleTooLong };
  if (CONTROL_CHARS.test(raw.title)) return { ok: false, message: TODO_TEXT.titleControl };
  const dueDate = /^\d{4}-\d{2}-\d{2}$/.test(raw.dueDate) ? raw.dueDate : null;
  return { ok: true, input: { title: raw.title.trim(), dueDate } };
};

/* ===== 등록 멱등 키 ===== */

export const newRequestId = function (): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") return crypto.randomUUID();
  // randomUUID가 없는 오래된 브라우저: getRandomValues로 v4 UUID를 만든다
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
};

export interface PendingCreate {
  requestId: string;
  input: TodoInput;
}

/**
 * 같은 입력을 다시 보내면(네트워크·시간 초과 뒤 재시도) 같은 requestId를 쓴다. 서버가 중복 없이 최초 결과를 준다.
 * 입력이 바뀌면 새 requestId를 만든다(같은 키·다른 입력은 409 TODO_REQUEST_CONFLICT).
 */
export const requestIdFor = (pending: PendingCreate | null, input: TodoInput): string =>
  pending && pending.input.title === input.title && pending.input.dueDate === input.dueDate ? pending.requestId : newRequestId();

/* ===== 필터·집계 ===== */

export const matchesFilter = function (item: TodoItem, filter: TaskFilter): boolean {
  if (filter === "today") return !item.done && item.urgency === 0;
  if (filter === "soon") return !item.done && item.urgency === 1;
  if (filter === "late") return !item.done && item.overdue;
  if (filter === "done") return item.done;
  if (filter === "open") return !item.done;
  return true;
};

export const todoStats = (active: TodoItem[], done: TodoItem[]) => ({
  today: active.filter((i) => i.urgency === 0).length,
  soon: active.filter((i) => i.urgency === 1).length,
  late: active.filter((i) => i.overdue).length,
  open: active.length,
  done: done.length,
});

/* ===== 실패 해석 (status 기준, 오류 본문에 code 없음) ===== */

export type TodoAction = "load" | "create" | "update" | "delete";

export interface TodoFailureView {
  message: string;
  /** 목록을 다시 받아야 하는지 */
  reload: boolean;
  /** 등록: 다음 시도에 새 requestId를 써야 하는지 */
  resetRequest: boolean;
}

const common = function (failure: ApiFailure): string {
  if (failure.kind === "network") return TODO_TEXT.network;
  if (failure.kind === "timeout") return TODO_TEXT.timeout;
  if (failure.kind === "http" && failure.status >= 500) return TODO_TEXT.serverError;
  return TODO_TEXT.unknown;
};

export const interpretTodoFailure = function (action: TodoAction, failure: ApiFailure): TodoFailureView {
  // 네트워크·시간 초과는 서버에 반영됐는지 알 수 없다. 같은 입력이면 같은 키로 다시 보낼 수 있게 키를 남긴다
  if (failure.kind !== "http") return { message: common(failure), reload: false, resetRequest: false };
  const { status } = failure;
  if (status === 400) return { message: failure.message || TODO_TEXT.invalid, reload: false, resetRequest: action === "create" };
  if (status === 404) return { message: TODO_TEXT.notFound, reload: true, resetRequest: false };
  if (status === 409) {
    // 등록 409: TODO_REQUEST_CONFLICT·TODO_DELETED·CONCURRENT_MODIFICATION — 어느 쪽이든 새 키로 다시 등록해야 한다
    if (action === "create") return { message: TODO_TEXT.createConflict, reload: true, resetRequest: true };
    return { message: TODO_TEXT.concurrent, reload: true, resetRequest: false };
  }
  return { message: common(failure), reload: false, resetRequest: action === "create" && status < 500 };
};
