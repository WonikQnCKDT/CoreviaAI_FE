import type { Health, Priority, RoleKey, StageKey, TaskStatus, Visibility } from "@/types";

export const HEALTH_LABEL: Record<Health, string> = {
  normal: "정상",
  caution: "주의",
  danger: "위험",
  done: "완료",
};

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

export const TASK_STATUS_LABEL: Record<TaskStatus, string> = {
  todo: "대기",
  progress: "진행",
  review: "검토",
  done: "완료",
};

export const TASK_STATUS_CLASS: Record<TaskStatus, string> = {
  todo: "bg-secondary-100 text-secondary-600 border-secondary-200",
  progress: "bg-primary-50 text-primary-700 border-primary-200",
  review: "bg-amber-50 text-amber-700 border-amber-200",
  done: "bg-emerald-50 text-emerald-700 border-emerald-200",
};

export const PRIORITY_LABEL: Record<Priority, string> = {
  high: "높음",
  normal: "보통",
  low: "낮음",
};

export const PRIORITY_CLASS: Record<Priority, string> = {
  high: "bg-rose-50 text-rose-700 border-rose-200",
  normal: "bg-secondary-100 text-secondary-600 border-secondary-200",
  low: "bg-background-100 text-foreground-500 border-background-300",
};

export const ROLE_LABEL: Record<RoleKey, string> = {
  pm: "PM",
  biz: "현업 담당자",
  dev: "개발자",
  qa: "QA",
};

export const VISIBILITY_LABEL: Record<Visibility, string> = {
  company: "전사 공개",
  department: "부서 공개",
  members: "멤버 전용",
};

export const STAGES: { key: StageKey; label: string; short: string }[] = [
  { key: "analysis", label: "분석", short: "분석" },
  { key: "design", label: "설계", short: "설계" },
  { key: "dev", label: "개발", short: "개발" },
  { key: "test", label: "테스트", short: "테스트" },
  { key: "deploy", label: "이행", short: "이행" },
];

export const STAGE_LABEL: Record<StageKey, string> = {
  analysis: "분석",
  design: "설계",
  dev: "개발",
  test: "테스트",
  deploy: "이행",
};

export const ACTIVITY_ISSUE_LABEL: Record<string, string> = {
  open: "접수",
  progress: "처리중",
  resolved: "해결",
};

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