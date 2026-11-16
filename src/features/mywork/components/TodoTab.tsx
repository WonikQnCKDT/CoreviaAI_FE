import { useMemo } from "react";
import { useDemoStore } from "@/stores/DemoStore";
import { deadlineInfo, diffDays, TODAY, type DeadlineTone } from "@/utils/date";
import { PriorityBadge, StatusBadge, Badge } from "@/components/ui/Badge";
import ProgressBar from "@/components/ui/ProgressBar";
import EmptyState from "@/components/ui/EmptyState";
import InfoTip from "@/components/ui/InfoTip";
import AssigneeStack from "@/components/ui/AssigneeStack";
import { assigneeIdsOf, isAssignedTo } from "@/utils/assignee";
import TeamPeers from "@/features/mywork/components/TeamPeers";
import { TASK_FILTERS, type TaskFilter } from "@/features/mywork/utils/filters";
import type { Task } from "@/types";

interface TodoTabProps {
  onAddTask: () => void;
  filter: TaskFilter;
  onFilterChange: (filter: TaskFilter) => void;
}

const FILTER_HELP =
  "진행 중: 완료되지 않은 업무 · 오늘: 오늘 마감 · 마감 임박: 1~3일 내 마감 · 지연: 마감일이 지난 업무 · 완료: 완료 처리된 업무 · 전체: 완료 포함 모든 업무";

const DEADLINE_BADGE_CLASS: Record<Exclude<DeadlineTone, "none">, string> = {
  late: "border-rose-200 bg-rose-50 text-rose-600",
  today: "border-amber-200 bg-amber-50 text-amber-700",
  future: "border-background-300 bg-background-100 text-foreground-600",
  done: "border-emerald-200 bg-emerald-50 text-emerald-600",
};

