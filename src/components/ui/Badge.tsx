import type { ReactNode } from "react";
import type { Health, Priority, TaskStatus } from "@/types";
import {
  HEALTH_CLASS,
  HEALTH_LABEL,
  PRIORITY_CLASS,
  PRIORITY_LABEL,
  TASK_STATUS_CLASS,
  TASK_STATUS_LABEL,
  riskLevel,
} from "@/utils/ui";

export function Badge({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <span
      className={`inline-flex items-center gap-1 whitespace-nowrap rounded-md border px-1.5 py-[2px] text-[11px] font-medium leading-5 ${className}`}
    >
      {children}
    </span>
  );
}

export function HealthBadge({ health, label }: { health: Health; label?: string }) {
  return <Badge className={HEALTH_CLASS[health]}>{label || HEALTH_LABEL[health]}</Badge>;
}

export function StatusBadge({ status, label }: { status: TaskStatus; label?: string }) {
  return <Badge className={TASK_STATUS_CLASS[status]}>{label || TASK_STATUS_LABEL[status]}</Badge>;
}

export function PriorityBadge({ priority }: { priority: Priority }) {
  return <Badge className={PRIORITY_CLASS[priority]}>{PRIORITY_LABEL[priority]}</Badge>;
}

export function RiskBadge({ score }: { score: number }) {
  const level = riskLevel(score);
  return (
    <span className="inline-flex items-center gap-1.5 whitespace-nowrap text-[12px] text-foreground-700">
      <span className="font-semibold tabular-nums">{score}</span>
      <Badge className={HEALTH_CLASS[level]}>{HEALTH_LABEL[level]}</Badge>
    </span>
  );
}