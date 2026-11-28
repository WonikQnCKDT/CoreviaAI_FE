import { describe, expect, it } from "vitest";
import { dday, ddayLabel, isOverdue, referenceToday, TODAY, today } from "@/utils/date";

describe("date utils — today() / referenceToday()", () => {
  it("today()는 전달한 Date를 YYYY-MM-DD 형식으로 반환한다", () => {
    expect(today(new Date(2026, 0, 5))).toBe("2026-01-05");
    expect(today(new Date(2026, 10, 28))).toBe("2026-11-28");
  });

  it("referenceToday()는 api 모드에서는 실제 오늘, demo 모드에서는 고정 TODAY를 반환한다", () => {
    const fixedNow = new Date(2026, 10, 28);
    expect(referenceToday("api", fixedNow)).toBe("2026-11-28");
    expect(referenceToday("demo", fixedNow)).toBe(TODAY);
  });

  it("dday, ddayLabel, isOverdue는 기준일을 넘기면 해당 기준일로 계산한다", () => {
    expect(dday("2026-11-30", "2026-11-28")).toBe(2);
    expect(ddayLabel("2026-11-28", "2026-11-28")).toBe("D-Day");
    expect(ddayLabel("2026-11-25", "2026-11-28")).toBe("D+3");
    expect(isOverdue("2026-11-27", "2026-11-28")).toBe(true);
    expect(isOverdue("2026-11-28", "2026-11-28")).toBe(false);
  });
});
