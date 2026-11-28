import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Badge, StatusBadge } from "@/components/ui/Badge";
import { TASK_STATUS_TO_CODE } from "@/shared/codes/codeStore";
import { useCommonCodes } from "@/shared/codes/useCommonCodes";
import EmptyState from "@/components/ui/EmptyState";
import {
  createEvent,
  fetchCalendarTasks,
  fetchEvents,
  fetchWorklogDates,
  updateEvent,
  type CalendarTask,
  type EventInput,
  type PersonalEvent,
} from "@/features/mywork/api/scheduleApi";
import ServerScheduleDialog from "@/features/mywork/components/ServerScheduleDialog";
import { SCHEDULE_TEXT } from "@/features/mywork/i18n/ko";
import {
  coveredDates,
  emptyEventForm,
  formFromEvent,
  interpretScheduleFailure,
  kstTimeOf,
  kstToday,
  moveSelected,
  viewRange,
  type CalendarView,
} from "@/features/mywork/utils/scheduleRules";
import { fetchAllProjects } from "@/features/project/api/projectApi";
import { serverProjectColorKey } from "@/features/project/utils/serverProject";
import { formatLabel } from "@/shared/i18n/store";
import { useDemoStore } from "@/stores/DemoStore";
import { addDays, monthMatrix, WEEKDAY_LABELS } from "@/utils/date";
import { projectColor } from "@/utils/ui";

type LoadState =
  | { phase: "loading" }
  | { phase: "error"; message: string }
  /** notes: 노트를 기록한 날. null이면 받지 못한 것(일정은 그대로 보인다) */
  | { phase: "ready"; events: PersonalEvent[]; tasks: CalendarTask[]; truncated: boolean; notes: Set<string> | null };

type DayItem = { key: string; kind: "event"; event: PersonalEvent } | { key: string; kind: "task"; task: CalendarTask };

const MAX_IN_CELL = 3;
/** monthMatrix가 월요일부터라 요일 머리글도 월요일부터 */
const MONDAY_FIRST = [...WEEKDAY_LABELS.slice(1), WEEKDAY_LABELS[0]];
const VIEWS: { key: CalendarView; label: string }[] = [
  { key: "month", label: SCHEDULE_TEXT.viewMonth },
  { key: "week", label: SCHEDULE_TEXT.viewWeek },
  { key: "day", label: SCHEDULE_TEXT.viewDay },
];
const PREV_LABEL: Record<CalendarView, string> = { month: SCHEDULE_TEXT.prevMonth, week: SCHEDULE_TEXT.prevWeek, day: SCHEDULE_TEXT.prevDay };
const NEXT_LABEL: Record<CalendarView, string> = { month: SCHEDULE_TEXT.nextMonth, week: SCHEDULE_TEXT.nextWeek, day: SCHEDULE_TEXT.nextDay };
/** 개인 일정은 프로젝트 색과 겹치지 않는 중립색 */
const PERSONAL_CHIP = "bg-background-200 text-foreground-700";
const PERSONAL_BADGE = "border-background-300 bg-background-100 text-foreground-700";

const taskColor = (task: CalendarTask) => projectColor(serverProjectColorKey(task.projectId));

interface Props {
  today?: string;
  /** 처음 선택할 날짜(업무일지에서 넘어올 때). 없으면 오늘 */
  initialDate?: string;
  /** 그날 업무 노트로 이동 */
  onOpenNote?: (date: string) => void;
}

/**
 * api 모드 내 일정(FR-PSN-02): 월·주·일 보기 + 선택한 날의 목록.
 * 개인 일정은 /me/events(메모 포함), 담당 업무는 /me/calendar의 TASK 항목, 노트를 쓴 날은 /me/worklogs로 그린다(한국 날짜 기준).
 * 담당 업무는 프로젝트마다 다른 색(다른 화면과 같은 규칙)으로 그린다. 저장은 서버 성공 뒤 그 범위를 다시 받아 반영한다.
 */
