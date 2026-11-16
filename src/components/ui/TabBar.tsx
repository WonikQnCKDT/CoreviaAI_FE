import type { ReactNode } from "react";

export interface TabBarItem {
  key: string;
  label: string;
  icon?: string;
  count?: number;
}

interface TabBarProps {
  items: TabBarItem[];
  activeKey: string;
  onChange: (key: string) => void;
  meta?: ReactNode;
  ariaLabel?: string;
  className?: string;
}

/** 화면 공통 탭 스타일입니다. 선택된 탭만 진한 파란색과 얇은 밑줄로 표시합니다. */
export default function TabBar({ items, activeKey, onChange, meta, ariaLabel, className = "" }: TabBarProps) {
  return (
    <div className={`flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-background-300 ${className}`}>
      <div role="tablist" aria-label={ariaLabel} className="flex flex-wrap items-center gap-0.5">
        {items.map((item) => {
          const active = item.key === activeKey;
          return (
            <button
              key={item.key}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => onChange(item.key)}
              className={`relative flex cursor-pointer items-center gap-1.5 whitespace-nowrap px-3 py-2.5 text-[13px] font-medium transition ${
                active ? "text-primary-700" : "text-foreground-600 hover:text-foreground-950"
              }`}
            >
              {item.icon && <i className={`${item.icon} text-[15px]`} aria-hidden="true" />}
              {item.label}
              {typeof item.count === "number" && (
                <span className={`text-[11.5px] tabular-nums ${active ? "text-primary-600" : "text-foreground-400"}`}>
                  {item.count}
                </span>
              )}
              {active && <span className="absolute inset-x-2 -bottom-px h-0.5 rounded-full bg-primary-500" />}
            </button>
          );
        })}
      </div>
      {meta && <div className="ml-auto flex flex-wrap items-center gap-2 pb-1.5">{meta}</div>}
    </div>
  );
}