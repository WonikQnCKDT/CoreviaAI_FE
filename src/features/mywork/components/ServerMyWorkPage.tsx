import { useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Badge, StatusBadge } from "@/components/ui/Badge";
import EmptyState from "@/components/ui/EmptyState";
import TabBar from "@/components/ui/TabBar";
import ApprovalTab from "@/features/mywork/components/ApprovalTab";
import CalendarTab from "@/features/mywork/components/CalendarTab";
import JournalTab from "@/features/mywork/components/JournalTab";
import KpiCard from "@/features/mywork/components/KpiCard";
import ServerTodoDialog from "@/features/mywork/components/ServerTodoDialog";
import { createTodo, deleteTodo, updateTodo, type TodoInput, type TodoItem } from "@/features/mywork/api/todoApi";
import { useServerTodos } from "@/features/mywork/hooks/useServerTodos";
import { TODO_TEXT } from "@/features/mywork/i18n/ko";
import { loadTaskFilter, saveTaskFilter, TASK_FILTERS, type TaskFilter } from "@/features/mywork/utils/filters";
import { interpretTodoFailure, matchesFilter, requestIdFor, todoStats, type PendingCreate, type TodoAction } from "@/features/mywork/utils/todoRules";
import type { ApiResult } from "@/shared/api/client";
import { MYWORK_TAB_TEXT } from "@/shared/i18n/catalog/menu";
import { formatLabel } from "@/shared/i18n/store";
import { useDemoStore } from "@/stores/DemoStore";

type TabKey = "todo" | "approval" | "calendar" | "journal";
type Notice = { tone: "success" | "error"; text: string } | null;
type DialogTarget = { kind: "create" } | { kind: "edit"; item: TodoItem } | null;

const TABS: { key: TabKey; icon: string; label: () => string }[] = [
  { key: "todo", icon: "ri-checkbox-multiple-line", label: () => MYWORK_TAB_TEXT.todo },
  { key: "approval", icon: "ri-shield-check-line", label: () => MYWORK_TAB_TEXT.approval },
  { key: "calendar", icon: "ri-calendar-line", label: () => MYWORK_TAB_TEXT.calendar },
  { key: "journal", icon: "ri-file-text-line", label: () => MYWORK_TAB_TEXT.journal },
];

const dueBadge = function (item: TodoItem) {
  if (!item.dueDate) return <span className="text-[12px] text-foreground-500">{TODO_TEXT.noDue}</span>;
  const tone = item.done
    ? "border-background-300 text-foreground-500"
    : item.overdue
      ? "border-rose-200 bg-rose-50 text-rose-600"
      : item.urgency === 0
        ? "border-amber-200 bg-amber-50 text-amber-700"
        : "border-background-300 text-foreground-600";
  const label = !item.done && item.overdue ? ` · ${TODO_TEXT.overdue}` : !item.done && item.urgency === 0 ? ` · ${TODO_TEXT.dueToday}` : "";
  return <Badge className={tone}>{item.dueDate}{label}</Badge>;
};

/**
 * api 모드 내 업무(FR-PSN-01). 할 일 탭은 서버의 개인 TODO + 배정 업무 통합 목록을 그린다.
 * 변경은 서버 성공 응답 뒤에 목록을 다시 받아 반영한다. 배정 업무는 이 화면에서 상태를 바꾸지 않는다.
 * 승인·캘린더·업무일지 탭은 아직 서버와 연결하지 않아 기존 화면을 쓴다(06-2 범위).
 */
