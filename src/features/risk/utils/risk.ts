import type { Issue, Milestone, Project, Task, User } from "@/types";
import { addDays, diffDays, TODAY } from "@/utils/date";
import { isLateTask, leafTasks } from "@/features/task/utils/taskTree";

export interface ImpactInfo {
  task: Task;
  delayDays: number;
  expectedEnd: string;
  depth: number;
}

export function successorsOf(taskId: string, tasks: Task[]): Task[] {
  return tasks.filter((t) => t.predecessors.includes(taskId));
}

export function impactOf(rootId: string, allTasks: Task[]): ImpactInfo[] {
  const tasks = allTasks.filter((t) => !t.personal);
  const root = tasks.find((t) => t.id === rootId);
  if (!root) return [];

  const expected = new Map<string, string>();
  expected.set(root.id, root.endDate < TODAY ? TODAY : root.endDate);
  const depth = new Map<string, number>([[root.id, 0]]);
  const queue: string[] = [root.id];
  const visited = new Set<string>([root.id]);
  const result: ImpactInfo[] = [];

  while (queue.length > 0) {
    const currentId = queue.shift() as string;
    const currentEnd = expected.get(currentId) || TODAY;
    const currentDepth = depth.get(currentId) || 0;
    const currentTask = tasks.find((t) => t.id === currentId);
    if (!currentTask) continue;

    successorsOf(currentId, tasks).forEach((next) => {
      const requiredStart = addDays(currentEnd, 1);
      const shift = Math.max(0, diffDays(next.startDate, requiredStart));
      const nextExpectedEnd = addDays(next.endDate, shift);
      const previous = expected.get(next.id);
      if (!previous || nextExpectedEnd > previous) {
        expected.set(next.id, nextExpectedEnd);
        depth.set(next.id, currentDepth + 1);
        result.push({
          task: next,
          delayDays: shift,
          expectedEnd: nextExpectedEnd,
          depth: currentDepth + 1,
        });
      }
      if (!visited.has(next.id)) {
        visited.add(next.id);
        queue.push(next.id);
      }
    });
  }

  return result.sort((a, b) => a.depth - b.depth || b.delayDays - a.delayDays);
}

export interface RippleTask {
  task: Task;
  downstreamCount: number;
  estimate: number;
}

export function topRippleTasks(allTasks: Task[], limit = 5): RippleTask[] {
  const tasks = allTasks.filter((t) => !t.personal);
  return tasks
    .map((task) => {
      const downstream = impactOf(task.id, tasks);
      return {
        task,
        downstreamCount: downstream.length,
        estimate: task.estimate + downstream.reduce((sum, i) => sum + i.task.estimate, 0),
      };
    })
    .sort((a, b) => b.downstreamCount - a.downstreamCount || b.estimate - a.estimate)
    .slice(0, limit);
}

export interface MilestoneImpact {
  milestone: Milestone;
  expectedDate: string;
  delayDays: number;
}

export function affectedMilestones(project: Project, impacts: ImpactInfo[]): MilestoneImpact[] {
  return project.milestones
    .map((milestone) => {
      const sameStage = impacts.filter((i) => i.task.stage === milestone.stage);
      const maxDelay = sameStage.reduce((max, i) => Math.max(max, i.delayDays), 0);
      return {
        milestone,
        expectedDate: addDays(milestone.date, maxDelay),
        delayDays: maxDelay,
      };
    })
    .filter((m) => m.delayDays > 0)
    .sort((a, b) => b.delayDays - a.delayDays);
}

export interface FactorCard {
  key: "schedule" | "bottleneck" | "workload" | "impact";
  label: string;
  value: string;
  detail: string;
  weight: number;
  tone: "danger" | "caution" | "normal";
}

export function riskFactors(
  project: Project,
  allTasks: Task[],
  issues: Issue[],
  users: User[],
  settings: { weights: { schedule: number; bottleneck: number; workload: number; impact: number } },
): FactorCard[] {
  const projectTasks = allTasks.filter((t) => t.projectId === project.id);
  const leaves = leafTasks(projectTasks);
  const late = leaves.filter((t) => isLateTask(t, TODAY));
  const openIssues = issues.filter((i) => i.projectId === project.id && i.status !== "closed");

  const fanOut = projectTasks.map((t) => successorsOf(t.id, projectTasks).length);
  const bottleneckTask = projectTasks[fanOut.indexOf(Math.max(0, ...fanOut))];

  const openLeaves = leaves.filter((t) => t.status !== "done");
  const byAssignee = new Map<string, number>();
  openLeaves.forEach((t) => byAssignee.set(t.assigneeId || "none", (byAssignee.get(t.assigneeId || "none") || 0) + 1));
  const total = openLeaves.length || 1;
  const topEntry = Array.from(byAssignee.entries()).sort((a, b) => b[1] - a[1])[0];
  const topName = topEntry ? users.find((u) => u.id === topEntry[0])?.name || "미지정" : "-";
  const topShare = topEntry ? Math.round((topEntry[1] / total) * 100) : 0;

  const ripple = topRippleTasks(projectTasks, 1)[0];

  return [
    {
      key: "schedule",
      label: "일정 지연",
      value: `${late.length}건`,
      detail: late[0] ? `대표: ${late[0].name} (${Math.abs(diffDays(TODAY, late[0].endDate))}일 경과)` : "지연 업무 없음",
      weight: settings.weights.schedule,
      tone: late.length > 0 ? "danger" : "normal",
    },
    {
      key: "bottleneck",
      label: "병목 구간",
      value: `${Math.max(0, ...fanOut)}개 후행`,
      detail: bottleneckTask ? `${bottleneckTask.name}에 후속 작업 집중` : "의존 관계 없음",
      weight: settings.weights.bottleneck,
      tone: Math.max(0, ...fanOut) >= 2 ? "caution" : "normal",
    },
    {
      key: "workload",
      label: "인력 편중",
      value: `${topShare}%`,
      detail: `${topName}에게 미완료 업무 ${topEntry?.[1] || 0}건 집중`,
      weight: settings.weights.workload,
      tone: topShare > 45 ? "danger" : topShare > 30 ? "caution" : "normal",
    },
    {
      key: "impact",
      label: "파급 효과",
      value: `${ripple?.downstreamCount || 0}개`,
      detail: ripple ? `${ripple.task.name} 지연 시 연쇄 영향` : "파급 작업 없음",
      weight: settings.weights.impact,
      tone: (ripple?.downstreamCount || 0) >= 3 ? "danger" : (ripple?.downstreamCount || 0) > 0 ? "caution" : "normal",
    },
  ];
}

export function issueOpenCount(issues: Issue[], projectId: string): number {
  return issues.filter((i) => i.projectId === projectId && i.status !== "closed").length;
}