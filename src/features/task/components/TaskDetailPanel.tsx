import { useEffect, useMemo, useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";
import { useNavigate } from "react-router-dom";
import { useDemoStore } from "@/stores/DemoStore";
import { DEADLINE_TONE_CLASS, deadlineInfo, formatDate, TODAY } from "@/utils/date";
import { ROLE_LABEL, STAGE_LABEL, PRIORITY_LABEL, TASK_STATUS_LABEL } from "@/utils/ui";
import { childrenOf, isLateTask, rollupMap } from "@/features/task/utils/taskTree";
import Avatar from "@/components/ui/Avatar";
import AssigneeMultiSelect from "@/features/task/components/AssigneeMultiSelect";
import AssigneeStack from "@/components/ui/AssigneeStack";
import { assigneeIdsOf } from "@/utils/assignee";
import { Badge, PriorityBadge, StatusBadge } from "@/components/ui/Badge";
import Modal from "@/components/ui/Modal";
import InfoTip from "@/components/ui/InfoTip";
import { EFFORT_TOOLTIP, effortDetailText } from "@/features/task/utils/effort";
import { clearUnsavedGuard, setUnsavedGuard } from "@/utils/navGuard";

function stamp(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(d.getMonth() + 1)}.${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

const STATUS_OPTIONS = ["todo", "progress", "review", "done"] as const;

const PANEL_DEFAULT_WIDTH = 560;
const PANEL_MIN_WIDTH = 360;
const PANEL_MAX_WIDTH = 980;
const PANEL_WIDTH_STORAGE_KEY = "corevia-task-panel-width";

export default function TaskDetailPanel() {
  const navigate = useNavigate();
  const {
    activeTaskId,
    closeTask,
    tasks,
    projects,
    users,
    comments,
    history,
    openTask,
    updateTask,
    setTaskAssignees,
    setTaskStatus,
    addComment,
    deleteTask,
    currentUser,
  } = useDemoStore();

  const [commentDraft, setCommentDraft] = useState("");
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [sliderValue, setSliderValue] = useState(0);
  const [progressDragging, setProgressDragging] = useState(false);
  const progressTrackRef = useRef<HTMLDivElement | null>(null);
  const sliderValueRef = useRef(0);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [historyPage, setHistoryPage] = useState(1);
  const [closeConfirm, setCloseConfirm] = useState(false);

  const [panelWidth, setPanelWidth] = useState(() => {
    if (typeof window === "undefined") return PANEL_DEFAULT_WIDTH;
    const saved = Number(window.localStorage.getItem(PANEL_WIDTH_STORAGE_KEY));
    return saved >= PANEL_MIN_WIDTH && saved <= PANEL_MAX_WIDTH ? saved : PANEL_DEFAULT_WIDTH;
  });
  const [panelResizing, setPanelResizing] = useState(false);
  const panelResizeStart = useRef({ x: 0, width: PANEL_DEFAULT_WIDTH });

  const clampPanelWidth = (next: number) => {
    const viewportMax = typeof window === "undefined" ? PANEL_MAX_WIDTH : Math.max(PANEL_MIN_WIDTH, Math.min(PANEL_MAX_WIDTH, window.innerWidth - 96));
    return Math.max(PANEL_MIN_WIDTH, Math.min(viewportMax, Math.round(next)));
  };

  const savePanelWidth = (next: number) => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(PANEL_WIDTH_STORAGE_KEY, String(next));
  };

  const startPanelResize = (event: ReactPointerEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    panelResizeStart.current = { x: event.clientX, width: panelWidth };
    setPanelResizing(true);
  };

  const movePanelResize = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!panelResizing) return;
    const delta = panelResizeStart.current.x - event.clientX;
    setPanelWidth(clampPanelWidth(panelResizeStart.current.width + delta));
  };

  const endPanelResize = () => {
    if (!panelResizing) return;
    setPanelResizing(false);
    savePanelWidth(panelWidth);
  };

  const resetPanelWidth = () => {
    setPanelWidth(PANEL_DEFAULT_WIDTH);
    savePanelWidth(PANEL_DEFAULT_WIDTH);
  };

  const task = tasks.find((t) => t.id === activeTaskId) || null;
  const project = task?.projectId ? projects.find((p) => p.id === task.projectId) : null;
  const rollup = useMemo(() => rollupMap(tasks), [tasks]);
  const childTasks = task ? childrenOf(tasks, task.id) : [];
  const taskComments = task ? comments.filter((c) => c.taskId === task.id) : [];
  const taskHistory = task ? history.filter((h) => h.taskId === task.id) : [];
  const sortedHistory = taskHistory
    .slice()
    .sort((a, b) => (a.createdAt < b.createdAt ? 1 : a.createdAt > b.createdAt ? -1 : 0));
  const recentHistory = sortedHistory.slice(0, 3);
  const historyPageSize = 10;
  const pagedHistory = sortedHistory.slice(0, historyPage * historyPageSize);
  const historyGroups: { date: string; items: typeof sortedHistory }[] = [];
  pagedHistory.forEach((entry) => {
    const date = entry.createdAt.slice(0, 10);
    const lastGroup = historyGroups[historyGroups.length - 1];
    if (lastGroup && lastGroup.date === date) lastGroup.items.push(entry);
    else historyGroups.push({ date, items: [entry] });
  });
  const assigneeIds = assigneeIdsOf(task);

  useEffect(() => {
    setSliderValue(task?.progress ?? 0);
    sliderValueRef.current = task?.progress ?? 0;
  }, [task?.id, task?.progress]);

  // 저장하지 않은 코멘트가 있을 때만 이탈 확인을 사용합니다.
  useEffect(() => {
    const message = "작성 중인 코멘트가 저장되지 않았습니다.";
    if (commentDraft.trim()) setUnsavedGuard(message);
    else clearUnsavedGuard(message);
    return () => clearUnsavedGuard(message);
  }, [commentDraft]);
  const memberOptions = project
    ? project.members.map((m) => {
        const member = users.find((u) => u.id === m.userId);
        return {
          id: m.userId,
          name: member?.name || "",
          dept: member?.dept,
          roleLabel: ROLE_LABEL[m.role],
          projectRole: m.role,
        };
      })
    : users.map((u) => ({ id: u.id, name: u.name, dept: u.dept, roleLabel: ROLE_LABEL[u.role], projectRole: u.role }));

  if (!task) return null;

  const requestClose = () => {
    if (commentDraft.trim()) {
      setCloseConfirm(true);
      return;
    }
    closeTask();
  };

  const late = isLateTask(task, TODAY);
  const deadline = deadlineInfo(task.endDate, task.status, TODAY);
  const value = rollup[task.id];
  const mentionChips = memberOptions.slice(0, 5);

  const handleComment = () => {
    const content = commentDraft.trim();
    if (!content) return;
    addComment(task.id, content);
    setCommentDraft("");
  };

  const applyProgressFromX = (clientX: number) => {
    const track = progressTrackRef.current;
    if (!track) return;
    const rect = track.getBoundingClientRect();
    if (rect.width <= 0) return;
    const ratio = (clientX - rect.left) / rect.width;
    const next = Math.max(0, Math.min(100, Math.round((ratio * 100) / 5) * 5));
    sliderValueRef.current = next;
    setSliderValue(next);
  };

  const commitProgress = () => {
    const next = sliderValueRef.current;
    if (next === task.progress) return;
    updateTask(task.id, {
      progress: next,
      status: next >= 100 ? "done" : task.status === "done" ? "progress" : task.status,
    });
  };

  const nudgeProgress = (delta: number) => {
    const next = Math.max(0, Math.min(100, sliderValueRef.current + delta));
    sliderValueRef.current = next;
    setSliderValue(next);
  };

  const renderMentions = (text: string) =>
    text.split(/(@[가-힣A-Za-z0-9]+)/g).map((part, index) =>
      part.startsWith("@") ? (
        <span key={index} className="font-medium text-primary-700">
          {part}
        </span>
      ) : (
        <span key={index}>{part}</span>
      ),
    );

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <button
        type="button"
        aria-label="업무 상세 닫기"
        onClick={requestClose}
        className="absolute inset-0 cursor-default bg-foreground-950/25"
      />
      <aside
        className={`relative flex h-full w-full flex-col border-l border-background-300 bg-background-50 shadow-panel ${
          panelResizing ? "select-none" : ""
        }`}
        style={{ maxWidth: panelWidth }}
      >
        <div
          role="separator"
          aria-orientation="vertical"
          aria-label="업무 상세 창 너비 조절"
          aria-valuemin={PANEL_MIN_WIDTH}
          aria-valuemax={PANEL_MAX_WIDTH}
          aria-valuenow={panelWidth}
          tabIndex={0}
          title="드래그하여 창 너비 조절 (더블클릭하면 기본 크기)"
          onPointerDown={startPanelResize}
          onPointerMove={movePanelResize}
          onPointerUp={endPanelResize}
          onPointerCancel={endPanelResize}
          onDoubleClick={resetPanelWidth}
          onKeyDown={(event) => {
            if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
            event.preventDefault();
            const next = clampPanelWidth(panelWidth + (event.key === "ArrowLeft" ? 24 : -24));
            setPanelWidth(next);
            savePanelWidth(next);
          }}
          className="group absolute inset-y-0 left-0 z-30 hidden w-3 -translate-x-1/2 cursor-col-resize touch-none select-none outline-none sm:block"
        >
          <span
            className={`absolute left-1/2 top-1/2 h-12 w-[3px] -translate-x-1/2 -translate-y-1/2 rounded-full transition-colors ${
              panelResizing ? "bg-primary-500" : "bg-background-300 group-hover:bg-primary-400"
            }`}
          />
          <span
            className={`pointer-events-none absolute left-1/2 top-1/2 flex h-9 w-4 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-background-300 bg-background-50 text-foreground-400 shadow-sm transition-opacity ${
              panelResizing ? "opacity-100" : "opacity-0 group-hover:opacity-100"
            }`}
          >
            <i className="ri-draggable text-[10px]" aria-hidden="true" />
          </span>
        </div>
        <div className="flex items-start justify-between gap-3 border-b border-background-200 px-5 py-4">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-foreground-500">
              {project ? (
                <button
                  type="button"
                  onClick={() => {
                    closeTask();
                    navigate(`/projects/${project.id}`);
                  }}
                  className="cursor-pointer font-medium text-primary-600 hover:text-primary-700"
                >
                  {project.name}
                </button>
              ) : (
                <span className="font-medium text-foreground-600">개인 할 일</span>
              )}
              {task.stage && (
                <>
                  <i className="ri-arrow-right-s-line text-foreground-300" />
                  <span>{STAGE_LABEL[task.stage]}</span>
                </>
              )}
              {late && (
                <Badge className="border-rose-200 bg-rose-50 text-rose-700">
                  <i className="ri-alarm-warning-line" /> 지연
                </Badge>
              )}
              {task.personal && <Badge className="border-background-300 bg-background-100 text-foreground-600">개인</Badge>}
            </div>
            <h2 className="mt-1.5 text-[17px] font-semibold leading-6 text-foreground-950">{task.name}</h2>
            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              <Badge className={task.type === "defect" ? "border-rose-200 bg-rose-50 text-rose-700" : "border-primary-200 bg-primary-50 text-primary-700"}>
                {task.type === "defect" ? "결함" : "작업"}
              </Badge>
              <StatusBadge status={task.status} />
              <PriorityBadge priority={task.priority} />
              <Badge
                className={
                  deadline.tone === "late"
                    ? "border-rose-200 bg-rose-50 text-rose-700"
                    : deadline.tone === "today"
                      ? "border-amber-200 bg-amber-50 text-amber-700"
                      : deadline.tone === "done"
                        ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                        : "border-background-300 bg-background-100 text-foreground-600"
                }
              >
                <i className="ri-calendar-line" aria-hidden="true" /> {deadline.full}
              </Badge>
            </div>
          </div>
          <button
            type="button"
            onClick={requestClose}
            aria-label="닫기"
            className="flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-md text-foreground-500 hover:bg-background-200 hover:text-foreground-900"
          >
            <i className="ri-close-line text-lg" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          <section className="rounded-lg border border-background-200 bg-background-100/60 px-4 py-3">
            <div className="flex items-center justify-between text-[12px] text-foreground-600">
              <span className="flex items-center gap-1.5">
                진척률
                <span className="text-[10px] text-foreground-400">막대를 클릭하거나 드래그하세요</span>
              </span>
              <span className="font-semibold text-foreground-900">{sliderValue}%</span>
            </div>
            <div
              ref={progressTrackRef}
              role="slider"
              tabIndex={0}
              aria-label="진척률 조절"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={sliderValue}
              onPointerDown={(event) => {
                event.currentTarget.setPointerCapture(event.pointerId);
                setProgressDragging(true);
                applyProgressFromX(event.clientX);
              }}
              onPointerMove={(event) => {
                if (!progressDragging) return;
                applyProgressFromX(event.clientX);
              }}
              onPointerUp={(event) => {
                if (!progressDragging) return;
                setProgressDragging(false);
                applyProgressFromX(event.clientX);
                commitProgress();
              }}
              onPointerCancel={() => {
                setProgressDragging(false);
                commitProgress();
              }}
              onKeyDown={(event) => {
                if (event.key === "ArrowRight" || event.key === "ArrowUp") {
                  event.preventDefault();
                  nudgeProgress(5);
                }
                if (event.key === "ArrowLeft" || event.key === "ArrowDown") {
                  event.preventDefault();
                  nudgeProgress(-5);
                }
              }}
              onKeyUp={commitProgress}
              onBlur={commitProgress}
              className={`relative mt-3 flex h-4 w-full cursor-pointer touch-none select-none items-center rounded-full outline-none ring-offset-2 focus-visible:ring-2 focus-visible:ring-primary-300 ${
                progressDragging ? "cursor-grabbing" : ""
              }`}
            >
              <span className="absolute inset-x-0 top-1/2 h-2.5 -translate-y-1/2 overflow-hidden rounded-full bg-background-300">
                <span
                  className={`block h-full rounded-full ${
                    task.status === "done" ? "bg-emerald-500" : late ? "bg-rose-500" : "bg-primary-500"
                  }`}
                  style={{ width: `${sliderValue}%` }}
                />
              </span>
              <span
                className={`absolute top-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-background-50 shadow-sm transition-transform ${
                  task.status === "done" ? "bg-emerald-500" : late ? "bg-rose-500" : "bg-primary-500"
                } ${progressDragging ? "scale-110" : ""}`}
                style={{ left: `${sliderValue}%` }}
              />
            </div>
            <div className="mt-1 flex items-center justify-between text-[11px] text-foreground-500">
              <span>계획 {value?.startDate ? `${formatDate(value.startDate)} ~ ${formatDate(value.endDate)}` : "-"}</span>
              <span className={`whitespace-nowrap text-[11px] ${DEADLINE_TONE_CLASS[deadline.tone]}`}>
                {deadline.full}
              </span>
            </div>
          </section>

          <section className="mt-5">
            <h3 className="text-[12.5px] font-semibold text-foreground-900">기본 정보</h3>
            <div className="mt-2.5 grid grid-cols-2 gap-x-3 gap-y-3">
              <div className="col-span-2 block">
                <span className="mb-1 flex items-center gap-1 text-[11px] text-foreground-500">
                  담당자
                  <span className="text-[10px] text-foreground-400">공동 담당 {assigneeIds.length}명</span>
                </span>
                <AssigneeMultiSelect
                  members={memberOptions}
                  value={assigneeIds}
                  onChange={(next) => setTaskAssignees(task.id, next)}
                  compact
                />
                <span className="mt-1 block text-[10.5px] leading-4 text-foreground-500">
                  여러 명을 지정해도 업무는 하나로 유지되며, 선택한 모든 담당자의 ‘내 업무’에 함께 표시됩니다.
                </span>
              </div>
              <label className="block">
                <span className="mb-1 block text-[11px] text-foreground-500">상태</span>
                <select
                  className="field"
                  value={task.status}
                  onChange={(event) => setTaskStatus(task.id, event.target.value as (typeof STATUS_OPTIONS)[number])}
                >
                  {STATUS_OPTIONS.map((status) => (
                    <option key={status} value={status}>
                      {TASK_STATUS_LABEL[status]}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className="mb-1 block text-[11px] text-foreground-500">시작일</span>
                <input
                  type="date"
                  className="field"
                  value={task.startDate}
                  onChange={(event) => updateTask(task.id, { startDate: event.target.value })}
                />
              </label>
              <label className="block">
                <span className="mb-1 block text-[11px] text-foreground-500">종료일</span>
                <input
                  type="date"
                  className="field"
                  value={task.endDate}
                  onChange={(event) => updateTask(task.id, { endDate: event.target.value })}
                />
              </label>
              <label className="block">
                <span className="mb-1 flex items-center gap-1 text-[11px] text-foreground-500">
                  예상 작업량 (인일)
                  <InfoTip label="예상 작업량 설명" text={EFFORT_TOOLTIP} />
                </span>
                <input
                  type="number"
                  min={0}
                  step={0.5}
                  className="field"
                  value={task.estimate || 0}
                  onChange={(event) => updateTask(task.id, { estimate: Number(event.target.value) || 0 })}
                />
                <span className="mt-1 block text-[10.5px] leading-4 text-foreground-500">
                  {effortDetailText(task.estimate || 0)}
                </span>
              </label>
              <label className="block">
                <span className="mb-1 block text-[11px] text-foreground-500">우선순위</span>
                <select
                  className="field"
                  value={task.priority}
                  onChange={(event) => updateTask(task.id, { priority: event.target.value as "high" | "normal" | "low" })}
                >
                  {(["high", "normal", "low"] as const).map((priority) => (
                    <option key={priority} value={priority}>
                      {PRIORITY_LABEL[priority]}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          </section>

          <section className="mt-5">
            <h3 className="text-[12.5px] font-semibold text-foreground-900">설명</h3>
            <p className="mt-1.5 whitespace-pre-wrap rounded-lg border border-background-200 bg-background-50 px-3 py-2.5 text-[12.5px] leading-6 text-foreground-700">
              {task.description || "등록된 설명이 없습니다."}
            </p>
            <h3 className="mt-4 text-[12.5px] font-semibold text-foreground-900">완료 조건</h3>
            <p className="mt-1.5 whitespace-pre-wrap rounded-lg border border-background-200 bg-background-50 px-3 py-2.5 text-[12.5px] leading-6 text-foreground-700">
              {task.doneCondition || "완료 조건이 등록되지 않았습니다."}
            </p>
          </section>

          <section className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <h3 className="text-[12.5px] font-semibold text-foreground-900">선행작업</h3>
              <ul className="mt-1.5 space-y-1">
                {task.predecessors.length === 0 && <li className="text-[12px] text-foreground-500">없음</li>}
                {task.predecessors.map((id) => {
                  const predecessor = tasks.find((t) => t.id === id);
                  if (!predecessor) return null;
                  return (
                    <li key={id}>
                      <button
                        type="button"
                        onClick={() => openTask(id)}
                        className="flex w-full cursor-pointer items-center gap-1.5 rounded-md border border-background-300 bg-background-50 px-2 py-1.5 text-left text-[11.5px] text-foreground-800 hover:border-primary-300 hover:text-primary-700"
                      >
                        <i className="ri-link-m text-foreground-400" />
                        <span className="truncate">{predecessor.name}</span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
            <div>
              <h3 className="text-[12.5px] font-semibold text-foreground-900">하위작업</h3>
              <ul className="mt-1.5 space-y-1">
                {childTasks.length === 0 && <li className="text-[12px] text-foreground-500">없음</li>}
                {childTasks.map((child) => (
                  <li key={child.id}>
                    <button
                      type="button"
                      onClick={() => openTask(child.id)}
                      className="flex w-full cursor-pointer items-center justify-between gap-1.5 rounded-md border border-background-300 bg-background-50 px-2 py-1.5 text-left text-[11.5px] text-foreground-800 hover:border-primary-300 hover:text-primary-700"
                    >
                      <span className="truncate">{child.name}</span>
                      <span className="shrink-0 text-[10.5px] text-foreground-500">{child.progress}%</span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          </section>

          <section className="mt-5">
            <h3 className="flex items-center gap-1.5 text-[12.5px] font-semibold text-foreground-900">
              코멘트
              <span className="text-[11px] font-normal text-foreground-500">{taskComments.length}건</span>
            </h3>
            <ul className="mt-2 space-y-3">
              {taskComments.length === 0 && <li className="text-[12px] text-foreground-500">첫 코멘트를 남겨 보세요.</li>}
              {taskComments.map((comment) => {
                const writer = users.find((u) => u.id === comment.userId);
                return (
                  <li key={comment.id} className="flex gap-2.5">
                    <Avatar name={writer?.name || "?"} size="sm" />
                    <div className="min-w-0 flex-1">
                      <p className="flex items-center gap-1.5 text-[11.5px]">
                        <span className="font-medium text-foreground-900">{writer?.name}</span>
                        <span className="text-foreground-400">{writer?.dept}</span>
                        <span className="text-foreground-400">· {stamp(comment.createdAt)}</span>
                      </p>
                      <p className="mt-1 whitespace-pre-wrap rounded-lg bg-background-100 px-3 py-2 text-[12.5px] leading-6 text-foreground-800">
                        {renderMentions(comment.content)}
                      </p>
                    </div>
                  </li>
                );
              })}
            </ul>
            <div className="mt-3 rounded-lg border border-background-300 bg-background-50 p-2">
              <textarea
                value={commentDraft}
                onChange={(event) => setCommentDraft(event.target.value)}
                rows={2}
                maxLength={500}
                placeholder="코멘트를 입력하세요. @이름으로 멘션할 수 있습니다."
                className="w-full resize-none border-0 bg-transparent px-1 py-1 text-[12.5px] leading-6 text-foreground-900 outline-none placeholder:text-foreground-400"
              />
              <div className="flex flex-wrap items-center justify-between gap-2 border-t border-background-200 px-1 pt-2">
                <div className="flex flex-wrap gap-1">
                  {mentionChips.map((member) => (
                    <button
                      key={member.id}
                      type="button"
                      onClick={() => setCommentDraft((prev) => `${prev}${prev && !prev.endsWith(" ") ? " " : ""}@${member.name} `)}
                      className="cursor-pointer rounded border border-background-300 px-1.5 py-0.5 text-[10.5px] text-foreground-600 hover:border-primary-300 hover:text-primary-700"
                    >
                      @{member.name}
                    </button>
                  ))}
                </div>
                <button type="button" className="btn-primary" onClick={handleComment} disabled={!commentDraft.trim()}>
                  코멘트 등록
                </button>
              </div>
            </div>
          </section>

          <section className="mt-5 pb-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="flex items-center gap-1.5 text-[12.5px] font-semibold text-foreground-900">
                변경 이력
                <span className="text-[11px] font-normal text-foreground-500">{sortedHistory.length}건</span>
              </h3>
              {sortedHistory.length > 3 && (
                <button
                  type="button"
                  className="flex cursor-pointer items-center gap-1 whitespace-nowrap rounded px-1.5 py-1 text-[11.5px] font-medium text-primary-600 hover:bg-primary-50 hover:text-primary-700"
                  onClick={() => {
                    setHistoryPage(1);
                    setHistoryOpen(true);
                  }}
                >
                  전체 이력 보기({sortedHistory.length})
                  <i className="ri-arrow-right-s-line" aria-hidden="true" />
                </button>
              )}
            </div>
            {recentHistory.length === 0 ? (
              <p className="mt-2 rounded-lg border border-dashed border-background-300 px-3 py-4 text-center text-[12px] text-foreground-500">
                아직 기록된 변경 이력이 없습니다. 상태·일정·담당자를 변경하면 자동으로 기록됩니다.
              </p>
            ) : (
              <>
                <ol className="mt-2 space-y-3 border-l border-background-300 pl-3">
                  {recentHistory.map((entry) => {
                    const actor = users.find((u) => u.id === entry.userId);
                    return (
                      <li key={entry.id} className="relative">
                        <span className="absolute -left-[17px] top-1.5 h-2 w-2 rounded-full border-2 border-background-50 bg-primary-400" />
                        <p className="text-[11.5px] leading-5 text-foreground-800">
                          <span className="font-medium">{entry.field}</span> : {entry.before} →{" "}
                          <span className="font-medium text-foreground-950">{entry.after}</span>
                        </p>
                        <p className="mt-0.5 text-[10.5px] text-foreground-500">
                          {actor?.name || "시스템"} · {stamp(entry.createdAt)}
                        </p>
                      </li>
                    );
                  })}
                </ol>
                {sortedHistory.length > 3 && (
                  <p className="mt-2 text-[10.5px] text-foreground-500">
                    최근 3건만 표시됩니다. 전체 이력은 위 버튼에서 날짜별로 확인할 수 있습니다.
                  </p>
                )}
              </>
            )}
          </section>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-background-200 px-5 py-3">
          {deleteConfirm ? (
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[11.5px] text-foreground-600">이 업무를 삭제할까요?</span>
              <button
                type="button"
                className="btn-outline"
                onClick={() => {
                  deleteTask(task.id);
                  setDeleteConfirm(false);
                }}
              >
                삭제
              </button>
              <button type="button" className="btn-ghost" onClick={() => setDeleteConfirm(false)}>
                취소
              </button>
            </div>
          ) : (
            <button
              type="button"
              className="btn-ghost text-rose-600 hover:bg-rose-50"
              onClick={() => setDeleteConfirm(true)}
            >
              <i className="ri-delete-bin-line" />
              업무 삭제
            </button>
          )}
          <div className="flex items-center gap-2">
            <span className="flex items-center gap-1.5 text-[11px] text-foreground-500">
              {assigneeIds.length > 0 ? (
                <AssigneeStack userIds={assigneeIds} users={users} max={2} />
              ) : (
                <>
                  <Avatar name={currentUser.name} seed={currentUser.id} size="xs" />
                  미지정
                </>
              )}
            </span>
            {task.status !== "done" ? (
              <button type="button" className="btn-primary" onClick={() => setTaskStatus(task.id, "done")}>
                <i className="ri-check-line" />
                완료 처리
              </button>
            ) : (
              <button type="button" className="btn-outline" onClick={() => setTaskStatus(task.id, "progress")}>
                <i className="ri-arrow-go-back-line" />
                완료 취소
              </button>
            )}
          </div>
        </div>
      </aside>

      <Modal
        open={historyOpen}
        title="변경 이력 전체"
        description={`${task.name} · 최신순 ${sortedHistory.length}건`}
        onClose={() => setHistoryOpen(false)}
        footer={
          <button type="button" className="btn-outline whitespace-nowrap" onClick={() => setHistoryOpen(false)}>
            닫기
          </button>
        }
      >
        {historyGroups.length === 0 ? (
          <p className="py-6 text-center text-[12px] text-foreground-500">기록된 이력이 없습니다.</p>
        ) : (
          <div className="space-y-4">
            {historyGroups.map((group) => (
              <div key={group.date}>
                <p className="rounded bg-background-100 px-2 py-1 text-[11px] font-medium text-foreground-600">
                  {formatDate(group.date)}
                </p>
                <ol className="mt-2 space-y-2.5 border-l border-background-300 pl-3">
                  {group.items.map((entry) => {
                    const actor = users.find((u) => u.id === entry.userId);
                    return (
                      <li key={entry.id} className="relative">
                        <span className="absolute -left-[17px] top-1.5 h-2 w-2 rounded-full border-2 border-background-50 bg-primary-400" />
                        <p className="text-[11.5px] leading-5 text-foreground-800">
                          <span className="font-medium">{entry.field}</span> : {entry.before} →{" "}
                          <span className="font-medium text-foreground-950">{entry.after}</span>
                        </p>
                        <p className="mt-0.5 text-[10.5px] text-foreground-500">
                          {actor?.name || "시스템"} · {stamp(entry.createdAt)}
                        </p>
                      </li>
                    );
                  })}
                </ol>
              </div>
            ))}
            {sortedHistory.length > pagedHistory.length && (
              <button
                type="button"
                className="btn-outline w-full whitespace-nowrap"
                onClick={() => setHistoryPage((prev) => prev + 1)}
              >
                더 보기 ({pagedHistory.length}/{sortedHistory.length})
              </button>
            )}
          </div>
        )}
      </Modal>

      <Modal
        open={closeConfirm}
        title="작성 중인 코멘트가 있습니다"
        description="창을 닫으면 입력한 코멘트는 저장되지 않습니다."
        onClose={() => setCloseConfirm(false)}
        width="max-w-md"
        footer={
          <>
            <button type="button" className="btn-outline whitespace-nowrap" onClick={() => setCloseConfirm(false)}>
              계속 작성
            </button>
            <button
              type="button"
              className="btn-primary whitespace-nowrap"
              onClick={() => {
                setCloseConfirm(false);
                setCommentDraft("");
                clearUnsavedGuard("작성 중인 코멘트가 저장되지 않았습니다.");
                closeTask();
              }}
            >
              닫기
            </button>
          </>
        }
      >
        <p className="text-[12.5px] leading-6 text-foreground-700">
          코멘트를 등록하지 않고 닫으려고 합니다. 저장하지 않은 입력이 있을 때만 이 확인을 표시합니다.
        </p>
      </Modal>
    </div>
  );
}