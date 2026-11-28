import { describe, expect, it } from "vitest";
import type { ApiFailure } from "@/shared/api/client";
import type { DraftTask, WbsItem } from "@/features/wbs/api/wbsApi";
import { WBS_DRAFT_TEXT, WBS_FORM_TEXT, WBS_TEXT } from "@/features/wbs/i18n/ko";
import {
  buildApplyBody,
  canAddSubtask,
  canEditItem,
  canEditProgress,
  canManageWbs,
  canReparent,
  deriveDisplayStatus,
  interpretDraftFailure,
  interpretWbsFailure,
  moveTarget,
  parseEffort,
  parseProgress,
  reparentCandidates,
  toReview,
  validateDraftInput,
  validateWbsForm,
  viewerNote,
  type WbsFormValues,
  type WbsViewer,
} from "@/features/wbs/utils/wbsRules";

const item = (overrides: Partial<WbsItem> = {}): WbsItem => ({
  id: 1,
  phaseId: 10,
  parentTaskId: null,
  sortOrder: 1,
  name: "작업",
  description: "",
  assignee: null,
  startDate: "2026-12-01",
  endDate: "2026-12-05",
  scheduleDerived: false,
  estimatedEffort: null,
  progress: 0,
  status: "todo",
  source: "manual",
  version: 0,
  subtasks: [],
  ...overrides,
});

const PM: WbsViewer = { userId: 5, actor: "pm" };
const DEV: WbsViewer = { userId: 11, actor: "dev" };
const QA: WbsViewer = { userId: 12, actor: "qa" };
const BIZ: WbsViewer = { userId: 13, actor: "biz" };
const OUTSIDER: WbsViewer = { userId: 99, actor: null };

const http = (status: number, message: string | null = null): ApiFailure => ({ kind: "http", status, code: null, message });

describe("권한 표시 (3.3 WBS-01)", () => {
  const mine = item({ assignee: { id: 11, name: "이개발" } });
  const others = item({ assignee: { id: 12, name: "박품질" } });

  it("PM은 전부 할 수 있다", () => {
    expect(canManageWbs(PM)).toBe(true);
    expect(canAddSubtask(PM, others)).toBe(true);
    expect(canEditItem(PM, others)).toBe(true);
  });

  it("개발자는 본인 담당 작업만 수정하고 그 아래에만 하위작업을 추가한다", () => {
    expect(canManageWbs(DEV)).toBe(false);
    expect(canAddSubtask(DEV, mine)).toBe(true);
    expect(canEditItem(DEV, mine)).toBe(true);
    expect(canAddSubtask(DEV, others)).toBe(false);
    expect(canEditItem(DEV, others)).toBe(false);
  });

  it("QA도 개발자와 같다", () => {
    expect(canEditItem(QA, others)).toBe(true);
    expect(canEditItem(QA, mine)).toBe(false);
  });

  it("현업 담당자·멤버 아님은 담당이어도 조회만", () => {
    const bizOwned = item({ assignee: { id: 13, name: "최현업" } });
    expect(canEditItem(BIZ, bizOwned)).toBe(false);
    expect(canAddSubtask(BIZ, bizOwned)).toBe(false);
    expect(canEditItem(OUTSIDER, item())).toBe(false);
    expect(viewerNote(BIZ)).toBe(WBS_TEXT.viewerNote);
    expect(viewerNote(DEV)).toBe(WBS_TEXT.memberNote);
    expect(viewerNote(PM)).toBeNull();
  });

  it("로그인 사용자 ID를 모르면 담당 판단을 하지 않는다", () => {
    expect(canEditItem({ userId: null, actor: "dev" }, item({ assignee: null }))).toBe(false);
  });

  it("하위작업 아래에는 하위작업을 추가할 수 없고, 하위작업이 있는 작업은 진척률을 직접 고칠 수 없다", () => {
    const sub = item({ id: 2, parentTaskId: 1 });
    expect(canAddSubtask(PM, sub)).toBe(false);
    expect(canEditProgress(PM, item({ subtasks: [sub] }))).toBe(false);
    expect(canEditProgress(PM, sub)).toBe(true);
    expect(canEditProgress(DEV, item({ assignee: { id: 11, name: "" } }))).toBe(true);
  });
});

