import { useState, type FormEvent } from "react";
import Modal from "@/components/ui/Modal";
import type { ServerProjectMember, ServerProjectPhase } from "@/features/project/api/projectApi";
import type { WbsItem, WbsTaskFields } from "@/features/wbs/api/wbsApi";
import { WBS_FORM_TEXT } from "@/features/wbs/i18n/ko";
import { isWbsPm, validateWbsForm, type WbsFormValues, type WbsViewer } from "@/features/wbs/utils/wbsRules";
import { formatLabel } from "@/shared/i18n/store";

export type WbsFormTarget =
  | { kind: "createTask"; phaseId: number | null }
  | { kind: "createSubtask"; parent: WbsItem }
  | { kind: "edit"; item: WbsItem };

interface Props {
  target: WbsFormTarget;
  phases: ServerProjectPhase[];
  members: ServerProjectMember[];
  viewer: WbsViewer;
  submitting: boolean;
  error: string;
  onClose: () => void;
  onSubmit: (input: { phaseId: number | null; fields: WbsTaskFields }) => void;
}

const initialValues = function (target: WbsFormTarget): WbsFormValues {
  if (target.kind === "edit") {
    const { item } = target;
    return {
      name: item.name,
      description: item.description,
      phaseId: item.phaseId,
      assigneeUserId: item.assignee?.id ?? null,
      startDate: item.startDate,
      endDate: item.endDate,
      effort: item.estimatedEffort === null ? "" : String(item.estimatedEffort),
    };
  }
  const base = target.kind === "createSubtask" ? target.parent : null;
  return {
    name: "",
    description: "",
    phaseId: target.kind === "createTask" ? target.phaseId : (base?.phaseId ?? null),
    assigneeUserId: null,
    // 하위작업은 상위 작업 기간을 기본값으로 둔다
    startDate: base?.startDate ?? "",
    endDate: base?.endDate ?? "",
    effort: "",
  };
};

/**
 * WBS 작업 등록·수정. 담당자 선택지는 서버 멤버 목록에서만 만든다(데모 사용자 ID를 서버로 보내지 않는다).
 * - PM: 누구나 배정
 * - 개발자·QA: 하위작업 등록 때 비우거나 본인만, 수정 때는 담당자를 바꿀 수 없다(서버 403 PROJECT_PM_ONLY)
 */
