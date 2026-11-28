import { useState, type FormEvent } from "react";
import Modal from "@/components/ui/Modal";
import type { MeetingInput } from "@/features/meeting/api/meetingApi";
import { MEETING_FORM_TEXT } from "@/features/meeting/i18n/ko";
import { validateMeetingForm, type ActionRow, type MeetingForm } from "@/features/meeting/utils/meetingRules";
import type { ServerProjectMember } from "@/features/project/api/projectApi";

interface Props {
  mode: "create" | "edit";
  initial: MeetingForm;
  members: ServerProjectMember[];
  /** 수정할 회의록에 이미 있는 사내 사용자(지금은 멤버가 아닐 수 있다). 말없이 빠지지 않게 선택지에 남긴다 */
  existingPeople?: { userId: number; name: string }[];
  submitting: boolean;
  error: string;
  onClose: () => void;
  onSubmit: (input: MeetingInput) => void;
}

/** 회의록 작성·수정. 사내 참석자·담당자는 프로젝트 멤버 목록에서만 고른다(데모 사용자 ID를 보내지 않는다) */
export default function MeetingFormDialog({ mode, initial, members, existingPeople = [], submitting, error, onClose, onSubmit }: Props) {
  const [form, setForm] = useState<MeetingForm>(initial);
  const [localError, setLocalError] = useState("");
  const set = <K extends keyof MeetingForm>(key: K, value: MeetingForm[K]) => setForm((prev) => ({ ...prev, [key]: value }));
  const setAction = (index: number, patch: Partial<ActionRow>) =>
    setForm((prev) => ({ ...prev, actions: prev.actions.map((a, i) => (i === index ? { ...a, ...patch } : a)) }));
  const setDecision = (index: number, value: string) =>
    setForm((prev) => ({ ...prev, decisions: prev.decisions.map((d, i) => (i === index ? value : d)) }));

  // 멤버 먼저, 그다음 멤버가 아닌 기존 사람. 같은 사람(참석자이자 담당자)은 한 번만
  const people = [...members.map((m) => ({ userId: m.userId, name: m.name })), ...existingPeople].filter(
    (p, i, all) => all.findIndex((q) => q.userId === p.userId) === i,
  );

  const toggleMember = (userId: number) =>
    set("memberIds", form.memberIds.includes(userId) ? form.memberIds.filter((id) => id !== userId) : [...form.memberIds, userId]);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (submitting) return;
    const checked = validateMeetingForm(form, people.map((p) => p.userId));
    if (checked.ok === false) {
      setLocalError(checked.message);
      return;
    }
    setLocalError("");
    onSubmit(checked.input);
  };

  const fieldClass = "field mt-1 w-full text-[13px]";
  const shown = localError || error;

  return (
    <Modal
      open
      title={mode === "create" ? MEETING_FORM_TEXT.createTitle : MEETING_FORM_TEXT.editTitle}
      onClose={onClose}
      width="max-w-2xl"
      footer={
        <div className="flex justify-end gap-2">
          <button type="button" className="btn-outline" onClick={onClose} disabled={submitting}>{MEETING_FORM_TEXT.cancel}</button>
          <button type="submit" form="meeting-form" className="btn-primary" disabled={submitting}>
            {submitting ? MEETING_FORM_TEXT.saving : MEETING_FORM_TEXT.save}
          </button>
        </div>
      }
    >
      <form id="meeting-form" className="space-y-3" onSubmit={submit} noValidate>
        <label className="block text-[12px] font-medium text-foreground-700">
          {MEETING_FORM_TEXT.title}
          <input className={fieldClass} maxLength={200} value={form.title} onChange={(e) => set("title", e.target.value)} autoFocus />
        </label>
        <div className="grid grid-cols-2 gap-3">
          <label className="block text-[12px] font-medium text-foreground-700">
            {MEETING_FORM_TEXT.date}
            <input type="date" className={fieldClass} value={form.date} onChange={(e) => set("date", e.target.value)} />
          </label>
          <label className="block text-[12px] font-medium text-foreground-700">
            {MEETING_FORM_TEXT.time}
            <input type="time" className={fieldClass} value={form.time} onChange={(e) => set("time", e.target.value)} />
          </label>
        </div>

        <fieldset>
          <legend className="text-[12px] font-medium text-foreground-700">{MEETING_FORM_TEXT.members}</legend>
          <div className="mt-1 flex flex-wrap gap-2">
            {people.map((m) => (
              <label key={m.userId} className="flex items-center gap-1 rounded-md border border-background-300 px-2 py-1 text-[12px]">
                <input type="checkbox" checked={form.memberIds.includes(m.userId)} onChange={() => toggleMember(m.userId)} />
                {m.name || `#${m.userId}`}
              </label>
            ))}
          </div>
        </fieldset>
        <label className="block text-[12px] font-medium text-foreground-700">
          {MEETING_FORM_TEXT.externals}
          <textarea className={fieldClass} rows={2} value={form.externals} onChange={(e) => set("externals", e.target.value)} />
        </label>

        <label className="block text-[12px] font-medium text-foreground-700">
          {MEETING_FORM_TEXT.content}
          <textarea className={fieldClass} rows={6} maxLength={50000} value={form.content} onChange={(e) => set("content", e.target.value)} />
        </label>

        <fieldset className="space-y-1.5">
          <legend className="text-[12px] font-medium text-foreground-700">{MEETING_FORM_TEXT.decisions}</legend>
          {form.decisions.map((d, i) => (
            <input key={i} className="field w-full text-[13px]" maxLength={1000} aria-label={`${MEETING_FORM_TEXT.decisions} ${i + 1}`} value={d}
              onChange={(e) => setDecision(i, e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  set("decisions", [...form.decisions.slice(0, i + 1), "", ...form.decisions.slice(i + 1)]);
                }
              }}
            />
          ))}
          <button type="button" className="btn-ghost py-1 text-[12px]" onClick={() => set("decisions", [...form.decisions, ""])}>+ {MEETING_FORM_TEXT.decisions}</button>
        </fieldset>

        <fieldset className="space-y-1.5">
          <legend className="text-[12px] font-medium text-foreground-700">{MEETING_FORM_TEXT.actionItems}</legend>
          {form.actions.map((a, i) => (
            <div key={i} className="grid grid-cols-[1fr_130px_130px_auto] items-center gap-1.5">
              <input className="field text-[13px]" maxLength={1000} aria-label={`${MEETING_FORM_TEXT.actionContent} ${i + 1}`} value={a.content} onChange={(e) => setAction(i, { content: e.target.value })} />
              <select className="field text-[12px]" aria-label={`${MEETING_FORM_TEXT.actionAssignee} ${i + 1}`} value={a.assigneeUserId ?? ""} onChange={(e) => setAction(i, { assigneeUserId: e.target.value ? Number(e.target.value) : null })}>
                <option value="">-</option>
                {people.map((m) => <option key={m.userId} value={m.userId}>{m.name || `#${m.userId}`}</option>)}
              </select>
              <input type="date" className="field text-[12px]" aria-label={`${MEETING_FORM_TEXT.actionDue} ${i + 1}`} value={a.dueDate} onChange={(e) => setAction(i, { dueDate: e.target.value })} />
              <button type="button" className="btn-ghost px-2 py-1 text-[12px] text-rose-600" aria-label={`${MEETING_FORM_TEXT.removeAction} ${i + 1}`}
                onClick={() => set("actions", form.actions.filter((_, j) => j !== i))}>
                {MEETING_FORM_TEXT.removeAction}
              </button>
            </div>
          ))}
          <button type="button" className="btn-ghost py-1 text-[12px]" onClick={() => set("actions", [...form.actions, { content: "", assigneeUserId: null, dueDate: "" }])}>
            + {MEETING_FORM_TEXT.addAction}
          </button>
        </fieldset>

        {shown && <p role="alert" className="rounded-md bg-rose-50 px-3 py-2 text-[12px] text-rose-700">{shown}</p>}
      </form>
    </Modal>
  );
}
