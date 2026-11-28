import { describe, expect, it } from "vitest";
import type { ApiFailure } from "@/shared/api/client";
import { MILESTONE_TEXT, WBS_TEXT } from "@/features/wbs/i18n/ko";
import {
  canManageMilestones,
  dDayLabel,
  interpretMilestoneFailure,
  milestoneTone,
  taskSummaryLabel,
  validateMilestoneForm,
} from "@/features/wbs/utils/milestoneRules";

const http = (status: number, message: string | null = null): ApiFailure => ({ kind: "http", status, code: null, message });

describe("dDayLabel (서버 dDay 부호 그대로)", () => {
  it.each([
    [0, "D-day"],
    [1, "D-1"],
    [-1, "D+1"],
    [3, "D-3"],
    [-2, "D+2"],
    [36500, "D-36500"],
    [-36500, "D+36500"],
  ])("dDay %i → %s", (dDay, label) => {
    expect(dDayLabel(dDay)).toBe(label);
  });

  it("값이 없거나 정수가 아니면 '-'", () => {
    expect(dDayLabel(null)).toBe(MILESTONE_TEXT.dDayUnknown);
    expect(dDayLabel(1.5)).toBe(MILESTONE_TEXT.dDayUnknown);
    expect(dDayLabel(Number.NaN)).toBe(MILESTONE_TEXT.dDayUnknown);
  });
});

describe("milestoneTone (지연 배지·D-day 색)", () => {
  it("delayed가 true면 dDay와 상관없이 지연", () => {
    expect(milestoneTone({ dDay: 0, delayed: true })).toBe("delayed");
    expect(milestoneTone({ dDay: -10, delayed: true })).toBe("delayed");
  });

  it("지연이 아니면 dDay 0·음수는 도래, 양수는 예정", () => {
    expect(milestoneTone({ dDay: 0, delayed: false })).toBe("due");
    expect(milestoneTone({ dDay: -1, delayed: false })).toBe("due");
    expect(milestoneTone({ dDay: 1, delayed: false })).toBe("upcoming");
    expect(milestoneTone({ dDay: null, delayed: false })).toBe("upcoming");
  });
});

describe("taskSummaryLabel", () => {
  it("연결 작업이 없으면 '연결 작업 없음'", () => {
    expect(taskSummaryLabel({ linkedTaskCount: 0, incompleteTaskCount: 0 })).toBe(MILESTONE_TEXT.noTasks);
  });
  it("있으면 미완료/연결 수", () => {
    expect(taskSummaryLabel({ linkedTaskCount: 3, incompleteTaskCount: 0 })).toBe("미완료 0 / 연결 3");
    expect(taskSummaryLabel({ linkedTaskCount: 200, incompleteTaskCount: 200 })).toBe("미완료 200 / 연결 200");
  });
});

describe("canManageMilestones (3.3 WBS-04: PM만 C·U·D)", () => {
  it("PM만 true", () => {
    expect(canManageMilestones({ userId: 5, actor: "pm" })).toBe(true);
    expect(canManageMilestones({ userId: 5, actor: "dev" })).toBe(false);
    expect(canManageMilestones({ userId: 5, actor: "qa" })).toBe(false);
    expect(canManageMilestones({ userId: 5, actor: null })).toBe(false);
  });
});

describe("validateMilestoneForm", () => {
  it("이름은 다듬어서 돌려준다", () => {
    expect(validateMilestoneForm({ name: "  오픈 ", targetDate: "2026-12-31" })).toEqual({ ok: true, name: "오픈" });
  });
  it("빈 이름·공백 이름은 거부", () => {
    expect(validateMilestoneForm({ name: "", targetDate: "2026-12-31" })).toEqual({ ok: false, message: MILESTONE_TEXT.nameRequired });
    expect(validateMilestoneForm({ name: "   ", targetDate: "2026-12-31" })).toEqual({ ok: false, message: MILESTONE_TEXT.nameRequired });
  });
  it("이름 200자는 통과, 201자는 거부", () => {
    expect(validateMilestoneForm({ name: "가".repeat(200), targetDate: "2026-12-31" }).ok).toBe(true);
    expect(validateMilestoneForm({ name: "가".repeat(201), targetDate: "2026-12-31" })).toEqual({ ok: false, message: MILESTONE_TEXT.nameTooLong });
  });
  it("목표일이 없거나 형식이 틀리면 거부", () => {
    expect(validateMilestoneForm({ name: "오픈", targetDate: "" })).toEqual({ ok: false, message: MILESTONE_TEXT.dateRequired });
    expect(validateMilestoneForm({ name: "오픈", targetDate: "2026/12/31" })).toEqual({ ok: false, message: MILESTONE_TEXT.dateRequired });
  });
});

describe("interpretMilestoneFailure", () => {
  it("조회 404는 사용할 수 없음, 500은 서버 오류, 네트워크·timeout은 공통 문구", () => {
    expect(interpretMilestoneFailure("load", http(404))).toEqual({ message: MILESTONE_TEXT.unavailable, reload: false });
    expect(interpretMilestoneFailure("load", http(500))).toEqual({ message: WBS_TEXT.serverError, reload: false });
    expect(interpretMilestoneFailure("create", { kind: "network" })).toEqual({ message: WBS_TEXT.network, reload: false });
    expect(interpretMilestoneFailure("update", { kind: "timeout" })).toEqual({ message: WBS_TEXT.timeout, reload: false });
  });

  it("400은 서버 메시지(없으면 기본 문구), 다시 받지 않는다", () => {
    expect(interpretMilestoneFailure("create", http(400, "마일스톤 목표일을 확인해 주세요"))).toEqual({ message: "마일스톤 목표일을 확인해 주세요", reload: false });
    expect(interpretMilestoneFailure("tasks", http(400))).toEqual({ message: MILESTONE_TEXT.invalid, reload: false });
  });

  it("403은 PM 전용 안내와 다시 받기", () => {
    expect(interpretMilestoneFailure("delete", http(403))).toEqual({ message: MILESTONE_TEXT.pmOnly, reload: true });
  });

  it("변경 404는 대상 없음과 다시 받기", () => {
    expect(interpretMilestoneFailure("update", http(404))).toEqual({ message: MILESTONE_TEXT.notFound, reload: true });
  });

  it("409: 등록은 상한 초과(다시 받지 않음), 수정·연결 교체는 version 충돌(다시 받기)", () => {
    expect(interpretMilestoneFailure("create", http(409))).toEqual({ message: MILESTONE_TEXT.limitExceeded, reload: false });
    expect(interpretMilestoneFailure("update", http(409))).toEqual({ message: MILESTONE_TEXT.concurrent, reload: true });
    expect(interpretMilestoneFailure("tasks", http(409))).toEqual({ message: MILESTONE_TEXT.concurrent, reload: true });
  });

  it("aborted는 공통 문구, 다시 받지 않는다", () => {
    expect(interpretMilestoneFailure("load", { kind: "aborted" }).reload).toBe(false);
  });
});