export default function TodoTab({ onAddTask, filter, onFilterChange }: TodoTabProps) {
  const { tasks, projects, users, currentUser, openTask, setTaskStatus } = useDemoStore();

  const myTasks = useMemo(() => tasks.filter((t) => isAssignedTo(t, currentUser.id)), [tasks, currentUser.id]);

  const matches = (task: Task) => {
    if (filter === "today") return task.endDate === TODAY && task.status !== "done";
    if (filter === "soon") {
      const dday = diffDays(TODAY, task.endDate);
      return dday > 0 && dday <= 3 && task.status !== "done";
    }
    if (filter === "late") return task.endDate < TODAY && task.status !== "done";
    if (filter === "done") return task.status === "done";
    if (filter === "open") return task.status !== "done";
    return true;
  };

  const visibleTasks = useMemo(
    () =>
      myTasks
        .filter(matches)
        .slice()
        .sort((a, b) => {
          const aDone = a.status === "done" ? 1 : 0;
          const bDone = b.status === "done" ? 1 : 0;
          if (aDone !== bDone) return aDone - bDone;
          if (a.endDate !== b.endDate) return a.endDate < b.endDate ? -1 : 1;
          return a.name < b.name ? -1 : 1;
        }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [myTasks, filter],
  );

  const counts = useMemo(() => {
    const count = (predicate: (task: Task) => boolean) => myTasks.filter(predicate).length;
    return {
      open: count((t) => t.status !== "done"),
      today: count((t) => t.endDate === TODAY && t.status !== "done"),
      soon: count((t) => {
        const dday = diffDays(TODAY, t.endDate);
        return dday > 0 && dday <= 3 && t.status !== "done";
      }),
      late: count((t) => t.endDate < TODAY && t.status !== "done"),
      done: count((t) => t.status === "done"),
      all: myTasks.length,
    } as Record<TaskFilter, number>;
  }, [myTasks]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex flex-wrap items-center gap-1 rounded-lg border border-background-300 bg-background-50 p-1">
          {TASK_FILTERS.map((item) => (
            <button
              key={item.key}
              type="button"
              onClick={() => onFilterChange(item.key)}
              aria-pressed={filter === item.key}
              className={`flex cursor-pointer items-center gap-1 whitespace-nowrap rounded-md px-2.5 py-1.5 text-[12.5px] font-medium transition ${
                filter === item.key
                  ? "bg-primary-500 text-background-50"
                  : "text-foreground-600 hover:bg-background-100 hover:text-foreground-900"
              }`}
            >
              {item.label}
              <span className={`text-[11px] ${filter === item.key ? "text-background-50/80" : "text-foreground-400"}`}>
                {counts[item.key]}
              </span>
            </button>
          ))}
        </div>
        <InfoTip text={FILTER_HELP} label="필터 기준 보기" />
      </div>

      <section className="card overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-background-200 px-4 py-3">
          <h2 className="flex items-center gap-2 text-[13.5px] font-semibold text-foreground-950">
            <i className="ri-list-check-2 text-primary-500" aria-hidden="true" />
            업무 목록
            <span className="text-[11.5px] font-normal text-foreground-500">{visibleTasks.length}건</span>
          </h2>
        </div>

        {visibleTasks.length === 0 ? (
          <EmptyState
            icon="ri-checkbox-circle-line"
            title="조건에 맞는 업무가 없습니다"
            description={
              filter === "open"
                ? "새로운 개인 할 일을 추가해 내 업무에서 관리할 수 있습니다."
                : "다른 필터를 선택하거나 필터를 해제하면 전체 업무를 확인할 수 있습니다."
            }
            action={
              filter === "open" ? (
                <button type="button" className="btn-outline whitespace-nowrap" onClick={onAddTask}>
                  <i className="ri-add-line" /> 할 일 추가
                </button>
              ) : (
                <button type="button" className="btn-outline whitespace-nowrap" onClick={() => onFilterChange("open")}>
                  <i className="ri-close-line" /> 필터 해제
                </button>
              )
            }
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[880px] border-collapse">
              <thead>
                <tr>
                  <th className="th">업무명</th>
                  <th className="th w-[180px]">프로젝트</th>
                  <th className="th w-[150px]">담당자</th>
                  <th className="th w-[150px]">마감일</th>
                  <th className="th w-[90px]">상태</th>
                  <th className="th w-[130px]">진척률</th>
                </tr>
              </thead>
              <tbody>
                {visibleTasks.map((task) => {
                  const project = projects.find((p) => p.id === task.projectId);
                  const done = task.status === "done";
                  const deadline = deadlineInfo(task.endDate, task.status, TODAY);
                  return (
                    <tr
                      key={task.id}
                      onClick={() => openTask(task.id)}
                      className="cursor-pointer border-b border-background-200 last:border-0 hover:bg-background-100"
                    >
                      <td className="td">
                        <div className="flex items-center gap-2">
                          {task.personal && (
                            <button
                              type="button"
                              aria-label={done ? "완료 취소" : "완료 처리"}
                              title={done ? "완료 취소" : "완료 처리"}
                              onClick={(event) => {
                                event.stopPropagation();
                                setTaskStatus(task.id, done ? "todo" : "done");
                              }}
                              className={`flex h-4 w-4 shrink-0 cursor-pointer items-center justify-center rounded border ${
                                done
                                  ? "border-emerald-500 bg-emerald-500 text-background-50"
                                  : "border-background-400 text-transparent hover:border-primary-400"
                              }`}
                            >
                              <i className="ri-check-line text-[10px]" aria-hidden="true" />
                            </button>
                          )}
                          <div className="flex min-w-0 flex-1 items-center gap-1">
                            <span
                              className={`min-w-0 truncate font-medium ${done ? "text-foreground-400 line-through" : "text-foreground-900"}`}
                            >
                              {task.name}
                            </span>
                            {task.priority ? <PriorityBadge priority={task.priority} /> : null}
                            {task.type === "defect" && (
                              <span className="shrink-0">
                                <Badge className="border-rose-200 bg-rose-50 text-rose-700">결함</Badge>
                              </span>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="td">
                        <span className="block truncate text-[12px] text-foreground-700">
                          {project?.name || (task.personal ? "개인 할 일" : "-")}
                        </span>
                      </td>
                      <td className="td">
                        <AssigneeStack userIds={assigneeIdsOf(task)} users={users} max={2} />
                      </td>
                      <td className="td">
                        <div className="flex items-center gap-1.5">
                          {deadline.tone === "none" ? (
                            <span className="flex items-center gap-1 text-[11.5px] text-foreground-500">
                              <i className="ri-subtract-line text-[12px]" aria-hidden="true" />
                              미정
                            </span>
                          ) : (
                            <>
                              <span className="w-[40px] shrink-0 whitespace-nowrap text-[11.5px] tabular-nums text-foreground-700">
                                {deadline.dateText}
                              </span>
                              <span
                                className={`inline-flex h-[20px] shrink-0 items-center whitespace-nowrap rounded-md border px-1.5 text-[10.5px] font-medium leading-none ${DEADLINE_BADGE_CLASS[deadline.tone]}`}
                              >
                                {deadline.dayText}
                              </span>
                            </>
                          )}
                        </div>
                      </td>
                      <td className="td">
                        <StatusBadge status={task.status} />
                      </td>
                      <td className="td">
                        <ProgressBar value={task.progress} showLabel />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <TeamPeers />
    </div>
  );
}