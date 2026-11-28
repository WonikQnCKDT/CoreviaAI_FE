import { useState, type FormEvent } from "react";
import Modal from "@/components/ui/Modal";
import type { WbsItem } from "@/features/wbs/api/wbsApi";
import type { ReparentOption } from "@/features/wbs/utils/wbsRules";
import { BUTTON_TEXT } from "@/shared/i18n/catalog/button";

interface WbsReparentDialogProps {
  item: WbsItem;
  options: ReparentOption[];
  phases: { id: number; name: string }[];
  submitting: boolean;
  error: string;
  onClose: () => void;
  onSubmit: (option: ReparentOption) => void;
}

const ROOT_VALUE = "__root__";

/**
 * WBS 상위 작업 변경 다이얼로그(FR-WBS-01).
 * 선택한 대상에 대해 기존 PUT .../position API를 호출해 계층을 변경한다.
 */
export default function WbsReparentDialog({
  item,
  options,
  phases,
  submitting,
  error,
  onClose,
  onSubmit,
}: WbsReparentDialogProps) {
  const [selected, setSelected] = useState<string>(() => {
    const first = options[0];
    if (!first) return "";
    return first.parentTaskId === null ? ROOT_VALUE : String(first.parentTaskId);
  });

  const phaseName = (phaseId: number | null) => {
    if (phaseId === null) return "";
    const found = phases.find((p) => p.id === phaseId);
    return found ? `[${found.name}] ` : "";
  };

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    const target = options.find((opt) =>
      opt.parentTaskId === null ? selected === ROOT_VALUE : String(opt.parentTaskId) === selected,
    );
    if (target) onSubmit(target);
  };

  return (
    <Modal open onClose={submitting ? () => {} : onClose} title="상위 작업 변경">
      <form onSubmit={handleSubmit} className="space-y-3.5">
        <p className="text-[12.5px] text-foreground-700">
          <span className="font-medium text-foreground-950">{item.name}</span>의 위치를 변경합니다. 다른 단계의 상위 작업 아래로 옮기면 해당 단계로 함께 이동합니다.
        </p>

        <div className="space-y-1.5">
          <label htmlFor="wbs-reparent-select" className="block text-[12px] font-medium text-foreground-700">
            이동할 상위 작업
          </label>
          <select
            id="wbs-reparent-select"
            className="field text-sm"
            value={selected}
            onChange={(e) => setSelected(e.target.value)}
            disabled={submitting}
          >
            {options.map((opt) => {
              const value = opt.parentTaskId === null ? ROOT_VALUE : String(opt.parentTaskId);
              const label = opt.parentTaskId === null ? "최상위 작업으로 올리기" : `${phaseName(opt.phaseId)}${opt.name}`;
              return (
                <option key={value} value={value}>
                  {label}
                </option>
              );
            })}
          </select>
        </div>

        {error && (
          <p role="alert" className="rounded-md bg-rose-50 px-3 py-2 text-[12px] text-rose-700">
            {error}
          </p>
        )}

        <div className="flex justify-end gap-2 pt-1">
          <button type="button" className="btn-outline" onClick={onClose} disabled={submitting}>
            {BUTTON_TEXT.cancel}
          </button>
          <button type="submit" className="btn-primary" disabled={submitting || !selected}>
            {submitting ? "저장 중..." : BUTTON_TEXT.save}
          </button>
        </div>
      </form>
    </Modal>
  );
}
