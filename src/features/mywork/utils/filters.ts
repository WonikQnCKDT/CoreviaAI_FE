import { TASK_FILTER_LABEL } from "@/shared/i18n/catalog/status";
import { TASK_FILTER_HINT } from "@/shared/i18n/catalog/status";
export type TaskFilter = "open" | "today" | "soon" | "late" | "done" | "all";

export const TASK_FILTERS: { key: TaskFilter; label: string }[] = [
  { key: "open", get label() { return TASK_FILTER_LABEL.open; } },
  { key: "today", get label() { return TASK_FILTER_LABEL.today; } },
  { key: "soon", get label() { return TASK_FILTER_LABEL.soon; } },
  { key: "late", get label() { return TASK_FILTER_LABEL.late; } },
  { key: "done", get label() { return TASK_FILTER_LABEL.done; } },
  { key: "all", get label() { return TASK_FILTER_LABEL.all; } },
];

export const FILTER_DESCRIPTION: Record<TaskFilter, string> = TASK_FILTER_HINT;

const STORAGE_KEY = "corevia-mywork-task-filter";

export function isTaskFilter(value: string): value is TaskFilter {
  return TASK_FILTERS.some((item) => item.key === value);
}

export function loadTaskFilter(): TaskFilter {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (raw && isTaskFilter(raw)) return raw;
  } catch {
    // 저장된 필터를 읽지 못하면 기본 필터로 시작합니다.
  }
  return "open";
}

export function saveTaskFilter(filter: TaskFilter) {
  try {
    sessionStorage.setItem(STORAGE_KEY, filter);
  } catch {
    // 저장 공간을 사용할 수 없어도 화면 동작은 유지합니다.
  }
}