import { AUTH_TEXT } from "@/features/auth/i18n/ko";
import { formatLabel } from "@/shared/i18n/store";

/**
 * 서비스 비밀번호 규칙 (인증 API 명세 기준)
 * - 영문·숫자·특수문자 각 1자 이상
 * - 8~64자
 * - 공백과 비ASCII 문자(한글 등) 불가
 * - 대문자는 필수 아님
 * 최종 검증은 서버가 하며, 화면 검증은 입력 안내용이다.
 */
export const PASSWORD_MIN_LENGTH = 8;
export const PASSWORD_MAX_LENGTH = 64;
export const PASSWORD_POLICY_TEXT = "영문·숫자·특수문자를 각 1자 이상 포함한 8~64자 (공백·한글 불가)";

export interface PasswordRequirement {
  key: "length" | "letter" | "digit" | "special" | "charset";
  label: string;
  met: boolean;
}

/** 공백을 제외한 출력 가능한 ASCII 문자만 허용 */
const ALLOWED_CHARSET = /^[\x21-\x7E]*$/;
const SPECIAL_CHARACTER = /[!-/:-@[-`{-~]/;

/** 규칙별 충족 여부. 화면 체크리스트와 검증에서 함께 쓴다. */
export const passwordRequirements = function (value: string): PasswordRequirement[] {
  const { length } = value;
  return [
    {
      key: "length",
      label: formatLabel(AUTH_TEXT.passwordRuleLength, { min: PASSWORD_MIN_LENGTH, max: PASSWORD_MAX_LENGTH }),
      met: length >= PASSWORD_MIN_LENGTH && length <= PASSWORD_MAX_LENGTH,
    },
    { key: "letter", label: AUTH_TEXT.passwordRuleLetter, met: /[A-Za-z]/.test(value) },
    { key: "digit", label: AUTH_TEXT.passwordRuleDigit, met: /[0-9]/.test(value) },
    { key: "special", label: AUTH_TEXT.passwordRuleSpecial, met: SPECIAL_CHARACTER.test(value) },
    { key: "charset", label: AUTH_TEXT.passwordRuleCharset, met: length > 0 && ALLOWED_CHARSET.test(value) },
  ];
};

export const isPasswordValid = function (value: string): boolean {
  return passwordRequirements(value).every(({ met }) => met);
};

/** 비밀번호 규칙 검증 메시지. 통과하면 빈 문자열을 반환한다. */
export const passwordPolicyError = function (value: string): string {
  if (!value) return AUTH_TEXT.passwordRequired;
  const missing = passwordRequirements(value)
    .filter(({ met }) => !met)
    .map(({ label }) => label);
  if (missing.length === 0) return "";
  return formatLabel(AUTH_TEXT.passwordPolicyUnmet, { missing: missing.join(", ") });
};
