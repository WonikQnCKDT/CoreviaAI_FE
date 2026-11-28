import type { Health, Priority, StageKey, TaskStatus } from "@/types";
import { STAGE_LABEL } from "@/shared/i18n/catalog/status";

/** 상태 문구는 다국어 라벨 카탈로그에 있다. 기존 import 경로를 유지하려고 다시 내보낸다. */
export {
  ACTIVITY_ISSUE_LABEL,
  HEALTH_LABEL,
  PRIORITY_LABEL,
  ROLE_LABEL,
  STAGE_LABEL,
  TASK_STATUS_LABEL,
  VISIBILITY_LABEL,
} from "@/shared/i18n/catalog/status";

export const HEALTH_CLASS: Record<Health, string> = {
  normal: "bg-emerald-50 text-emerald-700 border-emerald-200",
  caution: "bg-amber-50 text-amber-700 border-amber-200",
  danger: "bg-rose-50 text-rose-700 border-rose-200",
  done: "bg-secondary-100 text-secondary-600 border-secondary-200",
};

export const HEALTH_DOT: Record<Health, string> = {
  normal: "bg-emerald-500",
  caution: "bg-amber-500",
  danger: "bg-rose-500",
  done: "bg-secondary-400",
};

export const TASK_STATUS_CLASS: Record<TaskStatus, string> = {
  todo: "bg-secondary-100 text-secondary-600 border-secondary-200",
  progress: "bg-primary-50 text-primary-700 border-primary-200",
  review: "bg-amber-50 text-amber-700 border-amber-200",
  done: "bg-emerald-50 text-emerald-700 border-emerald-200",
};

export const PRIORITY_CLASS: Record<Priority, string> = {
  high: "bg-rose-50 text-rose-700 border-rose-200",
  normal: "bg-secondary-100 text-secondary-600 border-secondary-200",
  low: "bg-background-100 text-foreground-500 border-background-300",
};

const STAGE_KEYS: StageKey[] = ["analysis", "design", "dev", "test", "deploy"];

/** 단계 목록. 문구는 읽을 때마다 현재 언어로 바꾼다(모듈을 불러올 때 값을 고정하지 않는다). */
export const STAGES: { key: StageKey; readonly label: string; readonly short: string }[] = STAGE_KEYS.map((key) => ({
  key,
  get label() {
    return STAGE_LABEL[key];
  },
  get short() {
    return STAGE_LABEL[key];
  },
}));

export function riskLevel(score: number): Health {
  if (score >= 70) return "danger";
  if (score >= 40) return "caution";
  return "normal";
}

export const PROJECT_COLORS: Record<string, { bar: string; chip: string; dot: string; soft: string; border: string }> = {
  primary: {
    bar: "bg-primary-500",
    chip: "bg-primary-50 text-primary-700",
    dot: "bg-primary-500",
    soft: "bg-primary-50",
    border: "border-primary-200",
  },
  accent: {
    bar: "bg-accent-500",
    chip: "bg-accent-50 text-accent-700",
    dot: "bg-accent-500",
    soft: "bg-accent-50",
    border: "border-accent-200",
  },
  emerald: {
    bar: "bg-emerald-500",
    chip: "bg-emerald-50 text-emerald-700",
    dot: "bg-emerald-500",
    soft: "bg-emerald-50",
    border: "border-emerald-200",
  },
  amber: {
    bar: "bg-amber-500",
    chip: "bg-amber-50 text-amber-700",
    dot: "bg-amber-500",
    soft: "bg-amber-50",
    border: "border-amber-200",
  },
  secondary: {
    bar: "bg-secondary-400",
    chip: "bg-secondary-100 text-secondary-600",
    dot: "bg-secondary-400",
    soft: "bg-secondary-50",
    border: "border-secondary-200",
  },
};

export function projectColor(key: string) {
  return PROJECT_COLORS[key] || PROJECT_COLORS.primary;
}

const AVATAR_CLASSES = [
  "bg-primary-100 text-primary-700",
  "bg-emerald-100 text-emerald-700",
  "bg-amber-100 text-amber-700",
  "bg-rose-100 text-rose-700",
  "bg-accent-100 text-accent-700",
  "bg-secondary-200 text-secondary-700",
];

export function avatarClass(seed: string): string {
  let total = 0;
  for (let i = 0; i < seed.length; i += 1) total += seed.charCodeAt(i);
  return AVATAR_CLASSES[total % AVATAR_CLASSES.length];
}