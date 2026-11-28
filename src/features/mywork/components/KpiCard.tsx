import { COMMON_UI_TEXT } from "@/shared/i18n/catalog/common";

interface KpiCardProps {
  icon: string;
  label: string;
  value: number;
  unit?: string;
  hint: string;
  tone: "primary" | "warning" | "danger" | "success";
  active?: boolean;
  onClick: () => void;
}

const TONE_STYLE: Record<KpiCardProps["tone"], { box: string; text: string }> = {
  primary: { box: "bg-primary-50 text-primary-600", text: "text-primary-600" },
  warning: { box: "bg-amber-50 text-amber-600", text: "text-amber-600" },
  danger: { box: "bg-rose-50 text-rose-600", text: "text-rose-600" },
  success: { box: "bg-emerald-50 text-emerald-600", text: "text-emerald-600" },
};

export default function KpiCard({ icon, label, value, unit, hint, tone, active = false, onClick }: KpiCardProps) {
  const style = TONE_STYLE[tone];
  const displayUnit = unit ?? COMMON_UI_TEXT.countUnit;
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      title={hint}
      className={`card flex w-full cursor-pointer items-center gap-3 px-4 py-3 text-left transition hover:border-primary-300 ${
        active ? "border-primary-400 ring-1 ring-primary-200" : ""
      }`}
    >
      <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${style.box}`}>
        <i className={`${icon} text-[16px]`} aria-hidden="true" />
      </span>
      <span className="min-w-0">
        <span className="block truncate text-[11.5px] font-medium text-foreground-600">{label}</span>
        <span className={`mt-1 flex items-baseline gap-1 ${style.text}`}>
          <span className="text-[20px] font-semibold leading-none tabular-nums">{value}</span>
          <span className="text-[11px] font-medium text-foreground-500">{displayUnit}</span>
        </span>
      </span>
    </button>
  );
}