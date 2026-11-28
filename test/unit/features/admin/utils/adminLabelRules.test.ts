import { describe, expect, it } from "vitest";
import type { ApiFailure } from "@/shared/api/client";
import { ADMIN_LABEL_TEXT } from "@/features/admin/i18n/ko";
import { interpretLabelFailure, validateLabel } from "@/features/admin/utils/adminLabelRules";

const texts = (overrides: Partial<{ textKo: string; textEn: string; textZhTw: string }> = {}) => ({
  textKo: "저장",
  textEn: "",
  textZhTw: "",
  ...overrides,
});

const http = (status: number, message: string | null = null): ApiFailure => ({ kind: "http", status, code: null, message });

describe("validateLabel — 라벨 키 (등록)", () => {
  it.each(["button.save", "code.TASK_STATUS.IN_PROGRESS", "a", "menu.project-list_v2", `a${".b".repeat(49)}`])("%s는 허용", (labelKey) => {
    expect(validateLabel({ labelKey, texts: texts(), creating: true })).toEqual({});
  });

  it.each(["", "   "])("빈 키(%j)는 입력을 요구한다", (labelKey) => {
    expect(validateLabel({ labelKey, texts: texts(), creating: true }).labelKey).toBe(ADMIN_LABEL_TEXT.keyRequired);
  });

  it.each(["1button", ".save", "button.", "button..save", "button save", "버튼.저장", "button/save", `a${"b".repeat(100)}`])(
    "%s는 형식 오류 (영문자 시작·점 구분·100자 이하)",
    (labelKey) => {
      expect(validateLabel({ labelKey, texts: texts(), creating: true }).labelKey).toBe(ADMIN_LABEL_TEXT.keyFormat);
    },
  );

  it("100자 키는 허용하고 101자는 거부한다", () => {
    expect(validateLabel({ labelKey: `a${"b".repeat(99)}`, texts: texts(), creating: true }).labelKey).toBeUndefined();
    expect(validateLabel({ labelKey: `a${"b".repeat(100)}`, texts: texts(), creating: true }).labelKey).toBe(ADMIN_LABEL_TEXT.keyFormat);
  });

  it("수정할 때는 키를 검사하지 않는다(고정)", () => {
    expect(validateLabel({ labelKey: "", texts: texts(), creating: false })).toEqual({});
  });
});

describe("validateLabel — 문구", () => {
  it("한국어는 필수이고 공백만 있으면 거부한다", () => {
    expect(validateLabel({ labelKey: "a", texts: texts({ textKo: "  " }), creating: false }).textKo).toBe(ADMIN_LABEL_TEXT.textKoRequired);
  });

  it("영어·번체 중국어는 비워도 된다(번역 누락)", () => {
    expect(validateLabel({ labelKey: "a", texts: texts({ textEn: "", textZhTw: "   " }), creating: false })).toEqual({});
  });

  it("500자는 허용하고 501자는 거부한다", () => {
    expect(validateLabel({ labelKey: "a", texts: texts({ textEn: "x".repeat(500) }), creating: false })).toEqual({});
    expect(validateLabel({ labelKey: "a", texts: texts({ textEn: "x".repeat(501) }), creating: false }).textEn).toBe(
      ADMIN_LABEL_TEXT.textTooLong,
    );
  });

  it.each(["줄\n바꿈", "탭\t문구", "널\u0000문자", "삭제\u007f문자"])("제어 문자(%j)는 거부한다", (text) => {
    expect(validateLabel({ labelKey: "a", texts: texts({ textZhTw: text }), creating: false }).textZhTw).toBe(
      ADMIN_LABEL_TEXT.textControlCharacter,
    );
  });

  it("앞뒤 공백·줄바꿈은 지운 뒤 검사한다", () => {
    expect(validateLabel({ labelKey: "a", texts: texts({ textKo: "\n 저장 \n" }), creating: false })).toEqual({});
  });

  it("HTML처럼 보이는 문구도 글자로 허용한다(화면은 텍스트로만 출력)", () => {
    expect(validateLabel({ labelKey: "a", texts: texts({ textEn: "<b>Save</b>" }), creating: false })).toEqual({});
  });
});

describe("interpretLabelFailure", () => {
  it("등록 409는 키 중복이라 키 칸에 서버 메시지를 붙인다", () => {
    expect(interpretLabelFailure(http(409, "이미 등록된 라벨 키입니다"), { creating: true })).toEqual({
      message: "이미 등록된 라벨 키입니다",
      field: "labelKey",
      stale: false,
    });
  });

  it("등록 400은 폼 오류다", () => {
    expect(interpretLabelFailure(http(400, "문구는 500자 이하로 입력해 주세요"), { creating: true }).field).toBeNull();
  });

  it("수정 409는 동시 수정이라 FE 안내를 보여 주고 목록을 다시 받는다", () => {
    expect(interpretLabelFailure(http(409, "서버 메시지"), { creating: false })).toEqual({
      message: ADMIN_LABEL_TEXT.concurrentModification,
      field: null,
      stale: true,
    });
  });

  it("수정 404는 라벨이 사라져 목록을 다시 받는다", () => {
    expect(interpretLabelFailure(http(404, "다국어 라벨을 찾을 수 없습니다"), { creating: false }).stale).toBe(true);
  });

  it("네트워크 실패는 목록을 다시 받지 않는다", () => {
    expect(interpretLabelFailure({ kind: "network" }, { creating: false }).stale).toBe(false);
  });
});
