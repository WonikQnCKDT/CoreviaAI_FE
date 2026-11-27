import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Badge, StatusBadge } from "@/components/ui/Badge";
import EmptyState from "@/components/ui/EmptyState";
import {
  createEvent,
  fetchCalendarTasks,
  fetchEvents,
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
  monthRange,
} from "@/features/mywork/utils/scheduleRules";
import { formatLabel } from "@/shared/i18n/store";
import { monthMatrix, WEEKDAY_LABELS } from "@/utils/date";

type LoadState =
  | { phase: "loading" }
  | { phase: "error"; message: string }
  | { phase: "ready"; events: PersonalEvent[]; tasks: CalendarTask[]; truncated: boolean };

type DayItem = { key: string; kind: "event"; event: PersonalEvent } | { key: string; kind: "task"; task: CalendarTask };

const MAX_IN_CELL = 3;
/** monthMatrix가 월요일부터라 요일 머리글도 월요일부터 */
const MONDAY_FIRST = [...WEEKDAY_LABELS.slice(1), WEEKDAY_LABELS[0]];

/**
 * api 모드 내 일정(FR-PSN-02): 월 보기 + 선택한 날의 목록.
 * 개인 일정은 /me/events(메모 포함), 담당 업무는 /me/calendar의 TASK 항목으로 그린다(한국 날짜 기준).
 * 저장은 서버 성공 뒤 그 달을 다시 받아 반영한다.
 */
