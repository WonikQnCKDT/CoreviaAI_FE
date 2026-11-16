import { useId } from "react";

interface InfoTipProps {
  text: string;
  label?: string;
  className?: string;
}

/** 짧은 설명을 아이콘 뒤에 숨겨 두는 툴팁입니다. */
export default function InfoTip({ text, label = "설명 보기", className = "" }: InfoTipProps) {
  const id = useId();
  return (
    <span className={`group relative inline-flex h-4 w-4 shrink-0 items-center justify-center ${className}`}>
      <button
        type="button"
        aria-label={label}
        aria-describedby={id}
        className="flex h-4 w-4 cursor-help items-center justify-center rounded-full text-foreground-400 transition hover:text-primary-600"
      >
        <i className="ri-information-line text-[13px]" aria-hidden="true" />
      </button>
      <span
        role="tooltip"
        id={id}
        className="pointer-events-none absolute left-1/2 top-full z-40 mt-1.5 w-[260px] -translate-x-1/2 rounded-md border border-background-300 bg-background-50 px-2.5 py-2 text-left text-[11px] font-normal leading-4 text-foreground-700 opacity-0 shadow-lg transition group-hover:opacity-100 group-focus-within:opacity-100"
      >
        {text}
      </span>
    </span>
  );
}