describe("moveTarget (index는 자신을 뺀 형제 목록 기준)", () => {
  // 서버 최상위 순서: A(단계10) B(단계20) C(단계10) D(단계10)
  const A = item({ id: 1, phaseId: 10 });
  const B = item({ id: 2, phaseId: 20 });
  const C = item({ id: 3, phaseId: 10 });
  const D = item({ id: 4, phaseId: 10 });
  const tree = [A, B, C, D];

  it("같은 단계의 이웃 기준으로 서버 index를 계산한다", () => {
    // C를 위로: 화면 이웃은 A. 자신 뺀 목록 [A,B,D]에서 A 앞 → 0
    expect(moveTarget(tree, C, "up")).toEqual({ parentTaskId: null, index: 0 });
    // C를 아래로: 이웃 D. [A,B,D]에서 D 뒤 → 3
    expect(moveTarget(tree, C, "down")).toEqual({ parentTaskId: null, index: 3 });
    // A를 아래로: 이웃 C. [B,C,D]에서 C 뒤 → 2
    expect(moveTarget(tree, A, "down")).toEqual({ parentTaskId: null, index: 2 });
  });

  it("단계의 처음·끝, 혼자인 항목은 옮기지 않는다", () => {
    expect(moveTarget(tree, A, "up")).toBeNull();
    expect(moveTarget(tree, D, "down")).toBeNull();
    expect(moveTarget(tree, B, "up")).toBeNull();
  });

  it("하위작업은 같은 상위 작업 안에서만", () => {
    const s1 = item({ id: 11, parentTaskId: 5 });
    const s2 = item({ id: 12, parentTaskId: 5 });
    const parent = item({ id: 5, subtasks: [s1, s2] });
    expect(moveTarget([parent], s2, "up")).toEqual({ parentTaskId: 5, index: 0 });
    expect(moveTarget([parent], s1, "down")).toEqual({ parentTaskId: 5, index: 1 });
  });
});

