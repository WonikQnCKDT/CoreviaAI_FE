interface ProgressBarProps {
  /** 0~100. null이면 값을 모르는 것(빈 막대와 '-') */
  value: number | null;
  className?: string;
  color?: string;
  size?: "sm" | "md";
  showLabel?: boolean;
}

export default function ProgressBar({
  value,
  className = "",
  color = "bg-primary-500",
  size = "sm",
  showLabel = false,
}: ProgressBarProps) {
  const unknown = value === null;
  const safe = unknown ? 0 : Math.max(0, Math.min(100, Math.round(value)));
  const height = size === "sm" ? "h-1.5" : "h-2";
  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <div className={`w-full overflow-hidden rounded-full bg-background-300 ${height}`}>
        <div className={`${height} rounded-full ${color} transition-all`} style={{ width: `${safe}%` }} />
      </div>
      {showLabel && <span className="shrink-0 text-[11px] font-medium tabular-nums text-foreground-600">{unknown ? "-" : `${safe}%`}</span>}
    </div>
  );
}