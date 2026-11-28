import { useId, useState, type FormEvent } from "react";
import Modal from "@/components/ui/Modal";
import { MAX_MILESTONE_TASKS, type Milestone } from "@/features/wbs/api/milestoneApi";
import type { WbsItem } from "@/features/wbs/api/wbsApi";
import { MILESTONE_TEXT } from "@/features/wbs/i18n/ko";
import { MILESTONE_NAME_MAX, validateMilestoneForm } from "@/features/wbs/utils/milestoneRules";
import { formatLabel } from "@/shared/i18n/store";

export type MilestoneDialogTarget = { kind: "create" } | { kind: "edit"; milestone: Milestone } | { kind: "tasks"; milestone: Milestone };

export interface MilestoneDialogInput {
  name: string;
  targetDate: string;
  taskIds: number[];
}

interface Props {
  target: MilestoneDialogTarget;
  /** WBS 트리(작업 > 하위작업). 연결 작업 선택지 */
  tree: WbsItem[];
  submitting: boolean;
  error: string;
  onClose: () => void;
  onSubmit: (input: MilestoneDialogInput) => void;
}

const FORM_ID = "milestone-form";

/** WBS 트리에서 연결 작업을 여러 개 고른다. 상한에 닿으면 고르지 않은 항목은 막는다 */
function TaskPicker({ tree, selected, onChange }: { tree: WbsItem[]; selected: number[]; onChange: (ids: number[]) => void }) {
  const hintId = useId();
  const chosen = new Set(selected);
  const full = chosen.size >= MAX_MILESTONE_TASKS;
  const toggle = (id: number) => onChange(chosen.has(id) ? selected.filter((v) => v !== id) : [...selected, id]);

  const option = (item: WbsItem, depth: 0 | 1) => (
    <li key={item.id}>
      <label className={`flex items-center gap-2 py-1 text-[12.5px] text-foreground-800 ${depth === 1 ? "pl-6" : ""}`}>
        <input type="checkbox" checked={chosen.has(item.id)} disabled={full && !chosen.has(item.id)} onChange={() => toggle(item.id)} />
        {item.name}
      </label>
    </li>
  );

  return (
    <fieldset className="space-y-1" aria-describedby={hintId}>
      <legend className="text-[12px] font-medium text-foreground-700">{MILESTONE_TEXT.tasks}</legend>
      <p id={hintId} className="text-[11.5px] text-foreground-500">
        {formatLabel(MILESTONE_TEXT.tasksHint, { max: MAX_MILESTONE_TASKS })}
      </p>
      {tree.length === 0 ? (
        <p className="text-[12px] text-foreground-500">{MILESTONE_TEXT.noWbsTasks}</p>
      ) : (
        <ul className="max-h-64 overflow-y-auto rounded-md border border-background-200 px-3 py-1.5">
          {tree.map((task) => [option(task, 0), ...task.subtasks.map((sub) => option(sub, 1))])}
        </ul>
      )}
      <p className="text-[11.5px] text-foreground-600" role="status">
        {full ? formatLabel(MILESTONE_TEXT.tasksLimitReached, { max: MAX_MILESTONE_TASKS }) : formatLabel(MILESTONE_TEXT.tasksSelected, { count: chosen.size })}
      </p>
    </fieldset>
  );
}

/**
 * 마일스톤 추가(이름·목표일·연결 작업), 수정(이름·목표일), 연결 작업 교체. PM에게만 연다.
 * 수정과 연결 교체는 서버 API가 따로라(PATCH·PUT, 각자 version) 대화상자도 나눈다.
 */
export default function MilestoneDialog({ target, tree, submitting, error, onClose, onSubmit }: Props) {
  const source = target.kind === "create" ? null : target.milestone;
  const [name, setName] = useState(source?.name ?? "");
  const [targetDate, setTargetDate] = useState(source?.targetDate ?? "");
  const [taskIds, setTaskIds] = useState<number[]>(source?.tasks.map((t) => t.id) ?? []);
  const [localError, setLocalError] = useState("");
  const showFields = target.kind !== "tasks";
  const showTasks = target.kind !== "edit";

  const title =
    target.kind === "create"
      ? MILESTONE_TEXT.createTitle
      : target.kind === "edit"
        ? MILESTONE_TEXT.editTitle
        : formatLabel(MILESTONE_TEXT.tasksTitle, { name: target.milestone.name });

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (submitting) return;
    if (showFields) {
      const checked = validateMilestoneForm({ name, targetDate });
      if (checked.ok === false) {
        setLocalError(checked.message);
        return;
      }
    }
    setLocalError("");
    onSubmit({ name: name.trim(), targetDate, taskIds });
  };

  const shownError = localError || error;

  return (
    <Modal
      open
      title={title}
      onClose={onClose}
      footer={
        <div className="flex justify-end gap-2">
          <button type="button" className="btn-outline" onClick={onClose} disabled={submitting}>
            {MILESTONE_TEXT.cancel}
          </button>
          <button type="submit" form={FORM_ID} className="btn-primary" disabled={submitting}>
            {submitting ? MILESTONE_TEXT.submitting : MILESTONE_TEXT.submit}
          </button>
        </div>
      }
    >
      <form id={FORM_ID} className="space-y-3" onSubmit={submit} noValidate>
        {showFields && (
          <>
            <label className="block text-[12px] font-medium text-foreground-700">
              {MILESTONE_TEXT.name}
              <input
                className="field mt-1 w-full text-[13px]"
                value={name}
                maxLength={MILESTONE_NAME_MAX}
                onChange={(e) => setName(e.target.value)}
                autoFocus
              />
            </label>
            <label className="block text-[12px] font-medium text-foreground-700">
              {MILESTONE_TEXT.targetDate}
              <input className="field mt-1 w-full text-[13px]" type="date" value={targetDate} onChange={(e) => setTargetDate(e.target.value)} />
            </label>
          </>
        )}
        {showTasks && <TaskPicker tree={tree} selected={taskIds} onChange={setTaskIds} />}
        {shownError && (
          <p role="alert" className="rounded-md bg-rose-50 px-3 py-2 text-[12px] text-rose-700">
            {shownError}
          </p>
        )}
      </form>
    </Modal>
  );
}
