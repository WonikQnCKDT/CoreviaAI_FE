import { useEffect, useMemo, useRef, useState } from "react";
import { BUTTON_TEXT } from "@/shared/i18n/catalog/button";

export interface AssigneeOption {
  id: string;
  name: string;
  roleLabel?: string;
  dept?: string;
}

interface AssigneeMultiSelectProps {
  members: AssigneeOption[];
  value: string[];
  onChange: (next: string[]) => void;
  placeholder?: string;
  /** 목록이 좁은 공간에 들어갈 때 사용합니다. */
  compact?: boolean;
}

/**
 * 업무 담당자를 여러 명 선택하는 다중 선택 컴포넌트입니다.
 * 선택된 사람은 이름 칩으로 표시되고, 칩의 X로 개별 해제할 수 있습니다.
 */
export default function AssigneeMultiSelect({
  members,
  value,
  onChange,
  placeholder = "담당자를 선택하세요 (복수 선택 가능)",
  compact = false,
}: AssigneeMultiSelectProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const selectedMembers = useMemo(
    () => value.map((id) => members.find((m) => m.id === id)).filter((m): m is AssigneeOption => Boolean(m)),
    [value, members],
  );

  useEffect(() => {
    if (!open) return;
    const handlePointerDown = (event: MouseEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  const toggle = (memberId: string) => {
    if (value.includes(memberId)) onChange(value.filter((id) => id !== memberId));
    else onChange([...value, memberId]);
  };

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        aria-expanded={open}
        aria-haspopup="listbox"
        className={`flex w-full cursor-pointer flex-wrap items-center gap-1 rounded-md border border-background-300 bg-background-50 text-left transition hover:border-primary-300 focus:outline-none focus:ring-2 focus:ring-primary-200 ${
          compact ? "px-2 py-1.5" : "min-h-[34px] px-2 py-1.5"
        }`}
      >
        {selectedMembers.length === 0 ? (
          <span className="text-[12px] text-foreground-400">{placeholder}</span>
        ) : (
          selectedMembers.map((member) => (
            <span
              key={member.id}
              className="inline-flex max-w-full items-center gap-1 rounded-full border border-primary-200 bg-primary-50 px-2 py-0.5 text-[11px] font-medium text-primary-800"
            >
              <span className="truncate">{member.name}</span>
              <span
                role="button"
                tabIndex={-1}
                aria-label={`${member.name} 담당자 해제`}
                onClick={(event) => {
                  event.stopPropagation();
                  toggle(member.id);
                }}
                className="flex h-3.5 w-3.5 shrink-0 cursor-pointer items-center justify-center rounded-full text-primary-600 hover:bg-primary-200/70 hover:text-primary-900"
              >
                <i className="ri-close-line text-[11px]" aria-hidden="true" />
              </span>
            </span>
          ))
        )}
        <span className="ml-auto flex h-4 w-4 shrink-0 items-center justify-center text-foreground-400">
          <i className={open ? "ri-arrow-up-s-line text-[13px]" : "ri-arrow-down-s-line text-[13px]"} aria-hidden="true" />
        </span>
      </button>

      {open && (
        <div className="absolute left-0 right-0 z-40 mt-1 overflow-hidden rounded-lg border border-background-300 bg-background-50 shadow-panel">
          <div className="flex items-center justify-between gap-2 border-b border-background-200 px-2.5 py-1.5">
            <span className="text-[10.5px] font-medium text-foreground-500">
              선택 {selectedMembers.length}명 / 전체 {members.length}명
            </span>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => onChange(members.map((m) => m.id))}
                className="cursor-pointer whitespace-nowrap rounded px-1.5 py-0.5 text-[10.5px] font-medium text-primary-600 hover:bg-primary-50"
              >
                {BUTTON_TEXT.selectAll}
              </button>
              <button
                type="button"
                onClick={() => onChange([])}
                className="cursor-pointer whitespace-nowrap rounded px-1.5 py-0.5 text-[10.5px] text-foreground-500 hover:bg-background-100"
              >
                {BUTTON_TEXT.reset}
              </button>
            </div>
          </div>
          <ul role="listbox" aria-multiselectable="true" className="max-h-[220px] overflow-y-auto py-1">
            {members.length === 0 && (
              <li className="px-3 py-3 text-center text-[11.5px] text-foreground-500">선택할 수 있는 멤버가 없습니다.</li>
            )}
            {members.map((member) => {
              const checked = value.includes(member.id);
              return (
                <li key={member.id}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={checked}
                    onClick={() => toggle(member.id)}
                    className={`flex w-full cursor-pointer items-center gap-2 px-2.5 py-1.5 text-left transition ${
                      checked ? "bg-primary-50/70" : "hover:bg-background-100"
                    }`}
                  >
                    <span
                      className={`flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded ${
                        checked ? "bg-primary-500 text-background-50" : "border border-background-400 text-transparent"
                      }`}
                    >
                      <i className="ri-check-line text-[10px]" aria-hidden="true" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[12px] font-medium text-foreground-900">{member.name}</span>
                      <span className="block truncate text-[10.5px] text-foreground-500">
                        {[member.dept, member.roleLabel].filter(Boolean).join(" · ") || "-"}
                      </span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
          <div className="border-t border-background-200 px-2.5 py-1.5">
            <p className="text-[10.5px] leading-4 text-foreground-500">
              한 업무를 여러 명이 함께 담당합니다. 선택한 모든 담당자의 ‘내 업무’에 표시됩니다.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}