import type { ReactNode } from "react";

interface EmptyStateProps {
  icon?: string;
  title: string;
  description?: string;
  action?: ReactNode;
  tone?: "default" | "danger";
}

export default function EmptyState({ icon = "ri-inbox-line", title, description, action, tone = "default" }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-12 text-center">
      <span
        className={`mb-3 flex h-12 w-12 items-center justify-center rounded-full ${
          tone === "danger" ? "bg-rose-50 text-rose-500" : "bg-background-100 text-foreground-400"
        }`}
      >
        <i className={`${icon} text-xl`} />
      </span>
      <p className="text-[14px] font-semibold text-foreground-900">{title}</p>
      {description && <p className="mt-1 max-w-md text-[12.5px] leading-6 text-foreground-600">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}