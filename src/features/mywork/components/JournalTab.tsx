import { useEffect, useMemo, useRef, useState } from "react";
import { useDemoStore } from "@/stores/DemoStore";
import { addDays, diffDays, formatDate, startOfWeek, TODAY, weekdayOf } from "@/utils/date";
import { Badge, PriorityBadge } from "@/components/ui/Badge";
import ProgressBar from "@/components/ui/ProgressBar";
import EmptyState from "@/components/ui/EmptyState";
import InfoTip from "@/components/ui/InfoTip";
import { TASK_STATUS_LABEL } from "@/utils/ui";
import { BUTTON_TEXT } from "@/shared/i18n/catalog/button";

type Scope = "day" | "week";

interface SummaryItem {
  title: string;
  lines: string[];
}

export default function JournalTab({ focusRequest }: { focusRequest: number }) {
  const { journals, tasks, projects, currentUser, addJournal, setTaskStatus, openTask } = useDemoStore();
  const [scope, setScope] = useState<Scope>("day");
  const [anchor, setAnchor] = useState(TODAY);
  const [form, setForm] = useState({
    date: TODAY,
    content: "",
    taskId: "",
    progress: 0,
    hours: 1,
  });
  const [error, setError] = useState("");
  const [summary, setSummary] = useState<SummaryItem[] | null>(null);
  const [highlightId, setHighlightId] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    if (focusRequest > 0) {
      setForm((prev) => ({ ...prev, date: TODAY }));
      textareaRef.current?.focus();
    }
  }, [focusRequest]);

  const linkableTasks = tasks.filter((t) => t.assigneeId === currentUser.id);
  const selectedTask = tasks.find((t) => t.id === form.taskId);

  const range = useMemo(() => {
    if (scope === "day") return { start: anchor, end: anchor };
    const start = startOfWeek(anchor);
    return { start, end: addDays(start, 6) };
  }, [scope, anchor]);

  const scopedJournals = journals
    .filter((j) => j.userId === currentUser.id && j.date >= range.start && j.date <= range.end)
    .slice()
    .sort((a, b) => (a.date < b.date ? 1 : -1));

  const shift = (direction: number) => {
    setAnchor((prev) => addDays(prev, direction * (scope === "day" ? 1 : 7)));
    setSummary(null);
  };

  const handleSubmit = () => {
    if (!form.content.trim()) {
      setError("수행 내용을 입력해 주세요.");
      return;
    }
    if (form.hours <= 0) {
      setError("소요 시간을 0.5시간 이상 입력해 주세요.");
      return;
    }
    if (form.progress < 0 || form.progress > 100) {
      setError("진척률은 0~100 사이로 입력해 주세요.");
      return;
    }
    addJournal({
      date: form.date,
      content: form.content.trim(),
      taskId: form.taskId || null,
      progress: form.progress,
      hours: form.hours,
    });
    setForm({ date: form.date, content: "", taskId: "", progress: 0, hours: 1 });
    setError("");
    setAnchor(form.date);
    setSummary(null);
  };

  const buildSummary = () => {
    const progressed = scopedJournals.filter((j) => j.taskId);
    const hours = scopedJournals.reduce((sum, j) => sum + j.hours, 0);
    const tasksTouched = progressed
      .map((j) => tasks.find((t) => t.id === j.taskId))
      .filter((t): t is NonNullable<typeof t> => Boolean(t));
    const uniqueTasks = Array.from(new Map(tasksTouched.map((t) => [t.id, t])).values());
    const doneTasks = uniqueTasks.filter((t) => t.status === "done");
    const riskTasks = uniqueTasks.filter((t) => t.status !== "done" && t.endDate <= addDays(TODAY, 3));
    const nextActions = tasks
      .filter((t) => t.assigneeId === currentUser.id && t.status !== "done" && diffDays(TODAY, t.endDate) <= 3)
      .slice(0, 3);

    const items: SummaryItem[] = [
      {
        title: `기록 ${scopedJournals.length}건 · 소요 ${hours}시간`,
        lines: scopedJournals.slice(0, 3).map((j) => `${formatDate(j.date)} · ${j.content.slice(0, 44)}${j.content.length > 44 ? "…" : ""}`),
      },
      {
        title: `연결 업무 ${uniqueTasks.length}건 중 완료 ${doneTasks.length}건`,
        lines: uniqueTasks.slice(0, 4).map((t) => `${t.name} · ${TASK_STATUS_LABEL[t.status]} ${t.progress}%`),
      },
      {
        title: "이번 주 확인이 필요한 업무",
        lines: nextActions.length
          ? nextActions.map((t) => `${t.name} · 마감 ${formatDate(t.endDate)} (${projects.find((p) => p.id === t.projectId)?.name || "개인"})`)
          : ["마감이 임박한 업무가 없습니다."],
      },
      {
        title: "일정 지연 신호",
        lines: riskTasks.length
          ? riskTasks.map((t) => `${t.name} · 마감 임박/지연 (${formatDate(t.endDate)})`)
          : ["현재 지연 신호가 감지되지 않았습니다."],
      },
    ];
    setSummary(items);
  };

  const goToOrigin = () => {
    const first = scopedJournals[0];
    if (!first) return;
    setHighlightId(first.id);
    const element = document.getElementById(`journal-${first.id}`);
    element?.scrollIntoView({ behavior: "smooth", block: "center" });
    window.setTimeout(() => setHighlightId(null), 2600);
  };

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-5">
      <section className="card lg:col-span-2">
        <div className="border-b border-background-200 px-4 py-3">
          <h2 className="flex items-center gap-2 text-[13.5px] font-semibold text-foreground-950">
            <i className="ri-edit-2-line text-primary-500" />
            업무일지 작성
            <InfoTip text="진척률을 입력하면 연결된 업무의 진척률에 반영됩니다. 데모 환경이라 브라우저에만 저장됩니다." />
          </h2>
        </div>
        <div className="space-y-3 px-4 py-4">
          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="mb-1 block text-[11.5px] font-medium text-foreground-700">날짜</span>
              <input
                type="date"
                className="field"
                value={form.date}
                onChange={(event) => setForm({ ...form, date: event.target.value })}
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-[11.5px] font-medium text-foreground-700">소요 시간</span>
              <input
                type="number"
                min={0.5}
                step={0.5}
                className="field"
                value={form.hours}
                onChange={(event) => setForm({ ...form, hours: Number(event.target.value) })}
              />
            </label>
          </div>
          <label className="block">
            <span className="mb-1 block text-[11.5px] font-medium text-foreground-700">수행 내용</span>
            <textarea
              ref={textareaRef}
              rows={5}
              maxLength={500}
              className="field resize-none"
              placeholder="오늘 수행한 업무와 진행 상황을 적어 주세요."
              value={form.content}
              onChange={(event) => setForm({ ...form, content: event.target.value })}
            />
            <span className="mt-1 block text-right text-[10.5px] text-foreground-400">{form.content.length}/500</span>
          </label>
          <label className="block">
            <span className="mb-1 block text-[11.5px] font-medium text-foreground-700">연결 업무</span>
            <select
              className="field"
              value={form.taskId}
              onChange={(event) => {
                const taskId = event.target.value;
                const task = tasks.find((t) => t.id === taskId);
                setForm({ ...form, taskId, progress: task ? task.progress : 0 });
              }}
            >
              <option value="">연결하지 않음</option>
              {linkableTasks.map((task) => (
                <option key={task.id} value={task.id}>
                  {task.name}
                </option>
              ))}
            </select>
          </label>
          {selectedTask && (
            <div className="rounded-lg border border-background-200 bg-background-100 px-3 py-2.5">
              <p className="flex items-center gap-1.5 text-[11px] text-foreground-600">
                <i className="ri-link-m" />
                {projects.find((p) => p.id === selectedTask.projectId)?.name || "개인 할 일"} · 현재 {selectedTask.progress}%
              </p>
              <div className="mt-2 flex items-center gap-2">
                <input
                  type="range"
                  min={0}
                  max={100}
                  step={5}
                  value={form.progress}
                  onChange={(event) => setForm({ ...form, progress: Number(event.target.value) })}
                  className="w-full cursor-pointer accent-primary-500"
                />
                <span className="w-10 shrink-0 text-right text-[12px] font-semibold tabular-nums text-foreground-900">
                  {form.progress}%
                </span>
              </div>
            </div>
          )}
          {error && <p className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-[11.5px] text-rose-700">{error}</p>}
          <button type="button" className="btn-primary w-full" onClick={handleSubmit}>
            <i className="ri-save-line" />
            {BUTTON_TEXT.saveJournal}
          </button>
        </div>
      </section>

      <section className="space-y-4 lg:col-span-3">
        <div className="card px-4 py-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-1 rounded-full border border-background-300 bg-background-100 p-1">
              {(["day", "week"] as Scope[]).map((item) => (
                <button
                  key={item}
                  type="button"
                  onClick={() => {
                    setScope(item);
                    setSummary(null);
                  }}
                  className={`cursor-pointer rounded-full px-3.5 py-1 text-[12px] font-medium ${
                    scope === item ? "bg-background-50 text-primary-700 shadow-card" : "text-foreground-600 hover:text-foreground-900"
                  }`}
                >
                  {item === "day" ? BUTTON_TEXT.periodDay : BUTTON_TEXT.periodWeek}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-1.5">
              <button type="button" className="btn-outline" onClick={() => shift(-1)} aria-label={BUTTON_TEXT.previousPeriod}>
                <i className="ri-arrow-left-s-line" />
              </button>
              <button type="button" className="btn-outline" onClick={() => setAnchor(TODAY)}>
                {scope === "day" ? BUTTON_TEXT.thisDay : BUTTON_TEXT.thisWeek}
              </button>
              <button type="button" className="btn-outline" onClick={() => shift(1)} aria-label={BUTTON_TEXT.nextPeriod}>
                <i className="ri-arrow-right-s-line" />
              </button>
            </div>
          </div>
          <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
            <p className="text-[12px] font-medium text-foreground-800">
              {scope === "day" ? `${formatDate(anchor)} (${weekdayOf(anchor)})` : `${formatDate(range.start)} ~ ${formatDate(range.end)}`}
              <span className="ml-2 text-[11px] font-normal text-foreground-500">일지 {scopedJournals.length}건</span>
            </p>
            <button type="button" className="btn-outline" onClick={buildSummary}>
              <i className="ri-sparkling-2-line text-primary-500" />
              {BUTTON_TEXT.aiSummary}
            </button>
          </div>
        </div>

        {summary && (
          <div className="card border-primary-200 bg-primary-50/40 px-4 py-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="flex h-6 w-6 items-center justify-center rounded-md bg-primary-500 text-background-50">
                  <i className="ri-sparkling-2-line text-[13px]" />
                </span>
                <h3 className="text-[13px] font-semibold text-foreground-950">AI 요약</h3>
                <Badge className="border-amber-200 bg-amber-50 text-amber-700">데모 결과 · AI 초안</Badge>
              </div>
              <div className="flex items-center gap-2">
                <button type="button" className="btn-ghost" onClick={goToOrigin}>
                  {BUTTON_TEXT.openSourceJournal}
                  <i className="ri-arrow-right-up-line" />
                </button>
                <button type="button" className="btn-ghost" onClick={() => setSummary(null)} aria-label={BUTTON_TEXT.closeSummary}>
                  <i className="ri-close-line" />
                </button>
              </div>
            </div>
            <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
              {summary.map((item) => (
                <div key={item.title} className="rounded-lg border border-primary-100 bg-background-50 px-3 py-2.5">
                  <p className="text-[11.5px] font-semibold text-foreground-900">{item.title}</p>
                  <ul className="mt-1.5 space-y-1">
                    {item.lines.map((line, index) => (
                      <li key={`${item.title}-${index}`} className="flex gap-1.5 text-[11.5px] leading-5 text-foreground-700">
                        <i className="ri-checkbox-blank-circle-fill mt-[6px] text-[4px] text-primary-400" />
                        <span>{line}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
            <p className="mt-2.5 text-[10.5px] leading-4 text-foreground-500">
              규칙 기반으로 정리한 데모 초안입니다. 실제 AI 모델을 호출하지 않습니다.
            </p>
          </div>
        )}

        <div className="space-y-3">
          {scopedJournals.length === 0 ? (
            <div className="card">
              <EmptyState
                icon="ri-file-text-line"
                title="선택한 기간에 작성된 업무일지가 없습니다"
                description="왼쪽 작성 폼에서 수행 내용을 입력해 일지를 남겨 보세요."
              />
            </div>
          ) : (
            scopedJournals.map((journal) => {
              const task = tasks.find((t) => t.id === journal.taskId);
              const project = task ? projects.find((p) => p.id === task.projectId) : null;
              return (
                <article
                  key={journal.id}
                  id={`journal-${journal.id}`}
                  className={`card px-4 py-3 transition ${
                    highlightId === journal.id ? "border-primary-400 ring-2 ring-primary-200" : ""
                  }`}
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="flex items-center gap-2 text-[12px] font-semibold text-foreground-950">
                      {formatDate(journal.date)}
                      <span className="text-[11px] font-normal text-foreground-500">{weekdayOf(journal.date)}요일</span>
                      <span className="text-[11px] font-normal text-foreground-500">· {journal.hours}시간</span>
                    </p>
                    {task && <PriorityBadge priority={task.priority} />}
                  </div>
                  <p className="mt-1.5 whitespace-pre-wrap text-[12.5px] leading-6 text-foreground-700">{journal.content}</p>
                  {task && (
                    <div className="mt-2.5 rounded-lg border border-background-200 bg-background-100 px-3 py-2">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <button
                          type="button"
                          onClick={() => openTask(task.id)}
                          className="flex cursor-pointer items-center gap-1.5 text-left text-[11.5px] font-medium text-primary-700 hover:text-primary-800"
                        >
                          <i className="ri-link-m" />
                          {task.name}
                          <span className="font-normal text-foreground-500">· {project?.name || "개인 할 일"}</span>
                        </button>
                        <div className="flex items-center gap-2">
                          <span className="text-[11px] text-foreground-500">진척 {journal.progress}%</span>
                          {task.status !== "done" ? (
                            <button
                              type="button"
                              className="cursor-pointer text-[11.5px] font-medium text-emerald-700 hover:text-emerald-800"
                              onClick={() => setTaskStatus(task.id, "done")}
                            >
                              {BUTTON_TEXT.completeLinkedTask}
                            </button>
                          ) : (
                            <span className="text-[11.5px] font-medium text-emerald-700">완료된 업무</span>
                          )}
                        </div>
                      </div>
                      <ProgressBar value={journal.progress} className="mt-2" />
                    </div>
                  )}
                </article>
              );
            })
          )}
        </div>
      </section>
    </div>
  );
}