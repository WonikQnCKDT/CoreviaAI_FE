import { useEffect, useState } from "react";
import Modal from "@/components/ui/Modal";
import { BUTTON_TEXT } from "@/shared/i18n/catalog/button";

export interface ScheduleFormValue {
  title: string;
  date: string;
  startTime: string;
  endTime: string;
  type: "personal" | "meeting";
}

interface ScheduleEditorModalProps {
  open: boolean;
  mode: "create" | "edit";
  initial: ScheduleFormValue;
  onClose: () => void;
  onSave: (value: ScheduleFormValue) => void;
  onDelete?: () => void;
}

export default function ScheduleEditorModal({
  open,
  mode,
  initial,
  onClose,
  onSave,
  onDelete,
}: ScheduleEditorModalProps) {
  const [value, setValue] = useState<ScheduleFormValue>(initial);
  const [error, setError] = useState("");
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const initialKey = JSON.stringify(initial);

  useEffect(() => {
    if (!open) return;
    setValue(initial);
    setError("");
    setDeleteConfirm(false);
    // initialKey로 초기값 변화를 감지합니다.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, initialKey]);

  const patch = (next: Partial<ScheduleFormValue>) => setValue((prev) => ({ ...prev, ...next }));

  const submit = () => {
    if (!value.title.trim()) {
      setError("일정 제목을 입력해 주세요.");
      return;
    }
    if (!value.date) {
      setError("일정 날짜를 선택해 주세요.");
      return;
    }
    if (value.endTime <= value.startTime) {
      setError("종료 시간이 시작 시간보다 빠르거나 같습니다.");
      return;
    }
    onSave({ ...value, title: value.title.trim() });
  };

  return (
    <Modal
      open={open}
      title={mode === "edit" ? "일정 수정" : "일정 추가"}
      description={
        mode === "edit"
          ? "선택한 일정의 내용을 수정하거나 삭제할 수 있습니다."
          : "선택한 날짜와 시간이 자동으로 입력됩니다. 제목만 입력하고 저장해도 등록됩니다."
      }
      onClose={onClose}
      footer={
        <>
          {mode === "edit" && onDelete && (
            <div className="mr-auto">
              {deleteConfirm ? (
                <span className="flex flex-wrap items-center gap-2">
                  <span className="text-[11.5px] text-foreground-600">이 일정을 삭제할까요?</span>
                  <button type="button" className="btn-outline whitespace-nowrap text-rose-600" onClick={onDelete}>
                    {BUTTON_TEXT.delete}
                  </button>
                  <button type="button" className="btn-ghost whitespace-nowrap" onClick={() => setDeleteConfirm(false)}>
                    {BUTTON_TEXT.cancel}
                  </button>
                </span>
              ) : (
                <button
                  type="button"
                  className="btn-ghost whitespace-nowrap text-rose-600 hover:bg-rose-50"
                  onClick={() => setDeleteConfirm(true)}
                >
                  <i className="ri-delete-bin-line" aria-hidden="true" /> {BUTTON_TEXT.deleteSchedule}
                </button>
              )}
            </div>
          )}
          <button type="button" className="btn-outline whitespace-nowrap" onClick={onClose}>
            {BUTTON_TEXT.cancel}
          </button>
          <button type="button" className="btn-primary whitespace-nowrap" onClick={submit}>
            <i className="ri-save-line" aria-hidden="true" /> {mode === "edit" ? BUTTON_TEXT.saveChanges : BUTTON_TEXT.saveSchedule}
          </button>
        </>
      }
    >
      <div className="space-y-3.5">
        <label className="block">
          <span className="mb-1 block text-[11.5px] font-medium text-foreground-700">
            제목 <span className="text-rose-500">*</span>
          </span>
          <input
            className="field"
            value={value.title}
            placeholder="예) 치과 예약"
            autoFocus
            onChange={(event) => patch({ title: event.target.value })}
          />
        </label>
        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <span className="mb-1 block text-[11.5px] font-medium text-foreground-700">날짜</span>
            <input
              type="date"
              className="field"
              value={value.date}
              onChange={(event) => patch({ date: event.target.value })}
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-[11.5px] font-medium text-foreground-700">구분</span>
            <select
              className="field"
              value={value.type}
              onChange={(event) => patch({ type: event.target.value as "personal" | "meeting" })}
            >
              <option value="personal">개인 일정</option>
              <option value="meeting">회의</option>
            </select>
          </label>
          <label className="block">
            <span className="mb-1 block text-[11.5px] font-medium text-foreground-700">시작</span>
            <input
              type="time"
              className="field"
              value={value.startTime}
              onChange={(event) => patch({ startTime: event.target.value })}
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-[11.5px] font-medium text-foreground-700">종료</span>
            <input
              type="time"
              className="field"
              value={value.endTime}
              onChange={(event) => patch({ endTime: event.target.value })}
            />
          </label>
        </div>
        {error && (
          <p className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-[11.5px] text-rose-700">{error}</p>
        )}
      </div>
    </Modal>
  );
}