export default function ServerCalendarTab({ today = kstToday() }: { today?: string }) {
  const [cursor, setCursor] = useState(() => ({ year: Number(today.slice(0, 4)), month: Number(today.slice(5, 7)) - 1 }));
  const [selected, setSelected] = useState(today);
  const [state, setState] = useState<LoadState>({ phase: "loading" });
  const [dialog, setDialog] = useState<{ mode: "create"; date: string } | { mode: "edit"; event: PersonalEvent } | null>(null);
  const [dialogError, setDialogError] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{ tone: "success" | "error"; text: string } | null>(null);
  const controllerRef = useRef<AbortController | null>(null);
  const busyRef = useRef(false);

  const range = monthRange(cursor.year, cursor.month);

  const load = useCallback(() => {
    controllerRef.current?.abort();
    const controller = new AbortController();
    controllerRef.current = controller;
    const { signal } = controller;
    const { from, to } = monthRange(cursor.year, cursor.month);
    setState((prev) => (prev.phase === "ready" ? prev : { phase: "loading" }));
    Promise.all([fetchEvents({ from, to, signal }), fetchCalendarTasks({ from, to, signal })]).then(([events, tasks]) => {
      if (signal.aborted) return;
      const failed = events.ok === false ? events : tasks.ok === false ? tasks : null;
      if (failed) {
        setState({ phase: "error", message: interpretScheduleFailure("load", failed.failure).message });
        return;
      }
      if (events.ok !== true || tasks.ok !== true) return;
      setState({ phase: "ready", events: events.data.items, tasks: tasks.data.items, truncated: events.data.truncated || tasks.data.truncated });
    });
  }, [cursor.year, cursor.month]);

  useEffect(() => {
    load();
    return () => controllerRef.current?.abort();
  }, [load]);

  const moveMonth = (delta: number) => {
    setCursor((prev) => {
      const index = prev.year * 12 + prev.month + delta;
      return { year: Math.floor(index / 12), month: ((index % 12) + 12) % 12 };
    });
  };

  const goToday = () => {
    setCursor({ year: Number(today.slice(0, 4)), month: Number(today.slice(5, 7)) - 1 });
    setSelected(today);
  };

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
    const view = interpretScheduleFailure("saveEvent", result.failure);
    if (view.reload) {
      setDialog(null);
      setNotice({ tone: "error", text: view.message });
      load();
    } else setDialogError(view.message);
  };

  // 날짜별 항목(이 달 범위 안만)
  const byDate = new Map<string, DayItem[]>();
  if (state.phase === "ready") {
    const push = (date: string, item: DayItem) => byDate.set(date, [...(byDate.get(date) ?? []), item]);
    state.events.forEach((event) => coveredDates(event, range.firstDate, range.nextDate).forEach((d) => push(d, { key: `e-${event.id}`, kind: "event", event })));
    state.tasks.forEach((task) => coveredDates(task, range.firstDate, range.nextDate).forEach((d) => push(d, { key: `t-${task.id}`, kind: "task", task })));
  }
  const dayItems = byDate.get(selected) ?? [];
  // monthMatrix는 월을 1부터 받고 월요일부터 시작한다
  const cells = monthMatrix(cursor.year, cursor.month + 1);
  const inMonth = (date: string) => date >= range.firstDate && date < range.nextDate;

  const itemLabel = (item: DayItem) =>
    item.kind === "event" ? `${item.event.allDay ? SCHEDULE_TEXT.allDayBadge : kstTimeOf(item.event.startAt)} ${item.event.title}` : item.task.title;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <button type="button" className="btn-outline px-2 py-1" aria-label={SCHEDULE_TEXT.prevMonth} onClick={() => moveMonth(-1)}><i className="ri-arrow-left-s-line" aria-hidden="true" /></button>
          <h2 className="min-w-[120px] text-center text-[14px] font-semibold text-foreground-950">
            {formatLabel(SCHEDULE_TEXT.monthTitle, { year: cursor.year, month: cursor.month + 1 })}
          </h2>
          <button type="button" className="btn-outline px-2 py-1" aria-label={SCHEDULE_TEXT.nextMonth} onClick={() => moveMonth(1)}><i className="ri-arrow-right-s-line" aria-hidden="true" /></button>
          <button type="button" className="btn-ghost px-2 py-1 text-[12px]" onClick={goToday}>{SCHEDULE_TEXT.thisMonth}</button>
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
          <div className="card overflow-hidden">
            <div className="grid grid-cols-7 border-b border-background-200 bg-background-100 text-center text-[11px] font-medium text-foreground-600">
              {MONDAY_FIRST.map((w) => <div key={w} className="py-1.5">{w}</div>)}
            </div>
            <div className="grid grid-cols-7">
              {cells.map((date) => {
                const items = byDate.get(date) ?? [];
                const isSelected = date === selected;
                return (
                  <button
                    key={date}
                    type="button"
                    aria-label={formatLabel(SCHEDULE_TEXT.selectDay, { date })}
                    aria-pressed={isSelected}
                    onClick={() => setSelected(date)}
                    className={`min-h-[84px] border-b border-r border-background-200 p-1 text-left align-top ${inMonth(date) ? "" : "bg-background-100/60 text-foreground-400"} ${isSelected ? "ring-2 ring-inset ring-primary-400" : ""}`}
                  >
                    <span className={`text-[11px] ${date === today ? "rounded bg-primary-500 px-1 text-background-50" : ""}`}>{Number(date.slice(8, 10))}</span>
                    <ul className="mt-0.5 space-y-0.5">
                      {items.slice(0, MAX_IN_CELL).map((item) => (
                        <li key={item.key} className={`truncate rounded px-1 text-[10.5px] ${item.kind === "task" ? "bg-primary-50 text-primary-700" : "bg-emerald-50 text-emerald-700"}`}>
                          {itemLabel(item)}
                        </li>
                      ))}
                      {items.length > MAX_IN_CELL && <li className="px-1 text-[10px] text-foreground-500">{formatLabel(SCHEDULE_TEXT.more, { count: items.length - MAX_IN_CELL })}</li>}
                    </ul>
                  </button>
                );
              })}
            </div>
          </div>

          <section className="card p-3" aria-label={formatLabel(SCHEDULE_TEXT.dayTitle, { date: selected })}>
            <h3 className="mb-2 text-[13px] font-semibold text-foreground-950">{formatLabel(SCHEDULE_TEXT.dayTitle, { date: selected })}</h3>
            {dayItems.length === 0 ? (
              <p className="text-[12px] text-foreground-500">{SCHEDULE_TEXT.dayEmpty}</p>
            ) : (
              <ul className="space-y-1.5">
                {dayItems.map((item) => (
                  <li key={item.key} className="flex flex-wrap items-center gap-2 text-[12.5px]">
                    <Badge className={item.kind === "task" ? "border-primary-200 bg-primary-50 text-primary-700" : "border-emerald-200 bg-emerald-50 text-emerald-700"}>
                      {item.kind === "task" ? SCHEDULE_TEXT.task : SCHEDULE_TEXT.personal}
                    </Badge>
                    <span className="min-w-0 flex-1 break-words text-foreground-900">{itemLabel(item)}</span>
                    {item.kind === "event" && item.event.memo && <span className="w-full whitespace-pre-wrap pl-1 text-[11.5px] text-foreground-500">{item.event.memo}</span>}
                    {item.kind === "task" && <StatusBadge status={item.task.status} />}
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
