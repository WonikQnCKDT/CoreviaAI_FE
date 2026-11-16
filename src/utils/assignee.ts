import type { Task, User } from "@/types";

type AssigneeSource = Pick<Task, "assigneeId"> & { assigneeIds?: string[] };

/**
 * 업무의 담당자 전체 목록을 반환합니다.
 * 복수 담당자(assigneeIds)가 있으면 그것을 사용하고,
 * 이전 데이터처럼 대표 담당자(assigneeId)만 있으면 한 명짜리 목록으로 변환합니다.
 */
export function assigneeIdsOf(task: AssigneeSource | null | undefined): string[] {
  if (!task) return [];
  const list = Array.isArray(task.assigneeIds) && task.assigneeIds.length > 0
    ? task.assigneeIds
    : task.assigneeId
      ? [task.assigneeId]
      : [];
  return Array.from(new Set(list.filter(Boolean)));
}

/** 해당 사용자가 이 업무의 담당자(공동 담당 포함)인지 확인합니다. */
export function isAssignedTo(task: AssigneeSource | null | undefined, userId: string | undefined): boolean {
  if (!userId) return false;
  return assigneeIdsOf(task).includes(userId);
}

/**
 * 담당자 목록을 저장 형태로 정리합니다.
 * 대표 담당자(assigneeId)는 목록의 첫 번째 사람으로 자동 동기화합니다.
 */
export function settleAssignees(userIds: string[]): { assigneeIds: string[]; assigneeId: string | null } {
  const unique = Array.from(new Set(userIds.filter(Boolean)));
  return { assigneeIds: unique, assigneeId: unique[0] ?? null };
}

export function findAssignees(userIds: string[], users: User[]): User[] {
  return userIds
    .map((id) => users.find((u) => u.id === id))
    .filter((user): user is User => Boolean(user));
}

/** "김서연, 박지훈" 형태의 이름 목록 (변경 이력·알림 문구용) */
export function assigneeNameText(userIds: string[], users: User[], fallback = "없음"): string {
  const names = findAssignees(userIds, users).map((u) => u.name);
  return names.length > 0 ? names.join(", ") : fallback;
}