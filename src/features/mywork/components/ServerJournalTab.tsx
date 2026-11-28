import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { StatusBadge } from "@/components/ui/Badge";
import { TASK_STATUS_TO_CODE } from "@/shared/codes/codeStore";
import { useCommonCodes } from "@/shared/codes/useCommonCodes";
import EmptyState from "@/components/ui/EmptyState";
import ProgressBar from "@/components/ui/ProgressBar";
import { fetchTaskDetail } from "@/features/board/api/boardApi";
import {
  fetchCalendarTasks,
  fetchWorklog,
  fetchWorklogDates,
  fetchWorklogTasks,
  saveWorklog,
  saveWorklogTask,
  type CalendarTask,
  type WorklogTaskEntry,
} from "@/features/mywork/api/scheduleApi";
import { WORKLOG_TEXT } from "@/features/mywork/i18n/ko";
import { interpretScheduleFailure, kstDayStart, kstToday, validateTaskLog, WORKLOG_MAX, type TaskLogForm } from "@/features/mywork/utils/scheduleRules";
import { formatLabel } from "@/shared/i18n/store";
import { addDays } from "@/utils/date";

type DayState =
  | { phase: "loading" }
  | { phase: "error"; message: string }
  | { phase: "ready"; savedContent: string; tasks: CalendarTask[]; entries: Map<number, WorklogTaskEntry> };

type Notice = { tone: "success" | "error"; text: string } | null;

const RECENT_DAYS = 30;

const formOf = (task: CalendarTask, entry: WorklogTaskEntry | undefined): TaskLogForm => ({
  content: entry?.content ?? "",
  progress: String(entry?.progress ?? task.progress),
  spentMinutes: String(entry?.spentMinutes ?? 0),
  completed: entry?.completed ?? task.status === "done",
});

/**
 * api 모드 업무일지(FR-PSN-03): 날짜별 노트(본인만) + 그날 기간에 걸친 담당 업무별 기록(진척률·소요 시간·완료).
 * 노트 원문은 브라우저 저장소에 남기지 않고, Markdown은 HTML로 그리지 않는다(입력칸의 텍스트로만).
 * 업무 기록은 저장 직전에 업무 상세로 최신 업무 version을 받아 보낸다(서버가 진척·완료를 업무에 반영).
 */
interface Props {
  today?: string;
  /** 처음 고를 날짜(캘린더에서 넘어올 때). 없으면 오늘 */
  initialDate?: string;
  /** 이 날을 캘린더에서 보기 */
  onOpenCalendar?: (date: string) => void;
}

