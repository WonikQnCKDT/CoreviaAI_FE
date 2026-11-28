import { describe, expect, it } from "vitest";
import type { ApiFailure } from "@/shared/api/client";
import { SCHEDULE_TEXT, WORKLOG_TEXT } from "@/features/mywork/i18n/ko";
import {
  coveredDates,
  emptyEventForm,
  formFromEvent,
  interpretScheduleFailure,
  kstDateOf,
  kstDayStart,
  kstTimeOf,
  kstToday,
  monthRange,
  validateEventForm,
  validateTaskLog,
} from "@/features/mywork/utils/scheduleRules";

const http = (status: number, message: string | null = null): ApiFailure => ({ kind: "http", status, code: null, message });

describe("한국 날짜·시각", () => {
  it("UTC 15:00 이후는 한국 다음 날", () => {
    expect(kstToday(new Date("2026-11-27T14:59:00Z"))).toBe("2026-11-27");
    expect(kstToday(new Date("2026-11-27T15:00:00Z"))).toBe("2026-11-28");
    expect(kstDateOf("2026-11-27T15:30:00Z")).toBe("2026-11-28");
    expect(kstTimeOf("2026-11-27T15:30:00Z")).toBe("00:30");
  });

  it("한국 00:00은 전날 UTC 15:00, 달 범위는 [1일, 다음 달 1일)", () => {
    expect(kstDayStart("2026-12-01")).toBe("2026-11-30T15:00:00.000Z");
    expect(monthRange(2026, 11)).toMatchObject({ from: "2026-11-30T15:00:00.000Z", to: "2026-12-31T15:00:00.000Z", firstDate: "2026-12-01", nextDate: "2027-01-01" });
  });

  it("항목이 걸친 날짜: 종료 시각 직전까지, 달 범위로 자른다", () => {
    // 담당 업무: 12-30 00:00 ~ 01-02 00:00(종료일 01-01)
    const task = { startAt: kstDayStart("2026-12-30"), endAt: kstDayStart("2027-01-02") };
    expect(coveredDates(task, "2026-12-01", "2027-01-01")).toEqual(["2026-12-30", "2026-12-31"]);
    expect(coveredDates(task, "2027-01-01", "2027-02-01")).toEqual(["2027-01-01"]);
    // 같은 날 1시간 일정
    expect(coveredDates({ startAt: "2026-12-01T00:00:00Z", endAt: "2026-12-01T01:00:00Z" }, "2026-12-01", "2027-01-01")).toEqual(["2026-12-01"]);
  });
});

describe("일정 폼", () => {
  it("시각 일정은 한국 시각을 UTC로, 종일은 종료일 다음 날 00:00까지", () => {
    const timed = validateEventForm({ ...emptyEventForm("2026-12-01"), title: " 회의 " });
    expect(timed).toEqual({ ok: true, input: { title: "회의", startAt: "2026-12-01T00:00:00.000Z", endAt: "2026-12-01T01:00:00.000Z", allDay: false, memo: "" } });
    const allDay = validateEventForm({ ...emptyEventForm("2026-12-01"), title: "휴가", allDay: true, endDate: "2026-12-02" });
    expect(allDay).toMatchObject({ ok: true, input: { startAt: kstDayStart("2026-12-01"), endAt: kstDayStart("2026-12-03"), allDay: true } });
  });

  it("종일 일정의 폼은 종료를 그 전날로 보인다(왕복 보존)", () => {
    const form = formFromEvent({ id: 1, title: "휴가", startAt: kstDayStart("2026-12-01"), endAt: kstDayStart("2026-12-03"), allDay: true, memo: "" });
    expect(form).toMatchObject({ startDate: "2026-12-01", endDate: "2026-12-02", allDay: true });
    expect(validateEventForm(form)).toMatchObject({ ok: true, input: { endAt: kstDayStart("2026-12-03") } });
  });

  it("시작 = 종료·시작 > 종료는 거부, 제목·메모 경계값", () => {
    const base = { ...emptyEventForm("2026-12-01"), title: "a" };
    expect(validateEventForm({ ...base, endTime: "09:00" })).toEqual({ ok: false, message: SCHEDULE_TEXT.periodInvalid });
    expect(validateEventForm({ ...base, endTime: "08:59" })).toEqual({ ok: false, message: SCHEDULE_TEXT.periodInvalid });
    expect(validateEventForm({ ...base, title: "가".repeat(200) }).ok).toBe(true);
    expect(validateEventForm({ ...base, title: "가".repeat(201) })).toEqual({ ok: false, message: SCHEDULE_TEXT.titleTooLong });
    expect(validateEventForm({ ...base, title: "줄\n바꿈" })).toEqual({ ok: false, message: SCHEDULE_TEXT.titleControl });
    expect(validateEventForm({ ...base, memo: "m".repeat(2000) }).ok).toBe(true);
    expect(validateEventForm({ ...base, memo: "m".repeat(2001) })).toEqual({ ok: false, message: SCHEDULE_TEXT.memoTooLong });
    expect(validateEventForm({ ...base, startTime: "" })).toEqual({ ok: false, message: SCHEDULE_TEXT.timeRequired });
  });
});

describe("업무 기록 검증", () => {
  const form = { content: "", progress: "50", spentMinutes: "30", completed: false };
  it.each([
    [{ progress: "0", spentMinutes: "0" }, true],
    [{ progress: "100", spentMinutes: "1440" }, true],
    [{ progress: "101" }, false],
    [{ progress: "-1" }, false],
    [{ progress: "1.5" }, false],
    [{ spentMinutes: "1441" }, false],
    [{ content: "x".repeat(10000) }, true],
    [{ content: "x".repeat(10001) }, false],
  ])("%j → %s", (patch, ok) => {
    expect(validateTaskLog({ ...form, ...patch }).ok).toBe(ok);
  });

  it("완료는 진척률 100이 필요하다", () => {
    expect(validateTaskLog({ ...form, completed: true })).toEqual({ ok: false, message: WORKLOG_TEXT.completedNeeds100 });
    expect(validateTaskLog({ ...form, completed: true, progress: "100" })).toEqual({ ok: true, progress: 100, spentMinutes: 30 });
  });
});

describe("실패 해석", () => {
  it("400 서버 메시지, 일정 404·업무 403·409는 다시 받는다", () => {
    expect(interpretScheduleFailure("saveEvent", http(400, "일정 종료 시각은 시작 시각보다 뒤여야 합니다")).message).toContain("종료");
    expect(interpretScheduleFailure("saveEvent", http(404))).toEqual({ message: SCHEDULE_TEXT.notFound, reload: true });
    expect(interpretScheduleFailure("saveTaskLog", http(403))).toEqual({ message: WORKLOG_TEXT.notAssignee, reload: true });
    expect(interpretScheduleFailure("saveTaskLog", http(409))).toEqual({ message: WORKLOG_TEXT.concurrent, reload: true });
    expect(interpretScheduleFailure("saveWorklog", http(409))).toEqual({ message: SCHEDULE_TEXT.concurrent, reload: true });
    expect(interpretScheduleFailure("load", { kind: "network" })).toEqual({ message: SCHEDULE_TEXT.network, reload: false });
  });
});
