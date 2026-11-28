import { describe, expect, it } from "vitest";
import type { ApiFailure } from "@/shared/api/client";
import type { AdminCode } from "@/features/admin/api/adminCodeApi";
import { ADMIN_CODE_TEXT } from "@/features/admin/i18n/ko";
import { interpretCodeFailure, parseSortOrder, sortCodes } from "@/features/admin/utils/adminCodeRules";

const code = (id: number, sortOrder: number): AdminCode => ({
  id,
  code: `C${id}`,
  labelKey: `code.G.C${id}`,
  sortOrder,
  active: true,
  updatedAt: "2026-11-21T00:00:00Z",
});

describe("sortCodes", () => {
  it("sortOrder 오름차순, 같으면 id 오름차순으로 서버와 같게 정렬한다", () => {
    const sorted = sortCodes([code(3, 2), code(1, 2), code(2, 0), code(4, 9999)]);
    expect(sorted.map(({ id }) => id)).toEqual([2, 1, 3, 4]);
  });

  it("원본 배열을 바꾸지 않는다", () => {
    const original = [code(2, 1), code(1, 0)];
    sortCodes(original);
    expect(original.map(({ id }) => id)).toEqual([2, 1]);
  });

  it("빈 목록은 빈 목록이다", () => {
    expect(sortCodes([])).toEqual([]);
  });
});

describe("parseSortOrder", () => {
  it.each([
    ["0", 0],
    ["9999", 9999],
    [" 7 ", 7],
    ["0010", 10],
  ])("%s → %i (경계값 0·9999 포함)", (input, value) => {
    expect(parseSortOrder(input)).toEqual({ ok: true, value });
  });

  it.each(["", "   "])("빈 값(%j)은 입력을 요구한다", (input) => {
    expect(parseSortOrder(input)).toEqual({ ok: false, message: ADMIN_CODE_TEXT.sortOrderRequired });
  });

  it.each(["10000", "-1", "1.5", "1e3", "abc", "+3"])("%s는 범위·형식 오류다", (input) => {
    expect(parseSortOrder(input)).toEqual({ ok: false, message: ADMIN_CODE_TEXT.sortOrderRange });
  });
});

describe("interpretCodeFailure", () => {
  const http = (status: number, message: string | null = null): ApiFailure => ({ kind: "http", status, code: null, message });

  it("404(그룹·코드 없음)는 서버 메시지를 보여 주고 목록을 다시 받는다", () => {
    expect(interpretCodeFailure(http(404, "코드를 찾을 수 없습니다"))).toEqual({ message: "코드를 찾을 수 없습니다", stale: true });
  });

  it("400 검증 오류는 서버 메시지만 보여 준다", () => {
    expect(interpretCodeFailure(http(400, "정렬 순서는 0 이상 9999 이하로 입력해 주세요"))).toEqual({
      message: "정렬 순서는 0 이상 9999 이하로 입력해 주세요",
      stale: false,
    });
  });

  it("네트워크 실패는 목록을 다시 받지 않는다", () => {
    expect(interpretCodeFailure({ kind: "network" }).stale).toBe(false);
  });
});
