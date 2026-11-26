import { useRef, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { Badge } from "@/components/ui/Badge";
import EmptyState from "@/components/ui/EmptyState";
import { applyWbsDraft, generateWbsDraft, type DraftInput, type WbsDraft } from "@/features/wbs/api/wbsApi";
import { useServerWbs } from "@/features/wbs/hooks/useServerWbs";
import { WBS_DRAFT_TEXT, WBS_FORM_TEXT, WBS_TEXT } from "@/features/wbs/i18n/ko";
import {
  buildApplyBody,
  interpretDraftFailure,
  isWbsPm,
  toReview,
  validateDraftInput,
  type ReviewMilestone,
  type ReviewTask,
} from "@/features/wbs/utils/wbsRules";
import { formatLabel } from "@/shared/i18n/store";
import type { Project } from "@/types";

type Notice = { tone: "success" | "error"; text: string } | null;

interface Review {
  draft: WbsDraft;
  tasks: ReviewTask[];
  milestones: ReviewMilestone[];
}

const EMPTY_INPUT = { projectPurpose: "", requirementsText: "", constraints: "", userInstruction: "" };

/**
 * api 모드 AI WBS 초안(FR-PRJ-07). 초안은 WBS에 바로 들어가지 않고 PM이 고른 항목만 반영한다.
 * - 입력 원문·draftToken은 이 화면 메모리에만 둔다(저장소·주소창에 남기지 않는다)
 * - AI 결과는 신뢰하지 않는 입력이다: 단계·담당자는 프로젝트에 있는 값만 쓰고, 텍스트는 React가 문자로만 그린다
 */
export default function ServerWbsDraft({ project }: { project: Project & { serverId: number } }) {
  const projectId = project.serverId;
  const { state, reload, viewer } = useServerWbs(projectId);
  const [input, setInput] = useState(EMPTY_INPUT);
  const [review, setReview] = useState<Review | null>(null);
  const [busy, setBusy] = useState<"generate" | "apply" | null>(null);
  const [notice, setNotice] = useState<Notice>(null);
  const [applied, setApplied] = useState(false);
  const busyRef = useRef(false);

  if (state.phase === "loading") {
    return <p className="py-10 text-center text-[13px] text-foreground-500" role="status">{WBS_TEXT.loading}</p>;
  }
  if (state.phase === "unavailable") return <EmptyState icon="ri-node-tree" title={WBS_TEXT.unavailable} />;
  if (state.phase === "error") {
    return (
      <EmptyState
        tone="danger"
        icon="ri-error-warning-line"
        title={WBS_TEXT.loadFailed}
        description={state.message}
        action={
          <button type="button" className="btn-outline" onClick={reload}>
            {WBS_TEXT.retry}
          </button>
        }
      />
    );
  }

  const { phases, members } = state;
  const backLink = (
    <Link to={`/projects/${project.id}/wbs`} className="btn-outline py-1.5 text-[12px]">
      {WBS_DRAFT_TEXT.goWbs}
    </Link>
  );

  if (!isWbsPm(viewer)) {
    return <EmptyState icon="ri-lock-line" title={WBS_DRAFT_TEXT.pmOnly} action={backLink} />;
  }
  if (phases.length === 0) {
    return <EmptyState icon="ri-node-tree" title={WBS_DRAFT_TEXT.waterfallOnly} action={backLink} />;
  }

  const draftInput = (): DraftInput => ({
    projectPurpose: input.projectPurpose,
    requirementsText: input.requirementsText,
    constraints: input.constraints.split("\n"),
    userInstruction: input.userInstruction,
  });

  const generate = async (event: FormEvent) => {
    event.preventDefault();
    if (busyRef.current) return;
    const payload = draftInput();
    const invalid = validateDraftInput(payload);
    if (invalid) {
      setNotice({ tone: "error", text: invalid });
      return;
    }
    busyRef.current = true;
    setBusy("generate");
    setNotice(null);
    const result = await generateWbsDraft({ projectId, input: payload });
    busyRef.current = false;
    setBusy(null);
    if (result.ok === false) {
      setNotice({ tone: "error", text: interpretDraftFailure("generate", result.failure).message });
      return;
    }
    const reviewed = toReview({
      tasks: result.data.tasks,
      milestones: result.data.milestones,
      phaseIds: phases.map((p) => p.id),
      memberIds: members.map((m) => m.userId),
    });
    setApplied(false);
    setReview({ draft: result.data, ...reviewed });
  };

  const apply = async () => {
    if (!review || busyRef.current) return;
    const built = buildApplyBody({ draftToken: review.draft.draftToken, tasks: review.tasks, milestones: review.milestones });
    if (built.ok === false) {
      setNotice({ tone: "error", text: built.message });
      return;
    }
    busyRef.current = true;
    setBusy("apply");
    setNotice(null);
    const result = await applyWbsDraft({ projectId, body: built.body });
    busyRef.current = false;
    setBusy(null);
    if (result.ok === false) {
      const view = interpretDraftFailure("apply", result.failure);
      setNotice({ tone: "error", text: view.message });
      if (view.discardDraft) setReview(null);
      return;
    }
    // 토큰은 한 번만 쓸 수 있으므로 반영한 초안은 버린다
    setReview(null);
    setApplied(true);
    setNotice({
      tone: "success",
      text: formatLabel(WBS_DRAFT_TEXT.applied, { tasks: result.data.taskCount, milestones: result.data.milestoneCount }),
    });
  };

  const patchTask = (tempId: string, patch: Partial<ReviewTask>) =>
    setReview((prev) => (prev ? { ...prev, tasks: prev.tasks.map((t) => (t.tempId === tempId ? { ...t, ...patch } : t)) } : prev));
  const patchMilestone = (tempId: string, patch: Partial<ReviewMilestone>) =>
    setReview((prev) => (prev ? { ...prev, milestones: prev.milestones.map((m) => (m.tempId === tempId ? { ...m, ...patch } : m)) } : prev));
  const selectAll = (selected: boolean) =>
    setReview((prev) =>
      prev ? { ...prev, tasks: prev.tasks.map((t) => ({ ...t, selected })), milestones: prev.milestones.map((m) => ({ ...m, selected })) } : prev,
    );

  const fieldClass = "field mt-1 w-full text-[13px]";
  const expiresAt = review ? new Date(review.draft.expiresAt) : null;
  // 서버 값이 비었거나 형식이 틀리면 만료 시각을 표시하지 않는다
  const expiresText = expiresAt && !Number.isNaN(expiresAt.getTime()) ? expiresAt.toLocaleString() : "";
  const notes = review
    ? [
        { title: WBS_DRAFT_TEXT.warnings, items: review.draft.warnings },
        { title: WBS_DRAFT_TEXT.assumptions, items: review.draft.assumptions },
        { title: WBS_DRAFT_TEXT.questions, items: review.draft.clarificationQuestions },
        { title: WBS_DRAFT_TEXT.suggestions, items: review.draft.suggestions },
      ].filter((n) => n.items.length > 0)
    : [];

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-[15px] font-semibold text-foreground-950">{WBS_DRAFT_TEXT.title}</h2>
          <p className="text-[12px] text-foreground-600">{WBS_DRAFT_TEXT.description}</p>
        </div>
        {backLink}
      </div>

      {notice && (
        <p
          role={notice.tone === "error" ? "alert" : "status"}
          className={`rounded-md px-3 py-2 text-[12px] ${notice.tone === "error" ? "bg-rose-50 text-rose-700" : "bg-emerald-50 text-emerald-700"}`}
        >
          {notice.text}
        </p>
      )}

      <form className="card space-y-3 p-4" onSubmit={generate} noValidate>
        <label className="block text-[12px] font-medium text-foreground-700">
          {WBS_DRAFT_TEXT.purpose}
          <textarea className={fieldClass} rows={2} maxLength={2000} value={input.projectPurpose} onChange={(e) => setInput({ ...input, projectPurpose: e.target.value })} />
        </label>
        <label className="block text-[12px] font-medium text-foreground-700">
          {WBS_DRAFT_TEXT.requirements}
          <textarea className={fieldClass} rows={4} maxLength={20000} value={input.requirementsText} onChange={(e) => setInput({ ...input, requirementsText: e.target.value })} />
        </label>
        <label className="block text-[12px] font-medium text-foreground-700">
          {WBS_DRAFT_TEXT.constraints}
          <textarea className={fieldClass} rows={2} value={input.constraints} onChange={(e) => setInput({ ...input, constraints: e.target.value })} />
        </label>
        <label className="block text-[12px] font-medium text-foreground-700">
          {WBS_DRAFT_TEXT.instruction}
          <input className={fieldClass} maxLength={1000} value={input.userInstruction} onChange={(e) => setInput({ ...input, userInstruction: e.target.value })} />
        </label>
        <div className="flex justify-end">
          <button type="submit" className="btn-primary" disabled={busy !== null}>
            <i className="ri-sparkling-2-line" /> {busy === "generate" ? WBS_DRAFT_TEXT.generating : WBS_DRAFT_TEXT.generate}
          </button>
        </div>
      </form>

      {applied && !review && <div className="flex justify-end">{backLink}</div>}

      {review && (
        <section className="card space-y-3 p-4" aria-label={WBS_DRAFT_TEXT.aiBadge}>
          <div className="flex flex-wrap items-center gap-2">
            <Badge className="border-violet-200 bg-violet-50 text-violet-700">{WBS_DRAFT_TEXT.aiBadge}</Badge>
            <span className="text-[12px] text-foreground-600">{WBS_DRAFT_TEXT.reviewNote}</span>
            {expiresText && <span className="text-[11.5px] text-foreground-500">{formatLabel(WBS_DRAFT_TEXT.expiresAt, { time: expiresText })}</span>}
          </div>
          {review.draft.feasibility && (
            <p className="text-[12px] text-foreground-700">
              {WBS_DRAFT_TEXT.feasibility}: <strong>{WBS_DRAFT_TEXT[review.draft.feasibility.status]}</strong>
              {review.draft.feasibility.reason && ` — ${review.draft.feasibility.reason}`}
            </p>
          )}
          {notes.map((n) => (
            <div key={n.title}>
              <h4 className="text-[12px] font-semibold text-foreground-800">{n.title}</h4>
              <ul className="list-disc pl-5 text-[12px] text-foreground-700">
                {n.items.map((item, i) => (
                  <li key={i}>{item}</li>
                ))}
              </ul>
            </div>
          ))}

          <div className="flex gap-2">
            <button type="button" className="btn-ghost py-1 text-[12px]" onClick={() => selectAll(true)}>
              {WBS_DRAFT_TEXT.selectAll}
            </button>
            <button type="button" className="btn-ghost py-1 text-[12px]" onClick={() => selectAll(false)}>
              {WBS_DRAFT_TEXT.selectNone}
            </button>
          </div>

          <h3 className="text-[13px] font-semibold text-foreground-950">{formatLabel(WBS_DRAFT_TEXT.tasksSection, { count: review.tasks.length })}</h3>
          <ul className="space-y-2">
            {review.tasks.map((task) => (
              <li key={task.tempId} className="rounded-lg border border-background-300 p-3">
                <div className="flex flex-wrap items-start gap-2">
                  <input
                    type="checkbox"
                    className="mt-2"
                    checked={task.selected}
                    aria-label={task.name || task.tempId}
                    onChange={(e) => patchTask(task.tempId, { selected: e.target.checked })}
                  />
                  <div className="grid flex-1 gap-2 md:grid-cols-[2fr_1fr_1fr_1fr_1fr]">
                    <input className={fieldClass} aria-label={WBS_TEXT.columnName} maxLength={200} value={task.name} onChange={(e) => patchTask(task.tempId, { name: e.target.value })} />
                    <select
                      className={fieldClass}
                      aria-label={WBS_FORM_TEXT.phase}
                      value={task.phaseId ?? ""}
                      onChange={(e) => patchTask(task.tempId, { phaseId: Number(e.target.value) })}
                    >
                      {phases.map((phase) => (
                        <option key={phase.id} value={phase.id}>
                          {phase.name}
                        </option>
                      ))}
                    </select>
                    <select
                      className={fieldClass}
                      aria-label={WBS_TEXT.columnAssignee}
                      value={task.assigneeUserId ?? ""}
                      onChange={(e) => patchTask(task.tempId, { assigneeUserId: e.target.value ? Number(e.target.value) : null })}
                    >
                      <option value="">{WBS_TEXT.unassigned}</option>
                      {members.map((m) => (
                        <option key={m.userId} value={m.userId}>
                          {m.name}
                        </option>
                      ))}
                    </select>
                    <input type="date" className={fieldClass} aria-label={WBS_FORM_TEXT.startDate} value={task.startDate} onChange={(e) => patchTask(task.tempId, { startDate: e.target.value })} />
                    <input type="date" className={fieldClass} aria-label={WBS_FORM_TEXT.endDate} value={task.endDate} onChange={(e) => patchTask(task.tempId, { endDate: e.target.value })} />
                  </div>
                </div>
                <p className="mt-1 pl-6 text-[11.5px] text-foreground-500">
                  {formatLabel(WBS_DRAFT_TEXT.subtaskCount, { count: task.subtasks.length })}
                  {task.estimatedPersonDays !== null && ` · ${formatLabel(WBS_TEXT.personDays, { value: task.estimatedPersonDays })}`}
                  {task.reason && ` · ${WBS_DRAFT_TEXT.reason}: ${task.reason}`}
                </p>
              </li>
            ))}
          </ul>

          {review.milestones.length > 0 && (
            <>
              <h3 className="text-[13px] font-semibold text-foreground-950">
                {formatLabel(WBS_DRAFT_TEXT.milestonesSection, { count: review.milestones.length })}
              </h3>
              <ul className="space-y-2">
                {review.milestones.map((m) => (
                  <li key={m.tempId} className="flex flex-wrap items-center gap-2 rounded-lg border border-background-300 p-3">
                    <input
                      type="checkbox"
                      checked={m.selected}
                      aria-label={m.name || m.tempId}
                      onChange={(e) => patchMilestone(m.tempId, { selected: e.target.checked })}
                    />
                    <span className="flex-1 text-[13px] text-foreground-900">{m.name}</span>
                    <input type="date" className="field text-[13px]" aria-label={WBS_DRAFT_TEXT.targetDate} value={m.targetDate} onChange={(e) => patchMilestone(m.tempId, { targetDate: e.target.value })} />
                  </li>
                ))}
              </ul>
            </>
          )}

          <div className="flex justify-end">
            <button type="button" className="btn-primary" onClick={apply} disabled={busy !== null}>
              {busy === "apply" ? WBS_DRAFT_TEXT.applying : WBS_DRAFT_TEXT.apply}
            </button>
          </div>
        </section>
      )}
    </div>
  );
}