export default function ServerCalendarTab({ today = kstToday(), initialDate, onOpenNote }: Props) {
  const { projects } = useDemoStore();
  const { labelOf: taskStatusLabelOf } = useCommonCodes("TASK_STATUS");
  const [view, setView] = useState<CalendarView>("month");
  const [selected, setSelected] = useState(initialDate ?? today);
  const [state, setState] = useState<LoadState>({ phase: "loading" });
  const [projectNames, setProjectNames] = useState<Map<number, string>>(new Map());
  const [dialog, setDialog] = useState<{ mode: "create"; date: string } | { mode: "edit"; event: PersonalEvent } | null>(null);
  const [dialogError, setDialogError] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{ tone: "success" | "error"; text: string } | null>(null);
  const controllerRef = useRef<AbortController | null>(null);
  const busyRef = useRef(false);

  const range = viewRange(view, selected);
  const { from, to, firstDate, nextDate } = range;

  const load = useCallback(() => {
    controllerRef.current?.abort();
    const controller = new AbortController();
    controllerRef.current = controller;
    const { signal } = controller;
    setState((prev) => (prev.phase === "ready" ? prev : { phase: "loading" }));
    Promise.all([
      fetchEvents({ from, to, signal }),
      fetchCalendarTasks({ from, to, signal }),
      // 업무일지 기간 조회는 양끝 날짜 포함
      fetchWorklogDates({ from: firstDate, to: addDays(nextDate, -1), signal }),
    ]).then(([events, tasks, notes]) => {
      if (signal.aborted) return;
      const failed = events.ok === false ? events : tasks.ok === false ? tasks : null;
      if (failed) {
        setState({ phase: "error", message: interpretScheduleFailure("load", failed.failure).message });
        return;
      }
      if (events.ok !== true || tasks.ok !== true) return;
      setState({
        phase: "ready",
        events: events.data.items,
        tasks: tasks.data.items,
        truncated: events.data.truncated || tasks.data.truncated,
        notes: notes.ok === true ? new Set(notes.data) : null,
      });
    });
  }, [from, to, firstDate, nextDate]);

  useEffect(() => {
    load();
    return () => controllerRef.current?.abort();
  }, [load]);

  // 범례에 쓸 프로젝트 이름. 캘린더 응답에는 projectId만 있어 목록을 한 번 받는다(실패하면 번호로 보인다)
  useEffect(() => {
    const controller = new AbortController();
    fetchAllProjects({ signal: controller.signal }).then((result) => {
      if (controller.signal.aborted || result.ok === false) return;
      setProjectNames(new Map(result.data.map((p) => [p.id, p.name])));
    });
    return () => controller.abort();
  }, []);

  const projectName = (projectId: number) =>
    projectNames.get(projectId) || projects.find((p) => p.serverId === projectId)?.name || formatLabel(SCHEDULE_TEXT.projectFallback, { id: projectId });

  const submit = async (input: EventInput) => {
    if (!dialog || busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    setDialogError("");
    const result = dialog.mode === "create" ? await createEvent({ input }) : await updateEvent({ eventId: dialog.event.id, input });
    busyRef.current = false;
    setBusy(false);
    if (result.ok === true) {
      setNotice({ tone: "success", text: formatLabel(dialog.mode === "create" ? SCHEDULE_TEXT.created : SCHEDULE_TEXT.updated, { name: input.title }) });
      setDialog(null);
      load();
      return;
    }
    const failure = interpretScheduleFailure("saveEvent", result.failure);
    if (failure.reload) {
      setDialog(null);
      setNotice({ tone: "error", text: failure.message });
      load();
    } else setDialogError(failure.message);
  };

  // 날짜별 항목(조회 범위 안만)
  const byDate = new Map<string, DayItem[]>();
  if (state.phase === "ready") {
    const push = (date: string, item: DayItem) => byDate.set(date, [...(byDate.get(date) ?? []), item]);
    state.events.forEach((event) => coveredDates(event, firstDate, nextDate).forEach((d) => push(d, { key: `e-${event.id}`, kind: "event", event })));
    state.tasks.forEach((task) => coveredDates(task, firstDate, nextDate).forEach((d) => push(d, { key: `t-${task.id}`, kind: "task", task })));
  }
  const dayItems = byDate.get(selected) ?? [];
  const notes = state.phase === "ready" ? state.notes : null;
  const hasNote = (date: string) => notes?.has(date) === true;
  const inRange = (date: string) => date >= firstDate && date < nextDate;
  const legend = state.phase === "ready" ? [...new Set(state.tasks.map((t) => t.projectId))].sort((a, b) => a - b) : [];

  const itemLabel = (item: DayItem) =>
    item.kind === "event" ? `${item.event.allDay ? SCHEDULE_TEXT.allDayBadge : kstTimeOf(item.event.startAt)} ${item.event.title}` : item.task.title;
  const chipClass = (item: DayItem) => (item.kind === "task" ? taskColor(item.task).chip : PERSONAL_CHIP);

  const title =
    view === "month"
      ? formatLabel(SCHEDULE_TEXT.monthTitle, { year: Number(selected.slice(0, 4)), month: Number(selected.slice(5, 7)) })
      : view === "week"
        ? formatLabel(SCHEDULE_TEXT.weekTitle, { start: firstDate, end: addDays(nextDate, -1) })
        : selected;

  /** 날짜 칸 버튼의 이름. 화면 낭독기도 노트가 있는 날을 알 수 있게 넣는다 */
  const dayLabel = (date: string) =>
    hasNote(date) ? `${formatLabel(SCHEDULE_TEXT.selectDay, { date })} · ${SCHEDULE_TEXT.noteBadge}` : formatLabel(SCHEDULE_TEXT.selectDay, { date });

  /** 칸 안의 날짜 숫자와 노트 표시 */
  const dayHead = (date: string) => (
    <span className="flex items-center gap-1">
      <span className={`text-[11px] ${date === today ? "rounded bg-primary-500 px-1 text-background-50" : ""}`}>{Number(date.slice(8, 10))}</span>
      {/* 버튼 이름(dayLabel)에 노트 여부를 넣으므로 아이콘은 보조 표시만 한다 */}
      {hasNote(date) && <i className="ri-sticky-note-line text-[11px] text-amber-600" aria-hidden="true" title={SCHEDULE_TEXT.noteBadge} />}
    </span>
  );

  const monthGrid = () => {
    const cells = monthMatrix(Number(selected.slice(0, 4)), Number(selected.slice(5, 7)));
    return (
      <div className="grid grid-cols-7">
        {cells.map((date) => {
          const items = byDate.get(date) ?? [];
          const isSelected = date === selected;
          return (
            <button
              key={date}
              type="button"
              aria-label={dayLabel(date)}
              aria-pressed={isSelected}
              onClick={() => setSelected(date)}
              className={`min-h-[84px] border-b border-r border-background-200 p-1 text-left align-top ${inRange(date) ? "" : "bg-background-100/60 text-foreground-400"} ${isSelected ? "ring-2 ring-inset ring-primary-400" : ""}`}
            >
              {dayHead(date)}
              <ul className="mt-0.5 space-y-0.5">
                {items.slice(0, MAX_IN_CELL).map((item) => (
                  <li key={item.key} className={`truncate rounded px-1 text-[10.5px] ${chipClass(item)}`}>{itemLabel(item)}</li>
                ))}
                {items.length > MAX_IN_CELL && <li className="px-1 text-[10px] text-foreground-500">{formatLabel(SCHEDULE_TEXT.more, { count: items.length - MAX_IN_CELL })}</li>}
              </ul>
            </button>
          );
        })}
      </div>
    );
  };

  /** 주 보기: 7일을 나란히, 칸마다 모든 항목(잘라내지 않는다) */
  const weekGrid = () => (
    <div className="grid grid-cols-7">
      {Array.from({ length: 7 }, (_, i) => addDays(firstDate, i)).map((date) => {
        const items = byDate.get(date) ?? [];
        const isSelected = date === selected;
        return (
          <button
            key={date}
            type="button"
            aria-label={dayLabel(date)}
            aria-pressed={isSelected}
            onClick={() => setSelected(date)}
            className={`min-h-[180px] border-r border-background-200 p-1.5 text-left align-top ${isSelected ? "ring-2 ring-inset ring-primary-400" : ""}`}
          >
            {dayHead(date)}
            <ul className="mt-1 space-y-1">
              {items.map((item) => (
                <li key={item.key} className={`break-words rounded px-1 py-0.5 text-[11px] ${chipClass(item)}`}>{itemLabel(item)}</li>
              ))}
            </ul>
          </button>
        );
      })}
    </div>
  );

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-1.5">
          <button type="button" className="btn-outline px-2 py-1" aria-label={PREV_LABEL[view]} onClick={() => setSelected(moveSelected(view, selected, -1))}><i className="ri-arrow-left-s-line" aria-hidden="true" /></button>
          <h2 className="min-w-[120px] text-center text-[14px] font-semibold text-foreground-950">{title}</h2>
          <button type="button" className="btn-outline px-2 py-1" aria-label={NEXT_LABEL[view]} onClick={() => setSelected(moveSelected(view, selected, 1))}><i className="ri-arrow-right-s-line" aria-hidden="true" /></button>
          <button type="button" className="btn-ghost px-2 py-1 text-[12px]" onClick={() => setSelected(today)}>{SCHEDULE_TEXT.today}</button>
          <div role="group" aria-label={SCHEDULE_TEXT.viewLabel} className="ml-1 flex rounded-md border border-background-300 p-0.5">
            {VIEWS.map(({ key, label }) => (
              <button key={key} type="button" aria-pressed={view === key} onClick={() => setView(key)}
                className={`min-h-[24px] min-w-[32px] rounded px-2 text-[12px] ${view === key ? "bg-primary-500 text-background-50" : "text-foreground-700 hover:bg-background-100"}`}>
                {label}
              </button>
            ))}
          </div>
        </div>
        <button type="button" className="btn-primary" onClick={() => { setDialogError(""); setDialog({ mode: "create", date: selected }); }}>
          <i className="ri-add-line" /> {SCHEDULE_TEXT.add}
        </button>
      </div>

      {notice && (
        <p role={notice.tone === "error" ? "alert" : "status"} className={`rounded-md px-3 py-2 text-[12px] ${notice.tone === "error" ? "bg-rose-50 text-rose-700" : "bg-emerald-50 text-emerald-700"}`}>
          {notice.text}
        </p>
      )}

      {state.phase === "loading" && <p role="status" className="py-10 text-center text-[13px] text-foreground-500">{SCHEDULE_TEXT.loading}</p>}
      {state.phase === "error" && (
        <EmptyState tone="danger" icon="ri-error-warning-line" title={SCHEDULE_TEXT.loadFailed} description={state.message}
          action={<button type="button" className="btn-outline" onClick={load}>{SCHEDULE_TEXT.retry}</button>} />
      )}
      {state.phase === "ready" && (
        <>
          {state.truncated && <p className="text-[11.5px] text-amber-700">{SCHEDULE_TEXT.truncated}</p>}
          {state.notes === null && <p className="text-[11.5px] text-amber-700">{SCHEDULE_TEXT.notesUnavailable}</p>}

          {legend.length > 0 && (
            <ul aria-label={SCHEDULE_TEXT.legend} className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11.5px] text-foreground-700">
              <li className="flex items-center gap-1"><span className={`h-2.5 w-2.5 rounded-sm ${PERSONAL_CHIP}`} aria-hidden="true" />{SCHEDULE_TEXT.personal}</li>
              {legend.map((projectId) => (
                <li key={projectId} className="flex items-center gap-1">
                  <span className={`h-2.5 w-2.5 rounded-sm ${projectColor(serverProjectColorKey(projectId)).dot}`} aria-hidden="true" />
                  {projectName(projectId)}
                </li>
              ))}
            </ul>
          )}

          {view !== "day" && (
            <div className="card overflow-hidden">
              <div className="grid grid-cols-7 border-b border-background-200 bg-background-100 text-center text-[11px] font-medium text-foreground-600">
                {MONDAY_FIRST.map((w) => <div key={w} className="py-1.5">{w}</div>)}
              </div>
              {view === "month" ? monthGrid() : weekGrid()}
            </div>
          )}

          <section className="card p-3" aria-label={formatLabel(SCHEDULE_TEXT.dayTitle, { date: selected })}>
            <h3 className="mb-2 text-[13px] font-semibold text-foreground-950">{formatLabel(SCHEDULE_TEXT.dayTitle, { date: selected })}</h3>
            {dayItems.length === 0 ? (
              <p className="text-[12px] text-foreground-500">{SCHEDULE_TEXT.dayEmpty}</p>
            ) : (
              <ul className="space-y-1.5">
                {dayItems.map((item) => (
                  <li key={item.key} className="flex flex-wrap items-center gap-2 text-[12.5px]">
                    <Badge className={item.kind === "task" ? `${taskColor(item.task).chip} ${taskColor(item.task).border}` : PERSONAL_BADGE}>
                      {item.kind === "task" ? projectName(item.task.projectId) : SCHEDULE_TEXT.personal}
                    </Badge>
                    <span className="min-w-0 flex-1 break-words text-foreground-900">{itemLabel(item)}</span>
                    {item.kind === "event" && item.event.memo && <span className="w-full whitespace-pre-wrap pl-1 text-[11.5px] text-foreground-500">{item.event.memo}</span>}
                    {item.kind === "task" && <StatusBadge status={item.task.status} label={taskStatusLabelOf(TASK_STATUS_TO_CODE[item.task.status])} />}
                    {item.kind === "event" ? (
                      <button type="button" className="btn-ghost px-2 py-0.5 text-[12px]" disabled={busy} aria-label={`${SCHEDULE_TEXT.edit}: ${item.event.title}`}
                        onClick={() => { setDialogError(""); setDialog({ mode: "edit", event: item.event }); }}>
                        {SCHEDULE_TEXT.edit}
                      </button>
                    ) : (
                      <Link className="btn-ghost px-2 py-0.5 text-[12px]" to={`/projects/${item.task.projectId}/kanban`} aria-label={`${SCHEDULE_TEXT.openProject}: ${item.task.title}`}>
                        {SCHEDULE_TEXT.openProject}
                      </Link>
                    )}
                  </li>
                ))}
              </ul>
            )}

            {onOpenNote && (
              <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-background-200 pt-2">
                <p className="text-[12px] text-foreground-600">
                  <span className="font-medium text-foreground-900">{SCHEDULE_TEXT.noteTitle}</span>{" "}
                  {notes === null ? "" : hasNote(selected) ? SCHEDULE_TEXT.noteExists : SCHEDULE_TEXT.noteNone}
                </p>
                <button type="button" className="btn-outline px-2 py-1 text-[12px]" onClick={() => onOpenNote(selected)}>
                  <i className="ri-sticky-note-line" aria-hidden="true" /> {hasNote(selected) ? SCHEDULE_TEXT.openNote : SCHEDULE_TEXT.writeNote}
                </button>
              </div>
            )}
          </section>
        </>
      )}

      {dialog && (
        <ServerScheduleDialog
          mode={dialog.mode}
          initial={dialog.mode === "create" ? emptyEventForm(dialog.date) : formFromEvent(dialog.event)}
          submitting={busy}
          error={dialogError}
          onClose={() => setDialog(null)}
          onSubmit={submit}
        />
      )}
    </div>
  );
}
