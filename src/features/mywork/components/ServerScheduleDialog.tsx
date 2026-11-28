import { useState, type FormEvent } from "react";
import Modal from "@/components/ui/Modal";
import type { EventInput } from "@/features/mywork/api/scheduleApi";
import { SCHEDULE_TEXT } from "@/features/mywork/i18n/ko";
import { validateEventForm, type EventForm } from "@/features/mywork/utils/scheduleRules";

interface Props {
  mode: "create" | "edit";
  initial: EventForm;
  submitting: boolean;
  error: string;
  onClose: () => void;
  onSubmit: (input: EventInput) => void;
}

/** 개인 일정 등록·수정. 시각은 한국 시각으로 입력받아 UTC로 보낸다. 종일은 시작일 00:00 ~ 종료일 다음 날 00:00 */
export default function ServerScheduleDialog({ mode, initial, submitting, error, onClose, onSubmit }: Props) {
  const [form, setForm] = useState<EventForm>(initial);
  const [localError, setLocalError] = useState("");
  const set = <K extends keyof EventForm>(key: K, value: EventForm[K]) => setForm((prev) => ({ ...prev, [key]: value }));

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (submitting) return;
    const checked = validateEventForm(form);
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
      title={mode === "create" ? SCHEDULE_TEXT.addTitle : SCHEDULE_TEXT.editTitle}
      description={mode === "edit" ? SCHEDULE_TEXT.noDelete : undefined}
      onClose={onClose}
      width="max-w-md"
      footer={
        <div className="flex justify-end gap-2">
          <button type="button" className="btn-outline" onClick={onClose} disabled={submitting}>{SCHEDULE_TEXT.cancel}</button>
          <button type="submit" form="server-schedule-form" className="btn-primary" disabled={submitting}>
            {submitting ? SCHEDULE_TEXT.saving : SCHEDULE_TEXT.save}
          </button>
        </div>
      }
    >
      <form id="server-schedule-form" className="space-y-3" onSubmit={submit} noValidate>
        <label className="block text-[12px] font-medium text-foreground-700">
          {SCHEDULE_TEXT.titleLabel}
          <input className={fieldClass} maxLength={200} value={form.title} onChange={(e) => set("title", e.target.value)} autoFocus />
        </label>
        <label className="flex items-center gap-2 text-[12px] font-medium text-foreground-700">
          <input type="checkbox" checked={form.allDay} onChange={(e) => set("allDay", e.target.checked)} />
          {SCHEDULE_TEXT.allDay}
        </label>
        <div className="grid grid-cols-2 gap-3">
          <label className="block text-[12px] font-medium text-foreground-700">
            {SCHEDULE_TEXT.startDate}
            <input type="date" className={fieldClass} value={form.startDate} onChange={(e) => set("startDate", e.target.value)} />
          </label>
          {!form.allDay && (
            <label className="block text-[12px] font-medium text-foreground-700">
              {SCHEDULE_TEXT.startTime}
              <input type="time" className={fieldClass} value={form.startTime} onChange={(e) => set("startTime", e.target.value)} />
            </label>
          )}
          <label className="block text-[12px] font-medium text-foreground-700">
            {SCHEDULE_TEXT.endDate}
            <input type="date" className={fieldClass} value={form.endDate} onChange={(e) => set("endDate", e.target.value)} />
          </label>
          {!form.allDay && (
            <label className="block text-[12px] font-medium text-foreground-700">
              {SCHEDULE_TEXT.endTime}
              <input type="time" className={fieldClass} value={form.endTime} onChange={(e) => set("endTime", e.target.value)} />
            </label>
          )}
        </div>
        <label className="block text-[12px] font-medium text-foreground-700">
          {SCHEDULE_TEXT.memo}
          <textarea className={fieldClass} rows={3} maxLength={2000} value={form.memo} onChange={(e) => set("memo", e.target.value)} />
        </label>
        {shown && <p role="alert" className="rounded-md bg-rose-50 px-3 py-2 text-[12px] text-rose-700">{shown}</p>}
      </form>
    </Modal>
  );
}
