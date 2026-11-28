export const TODAY = "2026-11-08";

const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"];

export function parseDate(value: string): Date {
  const [y, m, d] = value.split("-").map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
}

export function toISO(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** 현재 로컬 기준 오늘 날짜(YYYY-MM-DD). 서버 모드 기준일로 사용한다. */
export function today(now: Date = new Date()): string {
  return toISO(now);
}

/** 실행 모드에 맞는 기준일: 서버(api) 모드는 실제 오늘, 데모 모드는 고정 기준일(TODAY). */
export function referenceToday(mode: "api" | "demo", now: Date = new Date()): string {
  return mode === "api" ? today(now) : TODAY;
}

export function addDays(value: string, days: number): string {
  const d = parseDate(value);
  d.setDate(d.getDate() + days);
  return toISO(d);
}

function dayNumber(value: string): number {
  const [y, m, d] = value.slice(0, 10).split("-").map(Number);
  return Date.UTC(y || 1970, (m || 1) - 1, d || 1) / 86400000;
}

/**
 * 날짜 단위 차이를 계산합니다.
 * 시각·시간대·서머타임 영향 없이 연-월-일만 비교하므로 하루가 어긋나지 않습니다.
 */
export function diffDays(from: string, to: string): number {
  return dayNumber(to) - dayNumber(from);
}

export function formatDate(value: string | null | undefined, sep = "."): string {
  if (!value) return "-";
  const [y, m, d] = value.split("-");
  return `${y}${sep}${m}${sep}${d}`;
}

export function formatShort(value: string | null | undefined): string {
  if (!value) return "-";
  const [, m, d] = value.split("-");
  return `${Number(m)}/${Number(d)}`;
}

export function weekdayOf(value: string): string {
  return WEEKDAYS[parseDate(value).getDay()];
}

export function startOfWeek(value: string): string {
  const d = parseDate(value);
  const dow = d.getDay();
  const offset = dow === 0 ? -6 : 1 - dow;
  d.setDate(d.getDate() + offset);
  return toISO(d);
}

export function monthMatrix(year: number, month: number): string[] {
  const first = new Date(year, month - 1, 1);
  const dow = first.getDay();
  const start = new Date(year, month - 1, 1 - (dow === 0 ? 6 : dow - 1));
  const days: string[] = [];
  for (let i = 0; i < 42; i += 1) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    days.push(toISO(d));
  }
  return days;
}

export function daysBetween(from: string, to: string): string[] {
  const total = diffDays(from, to);
  const result: string[] = [];
  for (let i = 0; i <= total; i += 1) result.push(addDays(from, i));
  return result;
}

export function dday(value: string, base: string = TODAY): number {
  return diffDays(base, value);
}

export function ddayLabel(value: string, base: string = TODAY): string {
  const n = dday(value, base);
  if (n === 0) return "D-Day";
  return n > 0 ? `D-${n}` : `D+${Math.abs(n)}`;
}

export function isOverdue(date: string, base: string = TODAY): boolean {
  return date < base;
}

export type DeadlineTone = "none" | "future" | "today" | "late" | "done";

export interface DeadlineInfo {
  /** 마감일 표기 (예: 11/13). 마감일이 없으면 '마감일 미정' */
  dateText: string;
  /** 남은 일수 표기 (예: D-3, D-Day, 1일 지연, 완료) */
  dayText: string;
  /** 목록·상세에서 함께 표시하는 문구 (예: 11/13 · D-3) */
  full: string;
  tone: DeadlineTone;
  /** 미완료 상태로 마감이 지난 경우에만 true */
  late: boolean;
  /** 오늘 기준 남은 일수. 마감일이 없으면 null */
  days: number | null;
}

/**
 * 마감일과 남은 일수를 같은 규칙으로 계산합니다.
 * - 완료 업무는 지연 경고를 표시하지 않습니다.
 * - 마감일이 없으면 '마감일 미정'으로 표시합니다.
 */
export function deadlineInfo(endDate: string | null | undefined, status?: string, today: string = TODAY): DeadlineInfo {
  if (!endDate) {
    return { dateText: "마감일 미정", dayText: "", full: "마감일 미정", tone: "none", late: false, days: null };
  }
  const dateText = formatShort(endDate);
  const days = diffDays(today, endDate);
  if (status === "done") {
    return { dateText, dayText: "완료", full: `${dateText} · 완료`, tone: "done", late: false, days };
  }
  if (days === 0) {
    return { dateText, dayText: "D-Day", full: `${dateText} · D-Day`, tone: "today", late: false, days };
  }
  if (days > 0) {
    return { dateText, dayText: `D-${days}`, full: `${dateText} · D-${days}`, tone: "future", late: false, days };
  }
  const overdue = Math.abs(days);
  return { dateText, dayText: `${overdue}일 지연`, full: `${dateText} · ${overdue}일 지연`, tone: "late", late: true, days };
}

export const DEADLINE_TONE_CLASS: Record<DeadlineTone, string> = {
  none: "text-foreground-500",
  future: "text-foreground-700",
  today: "text-amber-600 font-medium",
  late: "text-rose-600 font-medium",
  done: "text-emerald-600",
};

export function inRange(date: string, start: string, end: string): boolean {
  return date >= start && date <= end;
}

export function monthLabel(year: number, month: number): string {
  return `${year}년 ${month}월`;
}

export function nowStamp(): string {
  const d = new Date();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  const h = String(d.getHours()).padStart(2, "0");
  const min = String(d.getMinutes()).padStart(2, "0");
  return `${m}.${day} ${h}:${min}`;
}

export function isoNow(): string {
  return new Date().toISOString();
}

export const WEEKDAY_LABELS = WEEKDAYS;