describe("입력 검증", () => {
  const values = (overrides: Partial<WbsFormValues> = {}): WbsFormValues => ({
    name: "작업",
    description: "",
    phaseId: 10,
    assigneeUserId: null,
    startDate: "2026-12-01",
    endDate: "2026-12-01",
    effort: "",
    ...overrides,
  });

  it("이름 200자는 통과, 201자·공백은 거부", () => {
    expect(validateWbsForm(values({ name: "가".repeat(200) })).ok).toBe(true);
    expect(validateWbsForm(values({ name: "가".repeat(201) }))).toEqual({ ok: false, message: WBS_FORM_TEXT.nameTooLong });
    expect(validateWbsForm(values({ name: "   " }))).toEqual({ ok: false, message: WBS_FORM_TEXT.nameRequired });
  });

  it("설명 2000자 경계", () => {
    expect(validateWbsForm(values({ description: "a".repeat(2000) })).ok).toBe(true);
    expect(validateWbsForm(values({ description: "a".repeat(2001) }))).toEqual({ ok: false, message: WBS_FORM_TEXT.descriptionTooLong });
  });

  it("기간: 필수, 같은 날은 통과, 시작 > 종료는 거부", () => {
    expect(validateWbsForm(values({ endDate: "" }))).toEqual({ ok: false, message: WBS_FORM_TEXT.dateRequired });
    expect(validateWbsForm(values({ startDate: "2026-12-02" }))).toEqual({ ok: false, message: WBS_FORM_TEXT.dateOrder });
  });

  it.each([
    ["", { ok: true, value: null }],
    ["0.1", { ok: true, value: 0.1 }],
    ["99999.9", { ok: true, value: 99999.9 }],
    ["0", { ok: false }],
    ["0.05", { ok: false }],
    ["100000", { ok: false }],
    ["1.25", { ok: false }],
    ["-1", { ok: false }],
    ["abc", { ok: false }],
  ])("예상 공수 %s", (raw, expected) => {
    expect(parseEffort(raw)).toEqual(expected);
  });

  it.each([
    ["0", 0],
    ["100", 100],
    ["101", null],
    ["-1", null],
    ["1.5", null],
    ["", null],
  ])("진척률 %s → %s", (raw, expected) => {
    expect(parseProgress(raw)).toBe(expected);
  });

  it("AI 초안 입력: 목적·요구사항 중 하나 필수, 길이·개수 상한", () => {
    const base = { projectPurpose: "", requirementsText: "", constraints: [], userInstruction: "" };
    expect(validateDraftInput(base)).toBe(WBS_DRAFT_TEXT.inputRequired);
    expect(validateDraftInput({ ...base, requirementsText: "발주" })).toBeNull();
    expect(validateDraftInput({ ...base, projectPurpose: "a".repeat(2001) })).toBe(WBS_DRAFT_TEXT.purposeTooLong);
    expect(validateDraftInput({ ...base, projectPurpose: "a", constraints: Array(21).fill("c") })).toBe(WBS_DRAFT_TEXT.constraintsInvalid);
    expect(validateDraftInput({ ...base, projectPurpose: "a", constraints: Array(20).fill("c") })).toBeNull();
    expect(validateDraftInput({ ...base, projectPurpose: "a", constraints: ["c".repeat(201)] })).toBe(WBS_DRAFT_TEXT.constraintsInvalid);
  });
});

describe("실패 해석 (status 기준, code 없음)", () => {
  it("조회 404는 사용할 수 없음, 네트워크·5xx는 공통 문구", () => {
    expect(interpretWbsFailure("load", http(404)).message).toBe(WBS_TEXT.unavailable);
    expect(interpretWbsFailure("load", { kind: "network" }).message).toBe(WBS_TEXT.network);
    expect(interpretWbsFailure("load", http(500)).message).toBe(WBS_TEXT.serverError);
  });

  it("400은 서버 메시지를 보여 주고 다시 불러오지 않는다", () => {
    expect(interpretWbsFailure("update", http(400, "하위작업이 있는 작업의 기간은 ..."))).toEqual({ message: "하위작업이 있는 작업의 기간은 ...", reload: false });
    expect(interpretWbsFailure("create", http(400))).toEqual({ message: WBS_TEXT.invalid, reload: false });
  });

  it("403·404는 권한·대상이 바뀌었을 수 있어 다시 불러온다", () => {
    expect(interpretWbsFailure("update", http(403))).toEqual({ message: WBS_TEXT.forbidden, reload: true });
    expect(interpretWbsFailure("move", http(404))).toEqual({ message: WBS_TEXT.notFound, reload: true });
  });

  it("409는 API마다 뜻이 다르다", () => {
    expect(interpretWbsFailure("update", http(409))).toEqual({ message: WBS_TEXT.concurrent, reload: true });
    expect(interpretWbsFailure("move", http(409))).toEqual({ message: WBS_TEXT.concurrent, reload: true });
    expect(interpretWbsFailure("progress", http(409))).toEqual({ message: WBS_TEXT.concurrent, reload: true });
    expect(interpretWbsFailure("delete", http(409))).toEqual({ message: WBS_TEXT.inUse, reload: true });
    expect(interpretWbsFailure("create", http(409))).toEqual({ message: WBS_TEXT.limitExceeded, reload: false });
  });

  it("AI 초안: 503 준비 중, 502 실패, 504 시간 초과, 반영 404·409는 초안을 버린다", () => {
    expect(interpretDraftFailure("generate", http(503)).message).toBe(WBS_DRAFT_TEXT.aiUnavailable);
    expect(interpretDraftFailure("generate", http(502)).message).toBe(WBS_DRAFT_TEXT.aiFailed);
    expect(interpretDraftFailure("generate", http(504)).message).toBe(WBS_DRAFT_TEXT.aiTimeout);
    expect(interpretDraftFailure("generate", http(403)).message).toBe(WBS_DRAFT_TEXT.pmOnly);
    expect(interpretDraftFailure("apply", http(404))).toEqual({ message: WBS_DRAFT_TEXT.expired, discardDraft: true });
    expect(interpretDraftFailure("apply", http(409))).toEqual({ message: WBS_DRAFT_TEXT.alreadyApplied, discardDraft: true });
    expect(interpretDraftFailure("apply", http(400, "선후행 관계에 순환이 있습니다"))).toEqual({ message: "선후행 관계에 순환이 있습니다", discardDraft: false });
  });
});