export default function ServerMyWorkPage() {
  const { projects } = useDemoStore();
  const { state, reload } = useServerTodos();
  const [tab, setTab] = useState<TabKey>("todo");
  const [filter, setFilterState] = useState<TaskFilter>(loadTaskFilter);
  const [dialog, setDialog] = useState<DialogTarget>(null);
  const [dialogError, setDialogError] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<Notice>(null);
  const busyRef = useRef(false);
  const pendingRef = useRef<PendingCreate | null>(null);

  const setFilter = (next: TaskFilter) => {
    setFilterState(next);
    saveTaskFilter(next);
  };

  const run = async function <T>(action: TodoAction, request: () => Promise<ApiResult<T>>, success: string, inDialog: boolean): Promise<boolean> {
    if (busyRef.current) return false;
    busyRef.current = true;
    setBusy(true);
    setDialogError("");
    const result = await request();
    busyRef.current = false;
    setBusy(false);
    if (result.ok === true) {
      setNotice({ tone: "success", text: success });
      reload();
      return true;
    }
    const view = interpretTodoFailure(action, result.failure);
    if (action === "create" && view.resetRequest) pendingRef.current = null;
    if (view.reload) reload();
    if (inDialog && !view.reload) setDialogError(view.message);
    else {
      setNotice({ tone: "error", text: view.message });
      if (inDialog) setDialog(null);
    }
    return false;
  };

  const submitDialog = async (input: TodoInput) => {
    if (!dialog) return;
    if (dialog.kind === "create") {
      const requestId = requestIdFor(pendingRef.current, input);
      pendingRef.current = { requestId, input };
      const ok = await run("create", () => createTodo({ requestId, input }), formatLabel(TODO_TEXT.created, { name: input.title }), true);
      if (ok) {
        pendingRef.current = null;
        setDialog(null);
      }
      return;
    }
    const { item } = dialog;
    const ok = await run("update", () => updateTodo({ todoId: item.id, input, done: item.done }), formatLabel(TODO_TEXT.updated, { name: input.title }), true);
    if (ok) setDialog(null);
  };

  const toggleDone = (item: TodoItem) => {
    const done = !item.done;
    void run(
      "update",
      () => updateTodo({ todoId: item.id, input: { title: item.title, dueDate: item.dueDate }, done }),
      formatLabel(done ? TODO_TEXT.completed : TODO_TEXT.reopened, { name: item.title }),
      false,
    );
  };

  const remove = (item: TodoItem) => {
    if (!window.confirm(formatLabel(TODO_TEXT.confirmDelete, { name: item.title }))) return;
    void run("delete", () => deleteTodo({ todoId: item.id }), formatLabel(TODO_TEXT.deleted, { name: item.title }), false);
  };

  /**
   * 폼을 닫으면 등록 키를 버린다. 같은 내용을 나중에 새로 추가할 때 이전 요청으로 묶이지 않게 하기 위해서다.
   * 결과를 모르는 등록(네트워크·시간 초과)이 있었으면 목록을 다시 받아 실제로 만들어졌는지 보이게 한다.
   */
  const closeDialog = () => {
    if (pendingRef.current) reload();
    pendingRef.current = null;
    setDialog(null);
  };

  const openCreate = () => {
    setDialogError("");
    setDialog({ kind: "create" });
  };

  const ready = state.phase === "ready" ? state : null;
  const stats = ready ? todoStats(ready.active, ready.done) : { today: 0, soon: 0, late: 0, open: 0, done: 0 };
  const all = ready ? [...ready.active, ...ready.done] : [];
  const visible = all.filter((item) => matchesFilter(item, filter));
  const counts: Record<TaskFilter, number> = {
    open: stats.open,
    today: stats.today,
    soon: stats.soon,
    late: stats.late,
    done: stats.done,
    all: all.length,
  };
  const projectName = (projectId: number) => projects.find((p) => p.serverId === projectId)?.name ?? `#${projectId}`;

  const applyKpi = (next: TaskFilter) => {
    setFilter(next);
    setTab("todo");
  };

  const todoBody = () => {
    if (state.phase === "loading") return <p role="status" className="py-10 text-center text-[13px] text-foreground-500">{TODO_TEXT.loading}</p>;
    if (state.phase === "error") {
      return (
        <EmptyState
          tone="danger"
          icon="ri-error-warning-line"
          title={TODO_TEXT.loadFailed}
          description={state.message}
          action={<button type="button" className="btn-outline" onClick={() => reload()}>{TODO_TEXT.retry}</button>}
        />
      );
    }
    return (
      <div className="space-y-3">
        <div className="flex flex-wrap items-center gap-1 rounded-lg border border-background-300 bg-background-50 p-1">
          {TASK_FILTERS.map((item) => (
            <button
              key={item.key}
              type="button"
              onClick={() => setFilter(item.key)}
              aria-pressed={filter === item.key}
              className={`flex items-center gap-1 whitespace-nowrap rounded-md px-2.5 py-1.5 text-[12.5px] font-medium ${filter === item.key ? "bg-primary-500 text-background-50" : "text-foreground-600 hover:bg-background-100"}`}
            >
              {item.label}
              <span className="text-[11px] opacity-80">{counts[item.key]}</span>
            </button>
          ))}
        </div>
        <p className="text-[11px] text-foreground-500">{TODO_TEXT.taskNote} · {TODO_TEXT.refreshNote}</p>
        {state.truncated && <p className="text-[11.5px] text-amber-700">{TODO_TEXT.truncated}</p>}

        {visible.length === 0 ? (
          <EmptyState icon="ri-checkbox-circle-line" title={TODO_TEXT.empty} description={TODO_TEXT.emptyHint} />
        ) : (
          <ul className="card divide-y divide-background-200">
            {visible.map((item) => (
              <li key={item.key} className="flex flex-wrap items-center gap-3 px-4 py-2.5">
                {item.source === "personal" ? (
                  <input
                    type="checkbox"
                    className="h-4 w-4"
                    checked={item.done}
                    disabled={busy}
                    aria-label={`${item.done ? TODO_TEXT.markOpen : TODO_TEXT.markDone}: ${item.title}`}
                    onChange={() => toggleDone(item)}
                  />
                ) : (
                  <i className="ri-briefcase-4-line w-4 text-foreground-400" aria-hidden="true" />
                )}
                <div className="min-w-0 flex-1">
                  <p className={`break-words text-[13px] ${item.done ? "text-foreground-500 line-through" : "text-foreground-950"}`}>{item.title}</p>
                  <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[11px] text-foreground-500">
                    <Badge className={item.source === "task" ? "border-primary-200 bg-primary-50 text-primary-700" : "border-background-300 text-foreground-600"}>
                      {item.source === "task" ? TODO_TEXT.sourceTask : TODO_TEXT.sourcePersonal}
                    </Badge>
                    {item.projectId !== null && <span>{projectName(item.projectId)}</span>}
                    {item.taskStatus && <StatusBadge status={item.taskStatus} />}
                  </div>
                </div>
                {dueBadge(item)}
                <div className="flex gap-1">
                  {item.source === "personal" ? (
                    <>
                      <button type="button" className="btn-ghost px-2 py-1 text-[12px]" disabled={busy} aria-label={`${TODO_TEXT.edit}: ${item.title}`} onClick={() => { setDialogError(""); setDialog({ kind: "edit", item }); }}>
                        {TODO_TEXT.edit}
                      </button>
                      <button type="button" className="btn-ghost px-2 py-1 text-[12px] text-rose-600" disabled={busy} aria-label={`${TODO_TEXT.delete}: ${item.title}`} onClick={() => remove(item)}>
                        {TODO_TEXT.delete}
                      </button>
                    </>
                  ) : (
                    item.projectId !== null && (
                      <Link className="btn-ghost px-2 py-1 text-[12px]" to={`/projects/${item.projectId}/kanban`} aria-label={`${TODO_TEXT.openProject}: ${item.title}`}>
                        {TODO_TEXT.openProject}
                      </Link>
                    )
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiCard icon="ri-calendar-check-line" label={TODO_TEXT.kpiToday} value={stats.today} hint={TODO_TEXT.kpiTodayHint} tone="warning" active={filter === "today"} onClick={() => applyKpi("today")} />
        <KpiCard icon="ri-time-line" label={TODO_TEXT.kpiSoon} value={stats.soon} hint={TODO_TEXT.kpiSoonHint} tone="primary" active={filter === "soon"} onClick={() => applyKpi("soon")} />
        <KpiCard icon="ri-alarm-warning-line" label={TODO_TEXT.kpiLate} value={stats.late} hint={TODO_TEXT.kpiLateHint} tone="danger" active={filter === "late"} onClick={() => applyKpi("late")} />
        <KpiCard icon="ri-checkbox-circle-line" label={TODO_TEXT.kpiDone} value={stats.done} hint={TODO_TEXT.kpiDoneHint} tone="success" active={filter === "done"} onClick={() => applyKpi("done")} />
      </div>

      <TabBar
        items={TABS.map((t) => ({ key: t.key, label: t.label(), icon: t.icon, count: t.key === "todo" ? stats.open : undefined }))}
        activeKey={tab}
        onChange={(key) => setTab(key as TabKey)}
        ariaLabel={MYWORK_TAB_TEXT.views}
        meta={
          <button type="button" className="btn-primary whitespace-nowrap" onClick={openCreate}>
            <i className="ri-add-line" /> {TODO_TEXT.add}
          </button>
        }
      />

      {notice && (
        <p role={notice.tone === "error" ? "alert" : "status"} className={`rounded-md px-3 py-2 text-[12px] ${notice.tone === "error" ? "bg-rose-50 text-rose-700" : "bg-emerald-50 text-emerald-700"}`}>
          {notice.text}
        </p>
      )}

      {tab === "todo" && todoBody()}
      {tab === "approval" && <ApprovalTab />}
      {tab === "calendar" && <CalendarTab />}
      {tab === "journal" && <JournalTab focusRequest={0} />}

      {dialog && (
        <ServerTodoDialog
          mode={dialog.kind}
          initial={dialog.kind === "edit" ? { title: dialog.item.title, dueDate: dialog.item.dueDate } : undefined}
          submitting={busy}
          error={dialogError}
          onClose={closeDialog}
          onSubmit={submitDialog}
        />
      )}
    </div>
  );
}