export default function WbsTaskFormDialog({ target, phases, members, viewer, submitting, error, onClose, onSubmit }: Props) {
  const [values, setValues] = useState<WbsFormValues>(() => initialValues(target));
  const [localError, setLocalError] = useState("");
  const pm = isWbsPm(viewer);
  const isTopLevel = target.kind === "createTask" || (target.kind === "edit" && target.item.parentTaskId === null);
  const scheduleLocked = target.kind === "edit" && target.item.scheduleDerived;
  const assigneeLocked = !pm && target.kind === "edit";
  const assigneeChoices = pm ? members : members.filter((m) => m.userId === viewer.userId);

  const title =
    target.kind === "edit"
      ? WBS_FORM_TEXT.editTitle
      : target.kind === "createSubtask"
        ? formatLabel(WBS_FORM_TEXT.createSubtaskTitle, { name: target.parent.name })
        : WBS_FORM_TEXT.createTitle;

  const set = <K extends keyof WbsFormValues>(key: K, value: WbsFormValues[K]) => setValues((prev) => ({ ...prev, [key]: value }));

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (submitting) return;
    const result = validateWbsForm(values);
    if (result.ok === false) {
      setLocalError(result.message);
      return;
    }
    setLocalError("");
    onSubmit({ phaseId: values.phaseId, fields: result.fields });
  };

  const shownError = localError || error;
  const fieldClass = "field mt-1 w-full text-[13px]";

  return (
    <Modal
      open
      title={title}
      onClose={onClose}
      footer={
        <div className="flex justify-end gap-2">
          <button type="button" className="btn-outline" onClick={onClose} disabled={submitting}>
            {WBS_FORM_TEXT.cancel}
          </button>
          <button type="submit" form="wbs-task-form" className="btn-primary" disabled={submitting}>
            {submitting ? WBS_FORM_TEXT.submitting : WBS_FORM_TEXT.submit}
          </button>
        </div>
      }
    >
      <form id="wbs-task-form" className="space-y-3" onSubmit={submit} noValidate>
        <label className="block text-[12px] font-medium text-foreground-700">
          {WBS_FORM_TEXT.name}
          <input className={fieldClass} value={values.name} maxLength={200} onChange={(e) => set("name", e.target.value)} autoFocus />
        </label>
        <label className="block text-[12px] font-medium text-foreground-700">
          {WBS_FORM_TEXT.description}
          <textarea
            className={fieldClass}
            rows={3}
            value={values.description}
            maxLength={2000}
            onChange={(e) => set("description", e.target.value)}
          />
        </label>
        {isTopLevel ? (
          phases.length > 0 && (
            <label className="block text-[12px] font-medium text-foreground-700">
              {WBS_FORM_TEXT.phase}
              <select
                className={fieldClass}
                value={values.phaseId ?? ""}
                onChange={(e) => set("phaseId", e.target.value ? Number(e.target.value) : null)}
              >
                {phases.map((phase) => (
                  <option key={phase.id} value={phase.id}>
                    {phase.name}
                  </option>
                ))}
              </select>
            </label>
          )
        ) : (
          <p className="text-[11.5px] text-foreground-500">{WBS_FORM_TEXT.phaseInherited}</p>
        )}
        <label className="block text-[12px] font-medium text-foreground-700">
          {WBS_FORM_TEXT.assignee}
          <select
            className={fieldClass}
            value={values.assigneeUserId ?? ""}
            disabled={assigneeLocked}
            onChange={(e) => set("assigneeUserId", e.target.value ? Number(e.target.value) : null)}
          >
            <option value="">{WBS_FORM_TEXT.assigneeNone}</option>
            {(assigneeLocked ? members : assigneeChoices).map((member) => (
              <option key={member.userId} value={member.userId}>
                {member.name}
              </option>
            ))}
            {/* 멤버 목록에 없는 기존 담당자(비활성 등)도 값이 사라지지 않게 보인다 */}
            {values.assigneeUserId !== null && !members.some((m) => m.userId === values.assigneeUserId) && target.kind === "edit" && (
              <option value={values.assigneeUserId}>{target.item.assignee?.name || String(values.assigneeUserId)}</option>
            )}
          </select>
          {!pm && (
            <span className="mt-1 block text-[11px] font-normal text-foreground-500">
              {assigneeLocked ? WBS_FORM_TEXT.assigneePmOnly : WBS_FORM_TEXT.assigneeSelfOnly}
            </span>
          )}
        </label>
        <div className="grid grid-cols-2 gap-3">
          <label className="block text-[12px] font-medium text-foreground-700">
            {WBS_FORM_TEXT.startDate}
            <input type="date" className={fieldClass} value={values.startDate} disabled={scheduleLocked} onChange={(e) => set("startDate", e.target.value)} />
          </label>
          <label className="block text-[12px] font-medium text-foreground-700">
            {WBS_FORM_TEXT.endDate}
            <input type="date" className={fieldClass} value={values.endDate} disabled={scheduleLocked} onChange={(e) => set("endDate", e.target.value)} />
          </label>
        </div>
        {scheduleLocked && <p className="text-[11.5px] text-foreground-500">{WBS_FORM_TEXT.derivedNote}</p>}
        <label className="block text-[12px] font-medium text-foreground-700">
          {WBS_FORM_TEXT.effort}
          <input className={fieldClass} inputMode="decimal" value={values.effort} onChange={(e) => set("effort", e.target.value)} />
        </label>
        {shownError && (
          <p role="alert" className="rounded-md bg-rose-50 px-3 py-2 text-[12px] text-rose-700">
            {shownError}
          </p>
        )}
      </form>
    </Modal>
  );
}