describe("AI 초안 검토·반영 본문", () => {
  const draftTask = (overrides: Partial<DraftTask> = {}): DraftTask => ({
    tempId: "T-001",
    phaseId: 10,
    name: "분석",
    description: "",
    estimatedPersonDays: 3,
    suggestedAssigneeId: 11,
    suggestedRole: "DEVELOPER",
    startDate: "2026-12-01",
    endDate: "2026-12-05",
    dependencies: [],
    subtasks: [],
    reason: "",
    ...overrides,
  });

  it("toReview: 없는 단계는 첫 단계로, 멤버가 아닌 담당 제안은 비우고, 처음엔 아무것도 선택하지 않는다", () => {
    const review = toReview({
      tasks: [draftTask(), draftTask({ tempId: "T-002", phaseId: 999, suggestedAssigneeId: 777 })],
      milestones: [{ tempId: "M-1", name: "m", targetDate: "2026-12-05", relatedTaskIds: [], reason: "" }],
      phaseIds: [10, 20],
      memberIds: [5, 11],
    });
    expect(review.tasks.map((t) => [t.phaseId, t.assigneeUserId, t.selected])).toEqual([
      [10, 11, false],
      [10, null, false],
    ]);
    expect(review.milestones[0].selected).toBe(false);
  });

  it("아무것도 고르지 않으면 반영하지 않는다", () => {
    const { tasks, milestones } = toReview({ tasks: [draftTask()], milestones: [], phaseIds: [10], memberIds: [] });
    expect(buildApplyBody({ draftToken: "tok", tasks, milestones })).toEqual({ ok: false, message: WBS_DRAFT_TEXT.nothingSelected });
  });

  it("선택한 작업만 보내고, 고르지 않은 작업을 가리키는 선행·마일스톤 연결은 뺀다", () => {
    const { tasks, milestones } = toReview({
      tasks: [
        draftTask({ tempId: "T-001", subtasks: [{ tempId: "ST-1", name: " 정리 ", description: "", estimatedPersonDays: null }, { tempId: "ST-2", name: " ", description: "", estimatedPersonDays: null }] }),
        draftTask({ tempId: "T-002", dependencies: ["T-001", "T-003", "T-002"] }),
        draftTask({ tempId: "T-003" }),
      ],
      milestones: [
        { tempId: "M-1", name: "설계 완료", targetDate: "2026-12-20", relatedTaskIds: ["T-002", "T-003"], reason: "" },
        { tempId: "M-2", name: "제외", targetDate: "2026-12-21", relatedTaskIds: [], reason: "" },
      ],
      phaseIds: [10],
      memberIds: [11],
    });
    const chosen = tasks.map((t) => ({ ...t, selected: t.tempId !== "T-003" }));
    const chosenMilestones = milestones.map((m) => ({ ...m, selected: m.tempId === "M-1" }));
    const built = buildApplyBody({ draftToken: "tok", tasks: chosen, milestones: chosenMilestones });
    if (built.ok !== true) throw new Error(built.message);
    expect(built.body.tasks.map((t) => t.tempId)).toEqual(["T-001", "T-002"]);
    expect(built.body.tasks[1].dependencies).toEqual(["T-001"]);
    expect(built.body.tasks[0].subtasks).toEqual([
      { tempId: "ST-1", name: "정리", description: null, startDate: null, endDate: null, estimatedPersonDays: null, assigneeUserId: null },
    ]);
    expect(built.body.milestones).toEqual([{ tempId: "M-1", name: "설계 완료", targetDate: "2026-12-20", relatedTaskIds: ["T-002"] }]);
    expect(built.body.rejectedCount).toBe(2);
    expect(built.body.tasks[0]).toMatchObject({ phaseId: 10, assigneeUserId: 11 });
  });

  it("선택한 작업의 기간이 비었거나 거꾸로면 막는다", () => {
    const noDate = buildApplyBody({ draftToken: "tok", tasks: [{ ...draftTask({ endDate: "" }), selected: true, assigneeUserId: null }], milestones: [] });
    expect(noDate).toMatchObject({ ok: false });
    const reversed = buildApplyBody({ draftToken: "tok", tasks: [{ ...draftTask({ startDate: "2026-12-09" }), selected: true, assigneeUserId: null }], milestones: [] });
    expect(reversed).toMatchObject({ ok: false });
  });
});

