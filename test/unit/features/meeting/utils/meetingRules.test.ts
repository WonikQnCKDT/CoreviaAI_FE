import { describe, expect, it } from "vitest";
import type { ApiFailure } from "@/shared/api/client";
import type { MeetingDetail } from "@/features/meeting/api/meetingApi";
import { MEETING_FORM_TEXT, MEETING_TEXT } from "@/features/meeting/i18n/ko";
import {
  canCreateMeeting,
  canEditMeeting,
  emptyMeetingForm,
  formFromMeeting,
  interpretMeetingFailure,
  isProtectedMeeting,
  sameMeetingInput,
  validateMeetingForm,
} from "@/features/meeting/utils/meetingRules";

const http = (status: number, message: string | null = null): ApiFailure => ({ kind: "http", status, code: null, message });

const meeting = (overrides: Partial<MeetingDetail> = {}): MeetingDetail => ({
  id: 1, title: "주간 회의", heldAt: "2026-12-01T01:00:00.000Z", authorUserId: 11, authorName: "이개발",
  content: "", version: 0, attendees: [], decisions: [], actionItems: [], ...overrides,
});

describe("권한 표시", () => {
  it("작성은 멤버, 수정·삭제는 작성자 또는 PM", () => {
    expect(canCreateMeeting({ userId: 5, actor: "biz" })).toBe(true);
    expect(canCreateMeeting({ userId: 5, actor: null })).toBe(false);
    expect(canEditMeeting({ userId: 11, actor: "dev" }, meeting())).toBe(true);
    expect(canEditMeeting({ userId: 5, actor: "pm" }, meeting())).toBe(true);
    expect(canEditMeeting({ userId: 12, actor: "qa" }, meeting())).toBe(false);
    // 작성자라도 멤버가 아니게 됐으면 못 고친다
    expect(canEditMeeting({ userId: 11, actor: null }, meeting())).toBe(false);
  });

  it("AI 결정사항·AI/전환/제외 액션아이템이 있으면 보호", () => {
    const open = { content: "a", assigneeUserId: null, assigneeName: "", dueDate: null, status: "open" as const, source: "manual" as const, taskId: null };
    expect(isProtectedMeeting(meeting({ actionItems: [open] }))).toBe(false);
    expect(isProtectedMeeting(meeting({ decisions: [{ content: "d", source: "ai" }] }))).toBe(true);
    expect(isProtectedMeeting(meeting({ actionItems: [{ ...open, status: "converted", taskId: 3 }] }))).toBe(true);
    expect(isProtectedMeeting(meeting({ actionItems: [{ ...open, source: "ai" }] }))).toBe(true);
  });
});

