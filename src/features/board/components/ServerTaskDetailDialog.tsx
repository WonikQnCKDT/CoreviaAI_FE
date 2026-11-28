import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import Modal from "@/components/ui/Modal";
import ProgressBar from "@/components/ui/ProgressBar";
import { StatusBadge } from "@/components/ui/Badge";
import {
  fetchTaskDetail,
  fetchTaskHistories,
  updateTaskAttributes,
  type TaskDetail,
  type TaskHistory,
  type TaskPriority,
  type TaskType,
} from "@/features/board/api/boardApi";
import { TASK_DETAIL_TEXT } from "@/features/board/i18n/ko";
import { TASK_STATUS_TO_CODE } from "@/shared/codes/codeStore";
import { useCommonCodes } from "@/shared/codes/useCommonCodes";
import {
  activityLabel,
  canEditAttributes,
  historyLines,
  interpretBoardFailure,
  taskPriorityLabel,
  taskTypeLabel,
} from "@/features/board/utils/boardRules";
import type { ServerProjectMember } from "@/features/project/api/projectApi";
import type { WbsViewer } from "@/features/wbs/utils/wbsRules";

interface Props {
  projectId: number;
  taskId: number;
  viewer: WbsViewer;
  members: ServerProjectMember[];
  onClose: () => void;
  /** 속성이 저장되면 부모 화면(보드·WBS)이 다시 받도록 알린다 */
  onChanged?: () => void;
}

type DetailState = { phase: "loading" } | { phase: "error"; message: string } | { phase: "ready"; task: TaskDetail };
type HistoryState = { phase: "loading" } | { phase: "error" } | { phase: "ready"; items: TaskHistory[]; nextCursor: string | null; hasNext: boolean };

const TYPES: TaskType[] = ["task", "defect"];
const PRIORITIES: TaskPriority[] = ["high", "medium", "low"];
const fieldClass = "field mt-1 w-full text-[13px]";
const dateTime = (iso: string) => {
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? "" : date.toLocaleString();
};

/**
 * api 모드 업무 상세(FR-TSK-01): 상세 조회, 유형·우선순위·완료 조건 수정, 변경 이력.
 * 이력의 before·after는 사용자 입력이 섞여 있어 텍스트로만 그린다.
 */