describe("상위 작업 변경 후보 (reparentCandidates) & 파생 상태 (deriveDisplayStatus)", () => {
  it("하위작업이 있는 최상위 작업은 2단계 제한으로 다른 작업 아래로 옮길 수 없다", () => {
    const child = item({ id: 2, parentTaskId: 1, name: "하위" });
    const parent = item({ id: 1, name: "상위", subtasks: [child] });
    const other = item({ id: 3, name: "다른 작업" });
    const tree = [parent, other];

    expect(canReparent(tree, parent)).toBe(false);
    expect(reparentCandidates(tree, parent)).toEqual([]);

    // 하위작업은 최상위로 올리거나 다른 최상위 작업 아래로 옮길 수 있다
    expect(reparentCandidates(tree, child)).toEqual([
      { parentTaskId: null, phaseId: 10, name: "", index: 2 },
      { parentTaskId: 3, phaseId: 10, name: "다른 작업", index: 0 },
    ]);

    // 하위작업이 없는 최상위 작업은 다른 최상위 작업 아래로 옮길 수 있다
    expect(reparentCandidates(tree, other)).toEqual([
      { parentTaskId: 1, phaseId: 10, name: "상위", index: 1 },
    ]);
  });

  it("상위 작업 표시 상태는 하위작업 상태 기준으로 계산한다", () => {
    const leaf = item({ id: 1, status: "progress", subtasks: [] });
    expect(deriveDisplayStatus(leaf)).toBe("progress");

    const allDone = item({
      id: 2,
      status: "todo",
      subtasks: [item({ id: 21, parentTaskId: 2, status: "done" }), item({ id: 22, parentTaskId: 2, status: "done" })],
    });
    expect(deriveDisplayStatus(allDone)).toBe("done");

    const allTodo = item({
      id: 3,
      status: "progress",
      subtasks: [item({ id: 31, parentTaskId: 3, status: "todo" }), item({ id: 32, parentTaskId: 3, status: "todo" })],
    });
    expect(deriveDisplayStatus(allTodo)).toBe("todo");

    const reviewAndDone = item({
      id: 4,
      status: "todo",
      subtasks: [item({ id: 41, parentTaskId: 4, status: "review" }), item({ id: 42, parentTaskId: 4, status: "done" })],
    });
    expect(deriveDisplayStatus(reviewAndDone)).toBe("review");

    const mixed = item({
      id: 5,
      status: "todo",
      subtasks: [item({ id: 51, parentTaskId: 5, status: "todo" }), item({ id: 52, parentTaskId: 5, status: "done" })],
    });
    expect(deriveDisplayStatus(mixed)).toBe("progress");
  });
});
