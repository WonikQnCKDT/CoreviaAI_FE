import type { ReactNode } from "react";

interface ModalProps {
  open: boolean;
  title: string;
  description?: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  width?: string;
}

export default function Modal({ open, title, description, onClose, children, footer, width = "max-w-lg" }: ModalProps) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[60] flex items-start justify-center overflow-y-auto bg-foreground-950/35 px-4 py-10">
      <div className={`relative w-full ${width} rounded-xl border border-background-300 bg-background-50 shadow-panel`}>
        <div className="flex items-start justify-between gap-4 border-b border-background-200 px-5 py-4">
          <div>
            <h3 className="text-[15px] font-semibold text-foreground-950">{title}</h3>
            {description && <p className="mt-1 text-[12px] leading-5 text-foreground-600">{description}</p>}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="닫기"
            className="flex h-7 w-7 cursor-pointer items-center justify-center rounded-md text-foreground-500 hover:bg-background-200 hover:text-foreground-900"
          >
            <i className="ri-close-line text-base" />
          </button>
        </div>
        <div className="max-h-[70vh] overflow-y-auto px-5 py-4">{children}</div>
        {footer && <div className="flex flex-wrap items-center justify-end gap-2 border-t border-background-200 px-5 py-3">{footer}</div>}
      </div>
    </div>
  );
}