import { describe, expect, it } from "vitest";
import type { ApiFailure } from "@/shared/api/client";
import type { BoardColumn } from "@/features/board/api/boardApi";
import { BOARD_COLUMN_TEXT, BOARD_TEXT, TASK_DETAIL_TEXT } from "@/features/board/i18n/ko";
import {
  boardViewerNote,
  canDeleteColumn,
  canManageColumns,
  canMoveCard,
  columnTitle,
  historyFieldLabel,
  historyLines,
  interpretBoardFailure,
  reorderedIds,
  validateColumnInput,
} from "@/features/board/utils/boardRules";
import { applyLabels } from "@/shared/i18n/store";

const http = (status: number, message: string | null = null): ApiFailure => ({ kind: "http", status, code: null, message });

const col = (overrides: Partial<BoardColumn> = {}): BoardColumn => ({
  id: 1,
  name: null,
  labelKey: "code.TASK_STATUS.TODO",
  statusCategory: "todo",
  sortOrder: 1,
  wipLimit: null,
  cardCount: 0,
  wipExceeded: false,
  cards: [],
  ...overrides,
});

describe("권한 표시 (3.3 TSK-02)", () => {
  const mine = { assignee: { id: 11, name: "" } };
  it("PM은 모든 카드, 개발자·QA는 본인 카드만, 현업 담당자는 담당이어도 못 옮긴다", () => {
    expect(canMoveCard({ userId: 5, actor: "pm" }, { assignee: null })).toBe(true);
    expect(canMoveCard({ userId: 11, actor: "dev" }, mine)).toBe(true);
    expect(canMoveCard({ userId: 11, actor: "qa" }, mine)).toBe(true);
    expect(canMoveCard({ userId: 12, actor: "dev" }, mine)).toBe(false);
    expect(canMoveCard({ userId: 11, actor: "biz" }, mine)).toBe(false);
    expect(canMoveCard({ userId: 11, actor: null }, mine)).toBe(false);
  });

  it("컬럼 관리는 PM만, 안내 문구는 역할별", () => {
    expect(canManageColumns({ userId: 5, actor: "pm" })).toBe(true);
    expect(canManageColumns({ userId: 11, actor: "dev" })).toBe(false);
    expect(boardViewerNote({ userId: 5, actor: "pm" })).toBeNull();
    expect(boardViewerNote({ userId: 11, actor: "dev" })).toBe(BOARD_TEXT.memberNote);
    expect(boardViewerNote({ userId: 11, actor: "biz" })).toBe(BOARD_TEXT.viewerNote);
  });
});

describe("컬럼 이름", () => {
  it("사용자 이름은 그대로, 기본 컬럼은 라벨 키 번역, 없으면 상태 라벨", () => {
    expect(columnTitle(col({ name: "개발 중" }))).toBe("개발 중");
    expect(columnTitle(col())).toBe("대기");
    expect(columnTitle(col({ labelKey: null, statusCategory: "done" }))).toBe("완료");
    applyLabels({ language: "en", labels: { "code.TASK_STATUS.TODO": "To do" } });
    expect(columnTitle(col())).toBe("To do");
    applyLabels({ language: "ko", labels: {} });
  });
});

describe("컬럼 입력 검증", () => {
  it.each([
    [{ name: "가".repeat(50), wipLimit: "" }, { ok: true, name: "가".repeat(50), wipLimit: null }],
    [{ name: "  대기열 ", wipLimit: "1" }, { ok: true, name: "대기열", wipLimit: 1 }],
    [{ name: "", wipLimit: "999" }, { ok: true, name: "", wipLimit: 999 }],
  ])("통과 %j", (input, expected) => {
    expect(validateColumnInput(input)).toEqual(expected);
  });

  it.each([
    [{ name: "가".repeat(51), wipLimit: "" }, BOARD_COLUMN_TEXT.nameTooLong],
    [{ name: "줄\n바꿈", wipLimit: "" }, BOARD_COLUMN_TEXT.nameControl],
    [{ name: "탭\t", wipLimit: "" }, BOARD_COLUMN_TEXT.nameControl],
    [{ name: "a", wipLimit: "0" }, BOARD_COLUMN_TEXT.wipInvalid],
    [{ name: "a", wipLimit: "1000" }, BOARD_COLUMN_TEXT.wipInvalid],
    [{ name: "a", wipLimit: "1.5" }, BOARD_COLUMN_TEXT.wipInvalid],
    [{ name: "a", wipLimit: "-1" }, BOARD_COLUMN_TEXT.wipInvalid],
  ])("거부 %j", (input, message) => {
    expect(validateColumnInput(input)).toEqual({ ok: false, message });
  });
});

describe("컬럼 순서·삭제 가능", () => {
  const list = [col({ id: 1 }), col({ id: 2 }), col({ id: 3 })];
  it("한 칸 앞·뒤로 바꾼 전체 목록, 끝이면 null", () => {
    expect(reorderedIds(list, 2, "left")).toEqual([2, 1, 3]);
    expect(reorderedIds(list, 2, "right")).toEqual([1, 3, 2]);
    expect(reorderedIds(list, 1, "left")).toBeNull();
    expect(reorderedIds(list, 3, "right")).toBeNull();
    expect(reorderedIds(list, 9, "left")).toBeNull();
  });

  it("카드가 있거나 그 상태의 마지막 컬럼이면 삭제할 수 없다", () => {
    const a = col({ id: 1 });
    const b = col({ id: 2, cardCount: 3 });
    const done = col({ id: 3, statusCategory: "done" });
    expect(canDeleteColumn([a, b, done], a)).toBe(true);
    expect(canDeleteColumn([a, b, done], b)).toBe(false);
    expect(canDeleteColumn([a, b, done], done)).toBe(false);
  });
});

