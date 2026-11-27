import type { Project, Task } from "@/types";
import { assigneeIdsOf } from "@/utils/assignee";

export interface RollupValue {
  progress: number;
  estimate: number;
  startDate: string;
  endDate: string;
}

export function childrenOf(tasks: Task[], parentId: string): Task[] {
  return tasks
    .filter((t) => t.parentId === parentId)
    .sort((a, b) => a.order - b.order);
}

export function descendantsOf(tasks: Task[], taskId: string): Task[] {
  const direct = childrenOf(tasks, taskId);
  return direct.reduce<Task[]>((acc, child) => {
    acc.push(child);
    acc.push(...descendantsOf(tasks, child.id));
    return acc;
  }, []);
}

export function isDescendant(tasks: Task[], taskId: string, maybeDescendantId: string): boolean {
  return descendantsOf(tasks, taskId).some((t) => t.id === maybeDescendantId);
}

/** 상위 작업의 기간은 하위 작업 기준, 진척률은 예상공수 가중 평균 */
export function rollupMap(tasks: Task[]): Record<string, RollupValue> {
  const map: Record<string, RollupValue> = {};

  tasks.forEach((task) => {
    if (task.level === 3) {
      map[task.id] = {
        progress: task.progress,
        estimate: task.estimate,
        startDate: task.startDate,
        endDate: task.endDate,
      };
    }
  });

  tasks
    .filter((t) => t.level === 2)
    .forEach((task) => {
      const children = childrenOf(tasks, task.id);
      if (children.length === 0) {
        map[task.id] = {
          progress: task.progress,
          estimate: task.estimate,
          startDate: task.startDate,
          endDate: task.endDate,
        };
        return;
      }
      const estimate = children.reduce((sum, c) => sum + c.estimate, 0);
      const startDate = children.reduce((min, c) => (c.startDate < min ? c.startDate : min), children[0].startDate);
      const endDate = children.reduce((max, c) => (c.endDate > max ? c.endDate : max), children[0].endDate);
      const weighted = estimate > 0
        ? children.reduce((sum, c) => sum + c.progress * c.estimate, 0) / estimate
        : children.reduce((sum, c) => sum + c.progress, 0) / children.length;
      map[task.id] = {
        progress: Math.round(weighted),
        estimate,
        startDate,
        endDate,
      };
    });

  return map;
}

/** 프로젝트 진척률: 최하위(leaf) 업무 예상공수 가중 평균 */
export function projectProgress(tasks: Task[], projectId: string): number {
  const projectTasks = tasks.filter((t) => t.projectId === projectId);
  const leaves = projectTasks.filter((t) => t.level === 3 || childrenOf(projectTasks, t.id).length === 0);
  const estimate = leaves.reduce((sum, t) => sum + t.estimate, 0);
  if (leaves.length === 0) return 0;
  if (estimate <= 0) {
    return Math.round(leaves.reduce((sum, t) => sum + t.progress, 0) / leaves.length);
  }
  return Math.round(leaves.reduce((sum, t) => sum + t.progress * t.estimate, 0) / estimate);
}

/**
 * 화면에 보여 줄 프로젝트 진척률. 서버 프로젝트는 서버 값만 쓴다(데모 업무가 없어 계산하면 0%가 되기 때문).
 * 서버 값을 아직 받지 않았으면 null — 화면은 '-'로 표시한다. 데모 프로젝트는 데모 업무로 계산한다.
 */
export function displayProjectProgress(tasks: Task[], project: Pick<Project, "id" | "serverId" | "serverProgress">): number | null {
  if (project.serverId !== undefined) return project.serverProgress ?? null;
  return projectProgress(tasks, project.id);
}

export function stageProgress(tasks: Task[], projectId: string, stage: string): number {
  const stageTasks = tasks.filter((t) => t.projectId === projectId && t.stage === stage);
  const leaves = stageTasks.filter((t) => t.level === 3 || childrenOf(stageTasks, t.id).length === 0);
  if (leaves.length === 0) return 0;
  const estimate = leaves.reduce((sum, t) => sum + t.estimate, 0);
  if (estimate <= 0) return Math.round(leaves.reduce((sum, t) => sum + t.progress, 0) / leaves.length);
  return Math.round(leaves.reduce((sum, t) => sum + t.progress * t.estimate, 0) / estimate);
}

export function normalizeOrders(tasks: Task[]): Task[] {
  const groups = new Map<string, Task[]>();
  tasks.forEach((task) => {
    const key = `${task.projectId}|${task.stage}|${task.parentId}|${task.level}`;
    const list = groups.get(key) || [];
    list.push(task);
    groups.set(key, list);
  });
  const orderMap = new Map<string, number>();
  groups.forEach((list) => {
    list
      .slice()
      .sort((a, b) => a.order - b.order)
      .forEach((task, index) => {
        orderMap.set(task.id, index + 1);
      });
  });
  return tasks.map((task) => ({ ...task, order: orderMap.get(task.id) ?? task.order }));
}

export function nextOrder(tasks: Task[], projectId: string | null, stage: string | null, parentId: string | null, level: number): number {
  const siblings = tasks.filter(
    (t) => t.projectId === projectId && t.stage === stage && t.parentId === parentId && t.level === level,
  );
  return siblings.reduce((max, t) => Math.max(max, t.order), 0) + 1;
}

export function leafTasks(tasks: Task[]): Task[] {
  return tasks.filter((t) => t.level === 3 || childrenOf(tasks, t.id).length === 0);
}

export function isLateTask(task: Task, today: string): boolean {
  return task.status !== "done" && task.endDate < today;
}

export function isMissingTask(task: Task, today: string): boolean {
  if (task.projectId === null) return false;
  if (assigneeIdsOf(task).length === 0) return true;
  return task.status === "todo" && task.progress === 0 && task.startDate < today;
}