export default function ServerJournalTab({ today = kstToday(), initialDate, onOpenCalendar }: Props) {
  const { labelOf: taskStatusLabelOf } = useCommonCodes("TASK_STATUS");
  const [date, setDate] = useState(initialDate ?? today);
  const [day, setDay] = useState<DayState>({ phase: "loading" });
  const [content, setContent] = useState("");
  const [forms, setForms] = useState<Record<number, TaskLogForm>>({});
  const [recent, setRecent] = useState<string[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<Notice>(null);
  const controllerRef = useRef<AbortController | null>(null);
  const busyRef = useRef(false);
  // 저장 응답이 늦게 와도 그 사이 다른 날짜로 옮겼으면 화면에 반영하지 않는다
  const dateRef = useRef(date);
  dateRef.current = date;

  const loadRecent = useCallback(() => {
    fetchWorklogDates({ from: addDays(today, -RECENT_DAYS), to: today }).then((result) => {
      setRecent(result.ok === true ? [...result.data].reverse() : []);
    });
  }, [today]);

  const loadDay = useCallback(() => {
    controllerRef.current?.abort();
    const controller = new AbortController();
    controllerRef.current = controller;
    const { signal } = controller;
    setDay({ phase: "loading" });
    Promise.all([
      fetchWorklog({ logDate: date, signal }),
      fetchWorklogTasks({ logDate: date, signal }),
      fetchCalendarTasks({ from: kstDayStart(date), to: kstDayStart(addDays(date, 1)), signal }),
    ]).then(([log, entries, tasks]) => {
      if (signal.aborted) return;
      const failed = log.ok === false ? log : entries.ok === false ? entries : tasks.ok === false ? tasks : null;
      if (failed) {
        setDay({ phase: "error", message: interpretScheduleFailure("load", failed.failure).message });
        return;
      }
      if (log.ok !== true || entries.ok !== true || tasks.ok !== true) return;
      const entryMap = new Map(entries.data.items.map((e) => [e.taskId, e]));
      setDay({ phase: "ready", savedContent: log.data.content, tasks: tasks.data.items, entries: entryMap });
      setContent(log.data.content);
      setForms(Object.fromEntries(tasks.data.items.map((t) => [t.id, formOf(t, entryMap.get(t.id))])));
    });
  }, [date]);

  useEffect(() => {
    loadDay();
    return () => controllerRef.current?.abort();
  }, [loadDay]);

  useEffect(() => {
    loadRecent();
  }, [loadRecent]);

  const begin = () => {
    if (busyRef.current) return false;
    busyRef.current = true;
    setBusy(true);
    setNotice(null);
    return true;
  };
  const end = () => {
    busyRef.current = false;
    setBusy(false);
  };

  /** 저장하지 않은 노트가 있으면 떠나기 전에 확인한다(입력이 사라지지 않게) */
  const confirmLeave = () => !(day.phase === "ready" && content !== day.savedContent) || window.confirm(WORKLOG_TEXT.confirmLeave);

  const changeDate = (next: string) => {
    if (next === date) return;
    if (!confirmLeave()) return;
    setNotice(null);
    setDate(next);
  };

  const saveNote = async () => {
    if (day.phase !== "ready") return;
    const savingDate = date;
    if (content.length > WORKLOG_MAX) {
      setNotice({ tone: "error", text: WORKLOG_TEXT.contentTooLong });
      return;
    }
    if (!begin()) return;
    const result = await saveWorklog({ logDate: savingDate, content });
    end();
    if (dateRef.current !== savingDate) return;
    if (result.ok === true) {
      setDay((prev) => (prev.phase === "ready" ? { ...prev, savedContent: result.data.content } : prev));
      setContent(result.data.content);
      setNotice({ tone: "success", text: formatLabel(WORKLOG_TEXT.noteSaved, { date: savingDate }) });
      loadRecent();
      return;
    }
    const view = interpretScheduleFailure("saveWorklog", result.failure);
    setNotice({ tone: "error", text: view.message });
  };

  const saveTask = async (task: CalendarTask) => {
    if (day.phase !== "ready") return;
    const form = forms[task.id];
    if (!form) return;
    const checked = validateTaskLog(form);
    if (checked.ok === false) {
      setNotice({ tone: "error", text: checked.message });
      return;
    }
    if (!begin()) return;
    const savingDate = date;
    // 업무 version은 칸반·WBS 변경으로 바뀌므로 저장 직전에 다시 받는다
    const detail = await fetchTaskDetail({ projectId: task.projectId, taskId: task.id });
    if (detail.ok === false) {
      end();
      const view = interpretScheduleFailure("saveTaskLog", detail.failure);
      setNotice({ tone: "error", text: view.message });
      if (view.reload) loadDay();
      return;
    }
    const result = await saveWorklogTask({
      logDate: savingDate,
      taskId: task.id,
      input: {
        projectId: task.projectId,
        content: form.content,
        progress: checked.progress,
        spentMinutes: checked.spentMinutes,
        completed: form.completed,
        taskVersion: detail.data.version,
        version: day.entries.get(task.id)?.version ?? 0,
      },
    });
    end();
    if (dateRef.current !== savingDate) return;
    if (result.ok === true) {
      setNotice({ tone: "success", text: formatLabel(WORKLOG_TEXT.taskSaved, { name: task.title }) });
      // 업무 진척률·누적 시간·연결 기록 version이 바뀌었다
      loadDay();
      return;
    }
    const view = interpretScheduleFailure("saveTaskLog", result.failure);
    setNotice({ tone: "error", text: view.message });
    if (view.reload) loadDay();
  };

  const setForm = (taskId: number, patch: Partial<TaskLogForm>) =>
    setForms((prev) => {
      const current = prev[taskId];
      if (!current) return prev;
      const next = { ...current, ...patch };
      // 완료는 진척률 100을 요구한다
      if (patch.completed === true) next.progress = "100";
      return { ...prev, [taskId]: next };
    });

  const fieldClass = "field mt-1 w-full text-[13px]";

  return (
    <div className="grid gap-3 lg:grid-cols-[1fr_220px]">
      <div className="space-y-3">
        <div className="flex flex-wrap items-center gap-1.5">
          <button type="button" className="btn-outline px-2 py-1" aria-label={WORKLOG_TEXT.prevDay} onClick={() => changeDate(addDays(date, -1))}><i className="ri-arrow-left-s-line" aria-hidden="true" /></button>
          <input type="date" className="field w-auto text-[13px]" aria-label={WORKLOG_TEXT.date} value={date} onChange={(e) => e.target.value && changeDate(e.target.value)} />
          <button type="button" className="btn-outline px-2 py-1" aria-label={WORKLOG_TEXT.nextDay} onClick={() => changeDate(addDays(date, 1))}><i className="ri-arrow-right-s-line" aria-hidden="true" /></button>
          <button type="button" className="btn-ghost px-2 py-1 text-[12px]" onClick={() => changeDate(today)}>{WORKLOG_TEXT.today}</button>
          {onOpenCalendar && (
            <button type="button" className="btn-outline ml-auto px-2 py-1 text-[12px]" onClick={() => confirmLeave() && onOpenCalendar(date)}>
              <i className="ri-calendar-line" aria-hidden="true" /> {WORKLOG_TEXT.openCalendar}
            </button>
          )}
        </div>

        {notice && (
          <p role={notice.tone === "error" ? "alert" : "status"} className={`rounded-md px-3 py-2 text-[12px] ${notice.tone === "error" ? "bg-rose-50 text-rose-700" : "bg-emerald-50 text-emerald-700"}`}>
            {notice.text}
          </p>
        )}

        {day.phase === "loading" && <p role="status" className="py-10 text-center text-[13px] text-foreground-500">{WORKLOG_TEXT.loading}</p>}
        {day.phase === "error" && (
          <EmptyState tone="danger" icon="ri-error-warning-line" title={WORKLOG_TEXT.loadFailed} description={day.message}
            action={<button type="button" className="btn-outline" onClick={loadDay}>{WORKLOG_TEXT.retry}</button>} />
        )}
        {day.phase === "ready" && (
          <>
            <section className="card space-y-2 p-3" aria-label={formatLabel(WORKLOG_TEXT.noteTitle, { date })}>
              <h3 className="text-[13px] font-semibold text-foreground-950">{formatLabel(WORKLOG_TEXT.noteTitle, { date })}</h3>
              <p className="text-[11.5px] text-foreground-500">{WORKLOG_TEXT.noteHint}</p>
              <textarea
                className="field w-full font-mono text-[12.5px]"
                rows={8}
                maxLength={WORKLOG_MAX}
                aria-label={formatLabel(WORKLOG_TEXT.noteTitle, { date })}
                placeholder={WORKLOG_TEXT.notePlaceholder}
                value={content}
                onChange={(e) => setContent(e.target.value)}
              />
              <div className="flex items-center justify-between text-[11px] text-foreground-500">
                <span>
                  {formatLabel(WORKLOG_TEXT.counter, { count: content.length.toLocaleString() })}
                  {content !== day.savedContent && <span className="ml-2 text-amber-700">{WORKLOG_TEXT.unsaved}</span>}
                </span>
                <button type="button" className="btn-primary" disabled={busy || content === day.savedContent} onClick={saveNote}>
                  {busy ? WORKLOG_TEXT.saving : WORKLOG_TEXT.saveNote}
                </button>
              </div>
            </section>

            <section className="card space-y-2 p-3" aria-label={WORKLOG_TEXT.tasksTitle}>
              <h3 className="text-[13px] font-semibold text-foreground-950">{WORKLOG_TEXT.tasksTitle}</h3>
              <p className="text-[11.5px] text-foreground-500">{WORKLOG_TEXT.tasksHint}</p>
              {day.tasks.length === 0 && <p className="text-[12px] text-foreground-500">{WORKLOG_TEXT.tasksEmpty}</p>}
              <ul className="space-y-2">
                {day.tasks.map((task) => {
                  const form = forms[task.id] ?? formOf(task, undefined);
                  const doneLocked = task.status === "done";
                  return (
                    <li key={task.id} className="rounded-lg border border-background-300 p-2.5">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="min-w-0 flex-1 break-words text-[13px] font-medium text-foreground-950">{task.title}</span>
                        <StatusBadge status={task.status} label={taskStatusLabelOf(TASK_STATUS_TO_CODE[task.status])} />
                        <span className="text-[11px] text-foreground-500">{formatLabel(WORKLOG_TEXT.totalMinutes, { minutes: task.spentMinutes })}</span>
                        <Link className="btn-ghost px-2 py-0.5 text-[12px]" to={`/projects/${task.projectId}/kanban`} aria-label={`${WORKLOG_TEXT.openProject}: ${task.title}`}>
                          {WORKLOG_TEXT.openProject}
                        </Link>
                      </div>
                      <ProgressBar value={task.progress} showLabel className="mt-1" />
                      <div className="mt-2 grid gap-2 sm:grid-cols-[1fr_96px_110px_auto]">
                        <label className="block text-[11.5px] font-medium text-foreground-700">
                          {WORKLOG_TEXT.taskContent}
                          <input className={fieldClass} maxLength={WORKLOG_MAX} aria-label={`${WORKLOG_TEXT.taskContent}: ${task.title}`} value={form.content} onChange={(e) => setForm(task.id, { content: e.target.value })} />
                        </label>
                        <label className="block text-[11.5px] font-medium text-foreground-700">
                          {WORKLOG_TEXT.progress}
                          <input className={fieldClass} inputMode="numeric" aria-label={`${WORKLOG_TEXT.progress}: ${task.title}`} value={form.progress} disabled={form.completed} onChange={(e) => setForm(task.id, { progress: e.target.value })} />
                        </label>
                        <label className="block text-[11.5px] font-medium text-foreground-700">
                          {WORKLOG_TEXT.spentMinutes}
                          <input className={fieldClass} inputMode="numeric" aria-label={`${WORKLOG_TEXT.spentMinutes}: ${task.title}`} value={form.spentMinutes} onChange={(e) => setForm(task.id, { spentMinutes: e.target.value })} />
                        </label>
                        <div className="flex items-end gap-2">
                          <label className="flex items-center gap-1 pb-2 text-[12px] text-foreground-700" title={doneLocked ? WORKLOG_TEXT.completedLocked : undefined}>
                            <input type="checkbox" checked={form.completed} disabled={doneLocked} aria-label={`${WORKLOG_TEXT.completed}: ${task.title}`} onChange={(e) => setForm(task.id, { completed: e.target.checked })} />
                            {WORKLOG_TEXT.completed}
                          </label>
                          <button type="button" className="btn-outline mb-0.5 px-2 py-1 text-[12px]" disabled={busy} aria-label={`${WORKLOG_TEXT.saveTask}: ${task.title}`} onClick={() => saveTask(task)}>
                            {WORKLOG_TEXT.saveTask}
                          </button>
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </section>
          </>
        )}
      </div>

      <aside className="card h-fit p-3" aria-label={WORKLOG_TEXT.recentTitle}>
        <h3 className="mb-1.5 text-[12.5px] font-semibold text-foreground-900">{WORKLOG_TEXT.recentTitle}</h3>
        {recent !== null && recent.length === 0 && <p className="text-[11.5px] text-foreground-500">{WORKLOG_TEXT.recentEmpty}</p>}
        <ul className="space-y-0.5">
          {(recent ?? []).map((d) => (
            <li key={d}>
              <button type="button" className={`w-full rounded px-2 py-1 text-left text-[12px] ${d === date ? "bg-primary-50 text-primary-700" : "hover:bg-background-100"}`} onClick={() => changeDate(d)}>
                {d}
              </button>
            </li>
          ))}
        </ul>
      </aside>
    </div>
  );
}
