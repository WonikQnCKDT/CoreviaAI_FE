export type TaskFilter = "open" | "today" | "soon" | "late" | "done" | "all";

export const TASK_FILTERS: { key: TaskFilter; label: string }[] = [
  { key: "open", label: "진행 중" },
  { key: "today", label: "오늘" },
  { key: "soon", label: "마감 임박" },
  { key: "late", label: "지연" },
  { key: "done", label: "완료" },
  { key: "all", label: "전체" },
];

export const FILTER_DESCRIPTION: Record<TaskFilter, string> = {
  open: "완료되지 않은 업무",
  today: "오늘 마감인 미완료 업무",
  soon: "3일 이내 마감 예정",
  late: "마감일이 지난 미완료 업무",
  done: "완료 처리한 업무",
  all: "완료 포함 전체 업무",
};

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