export default function ServerTaskDetailDialog({ projectId, taskId, viewer, members, onClose, onChanged }: Props) {
  const { labelOf: taskStatusLabelOf } = useCommonCodes("TASK_STATUS");
  const [detail, setDetail] = useState<DetailState>({ phase: "loading" });
  const [history, setHistory] = useState<HistoryState>({ phase: "loading" });
  const [form, setForm] = useState({ taskType: "task" as TaskType, priority: "medium" as TaskPriority, completionCriteria: "" });
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<{ tone: "success" | "error"; text: string } | null>(null);
  const controllerRef = useRef<AbortController | null>(null);

  const loadDetail = useCallback(() => {
    controllerRef.current?.abort();
    const controller = new AbortController();
    controllerRef.current = controller;
    const { signal } = controller;
    Promise.all([fetchTaskDetail({ projectId, taskId, signal }), fetchTaskHistories({ projectId, taskId, signal })]).then(
      ([detailResult, historyResult]) => {
        if (signal.aborted) return;
        if (detailResult.ok === false) {
          setDetail({ phase: "error", message: interpretBoardFailure("loadTask", detailResult.failure).message });
          return;
        }
        const task = detailResult.data;
        setDetail({ phase: "ready", task });
        setForm({ taskType: task.taskType, priority: task.priority, completionCriteria: task.completionCriteria });
        setHistory(historyResult.ok === true ? { phase: "ready", ...historyResult.data } : { phase: "error" });
      },
    );
  }, [projectId, taskId]);

  useEffect(() => {
    loadDetail();
    return () => controllerRef.current?.abort();
  }, [loadDetail]);

  const loadMore = async () => {
    if (history.phase !== "ready" || !history.nextCursor) return;
    const result = await fetchTaskHistories({ projectId, taskId, cursor: history.nextCursor });
    if (result.ok === false) {
      setHistory({ phase: "error" });
      return;
    }
    const known = new Set(history.items.map((h) => h.id));
    setHistory({ phase: "ready", items: [...history.items, ...result.data.items.filter((h) => !known.has(h.id))], nextCursor: result.data.nextCursor, hasNext: result.data.hasNext });
  };

  const userName = (id: number) => members.find((m) => m.userId === id)?.name ?? null;

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (detail.phase !== "ready" || saving) return;
    if (form.completionCriteria.trim().length > 2000) {
      setNotice({ tone: "error", text: TASK_DETAIL_TEXT.criteriaTooLong });
      return;
    }
    setSaving(true);
    setNotice(null);
    const result = await updateTaskAttributes({ projectId, taskId, ...form, version: detail.task.version });
    setSaving(false);
    if (result.ok === true) {
      setDetail({ phase: "ready", task: result.data });
      // 서버가 다듬은 값(앞뒤 공백 제거 등)으로 맞춘다
      setForm({ taskType: result.data.taskType, priority: result.data.priority, completionCriteria: result.data.completionCriteria });
      setNotice({ tone: "success", text: TASK_DETAIL_TEXT.saved });
      onChanged?.();
      // 이력에 DETAILS_CHANGED가 생겼다
      const refreshed = await fetchTaskHistories({ projectId, taskId });
      if (refreshed.ok === true) setHistory({ phase: "ready", ...refreshed.data });
      return;
    }
    const view = interpretBoardFailure("updateTask", result.failure);
    setNotice({ tone: "error", text: view.message });
    if (view.reload) loadDetail();
  };

  const body = () => {
    if (detail.phase === "loading") return <p role="status" className="text-[13px] text-foreground-500">{TASK_DETAIL_TEXT.loading}</p>;
    if (detail.phase === "error") {
      return (
        <div className="space-y-2">
          <p role="alert" className="text-[13px] text-rose-700">{detail.message}</p>
          <button type="button" className="btn-outline" onClick={loadDetail}>{TASK_DETAIL_TEXT.retry}</button>
        </div>
      );
    }
    const { task } = detail;
    const editable = canEditAttributes(viewer, task);
    const facts: [string, string][] = [
      [TASK_DETAIL_TEXT.assignee, task.assignee ? task.assignee.name || `#${task.assignee.id}` : TASK_DETAIL_TEXT.none],
      [TASK_DETAIL_TEXT.period, task.startDate ? `${task.startDate} ~ ${task.endDate}${task.scheduleDerived ? ` (${TASK_DETAIL_TEXT.derived})` : ""}` : TASK_DETAIL_TEXT.none],
      [TASK_DETAIL_TEXT.effort, task.estimatedEffort === null ? TASK_DETAIL_TEXT.none : String(task.estimatedEffort)],
      [TASK_DETAIL_TEXT.source, task.source === "aiDraft" ? TASK_DETAIL_TEXT.sourceAi : TASK_DETAIL_TEXT.sourceManual],
      [TASK_DETAIL_TEXT.createdBy, [task.createdBy?.name, dateTime(task.createdAt)].filter(Boolean).join(" · ") || TASK_DETAIL_TEXT.none],
    ];
    return (
      <div className="space-y-4">
        <div>
          <h4 className="text-[15px] font-semibold text-foreground-950">{task.name}</h4>
          {task.description && <p className="mt-1 whitespace-pre-wrap text-[12.5px] text-foreground-700">{task.description}</p>}
        </div>
        <dl className="grid grid-cols-[88px_1fr] gap-x-3 gap-y-1.5 text-[12.5px]">
          {facts.map(([label, value]) => (
            <div key={label} className="contents">
              <dt className="text-foreground-500">{label}</dt>
              <dd className="text-foreground-900">{value}</dd>
            </div>
          ))}
          <dt className="text-foreground-500">{TASK_DETAIL_TEXT.status}</dt>
          <dd><StatusBadge status={task.status} label={taskStatusLabelOf(TASK_STATUS_TO_CODE[task.status])} /> <span className="ml-1 text-[11px] text-foreground-500">{TASK_DETAIL_TEXT.statusNote}</span></dd>
          <dt className="text-foreground-500">{TASK_DETAIL_TEXT.progress}</dt>
          <dd><ProgressBar value={task.progress} showLabel /></dd>
        </dl>

        <form className="space-y-2 rounded-lg border border-background-300 p-3" onSubmit={submit} noValidate aria-label={TASK_DETAIL_TEXT.attributes}>
          <h5 className="text-[12.5px] font-semibold text-foreground-900">{TASK_DETAIL_TEXT.attributes}</h5>
          {!editable && <p className="text-[11.5px] text-foreground-500">{TASK_DETAIL_TEXT.readOnly}</p>}
          <div className="grid grid-cols-2 gap-3">
            <label className="block text-[12px] font-medium text-foreground-700">
              {TASK_DETAIL_TEXT.taskType}
              <select className={fieldClass} disabled={!editable} value={form.taskType} onChange={(e) => setForm({ ...form, taskType: e.target.value as TaskType })}>
                {TYPES.map((t) => <option key={t} value={t}>{taskTypeLabel(t)}</option>)}
              </select>
            </label>
            <label className="block text-[12px] font-medium text-foreground-700">
              {TASK_DETAIL_TEXT.priority}
              <select className={fieldClass} disabled={!editable} value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value as TaskPriority })}>
                {PRIORITIES.map((p) => <option key={p} value={p}>{taskPriorityLabel(p)}</option>)}
              </select>
            </label>
          </div>
          <label className="block text-[12px] font-medium text-foreground-700">
            {TASK_DETAIL_TEXT.completionCriteria}
            <textarea className={fieldClass} rows={2} maxLength={2000} disabled={!editable} value={form.completionCriteria} onChange={(e) => setForm({ ...form, completionCriteria: e.target.value })} />
          </label>
          {notice && (
            <p role={notice.tone === "error" ? "alert" : "status"} className={`rounded-md px-3 py-2 text-[12px] ${notice.tone === "error" ? "bg-rose-50 text-rose-700" : "bg-emerald-50 text-emerald-700"}`}>
              {notice.text}
            </p>
          )}
          {editable && (
            <div className="flex justify-end">
              <button type="submit" className="btn-primary" disabled={saving}>{saving ? TASK_DETAIL_TEXT.saving : TASK_DETAIL_TEXT.save}</button>
            </div>
          )}
        </form>

        <section aria-label={TASK_DETAIL_TEXT.histories}>
          <h5 className="mb-1.5 text-[12.5px] font-semibold text-foreground-900">{TASK_DETAIL_TEXT.histories}</h5>
          {history.phase === "loading" && <p className="text-[12px] text-foreground-500">{TASK_DETAIL_TEXT.loading}</p>}
          {history.phase === "error" && <p className="text-[12px] text-rose-700">{TASK_DETAIL_TEXT.historiesFailed}</p>}
          {history.phase === "ready" && history.items.length === 0 && <p className="text-[12px] text-foreground-500">{TASK_DETAIL_TEXT.historiesEmpty}</p>}
          {history.phase === "ready" && history.items.length > 0 && (
            <ol className="space-y-1.5">
              {history.items.map((h) => (
                <li key={h.id} className="rounded-md bg-background-100 px-2.5 py-1.5 text-[12px]">
                  <div className="flex flex-wrap gap-x-2 text-foreground-600">
                    <span className="font-medium text-foreground-900">{activityLabel(h.activity)}</span>
                    <span>{h.actor ? h.actor.name || `#${h.actor.id}` : TASK_DETAIL_TEXT.system}</span>
                    <span>{dateTime(h.occurredAt)}</span>
                  </div>
                  <ul className="mt-0.5 text-foreground-700">
                    {historyLines({ before: h.before, after: h.after, userName }).map((line) => (
                      <li key={line.field} className="break-all">
                        {line.label}: {line.from && line.to ? `${line.from} → ${line.to}` : line.from || line.to}
                      </li>
                    ))}
                  </ul>
                </li>
              ))}
            </ol>
          )}
          {history.phase === "ready" && history.hasNext && history.nextCursor && (
            <button type="button" className="btn-ghost mt-1.5 py-1 text-[12px]" onClick={loadMore}>{TASK_DETAIL_TEXT.more}</button>
          )}
        </section>
      </div>
    );
  };

  return (
    <Modal open title={TASK_DETAIL_TEXT.title} onClose={onClose} width="max-w-2xl">
      {body()}
    </Modal>
  );
}
