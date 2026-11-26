import { useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { useDemoStore } from "@/stores/DemoStore";
import AssigneeStack from "@/components/ui/AssigneeStack";
import { assigneeIdsOf } from "@/utils/assignee";
import ProgressBar from "@/components/ui/ProgressBar";
import Modal from "@/components/ui/Modal";
import { Badge, PriorityBadge } from "@/components/ui/Badge";
import EmptyState from "@/components/ui/EmptyState";
import { DEADLINE_TONE_CLASS, deadlineInfo, TODAY } from "@/utils/date";
import { STAGES, STAGE_LABEL, TASK_STATUS_LABEL } from "@/utils/ui";
import { childrenOf } from "@/features/task/utils/taskTree";
import WorkPlanTabs from "@/features/task/components/WorkPlanTabs";
import type { KanbanWip, StageKey, TaskStatus } from "@/types";
import { BUTTON_TEXT } from "@/shared/i18n/catalog/button";

const COLUMNS: { key: TaskStatus; label: string; icon: string; accent: string }[] = [
  { key: "todo", icon: "ri-inbox-archive-line", accent: "bg-background-400", get label() { return TASK_STATUS_LABEL.todo; } },
  { key: "progress", icon: "ri-loader-4-line", accent: "bg-primary-500", get label() { return TASK_STATUS_LABEL.progress; } },
  { key: "review", icon: "ri-eye-line", accent: "bg-amber-500", get label() { return TASK_STATUS_LABEL.review; } },
  { key: "done", icon: "ri-checkbox-circle-line", accent: "bg-emerald-500", get label() { return TASK_STATUS_LABEL.done; } },
];

export default function KanbanPage() {
  const { projectId } = useParams();
  const { projects, tasks, users, currentUser, openTask, setTaskStatus, setKanbanWip } = useDemoStore();
  const project = projects.find((p) => p.id === projectId);

  const [stageFilter, setStageFilter] = useState<"all" | StageKey>("all");
  const [assigneeFilter, setAssigneeFilter] = useState<"all" | string>("all");
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [overColumn, setOverColumn] = useState<TaskStatus | null>(null);
  const [wipOpen, setWipOpen] = useState(false);
  const [wipForm, setWipForm] = useState<KanbanWip>(project?.kanbanWip || { todo: 5, progress: 4, review: 3, done: 99 });
  const [wipError, setWipError] = useState("");

  const projectTasks = useMemo(() => tasks.filter((t) => t.projectId === projectId), [tasks, projectId]);

  const boardTasks = useMemo(
    () =>
      projectTasks.filter((task) => {
        const isLeaf = task.level === 3 || childrenOf(projectTasks, task.id).length === 0;
        if (!isLeaf) return false;
        if (stageFilter !== "all" && task.stage !== stageFilter) return false;
        if (assigneeFilter !== "all" && !assigneeIdsOf(task).includes(assigneeFilter)) return false;
        return true;
      }),
    [projectTasks, stageFilter, assigneeFilter],
  );

  if (!project) return null;

  const isPm = project.pmId === currentUser.id;
  const members = project.members.map((m) => users.find((u) => u.id === m.userId)).filter(Boolean);
  const overColumns = COLUMNS.filter((col) => boardTasks.filter((t) => t.status === col.key).length > project.kanbanWip[col.key]);

  const openWipModal = () => {
    setWipForm(project.kanbanWip);
    setWipError("");
    setWipOpen(true);
  };

  const saveWip = () => {
    const invalid = Object.entries(wipForm).find(([key, value]) => key !== "done" && (Number.isNaN(value) || value < 1));
    if (invalid) {
      setWipError("WIP 한도는 1 이상이어야 합니다.");
      return;
    }
    setKanbanWip(project.id, wipForm);
    setWipOpen(false);
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <WorkPlanTabs projectId={project.id} active="kanban" />
          <span className="text-[10.5px] text-foreground-500">
            {boardTasks.length}개 카드 · 카드를 드래그하면 WBS와 상태가 함께 변경됩니다
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <select
            className="field w-auto min-w-[108px] text-[12px]"
            value={stageFilter}
            onChange={(event) => setStageFilter(event.target.value as "all" | StageKey)}
          >
            <option value="all">단계 전체</option>
            {STAGES.map((stage) => (
              <option key={stage.key} value={stage.key}>
                {stage.label}
              </option>
            ))}
          </select>
          <select
            className="field w-auto min-w-[116px] text-[12px]"
            value={assigneeFilter}
            onChange={(event) => setAssigneeFilter(event.target.value)}
          >
            <option value="all">담당자 전체</option>
            {members.map((member) => (
              <option key={member?.id} value={member?.id}>
                {member?.name}
              </option>
            ))}
          </select>
          <button
            type="button"
            className="btn-outline"
            onClick={openWipModal}
            disabled={!isPm}
            title={isPm ? BUTTON_TEXT.hintSetWipLimit : BUTTON_TEXT.hintWipPmOnly}
          >
            <i className="ri-settings-3-line" />
            {BUTTON_TEXT.setWipLimit}
          </button>
        </div>
      </div>

      {!isPm && (
        <p className="flex items-center gap-1.5 rounded-md border border-background-300 bg-background-100 px-3 py-2 text-[11px] text-foreground-600">
          <i className="ri-lock-line" />
          WIP 한도 설정은 프로젝트 PM({users.find((u) => u.id === project.pmId)?.name})만 변경할 수 있습니다. 현재 계정은 조회만 가능합니다.
        </p>
      )}

      {overColumns.length > 0 && (
        <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3.5 py-2.5">
          <i className="ri-error-warning-line mt-0.5 text-amber-600" />
          <p className="text-[11.5px] leading-5 text-amber-800">
            <span className="font-semibold">WIP 한도 초과</span> ·{" "}
            {overColumns
              .map((col) => {
                const count = boardTasks.filter((t) => t.status === col.key).length;
                return `${col.label} ${count}건 / 한도 ${project.kanbanWip[col.key]}건`;
              })
              .join(", ")}
            . 진행 중인 업무를 먼저 완료로 이동해 병목을 해소하세요.
          </p>
        </div>
      )}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {COLUMNS.map((column) => {
          const columnTasks = boardTasks.filter((t) => t.status === column.key);
          const limit = project.kanbanWip[column.key];
          const over = columnTasks.length > limit;
          const isOverTarget = overColumn === column.key;
          return (
            <div
              key={column.key}
              onDragOver={(event) => {
                event.preventDefault();
                setOverColumn(column.key);
              }}
              onDragLeave={() => setOverColumn((prev) => (prev === column.key ? null : prev))}
              onDrop={(event) => {
                event.preventDefault();
                const taskId = event.dataTransfer.getData("text/plain") || draggingId;
                if (taskId) setTaskStatus(taskId, column.key);
                setDraggingId(null);
                setOverColumn(null);
              }}
              className={`flex min-h-[460px] flex-col rounded-xl border bg-background-100/70 transition ${
                over ? "border-rose-300" : isOverTarget ? "border-primary-400 bg-primary-50/40" : "border-background-300"
              }`}
            >
              <div className="flex items-center justify-between gap-2 border-b border-background-200 px-3 py-2.5">
                <span className="flex items-center gap-1.5">
                  <span className={`h-1.5 w-1.5 rounded-full ${column.accent}`} />
                  <span className="text-[12.5px] font-semibold text-foreground-900">{column.label}</span>
                  <span className="text-[11px] tabular-nums text-foreground-500">{columnTasks.length}</span>
                </span>
                <span
                  className={`rounded px-1.5 py-[1px] text-[10px] ${
                    over ? "bg-rose-100 font-medium text-rose-700" : "bg-background-200 text-foreground-500"
                  }`}
                  title="WIP 한도"
                >
                  WIP {column.key === "done" ? "∞" : limit}
                </span>
              </div>

              <div className="flex-1 space-y-2 px-2 py-2">
                {columnTasks.length === 0 && (
                  <div className="flex h-[120px] flex-col items-center justify-center rounded-lg border border-dashed border-background-300 bg-background-50/60 text-center">
                    <i className="ri-drag-move-2-line text-[16px] text-foreground-400" />
                    <p className="mt-1 text-[10.5px] text-foreground-500">이 컬럼으로 카드를 이동하세요</p>
                  </div>
                )}
                {columnTasks.map((task) => {
                  const deadline = deadlineInfo(task.endDate, task.status, TODAY);
                  const late = deadline.late;
                  return (
                    <article
                      key={task.id}
                      draggable
                      onDragStart={(event) => {
                        event.dataTransfer.setData("text/plain", task.id);
                        event.dataTransfer.effectAllowed = "move";
                        setDraggingId(task.id);
                      }}
                      onDragEnd={() => {
                        setDraggingId(null);
                        setOverColumn(null);
                      }}
                      onClick={() => openTask(task.id)}
                      className={`cursor-grab rounded-lg border bg-background-50 px-2.5 py-2.5 transition hover:border-primary-300 hover:shadow-card active:cursor-grabbing ${
                        draggingId === task.id ? "border-primary-400 opacity-60" : "border-background-300"
                      }`}
                    >
                      <div className="flex flex-wrap items-center gap-1">
                        <Badge className="border-background-300 bg-background-100 text-foreground-600">
                          {task.stage ? STAGE_LABEL[task.stage] : "-"}
                        </Badge>
                        {task.type === "defect" && <Badge className="border-rose-200 bg-rose-50 text-rose-700">결함</Badge>}
                        <PriorityBadge priority={task.priority} />
                      </div>
                      <p className="mt-1.5 text-[12.5px] font-medium leading-5 text-foreground-950">{task.name}</p>
                      <div className="mt-2 flex items-center justify-between gap-2">
                        <AssigneeStack userIds={assigneeIdsOf(task)} users={users} max={3} avatarsOnly className="min-w-0" />
                        <span
                          className={`shrink-0 whitespace-nowrap text-[10px] ${DEADLINE_TONE_CLASS[deadline.tone]}`}
                          title="마감일과 오늘 기준 남은 일수"
                        >
                          <i className="ri-calendar-line mr-0.5" />
                          {deadline.full}
                        </span>
                      </div>
                      <div className="mt-2">
                        <ProgressBar
                          value={task.progress}
                          showLabel
                          color={task.status === "done" ? "bg-emerald-500" : late ? "bg-rose-500" : "bg-primary-500"}
                        />
                      </div>
                    </article>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {boardTasks.length === 0 && (
        <div className="card">
          <EmptyState
            icon="ri-layout-grid-line"
            title="필터 조건에 해당하는 업무가 없습니다"
            description="단계·담당자 필터를 변경하거나 WBS에서 업무를 추가해 주세요."
            action={
              <button
                type="button"
                className="btn-outline"
                onClick={() => {
                  setStageFilter("all");
                  setAssigneeFilter("all");
                }}
              >
                {BUTTON_TEXT.resetFilters}
              </button>
            }
          />
        </div>
      )}

      <p className="text-[10.5px] text-foreground-500">
        완료 컬럼은 WIP 한도를 적용하지 않습니다. 상태를 완료로 변경하면 진척률이 100%로 갱신되고 변경 이력에 기록됩니다.
      </p>

      <Modal
        open={wipOpen}
        title="WIP 한도 설정"
        description="컬럼별 동시 진행 업무 수를 제한합니다. 한도를 넘으면 경고가 표시됩니다."
        onClose={() => setWipOpen(false)}
        footer={
          <>
            <button type="button" className="btn-outline" onClick={() => setWipOpen(false)}>
              {BUTTON_TEXT.cancel}
            </button>
            <button type="button" className="btn-primary" onClick={saveWip}>
              {BUTTON_TEXT.save}
            </button>
          </>
        }
      >
        <div className="space-y-3">
          {COLUMNS.filter((col) => col.key !== "done").map((col) => (
            <label key={col.key} className="flex items-center justify-between gap-3">
              <span className="text-[12.5px] text-foreground-800">
                {col.label} ({TASK_STATUS_LABEL[col.key]})
              </span>
              <input
                type="number"
                min={1}
                max={30}
                className="field w-[96px] text-right"
                value={wipForm[col.key]}
                onChange={(event) => setWipForm({ ...wipForm, [col.key]: Number(event.target.value) })}
              />
            </label>
          ))}
          <div className="flex items-center justify-between gap-3 border-t border-background-200 pt-3">
            <span className="text-[12.5px] text-foreground-800">완료</span>
            <span className="text-[11.5px] text-foreground-500">한도 없음 (∞)</span>
          </div>
          {wipError && <p className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-[11.5px] text-rose-700">{wipError}</p>}
        </div>
      </Modal>
    </div>
  );
}