import { useMemo, useState, type MouseEvent } from "react";
import { useDemoStore } from "@/stores/DemoStore";
import {
  addDays,
  deadlineInfo,
  formatDate,
  DEADLINE_TONE_CLASS,
  monthMatrix,
  parseDate,
  startOfWeek,
  TODAY,
  WEEKDAY_LABELS,
} from "@/utils/date";
import { projectColor } from "@/utils/ui";
import InfoTip from "@/components/ui/InfoTip";
import ScheduleEditorModal, { type ScheduleFormValue } from "@/features/mywork/components/ScheduleEditorModal";
import { BUTTON_TEXT } from "@/shared/i18n/catalog/button";
import { VIEW_MODE_TEXT } from "@/shared/i18n/catalog/menu";

type ViewMode = "month" | "week" | "day";

interface DayEvent {
  key: string;
  label: string;
  startTime?: string;
  endTime?: string;
  dotClass: string;
  kind: "schedule" | "task" | "milestone";
  taskId?: string;
  scheduleId?: string;
  projectName?: string;
}

const VIEWS: { key: ViewMode; label: string }[] = [
  { key: "month", get label() { return VIEW_MODE_TEXT.month; } },
  { key: "week", get label() { return VIEW_MODE_TEXT.week; } },
  { key: "day", get label() { return VIEW_MODE_TEXT.day; } },
];

const ROW_H = 44;
const START_MIN = 8 * 60;
const END_MIN = 20 * 60;
const TOTAL_MIN = END_MIN - START_MIN;
const TOTAL_H = (TOTAL_MIN / 60) * ROW_H;
const HOURS = Array.from({ length: TOTAL_MIN / 60 }, (_, i) => 8 + i);
const WEEK_COLS = { gridTemplateColumns: "56px repeat(7, minmax(0, 1fr))" };
const DAY_COLS = { gridTemplateColumns: "56px minmax(0, 1fr)" };

const pad2 = (value: number) => String(value).padStart(2, "0");
const hourText = (hour: number) => `${pad2(hour)}:00`;
const toMin = (time: string) => {
  const [h, m] = time.split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
};
const posPx = (minute: number) => ((minute - START_MIN) / 60) * ROW_H;

