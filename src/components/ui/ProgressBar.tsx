interface ProgressBarProps {
  value: number;
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
  const safe = Math.max(0, Math.min(100, Math.round(value)));
  const height = size === "sm" ? "h-1.5" : "h-2";
  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <div className={`w-full overflow-hidden rounded-full bg-background-300 ${height}`}>
        <div className={`${height} rounded-full ${color} transition-all`} style={{ width: `${safe}%` }} />
      </div>
      {showLabel && <span className="shrink-0 text-[11px] font-medium tabular-nums text-foreground-600">{safe}%</span>}
    </div>
  );
}