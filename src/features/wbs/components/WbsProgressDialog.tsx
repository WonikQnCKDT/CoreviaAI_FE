import { useState, type FormEvent } from "react";
import Modal from "@/components/ui/Modal";
import type { WbsItem } from "@/features/wbs/api/wbsApi";
import { WBS_FORM_TEXT } from "@/features/wbs/i18n/ko";
import { parseProgress } from "@/features/wbs/utils/wbsRules";
import { formatLabel } from "@/shared/i18n/store";

interface Props {
  item: WbsItem;
  submitting: boolean;
  error: string;
  onClose: () => void;
  onSubmit: (progress: number) => void;
}

/** 진척률 수정(PATCH .../tasks/{id}/progress). 하위작업이 없는 항목에서만 연다 */
export default function WbsProgressDialog({ item, submitting, error, onClose, onSubmit }: Props) {
  const [value, setValue] = useState(String(item.progress));
  const [localError, setLocalError] = useState("");

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (submitting) return;
    const progress = parseProgress(value);
    if (progress === null) {
      setLocalError(WBS_FORM_TEXT.progressInvalid);
      return;
    }
    setLocalError("");
    onSubmit(progress);
  };

  const shownError = localError || error;

  return (
    <Modal
      open
      title={formatLabel(WBS_FORM_TEXT.progressTitle, { name: item.name })}
      onClose={onClose}
      width="max-w-sm"
      footer={
        <div className="flex justify-end gap-2">
          <button type="button" className="btn-outline" onClick={onClose} disabled={submitting}>
            {WBS_FORM_TEXT.cancel}
          </button>
          <button type="submit" form="wbs-progress-form" className="btn-primary" disabled={submitting}>
            {submitting ? WBS_FORM_TEXT.submitting : WBS_FORM_TEXT.submit}
          </button>
        </div>
      }
    >
      <form id="wbs-progress-form" className="space-y-3" onSubmit={submit} noValidate>
        <label className="block text-[12px] font-medium text-foreground-700">
          {WBS_FORM_TEXT.progressLabel}
          <input
            className="field mt-1 w-full text-[13px]"
            type="number"
            min={0}
            max={100}
            step={1}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            autoFocus
          />
        </label>
        {item.status === "done" && <p className="text-[11.5px] text-foreground-500">{WBS_FORM_TEXT.progressDoneNote}</p>}
        {shownError && (
          <p role="alert" className="rounded-md bg-rose-50 px-3 py-2 text-[12px] text-rose-700">
            {shownError}
          </p>
        )}
      </form>
    </Modal>
  );
}