describe("폼 검증·변환", () => {
  const base = { ...emptyMeetingForm("2026-12-01"), title: "주간 회의" };

  it("한국 시각을 UTC로, 빈 결정사항 줄은 빼고, 멤버가 아닌 ID는 보내지 않는다", () => {
    const result = validateMeetingForm(
      { ...base, memberIds: [11, 99, 11], externals: " 고객사 김부장 \n\n", decisions: ["범위 확정", " "], actions: [{ content: " 견적 ", assigneeUserId: 99, dueDate: "2026-12-05" }] },
      [5, 11],
    );
    expect(result).toEqual({
      ok: true,
      input: {
        title: "주간 회의",
        heldAt: "2026-12-01T01:00:00.000Z",
        content: "",
        attendees: [{ userId: 11 }, { externalName: "고객사 김부장" }],
        decisions: ["범위 확정"],
        actionItems: [{ content: "견적", assigneeUserId: null, dueDate: "2026-12-05" }],
      },
    });
  });

  it.each([
    [{ title: " " }, MEETING_FORM_TEXT.titleRequired],
    [{ title: "가".repeat(201) }, MEETING_FORM_TEXT.titleTooLong],
    [{ time: "" }, MEETING_FORM_TEXT.dateRequired],
    [{ content: "x".repeat(50001) }, MEETING_FORM_TEXT.contentTooLong],
    [{ externals: "가".repeat(51) }, MEETING_FORM_TEXT.externalTooLong],
    [{ externals: "김부장\n김부장" }, MEETING_FORM_TEXT.duplicateAttendee],
    [{ decisions: ["d".repeat(1001)] }, MEETING_FORM_TEXT.decisionTooLong],
    [{ actions: [{ content: " ", assigneeUserId: null, dueDate: "" }] }, MEETING_FORM_TEXT.actionRequired],
    [{ actions: [{ content: "a".repeat(1001), assigneeUserId: null, dueDate: "" }] }, MEETING_FORM_TEXT.actionTooLong],
    [{ decisions: Array(101).fill("d") }, MEETING_FORM_TEXT.tooMany],
  ])("거부 %#", (patch, message) => {
    expect(validateMeetingForm({ ...base, ...patch }, [])).toEqual({ ok: false, message });
  });

  it("경계값 통과: 제목 200자, 본문 50,000자, 외부 참석자 50자, 항목 100개", () => {
    expect(validateMeetingForm({ ...base, title: "가".repeat(200), content: "x".repeat(50000), externals: "가".repeat(50), decisions: Array(100).fill("d") }, []).ok).toBe(true);
  });

  it("상세 → 폼 → 요청이 같은 값으로 돌아온다", () => {
    const detail = meeting({
      content: "본문",
      attendees: [{ userId: 11, name: "이개발", external: false }, { userId: null, name: "김부장", external: true }],
      decisions: [{ content: "결정", source: "manual" }],
      actionItems: [{ content: "할 일", assigneeUserId: 11, assigneeName: "이개발", dueDate: "2026-12-05", status: "open", source: "manual", taskId: null }],
    });
    const result = validateMeetingForm(formFromMeeting(detail), [11]);
    expect(result).toMatchObject({
      ok: true,
      input: { heldAt: detail.heldAt, attendees: [{ userId: 11 }, { externalName: "김부장" }], decisions: ["결정"], actionItems: [{ content: "할 일", assigneeUserId: 11, dueDate: "2026-12-05" }] },
    });
  });

  it("같은 입력 비교", () => {
    const a = validateMeetingForm(base, []);
    const b = validateMeetingForm({ ...base }, []);
    const c = validateMeetingForm({ ...base, title: "다른 제목" }, []);
    if (a.ok !== true || b.ok !== true || c.ok !== true) throw new Error("통과해야 한다");
    expect(sameMeetingInput(a.input, b.input)).toBe(true);
    expect(sameMeetingInput(a.input, c.input)).toBe(false);
  });
});

describe("실패 해석", () => {
  it("목록 404는 사용할 수 없음", () => {
    expect(interpretMeetingFailure("load", http(404)).message).toBe(MEETING_TEXT.unavailable);
  });
  it("등록 409는 새 키·다시 받기, 삭제 409는 보호, 수정 409는 동시 수정", () => {
    expect(interpretMeetingFailure("create", http(409))).toEqual({ message: MEETING_TEXT.createConflict, reload: true, resetRequest: true });
    expect(interpretMeetingFailure("delete", http(409))).toEqual({ message: MEETING_TEXT.protected, reload: true, resetRequest: false });
    expect(interpretMeetingFailure("update", http(409))).toEqual({ message: MEETING_TEXT.concurrent, reload: true, resetRequest: false });
  });
  it("400 서버 메시지, 403·404 다시 받기, 네트워크는 키 유지", () => {
    expect(interpretMeetingFailure("update", http(400, "회의 참석자 또는 액션아이템 담당자를 확인해 주세요")).message).toContain("참석자");
    expect(interpretMeetingFailure("update", http(403))).toEqual({ message: MEETING_TEXT.forbidden, reload: true, resetRequest: false });
    expect(interpretMeetingFailure("delete", http(404)).reload).toBe(true);
    expect(interpretMeetingFailure("create", { kind: "timeout" })).toEqual({ message: MEETING_TEXT.timeout, reload: false, resetRequest: false });
  });
});
