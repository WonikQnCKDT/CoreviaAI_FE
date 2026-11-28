import { describe, expect, it } from "vitest";
import {
  PASSWORD_MAX_LENGTH,
  PASSWORD_MIN_LENGTH,
  isPasswordValid,
  passwordPolicyError,
  passwordRequirements,
} from "@/features/auth/utils/password";

describe("비밀번호 정책 (password)", () => {
  it("영문·숫자·특수문자를 포함한 8~64자 비밀번호는 통과한다", () => {
    expect(isPasswordValid("abc123!@")).toBe(true);
    expect(passwordPolicyError("abc123!@")).toBe("");
    expect(passwordRequirements("abc123!@").every(({ met }) => met)).toBe(true);
  });

  it("길이 경계값(7자·8자·64자·65자)을 정확히 판별한다", () => {
    expect(isPasswordValid("a1!aaaa")).toBe(false);
    expect(isPasswordValid("a1!aaaaa")).toBe(true);
    expect(isPasswordValid(`a1!${"a".repeat(PASSWORD_MAX_LENGTH - 3)}`)).toBe(true);
    expect(isPasswordValid(`a1!${"a".repeat(PASSWORD_MAX_LENGTH - 2)}`)).toBe(false);
    expect(PASSWORD_MIN_LENGTH).toBe(8);
    expect(PASSWORD_MAX_LENGTH).toBe(64);
  });

  it("빈 값이면 입력 안내 메시지를 돌려준다", () => {
    expect(isPasswordValid("")).toBe(false);
    expect(passwordPolicyError("")).toBe("비밀번호를 입력해 주세요.");
  });

  it("영문·숫자·특수문자 중 하나라도 빠지면 누락 조건을 안내한다", () => {
    expect(passwordPolicyError("1234567!")).toContain("영문 포함");
    expect(passwordPolicyError("abcdefg!")).toContain("숫자 포함");
    expect(passwordPolicyError("abcdefg1")).toContain("특수문자 포함");
  });

  it("공백이나 한글 등 허용되지 않은 문자를 차단한다", () => {
    expect(isPasswordValid("abc 123!")).toBe(false);
    expect(passwordPolicyError("abc 123!")).toContain("공백·한글 없음");
    expect(isPasswordValid("abc123!한")).toBe(false);
    expect(passwordPolicyError("abc123!한")).toContain("공백·한글 없음");
  });
});