export default function CalendarTab() {
  const {
    schedules,
    tasks,
    projects,
    currentUser,
    openTask,
    addSchedule,
    updateSchedule,
    deleteSchedule,
  } = useDemoStore();
  const [view, setView] = useState<ViewMode>("month");
  const [cursor, setCursor] = useState(TODAY);
  const [editor, setEditor] = useState<{
    mode: "create" | "edit";
    scheduleId: string | null;
    form: ScheduleFormValue;
  } | null>(null);

  const mySchedules = useMemo(
    () => schedules.filter((s) => s.userId === currentUser.id),
    [schedules, currentUser.id],
  );
  const myTasks = useMemo(
    () => tasks.filter((t) => t.assigneeId === currentUser.id && t.projectId !== null && t.status !== "done"),
    [tasks, currentUser.id],
  );
  const memberProjects = useMemo(
    () => projects.filter((p) => p.members.some((m) => m.userId === currentUser.id) || p.pmId === currentUser.id),
    [projects, currentUser.id],
  );

  const scheduleEventsFor = (date: string): DayEvent[] =>
    mySchedules
      .filter((s) => s.date === date)
      .map((schedule) => {
        const project = projects.find((p) => p.id === schedule.projectId);
        return {
          key: `s-${schedule.id}`,
          label: schedule.title,
          startTime: schedule.startTime,
          endTime: schedule.endTime,
          dotClass: project
            ? projectColor(project.colorKey).dot
            : schedule.type === "meeting"
              ? "bg-primary-500"
              : "bg-accent-500",
          kind: "schedule" as const,
          scheduleId: schedule.id,
          projectName: project?.name,
        };
      })
      .sort((a, b) => (a.startTime || "").localeCompare(b.startTime || ""));

  const allDayEventsFor = (date: string): DayEvent[] => {
    const events: DayEvent[] = [];
    myTasks.forEach((task) => {
      const project = projects.find((p) => p.id === task.projectId);
      if (task.startDate === date) {
        events.push({
          key: `start-${task.id}`,
          label: `${task.name} 시작`,
          dotClass: project ? projectColor(project.colorKey).bar : "bg-primary-400",
          kind: "task",
          taskId: task.id,
          projectName: project?.name,
        });
      }
      if (task.endDate === date) {
        events.push({
          key: `end-${task.id}`,
          label: `${task.name} 마감`,
          dotClass: "bg-rose-500",
          kind: "task",
          taskId: task.id,
          projectName: project?.name,
        });
      }
    });
    memberProjects.forEach((project) => {
      project.milestones
        .filter((m) => m.date === date)
        .forEach((milestone) => {
          events.push({
            key: `m-${milestone.id}`,
            label: `마일스톤 · ${milestone.name}`,
            dotClass: "bg-amber-500",
            kind: "milestone",
            projectName: project.name,
          });
        });
    });
    return events;
  };

  const openCreate = (date: string, startHour = 9) => {
    const start = Math.min(Math.max(startHour, 0), 22);
    setEditor({
      mode: "create",
      scheduleId: null,
      form: {
        title: "",
        date,
        startTime: hourText(start),
        endTime: hourText(start + 1),
        type: "personal",
      },
    });
  };

  const openEdit = (scheduleId: string) => {
    const schedule = mySchedules.find((s) => s.id === scheduleId);
    if (!schedule) return;
    setEditor({
      mode: "edit",
      scheduleId: schedule.id,
      form: {
        title: schedule.title,
        date: schedule.date,
        startTime: schedule.startTime,
        endTime: schedule.endTime,
        type: schedule.type,
      },
    });
  };

  const saveSchedule = (value: ScheduleFormValue) => {
    if (editor?.mode === "edit" && editor.scheduleId) {
      updateSchedule(editor.scheduleId, { ...value });
    } else {
      addSchedule({ ...value });
    }
    setCursor(value.date);
    setEditor(null);
  };

  const monthDate = parseDate(cursor);
  const year = monthDate.getFullYear();
  const month = monthDate.getMonth() + 1;
  const matrix = monthMatrix(year, month);
  const weekStart = startOfWeek(cursor);
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  const tasksInRange = myTasks.filter((t) => t.startDate <= cursor && t.endDate >= cursor);
  const cursorAllDay = allDayEventsFor(cursor);
  const cursorTimed = scheduleEventsFor(cursor);

  const shift = (direction: number) => {
    if (view === "month") {
      const next = new Date(year, month - 1 + direction, 1);
      setCursor(`${next.getFullYear()}-${pad2(next.getMonth() + 1)}-01`);
      return;
    }
    setCursor((prev) => addDays(prev, direction * (view === "week" ? 7 : 1)));
  };

  const headerLabel = () => {
    if (view === "month") return `${year}년 ${month}월`;
    if (view === "week") return `${formatDate(weekStart)} ~ ${formatDate(addDays(weekStart, 6))}`;
    return `${formatDate(cursor)} (${WEEKDAY_LABELS[parseDate(cursor).getDay()]})`;
  };

  const openTaskOrEdit = (event: DayEvent, mouseEvent: MouseEvent) => {
    mouseEvent.preventDefault();
    mouseEvent.stopPropagation();
    if (event.taskId) openTask(event.taskId);
    else if (event.scheduleId) openEdit(event.scheduleId);
  };

  const renderChip = (event: DayEvent, compact = false) => (
    <button
      key={event.key}
      type="button"
      onClick={(mouseEvent) => openTaskOrEdit(event, mouseEvent)}
      title={`${event.startTime ? `${event.startTime}~${event.endTime} · ` : ""}${event.label}${
        event.projectName ? ` · ${event.projectName}` : ""
      }`}
      className="pointer-events-auto flex w-full cursor-pointer items-center gap-1 truncate rounded px-1 py-0.5 text-left text-[10.5px] text-foreground-700 hover:bg-background-100"
    >
      <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${event.dotClass}`} />
      <span className="truncate">
        {compact && event.startTime ? `${event.startTime} ` : ""}
        {event.label}
      </span>
    </button>
  );

  const renderTimedEvent = (event: DayEvent, wide: boolean) => {
    const start = toMin(event.startTime || "09:00");
    const end = toMin(event.endTime || "10:00");
    const top = Math.max(0, posPx(start));
    const height = Math.max(Math.min(posPx(Math.max(end, start + 20)) - posPx(start), TOTAL_H - top), 20);
    return (
      <button
        key={event.key}
        type="button"
        onClick={(mouseEvent) => openTaskOrEdit(event, mouseEvent)}
        style={{ top, height }}
        title={`${event.startTime}~${event.endTime} · ${event.label}${event.projectName ? ` · ${event.projectName}` : ""}`}
        className="absolute inset-x-1 z-10 cursor-pointer overflow-hidden rounded border border-background-300 bg-background-50 px-1 py-0.5 text-left shadow-card transition hover:border-primary-300 hover:bg-primary-50"
      >
        <span className={`absolute inset-y-0 left-0 w-[3px] ${event.dotClass}`} />
        <span className={`block truncate pl-1.5 font-medium text-foreground-900 ${wide ? "text-[11.5px]" : "text-[10px]"}`}>
          {event.label}
        </span>
        <span className="block truncate pl-1.5 text-[9.5px] text-foreground-500">
          {event.startTime}~{event.endTime}
        </span>
      </button>
    );
  };

  const renderHourColumn = (date: string, wide = false) => {
    const events = scheduleEventsFor(date);
    return (
      <div className="relative border-r border-background-200 last:border-r-0" style={{ height: TOTAL_H }}>
        {HOURS.map((hour, index) => (
          <div
            key={hour}
            className={`absolute inset-x-0 border-b border-background-200/80 ${
              index % 2 === 1 ? "bg-background-100/40" : ""
            }`}
            style={{ top: index * ROW_H, height: ROW_H }}
          >
            <button
              type="button"
              onClick={() => openCreate(date, hour)}
              aria-label={`${formatDate(date)} ${hourText(hour)}에 일정 추가`}
              title={BUTTON_TEXT.hintAddScheduleAtTime}
              className="h-full w-full cursor-copy hover:bg-primary-50/70"
            />
          </div>
        ))}
        {events.map((event) => renderTimedEvent(event, wide))}
      </div>
    );
  };

  return (
    <div className="space-y-4">
      <div className="card px-4 py-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" className="btn-outline" onClick={() => shift(-1)} aria-label={BUTTON_TEXT.previousPeriod} title={BUTTON_TEXT.previousPeriod}>
              <i className="ri-arrow-left-s-line" />
            </button>
            <button type="button" className="btn-outline whitespace-nowrap" onClick={() => setCursor(TODAY)}>
              {BUTTON_TEXT.today}
            </button>
            <button type="button" className="btn-outline" onClick={() => shift(1)} aria-label={BUTTON_TEXT.nextPeriod} title={BUTTON_TEXT.nextPeriod}>
              <i className="ri-arrow-right-s-line" />
            </button>
            <p className="ml-1 text-[14px] font-semibold text-foreground-950">{headerLabel()}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1 rounded-full border border-background-300 bg-background-100 p-1">
              {VIEWS.map((item) => (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => setView(item.key)}
                  className={`cursor-pointer rounded-full px-3.5 py-1 text-[12px] font-medium transition ${
                    view === item.key
                      ? "bg-background-50 text-primary-700 shadow-card"
                      : "text-foreground-600 hover:text-foreground-900"
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>
            <button
              type="button"
              aria-label={BUTTON_TEXT.calendarHelp}
              title={
                view === "month"
                  ? BUTTON_TEXT.hintCalendarMonth
                  : BUTTON_TEXT.hintCalendarTime
              }
              className="flex h-8 w-8 cursor-help items-center justify-center rounded-md border border-background-300 text-foreground-500 hover:bg-background-100 hover:text-foreground-800"
            >
              <i className="ri-question-line text-[15px]" aria-hidden="true" />
            </button>
            <button type="button" className="btn-primary whitespace-nowrap" onClick={() => openCreate(cursor)}>
              <i className="ri-calendar-event-line" aria-hidden="true" />
              {BUTTON_TEXT.addPersonalSchedule}
            </button>
          </div>
        </div>
      </div>

      {view === "month" && (
        <div className="card overflow-hidden">
          <div className="grid grid-cols-7 border-b border-background-200 bg-background-100">
            {WEEKDAY_LABELS.map((label, index) => (
              <div
                key={label}
                className={`px-2 py-2 text-center text-[11px] font-medium ${
                  index === 0 ? "text-rose-500" : index === 6 ? "text-primary-500" : "text-foreground-600"
                }`}
              >
                {label}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-7">
            {matrix.map((date) => {
              const inMonth = parseDate(date).getMonth() + 1 === month;
              const events = [...scheduleEventsFor(date), ...allDayEventsFor(date)];
              const isToday = date === TODAY;
              return (
                <div
                  key={date}
                  className={`group relative min-h-[104px] border-b border-r border-background-200 p-1.5 last:border-r-0 ${
                    inMonth ? "bg-background-50" : "bg-background-100/60"
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => openCreate(date)}
                    aria-label={`${formatDate(date)}에 일정 추가`}
                    title={BUTTON_TEXT.hintAddScheduleOnDate}
                    className="absolute inset-0 z-0 flex cursor-copy items-end justify-end p-1 text-foreground-300 hover:bg-primary-50/50 hover:text-primary-500"
                  >
                    <i className="ri-add-line text-[13px] opacity-0 transition group-hover:opacity-100" aria-hidden="true" />
                  </button>
                  <div className="pointer-events-none relative z-10">
                    <div className="mb-1 flex items-center justify-between">
                      <button
                        type="button"
                        onClick={(mouseEvent) => {
                          mouseEvent.stopPropagation();
                          setCursor(date);
                          setView("day");
                        }}
                        title={BUTTON_TEXT.openDayView}
                        className={`pointer-events-auto flex h-5 min-w-5 cursor-pointer items-center justify-center rounded-full px-1 text-[11px] hover:ring-1 hover:ring-primary-300 ${
                          isToday
                            ? "bg-primary-500 font-semibold text-background-50"
                            : inMonth
                              ? "text-foreground-700"
                              : "text-foreground-400"
                        }`}
                      >
                        {Number(date.split("-")[2])}
                      </button>
                      {events.length > 0 && (
                        <span className="text-[9.5px] text-foreground-400">{events.length}</span>
                      )}
                    </div>
                    <div className="space-y-0.5">
                      {events.slice(0, 3).map((event) => renderChip(event, true))}
                      {events.length > 3 && (
                        <span className="block px-1 text-[10px] text-foreground-500">+{events.length - 3}건</span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {view === "week" && (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <div className="min-w-[880px]">
              <div className="grid border-b border-background-200" style={WEEK_COLS}>
                <div className="bg-background-100" />
                {weekDays.map((date) => {
                  const isToday = date === TODAY;
                  return (
                    <button
                      key={date}
                      type="button"
                      onClick={() => {
                        setCursor(date);
                        setView("day");
                      }}
                      title={BUTTON_TEXT.openDayView}
                      className={`flex cursor-pointer items-center justify-between border-l border-background-200 px-2 py-2 ${
                        isToday ? "bg-primary-50" : "bg-background-100 hover:bg-background-200/60"
                      }`}
                    >
                      <span className={`text-[11px] ${isToday ? "font-semibold text-primary-700" : "text-foreground-600"}`}>
                        {WEEKDAY_LABELS[parseDate(date).getDay()]}
                      </span>
                      <span className={`text-[11.5px] ${isToday ? "font-semibold text-primary-700" : "text-foreground-800"}`}>
                        {Number(date.split("-")[2])}
                      </span>
                    </button>
                  );
                })}
              </div>
              <div className="grid border-b border-background-200 bg-background-50" style={WEEK_COLS}>
                <div className="border-r border-background-200 px-1 py-1 text-[10px] text-foreground-500">종일</div>
                {weekDays.map((date) => {
                  const events = allDayEventsFor(date);
                  return (
                    <div key={date} className="min-h-[34px] space-y-0.5 border-r border-background-200 p-1 last:border-r-0">
                      {events.slice(0, 2).map((event) => renderChip(event))}
                      {events.length > 2 && (
                        <span className="block px-1 text-[10px] text-foreground-500">+{events.length - 2}건</span>
                      )}
                    </div>
                  );
                })}
              </div>
              <div className="grid" style={WEEK_COLS}>
                <div className="border-r border-background-200">
                  {HOURS.map((hour) => (
                    <div
                      key={hour}
                      className="border-b border-background-200/80 px-1 pt-0.5 text-[10px] tabular-nums text-foreground-400"
                      style={{ height: ROW_H }}
                    >
                      {hourText(hour)}
                    </div>
                  ))}
                </div>
                {weekDays.map((date) => (
                  <div key={date} className={date === TODAY ? "bg-primary-50/30" : ""}>
                    {renderHourColumn(date)}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {view === "day" && (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <div className="card overflow-hidden lg:col-span-2">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-background-200 px-4 py-3">
              <h2 className="text-[13.5px] font-semibold text-foreground-950">일정 · 업무</h2>
              <span className="text-[11.5px] text-foreground-500">
                일정 {cursorTimed.length}건 · 업무 {cursorAllDay.length}건
              </span>
            </div>
            <div className="grid border-b border-background-200 bg-background-50" style={DAY_COLS}>
              <div className="border-r border-background-200 px-1 py-1 text-[10px] text-foreground-500">종일</div>
              <div className="min-h-[34px] space-y-0.5 p-1">
                {cursorAllDay.length === 0 ? (
                  <span className="px-1 text-[10.5px] text-foreground-400">해당 없음</span>
                ) : (
                  cursorAllDay.map((event) => renderChip(event))
                )}
              </div>
            </div>
            <div className="grid" style={DAY_COLS}>
              <div className="border-r border-background-200">
                {HOURS.map((hour) => (
                  <div
                    key={hour}
                    className="border-b border-background-200/80 px-1 pt-0.5 text-[10px] tabular-nums text-foreground-400"
                    style={{ height: ROW_H }}
                  >
                    {hourText(hour)}
                  </div>
                ))}
              </div>
              {renderHourColumn(cursor, true)}
            </div>
          </div>
          <div className="card h-fit">
            <div className="border-b border-background-200 px-4 py-3">
              <h2 className="text-[13.5px] font-semibold text-foreground-950">진행 중인 내 업무</h2>
            </div>
            <ul className="divide-y divide-background-200">
              {tasksInRange.length === 0 && (
                <li className="px-4 py-8 text-center text-[12.5px] text-foreground-500">
                  이 날짜에 진행 중인 업무가 없습니다.
                </li>
              )}
              {tasksInRange.map((task) => {
                const project = projects.find((p) => p.id === task.projectId);
                const deadline = deadlineInfo(task.endDate, task.status, TODAY);
                return (
                  <li key={task.id}>
                    <button
                      type="button"
                      onClick={() => openTask(task.id)}
                      className="flex w-full cursor-pointer items-start gap-2 px-4 py-3 text-left hover:bg-background-100"
                    >
                      <span
                        className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ${
                          project ? projectColor(project.colorKey).dot : "bg-primary-500"
                        }`}
                      />
                      <span className="min-w-0">
                        <span className="block truncate text-[12.5px] font-medium text-foreground-900">{task.name}</span>
                        <span className="mt-0.5 block truncate text-[11px] text-foreground-500">
                          {project?.name} · {task.progress}% ·{" "}
                          <span className={DEADLINE_TONE_CLASS[deadline.tone]}>{deadline.full}</span>
                        </span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        </div>
      )}

      <div className="card flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-2.5">
        <span className="flex items-center gap-1 text-[11.5px] font-medium text-foreground-700">
          색상 구분
          <InfoTip text="업무 시작일은 프로젝트 색, 마감일은 빨간 점, 개인 일정은 청록, 마일스톤은 주황 점으로 표시됩니다." />
        </span>
        {memberProjects.slice(0, 4).map((project) => (
          <span key={project.id} className="flex items-center gap-1.5 text-[11px] text-foreground-600">
            <span className={`h-2 w-2 rounded-full ${projectColor(project.colorKey).dot}`} />
            {project.name}
          </span>
        ))}
        <span className="flex items-center gap-1.5 text-[11px] text-foreground-600">
          <span className="h-2 w-2 rounded-full bg-accent-500" /> 개인 일정
        </span>
        <span className="flex items-center gap-1.5 text-[11px] text-foreground-600">
          <span className="h-2 w-2 rounded-full bg-amber-500" /> 마일스톤
        </span>
        <span className="flex items-center gap-1.5 text-[11px] text-foreground-600">
          <span className="h-2 w-2 rounded-full bg-rose-500" /> 업무 마감일
        </span>
      </div>

      <ScheduleEditorModal
        open={Boolean(editor)}
        mode={editor?.mode || "create"}
        initial={
          editor?.form || {
            title: "",
            date: cursor,
            startTime: "09:00",
            endTime: "10:00",
            type: "personal",
          }
        }
        onClose={() => setEditor(null)}
        onSave={saveSchedule}
        onDelete={
          editor?.scheduleId
            ? () => {
                deleteSchedule(editor.scheduleId as string);
                setEditor(null);
              }
            : undefined
        }
      />
    </div>
  );
}