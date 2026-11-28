import { useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { useAuth } from "@/features/auth/authContext";
import { useDemoStore } from "@/stores/DemoStore";
import { addDays, diffDays, formatShort, parseDate, referenceToday } from "@/utils/date";
import { STAGES } from "@/utils/ui";
import GanttToolbar from "@/features/task/components/GanttToolbar";
import WorkPlanTabs from "@/features/task/components/WorkPlanTabs";
import { childrenOf, isLateTask, rollupMap } from "@/features/task/utils/taskTree";
import type { StageKey, Task } from "@/types";

type ViewMode = "day" | "week" | "month";

const DAY_WIDTH: Record<ViewMode, number> = { day: 32, week: 12, month: 4 };
const ROW_HEIGHT = 38;
const STAGE_ROW_HEIGHT = 34;
const HEADER_HEIGHT = 44;
const NAME_COL_WIDTH = 300;

interface GanttRow {
  key: string;
  type: "stage" | "task";
  stage: StageKey;
  stageLabel: string;
  stageProgress?: number;
  task?: Task;
  indent?: number;
}

export default function GanttPage() {
  const { projectId } = useParams();
  const { mode } = useAuth();
  const { projects, tasks, users, openTask } = useDemoStore();
  const project = projects.find((p) => p.id === projectId);
  const [view, setView] = useState<ViewMode>("week");
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const baseToday = referenceToday(mode);

  const rangeStart = addDays(project?.startDate || baseToday, -7);
  const rangeEnd = addDays(project?.endDate || baseToday, 7);
  const totalDays = Math.max(diffDays(rangeStart, rangeEnd) + 1, 1);
  const dayWidth = DAY_WIDTH[view];
  const chartWidth = totalDays * dayWidth;

  const projectTasks = useMemo(() => tasks.filter((t) => t.projectId === projectId), [tasks, projectId]);
  const rollup = useMemo(() => rollupMap(projectTasks), [projectTasks]);

  const rows = useMemo<GanttRow[]>(() => {
    const list: GanttRow[] = [];
    STAGES.forEach((stage) => {
      const stageTasks = projectTasks.filter((t) => t.stage === stage.key);
      if (stageTasks.length === 0) return;
      const roots = stageTasks.filter((t) => t.level === 2).sort((a, b) => a.order - b.order);
      const estimate = roots.reduce((sum, t) => sum + (rollup[t.id]?.estimate || 0), 0);
      const progress = estimate > 0 ? Math.round(roots.reduce((sum, t) => sum + (rollup[t.id]?.progress || 0) * (rollup[t.id]?.estimate || 0), 0) / estimate) : 0;
      list.push({ key: `stage-${stage.key}`, type: "stage", stage: stage.key, stageLabel: stage.label, stageProgress: progress });
      roots.forEach((task) => {
        list.push({ key: task.id, type: "task", stage: stage.key, stageLabel: stage.label, task, indent: 0 });
        childrenOf(projectTasks, task.id)
          .sort((a, b) => a.order - b.order)
          .forEach((child) => {
            list.push({ key: child.id, type: "task", stage: stage.key, stageLabel: stage.label, task: child, indent: 1 });
          });
      });
    });
    return list;
  }, [projectTasks, rollup]);

  const bodyHeight = rows.reduce((sum, row) => sum + (row.type === "stage" ? STAGE_ROW_HEIGHT : ROW_HEIGHT), 0);

  useEffect(() => {
    if (!scrollRef.current) return;
    const offset = diffDays(rangeStart, baseToday) * dayWidth;
    scrollRef.current.scrollLeft = Math.max(offset - 240, 0);
  }, [rangeStart, baseToday, dayWidth, view]);

  const headerCells = useMemo(() => {
    const cells: { label: string; width: number; start: string }[] = [];
    if (view === "day") {
      for (let i = 0; i < totalDays; i += 1) {
        const date = addDays(rangeStart, i);
        cells.push({ label: `${Number(date.split("-")[2])}`, width: dayWidth, start: date });
      }
      return cells;
    }
    if (view === "week") {
      for (let i = 0; i < totalDays; i += 7) {
        const date = addDays(rangeStart, i);
        const span = Math.min(7, totalDays - i);
        cells.push({ label: formatShort(date), width: dayWidth * span, start: date });
      }
      return cells;
    }
    let cursor = rangeStart;
    while (cursor <= rangeEnd) {
      const date = parseDate(cursor);
      const daysInMonth = new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
      const remaining = daysInMonth - date.getDate() + 1;
      const width = Math.min(remaining, diffDays(cursor, rangeEnd) + 1) * dayWidth;
      cells.push({ label: `${date.getMonth() + 1}월`, width, start: cursor });
      cursor = addDays(cursor, remaining);
    }
    return cells;
  }, [view, totalDays, rangeStart, rangeEnd, dayWidth]);

  const columnLines = useMemo(() => {
    const lines: number[] = [];
    let left = 0;
    headerCells.slice(0, -1).forEach((cell) => {
      left += cell.width;
      if (left > 0 && left < chartWidth) lines.push(left);
    });
    return lines;
  }, [headerCells, chartWidth]);

  if (!project) return null;

  const position = (start: string, end: string) => {
    const left = diffDays(rangeStart, start) * dayWidth;
    const width = (diffDays(start, end) + 1) * dayWidth;
    return { left, width: Math.max(width, 6) };
  };

  const todayLeft = diffDays(rangeStart, baseToday) * dayWidth;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <WorkPlanTabs projectId={project.id} active="gantt" />
        <span className="text-[10.5px] text-foreground-500">조회 전용 · 일정 수정은 WBS에서 수행합니다</span>
      </div>

      <GanttToolbar
        view={view}
        onChangeView={(next) => setView(next)}
        storageKey={`corevia-gantt-toolbar:${projectId || "default"}`}
      />

      <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[10.5px] text-foreground-600">
        <span className="flex items-center gap-1.5"><span className="h-2.5 w-6 rounded border border-primary-300 bg-primary-100" /> 계획</span>
        <span className="flex items-center gap-1.5"><span className="h-2.5 w-6 rounded bg-primary-500" /> 진척</span>
        <span className="flex items-center gap-1.5"><span className="h-2.5 w-6 rounded bg-rose-400" /> 지연</span>
        <span className="flex items-center gap-1.5"><i className="ri-flag-2-fill text-amber-500" /> 마일스톤</span>
        <span className="flex items-center gap-1.5"><span className="h-3 w-0.5 bg-rose-500" /> 오늘</span>
        <span className="flex items-center gap-1.5"><i className="ri-link-m" /> 선행 관계</span>
      </div>

      <div className="overflow-hidden rounded-lg border border-background-300 bg-background-50">
        <div ref={scrollRef} className="max-h-[calc(100vh-300px)] overflow-auto">
          <div className="relative" style={{ width: NAME_COL_WIDTH + chartWidth }}>
            <div
              className="pointer-events-none absolute z-0"
              style={{ left: NAME_COL_WIDTH, top: HEADER_HEIGHT, width: chartWidth, height: bodyHeight }}
            >
              {columnLines.map((left) => (
                <div key={`grid-${left}`} className="absolute inset-y-0 w-px bg-background-200" style={{ left }} />
              ))}
              {view === "day" &&
                Array.from({ length: totalDays }, (_, i) => addDays(rangeStart, i)).map((date, index) => {
                  const weekend = [0, 6].includes(parseDate(date).getDay());
                  return weekend ? (
                    <div
                      key={`weekend-${date}`}
                      className="absolute inset-y-0 bg-background-100/70"
                      style={{ left: index * dayWidth, width: dayWidth }}
                    />
                  ) : null;
                })}
            </div>

            <div className="sticky top-0 z-20 flex border-b border-background-300 bg-background-100" style={{ height: HEADER_HEIGHT }}>
              <div
                className="sticky left-0 z-[40] flex shrink-0 items-center gap-2 border-r border-background-300 bg-background-100 px-3 text-[11px] font-medium text-foreground-600"
                style={{ width: NAME_COL_WIDTH }}
              >
                <span className="flex-1">단계 · 업무</span>
                <span className="w-[52px] text-right">진척</span>
              </div>
              {headerCells.map((cell, index) => {
                const weekend = view === "day" && [0, 6].includes(parseDate(cell.start).getDay());
                return (
                  <div
                    key={`${cell.label}-${index}`}
                    style={{ width: cell.width }}
                    className={`flex shrink-0 items-center justify-center border-r border-background-200 text-[10px] ${weekend ? "bg-background-200/60 text-foreground-400" : "text-foreground-600"}`}
                  >
                    {cell.label}
                  </div>
                );
              })}
              <div className="min-w-0 flex-1" />
            </div>

            {rows.map((row) => {
              const height = row.type === "stage" ? STAGE_ROW_HEIGHT : ROW_HEIGHT;

              if (row.type === "stage") {
                return (
                  <div
                    key={row.key}
                    className="relative flex border-b border-background-200"
                    style={{ height }}
                  >
                    <div
                      className="sticky left-0 z-[40] flex shrink-0 items-center gap-2 border-r border-background-200 bg-background-100 px-3"
                      style={{ width: NAME_COL_WIDTH }}
                    >
                      <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-primary-400" />
                      <span className="min-w-0 flex-1 truncate text-[11.5px] font-semibold text-foreground-900">{row.stageLabel}</span>
                      <span className="w-[52px] shrink-0 text-right text-[10.5px] tabular-nums text-foreground-500">{row.stageProgress}%</span>
                    </div>
                    <div className="relative flex-1" style={{ width: chartWidth, minWidth: chartWidth }}>
                      <div className="absolute inset-0 bg-background-100/60" />
                    </div>
                  </div>
                );
              }

              const task = row.task as Task;
              const assignee = users.find((u) => u.id === task.assigneeId);
              const value = rollup[task.id];
              const start = value?.startDate || task.startDate;
              const end = value?.endDate || task.endDate;
              const bar = position(start, end);
              const progress = value?.progress ?? task.progress;
              const late = isLateTask(task, baseToday);

              return (
                <div key={row.key} className="relative flex border-b border-background-200" style={{ height }}>
                  <button
                    type="button"
                    onClick={() => openTask(task.id)}
                    className="sticky left-0 z-[40] flex shrink-0 cursor-pointer items-center gap-1.5 border-r border-background-200 bg-background-50 px-3 text-left hover:bg-background-100"
                    style={{ width: NAME_COL_WIDTH }}
                  >
                    <span className={`min-w-0 flex-1 ${row.indent ? "pl-3" : ""}`}>
                      <span className={`block truncate text-[11.5px] ${row.indent ? "text-foreground-600" : "font-medium text-foreground-900"}`}>
                        {task.name}
                      </span>
                      <span className="block truncate text-[9.5px] text-foreground-400">{assignee?.name || "미지정"}</span>
                    </span>
                    <span className={`w-[52px] shrink-0 text-right text-[10.5px] tabular-nums ${late ? "text-rose-600" : "text-foreground-500"}`}>
                      {progress}%
                    </span>
                  </button>
                  <div className="relative flex-1" style={{ width: chartWidth, minWidth: chartWidth }}>
                    <button
                      type="button"
                      onClick={() => openTask(task.id)}
                      title={`${task.name}\n계획 ${start} ~ ${end}\n진척 ${progress}%`}
                      className={`absolute top-1/2 z-10 flex h-3.5 -translate-y-1/2 cursor-pointer items-center rounded-sm border transition hover:brightness-95 ${
                        late ? "border-rose-300 bg-rose-100" : task.status === "done" ? "border-emerald-300 bg-emerald-100" : "border-primary-300 bg-primary-100"
                      }`}
                      style={{ left: bar.left, width: bar.width }}
                    >
                      <span
                        className={`h-full rounded-sm ${late ? "bg-rose-400" : task.status === "done" ? "bg-emerald-500" : "bg-primary-500"}`}
                        style={{ width: `${Math.min(progress, 100)}%` }}
                      />
                      {task.predecessors.length > 0 && (
                        <i className="ri-link-m absolute -left-1 -top-3 text-[10px] text-foreground-400" />
                      )}
                    </button>
                    {bar.width > 76 && (
                      <span
                        className="pointer-events-none absolute top-1/2 z-0 -translate-y-1/2 truncate pl-1 text-[9.5px] text-foreground-500"
                        style={{ left: bar.left + bar.width + 4 }}
                      >
                        {progress}%
                      </span>
                    )}
                  </div>
                </div>
              );
            })}

            {project.milestones.map((milestone) => {
              const left = diffDays(rangeStart, milestone.date) * dayWidth;
              return (
                <div
                  key={milestone.id}
                  className="absolute z-30 -translate-x-1/2"
                  style={{ left: NAME_COL_WIDTH + left, top: HEADER_HEIGHT + 2 }}
                  title={`${milestone.name} · ${milestone.date}`}
                >
                  <span className="flex h-4 w-4 items-center justify-center text-amber-500">
                    <i className="ri-flag-2-fill text-[13px]" />
                  </span>
                </div>
              );
            })}

            <div
              className="pointer-events-none absolute z-20 w-[2px] -translate-x-1/2 bg-rose-500"
              style={{ left: NAME_COL_WIDTH + todayLeft, top: 0, height: HEADER_HEIGHT + bodyHeight }}
            />
            <div
              className="pointer-events-none absolute top-0 z-30 -translate-x-1/2 rounded-b-full bg-rose-500 px-1.5 py-[2px] text-[9px] font-medium text-background-50"
              style={{ left: NAME_COL_WIDTH + todayLeft }}
            >
              TODAY
            </div>
          </div>
        </div>
      </div>

      <p className="text-[10.5px] leading-4 text-foreground-500">
        막대를 클릭하면 공통 업무 상세 패널이 열립니다. 계획 막대는 WBS 일정, 진척 막대는 업무 진척률을 의미합니다. 일정 변경은 WBS에서
        수행하면 간트와 개인 캘린더에 함께 반영됩니다.
      </p>
    </div>
  );
}