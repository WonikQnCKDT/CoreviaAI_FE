import type { Journal, Meeting, Project, Task, User, Visibility } from "@/types";
import { addDays, diffDays, parseDate, TODAY } from "@/utils/date";

export function isWeekend(value: string): boolean {
  const day = parseDate(value).getDay();
  return day === 0 || day === 6;
}

/** from 다음 날부터 to까지의 영업일 수 (주말 제외, 공휴일 미반영 데모 규칙) */
export function businessDaysBetween(from: string, to: string): number {
  if (to <= from) return 0;
  let count = 0;
  const total = diffDays(from, to);
  for (let i = 1; i <= total; i += 1) {
    if (!isWeekend(addDays(from, i))) count += 1;
  }
  return count;
}

export function addBusinessDays(from: string, days: number): string {
  let cursor = from;
  let added = 0;
  while (added < days) {
    cursor = addDays(cursor, 1);
    if (!isWeekend(cursor)) added += 1;
  }
  return cursor;
}

export function lastActivityDate(task: Task, journals: Journal[]): string {
  const dates = journals.filter((j) => j.taskId === task.id).map((j) => j.date);
  if (task.lastUpdated) dates.push(task.lastUpdated.slice(0, 10));
  dates.push(task.startDate);
  return dates.reduce((max, value) => (value > max ? value : max), task.startDate);
}

export type MissingType = "meeting" | "unassigned" | "overdue" | "stale";

export interface MissingItem {
  key: string;
  type: MissingType;
  title: string;
  reason: string;
  detail: string;
  assigneeId: string | null;
  dueDate: string;
  taskId?: string;
  meetingId?: string;
  stage: string | null;
}

export const MISSING_LABEL: Record<MissingType, string> = {
  meeting: "회의 액션아이템 미등록",
  unassigned: "담당자·기한 미지정",
  overdue: "마감 경과 미완료",
  stale: "진척 기록 없음",
};

/**
 * project 안에서 누락이 의심되는 항목을 사유별로 모읍니다.
 * PM은 프로젝트 전체, 일반 멤버는 본인에게 배정된 항목만 조회합니다.
 */
export function collectMissing(
  project: Project,
  allTasks: Task[],
  meetings: Meeting[],
  journals: Journal[],
  viewer: User,
  isPm: boolean,
): MissingItem[] {
  const items: MissingItem[] = [];
  const projectTasks = allTasks.filter((t) => t.projectId === project.id);
  const mine = (assigneeId: string | null) => isPm || assigneeId === viewer.id;

  projectsMeetings(meetings, project.id).forEach((meeting) => {
    meeting.actionItems.forEach((item) => {
      if (item.taskId) return;
      if (!mine(item.assigneeId)) return;
      items.push({
        key: `meeting-${meeting.id}-${item.id}`,
        type: "meeting",
        title: item.text,
        reason: "회의 액션아이템이 업무로 등록되지 않음",
        detail: `${meeting.title} · ${meeting.date} 회의`,
        assigneeId: item.assigneeId,
        dueDate: item.dueDate,
        meetingId: meeting.id,
        stage: item.stage,
      });
    });
  });

  projectTasks.forEach((task) => {
    if (!mine(task.assigneeId)) return;
    if (!task.assigneeId || !task.endDate) {
      const parts = [];
      if (!task.assigneeId) parts.push("담당자 없음");
      if (!task.endDate) parts.push("기한 없음");
      items.push({
        key: `unassigned-${task.id}`,
        type: "unassigned",
        title: task.name,
        reason: "담당자 또는 기한이 지정되지 않음",
        detail: parts.join(" · "),
        assigneeId: task.assigneeId,
        dueDate: task.endDate,
        taskId: task.id,
        stage: task.stage,
      });
    }
    if (task.status !== "done" && task.endDate && task.endDate < TODAY) {
      items.push({
        key: `overdue-${task.id}`,
        type: "overdue",
        title: task.name,
        reason: `마감일 ${task.endDate} 경과, 미완료`,
        detail: `${Math.abs(diffDays(TODAY, task.endDate))}일 경과 · 진척 ${task.progress}%`,
        assigneeId: task.assigneeId,
        dueDate: task.endDate,
        taskId: task.id,
        stage: task.stage,
      });
    }
    if (task.status === "progress") {
      const last = lastActivityDate(task, journals);
      const gap = businessDaysBetween(last, TODAY);
      if (gap >= 3) {
        items.push({
          key: `stale-${task.id}`,
          type: "stale",
          title: task.name,
          reason: `진행 중이지만 ${gap}영업일 동안 진척·일지 기록 없음`,
          detail: `마지막 기록 ${last} · 진척 ${task.progress}%`,
          assigneeId: task.assigneeId,
          dueDate: task.endDate,
          taskId: task.id,
          stage: task.stage,
        });
      }
    }
  });

  return items;
}

function projectsMeetings(meetings: Meeting[], projectId: string): Meeting[] {
  return meetings.filter((m) => m.projectId === projectId);
}

export interface CapacityLoad {
  userId: string;
  allocated: number;
  capacity: number;
  exceeded: boolean;
  remaining: number;
}

/** 향후 windowDays 영업일 기준 가용 인일과 배정된 예상공수를 비교합니다. (데모 규칙) */
export function capacityLoad(tasks: Task[], userId: string, from: string, windowDays = 10): CapacityLoad {
  const end = addBusinessDays(from, windowDays);
  const weekdays = businessDaysBetween(from, end);
  const allocated = tasks
    .filter(
      (t) =>
        t.assigneeId === userId &&
        !t.personal &&
        t.status !== "done" &&
        t.startDate <= end &&
        (!t.endDate || t.endDate >= from),
    )
    .reduce((sum, t) => sum + t.estimate, 0);
  const capacity = weekdays;
  return {
    userId,
    allocated,
    capacity,
    exceeded: allocated > capacity,
    remaining: capacity - allocated,
  };
}

export function canViewKnowledge(
  doc: { visibility: Visibility; dept: string; projectId: string | null },
  user: User,
  projects: Project[],
): boolean {
  if (user.isSystemAdmin) return true;
  if (doc.visibility === "company") return true;
  if (doc.visibility === "department") return doc.dept === user.dept;
  if (!doc.projectId) return false;
  const project = projects.find((p) => p.id === doc.projectId);
  return Boolean(project?.members.some((m) => m.userId === user.id));
}