import { useState, type FormEvent } from "react";
import Modal from "@/components/ui/Modal";
import type { TodoInput } from "@/features/mywork/api/todoApi";
import { TODO_TEXT } from "@/features/mywork/i18n/ko";
import { validateTodoInput } from "@/features/mywork/utils/todoRules";

interface Props {
  mode: "create" | "edit";
  initial?: { title: string; dueDate: string | null };
  submitting: boolean;
  error: string;
  onClose: () => void;
  onSubmit: (input: TodoInput) => void;
}

/** 개인 할 일 등록·수정 폼. 서버와 같은 규칙으로 먼저 검사한다(공백만·200자 초과·제어 문자) */
export default function ServerTodoDialog({ mode, initial, submitting, error, onClose, onSubmit }: Props) {
  const [title, setTitle] = useState(initial?.title ?? "");
  const [dueDate, setDueDate] = useState(initial?.dueDate ?? "");
  const [localError, setLocalError] = useState("");

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (submitting) return;
    const checked = validateTodoInput({ title, dueDate });
    if (checked.ok === false) {
      setLocalError(checked.message);
      return;
    }
    setLocalError("");
    onSubmit(checked.input);
  };

  const shown = localError || error;

  return (
    <Modal
      open
      title={mode === "create" ? TODO_TEXT.addTitle : TODO_TEXT.editTitle}
      onClose={onClose}
      width="max-w-md"
      footer={
        <div className="flex justify-end gap-2">
          <button type="button" className="btn-outline" onClick={onClose} disabled={submitting}>
            {TODO_TEXT.cancel}
          </button>
          <button type="submit" form="server-todo-form" className="btn-primary" disabled={submitting}>
            {submitting ? TODO_TEXT.saving : TODO_TEXT.save}
          </button>
        </div>
      }
    >
      <form id="server-todo-form" className="space-y-3" onSubmit={submit} noValidate>
        <label className="block text-[12px] font-medium text-foreground-700">
          {TODO_TEXT.titleLabel}
          <input className="field mt-1 w-full text-[13px]" value={title} maxLength={200} placeholder={TODO_TEXT.titlePlaceholder} onChange={(e) => setTitle(e.target.value)} autoFocus />
        </label>
        <label className="block text-[12px] font-medium text-foreground-700">
          {TODO_TEXT.dueLabel}
          <input type="date" className="field mt-1 w-full text-[13px]" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
        </label>
        {shown && (
          <p role="alert" className="rounded-md bg-rose-50 px-3 py-2 text-[12px] text-rose-700">
            {shown}
          </p>
        )}
      </form>
    </Modal>
  );
}