describe("이력 줄", () => {
  const userName = (id: number) => (id === 11 ? "김QA" : null);
  it("바뀐 필드만, 담당자 ID는 이름으로, 빈 값은 '없음', 필드 키는 사람이 읽는 라벨로 매핑한다", () => {
    expect(historyLines({ before: { assigneeUserId: null, name: "a" }, after: { assigneeUserId: "11", name: "a" }, userName })).toEqual([
      { field: "assigneeUserId", label: TASK_DETAIL_TEXT.assignee, from: TASK_DETAIL_TEXT.none, to: "김QA" },
    ]);
    expect(historyLines({ before: null, after: { assigneeUserId: "99" }, userName })).toEqual([
      { field: "assigneeUserId", label: TASK_DETAIL_TEXT.assignee, from: "", to: "#99" },
    ]);
  });

  it("주요 필드 키를 i18n 라벨로 바꾸고 모르는 키·프로토타입 키는 원문으로 폴백한다", () => {
    expect(historyFieldLabel("priority")).toBe(TASK_DETAIL_TEXT.priority);
    expect(historyFieldLabel("dueDate")).toBe(TASK_DETAIL_TEXT.fieldDueDate);
    expect(historyFieldLabel("startDate")).toBe(TASK_DETAIL_TEXT.fieldStartDate);
    expect(historyFieldLabel("endDate")).toBe(TASK_DETAIL_TEXT.fieldEndDate);
    expect(historyFieldLabel("completionCriteria")).toBe(TASK_DETAIL_TEXT.fieldCompletionCriteria);
    expect(historyFieldLabel("taskType")).toBe(TASK_DETAIL_TEXT.taskType);
    expect(historyFieldLabel("estimatedEffort")).toBe(TASK_DETAIL_TEXT.effort);
    expect(historyFieldLabel("unknownFutureKey")).toBe("unknownFutureKey");
    expect(historyFieldLabel("toString")).toBe("toString");
  });

  it("사용자 입력은 그대로 문자열로 둔다(HTML로 해석하지 않음), 긴 값은 줄인다", () => {
    const [line] = historyLines({ before: null, after: { name: "<script>alert(1)</script>" }, userName });
    expect(line.label).toBe(TASK_DETAIL_TEXT.fieldName);
    expect(line.to).toBe("<script>alert(1)</script>");
    const [long] = historyLines({ before: { description: "x".repeat(200) }, after: { description: null }, userName });
    expect(long.label).toBe(TASK_DETAIL_TEXT.description);
    expect(long.from).toHaveLength(81);
    expect(long.to).toBe(TASK_DETAIL_TEXT.none);
  });
});

describe("실패 해석", () => {
  it("보드 404는 사용할 수 없음, 업무 404는 찾을 수 없음", () => {
    expect(interpretBoardFailure("load", http(404)).message).toBe(BOARD_TEXT.unavailable);
    expect(interpretBoardFailure("loadTask", http(404)).message).toBe(TASK_DETAIL_TEXT.notFound);
    expect(interpretBoardFailure("load", { kind: "network" }).message).toBe(BOARD_TEXT.network);
  });

  it("이동 400 서버 메시지·403·404·409는 다시 받는다", () => {
    expect(interpretBoardFailure("move", http(400, "옮길 컬럼을 선택해 주세요"))).toEqual({ message: "옮길 컬럼을 선택해 주세요", reload: false });
    expect(interpretBoardFailure("move", http(403))).toEqual({ message: BOARD_TEXT.forbidden, reload: true });
    expect(interpretBoardFailure("move", http(404))).toEqual({ message: BOARD_TEXT.notFound, reload: true });
    expect(interpretBoardFailure("move", http(409))).toEqual({ message: BOARD_TEXT.concurrent, reload: true });
  });

  it("컬럼: 추가 409 상한, 삭제 409 삭제 불가, 순서 400은 다시 받는다", () => {
    expect(interpretBoardFailure("createColumn", http(409))).toEqual({ message: BOARD_COLUMN_TEXT.limitExceeded, reload: false });
    expect(interpretBoardFailure("deleteColumn", http(409))).toEqual({ message: BOARD_COLUMN_TEXT.cannotDelete, reload: true });
    expect(interpretBoardFailure("reorderColumns", http(400, "컬럼 순서를 확인해 주세요")).reload).toBe(true);
    expect(interpretBoardFailure("updateColumn", http(403)).message).toBe(BOARD_TEXT.forbidden);
  });

  it("업무 속성: 409 동시 수정, 403 권한", () => {
    expect(interpretBoardFailure("updateTask", http(409))).toEqual({ message: TASK_DETAIL_TEXT.concurrent, reload: true });
    expect(interpretBoardFailure("updateTask", http(403))).toEqual({ message: TASK_DETAIL_TEXT.forbidden, reload: true });
  });
});
