import type { ReactNode } from "react";
import Modal from "@/components/ui/Modal";
import { ADMIN_TEXT } from "@/features/admin/i18n/ko";

export type ConfirmPhase = { phase: "idle" } | { phase: "submitting" } | { phase: "failed"; message: string };

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  children: ReactNode;
  confirmLabel: string;
  tone?: "default" | "danger";
  state: ConfirmPhase;
  onConfirm: () => void;
  onClose: () => void;
}

/** 세션 종료처럼 되돌리기 어려운 변경 전에 한 번 더 확인받는 창 */
const ConfirmDialog = function ({
  open,
  title,
  children,
  confirmLabel,
  tone = "default",
  state,
  onConfirm,
  onClose,
}: ConfirmDialogProps) {
  const submitting = state.phase === "submitting";
  const failed = state.phase === "failed";
  return (
    <Modal
      open={open}
      title={title}
      onClose={() => {
        if (!submitting) onClose();
      }}
      footer={
        <>
          <button type="button" className="btn-outline" onClick={onClose} disabled={submitting}>
            {ADMIN_TEXT.cancel}
          </button>
          <button
            type="button"
            className={tone === "danger" ? "btn-primary bg-rose-600 border-rose-600 hover:bg-rose-700" : "btn-primary"}
            onClick={onConfirm}
            disabled={submitting}
          >
            {submitting ? (
              <>
                <i className="ri-loader-4-line animate-spin motion-reduce:animate-none" aria-hidden="true" />
                {ADMIN_TEXT.saving}
              </>
            ) : failed ? (
              ADMIN_TEXT.retry
            ) : (
              confirmLabel
            )}
          </button>
        </>
      }
    >
      <div className="space-y-3 text-sm leading-6 text-foreground-700">{children}</div>
      {failed && (
        <p role="alert" className="mt-3 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-xs leading-5 text-rose-700">
          {state.message}
        </p>
      )}
    </Modal>
  );
};

export default ConfirmDialog;
