import type { ReactNode } from "react";

interface StatCardProps {
  label: string;
  value: ReactNode;
  unit?: string;
  hint?: string;
  tone?: "default" | "primary" | "warning" | "danger" | "success";
  onClick?: () => void;
}

const TONE = {
  default: "text-foreground-950",
  primary: "text-primary-600",
  warning: "text-amber-600",
  danger: "text-rose-600",
  success: "text-emerald-600",
};

export default function StatCard({ label, value, unit, hint, tone = "default", onClick }: StatCardProps) {
  const Wrapper = onClick ? "button" : "div";
  return (
    <Wrapper
      {...(onClick ? { type: "button" as const, onClick } : {})}
      className={`card w-full px-4 py-3.5 text-left ${onClick ? "cursor-pointer transition hover:border-primary-300 hover:shadow-card" : ""}`}
    >
      <p className="text-[12px] font-medium text-foreground-600">{label}</p>
      <p className={`mt-1.5 flex items-baseline gap-1 ${TONE[tone]}`}>
        <span className="text-[22px] font-semibold leading-none tabular-nums">{value}</span>
        {unit && <span className="text-[12px] font-medium text-foreground-500">{unit}</span>}
      </p>
      {hint && <p className="mt-1.5 text-[11.5px] leading-4 text-foreground-500">{hint}</p>}
    </Wrapper>
  );
}