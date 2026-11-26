import { describe, expect, it } from "vitest";
import type { ApiFailure } from "@/shared/api/client";
import { ADMIN_ERROR_LOG_TEXT } from "@/features/admin/i18n/ko";
import { interpretDetailFailure, shortTypeName, toErrorLogQuery, type DayStart } from "@/features/admin/utils/errorLogRules";

/** 테스트는 실행 환경 시간대에 기대지 않도록 KST(UTC+9) 하루 시작을 직접 만든다. */
const KST_OFFSET_MS = 9 * 60 * 60 * 1000;
const kstDayStart: DayStart = (year, monthIndex, day) => new Date(Date.UTC(year, monthIndex, day) - KST_OFFSET_MS);
const utcDayStart: DayStart = (year, monthIndex, day) => new Date(Date.UTC(year, monthIndex, day));

const filter = (overrides: Partial<{ fromDate: string; toDate: string; errorType: string; apiPath: string }> = {}) => ({
  fromDate: "",
  toDate: "",
  errorType: "",
  apiPath: "",
  ...overrides,
});

describe("toErrorLogQuery — 기간", () => {
  it("조건이 없으면 기간 없이 조회한다", () => {
    expect(toErrorLogQuery(filter(), kstDayStart)).toEqual({ ok: true, query: { from: null, to: null, errorType: "", apiPath: "" } });
  });

  it("KST 시작일 0시(포함) ~ 종료일 다음 날 0시(제외)를 UTC로 보낸다 (자정 경계)", () => {
    expect(toErrorLogQuery(filter({ fromDate: "2026-11-01", toDate: "2026-11-21" }), kstDayStart)).toEqual({
      ok: true,
      query: { from: "2026-10-31T15:00:00.000Z", to: "2026-11-21T15:00:00.000Z", errorType: "", apiPath: "" },
    });
  });

  it("시작일과 종료일이 같으면 그 하루를 조회한다", () => {
    const result = toErrorLogQuery(filter({ fromDate: "2026-11-21", toDate: "2026-11-21" }), utcDayStart);
    expect(result).toMatchObject({ ok: true, query: { from: "2026-11-21T00:00:00.000Z", to: "2026-11-22T00:00:00.000Z" } });
  });

  it("월말·연말 다음 날로 넘어간다", () => {
    expect(toErrorLogQuery(filter({ toDate: "2026-12-31" }), utcDayStart)).toMatchObject({ query: { to: "2027-01-01T00:00:00.000Z" } });
    expect(toErrorLogQuery(filter({ toDate: "2028-02-29" }), utcDayStart)).toMatchObject({ query: { to: "2028-03-01T00:00:00.000Z" } });
  });

  it("시작일만, 종료일만 줄 수 있다", () => {
    expect(toErrorLogQuery(filter({ fromDate: "2026-11-01" }), utcDayStart)).toMatchObject({ query: { from: "2026-11-01T00:00:00.000Z", to: null } });
    expect(toErrorLogQuery(filter({ toDate: "2026-11-01" }), utcDayStart)).toMatchObject({ query: { from: null, to: "2026-11-02T00:00:00.000Z" } });
  });

  it("시작일이 종료일보다 늦으면 보내지 않는다 (서버 400 INVALID_PERIOD)", () => {
    expect(toErrorLogQuery(filter({ fromDate: "2026-11-22", toDate: "2026-11-21" }), kstDayStart)).toEqual({
      ok: false,
      message: ADMIN_ERROR_LOG_TEXT.invalidPeriod,
    });
  });

  it.each(["2026-02-30", "2026-13-01", "2026-1-1", "20261101", "2027-02-29"])("없는 날짜·형식 오류(%s)는 거부한다", (fromDate) => {
    expect(toErrorLogQuery(filter({ fromDate }), utcDayStart)).toEqual({ ok: false, message: ADMIN_ERROR_LOG_TEXT.invalidDate });
  });
});

describe("toErrorLogQuery — 유형·경로", () => {
  it("앞뒤 공백을 지운다", () => {
    expect(toErrorLogQuery(filter({ errorType: "  java.lang.IllegalStateException ", apiPath: " /api/projects " }), utcDayStart)).toMatchObject({
      ok: true,
      query: { errorType: "java.lang.IllegalStateException", apiPath: "/api/projects" },
    });
  });

  it("예외 유형은 200자까지 허용하고 201자는 거부한다", () => {
    expect(toErrorLogQuery(filter({ errorType: "a".repeat(200) }), utcDayStart).ok).toBe(true);
    expect(toErrorLogQuery(filter({ errorType: "a".repeat(201) }), utcDayStart)).toEqual({
      ok: false,
      message: ADMIN_ERROR_LOG_TEXT.errorTypeTooLong,
    });
  });

  it("경로는 300자까지 허용하고 301자는 거부한다", () => {
    expect(toErrorLogQuery(filter({ apiPath: `/${"a".repeat(299)}` }), utcDayStart).ok).toBe(true);
    expect(toErrorLogQuery(filter({ apiPath: `/${"a".repeat(300)}` }), utcDayStart)).toEqual({
      ok: false,
      message: ADMIN_ERROR_LOG_TEXT.apiPathTooLong,
    });
  });
});

describe("shortTypeName", () => {
  it.each([
    ["java.lang.IllegalStateException", "IllegalStateException"],
    ["Plain", "Plain"],
    ["org.example.", "org.example."],
  ])("%s → %s", (input, expected) => {
    expect(shortTypeName(input)).toBe(expected);
  });
});

describe("interpretDetailFailure", () => {
  const http = (status: number, message: string | null = null): ApiFailure => ({ kind: "http", status, code: null, message });

  it("404는 다시 시도해도 같아 재시도를 보여 주지 않는다", () => {
    expect(interpretDetailFailure(http(404, "에러 로그를 찾을 수 없습니다"))).toEqual({
      message: ADMIN_ERROR_LOG_TEXT.notFound,
      retryable: false,
    });
  });

  it("서버 오류·네트워크 실패는 다시 시도할 수 있다", () => {
    expect(interpretDetailFailure(http(500)).retryable).toBe(true);
    expect(interpretDetailFailure({ kind: "network" }).retryable).toBe(true);
  });

  it("취소는 다시 시도를 보여 주지 않는다", () => {
    expect(interpretDetailFailure({ kind: "aborted" })).toEqual({ message: "", retryable: false });
  });
});
