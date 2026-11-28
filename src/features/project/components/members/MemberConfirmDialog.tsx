import type { ReactNode } from "react";
import Modal from "@/components/ui/Modal";
import { PROJECT_MEMBER_TEXT } from "@/features/project/i18n/member";

interface MemberConfirmDialogProps {
  open: boolean;
  title: string;
  children: ReactNode;
  confirmLabel: string;
  tone?: "default" | "danger";
  submitting: boolean;
  onConfirm: () => void;
  onClose: () => void;
}

/** 역할 변경·PM 추가·해제·제외 전에 한 번 더 확인받는 창. 처리 중에는 닫거나 다시 누를 수 없다. */
const MemberConfirmDialog = function ({
  open,
  title,
  children,
  confirmLabel,
  tone = "default",
  submitting,
  onConfirm,
  onClose,
}: MemberConfirmDialogProps) {
  return (
    <Modal
      open={open}
      title={title}
      width="max-w-md"
      onClose={() => {
        if (!submitting) onClose();
      }}
      footer={
        <>
          <button type="button" className="btn-outline whitespace-nowrap" onClick={onClose} disabled={submitting}>
            {PROJECT_MEMBER_TEXT.cancel}
          </button>
          <button
            type="button"
            className={`whitespace-nowrap ${tone === "danger" ? "btn-primary border-rose-600 bg-rose-600 hover:bg-rose-700" : "btn-primary"}`}
            onClick={onConfirm}
            disabled={submitting}
          >
            {submitting ? (
              <>
                <i className="ri-loader-4-line animate-spin motion-reduce:animate-none" aria-hidden="true" />
                {PROJECT_MEMBER_TEXT.submitting}
              </>
            ) : (
              confirmLabel
            )}
          </button>
        </>
      }
    >
      <div className="space-y-2 text-[12.5px] leading-5 text-foreground-700">{children}</div>
    </Modal>
  );
};

export default MemberConfirmDialog;
