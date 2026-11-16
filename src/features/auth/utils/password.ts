/** 서비스 비밀번호 정책: 영문 소문자와 특수문자를 포함한 8자 이상. 숫자·대문자는 필수가 아닙니다. */
export const PASSWORD_MIN_LENGTH = 8;
export const PASSWORD_POLICY_TEXT = "영문 소문자와 특수문자를 포함한 8자 이상";

export interface PasswordRequirement {
  key: "length" | "lowercase" | "special";
  label: string;
  met: boolean;
}

/** 정책 조건별 충족 여부를 반환합니다. 화면 체크리스트와 검증에서 함께 사용합니다. */
export function passwordRequirements(value: string): PasswordRequirement[] {
  return [
    { key: "length", label: `${PASSWORD_MIN_LENGTH}자 이상`, met: value.length >= PASSWORD_MIN_LENGTH },
    { key: "lowercase", label: "영문 소문자 포함", met: /[a-z]/.test(value) },
    { key: "special", label: "특수문자 포함", met: /[^A-Za-z0-9\s]/.test(value) },
  ];
}

export function isPasswordValid(value: string): boolean {
  return passwordRequirements(value).every((item) => item.met);
}

/** 비밀번호 정책 검증 메시지. 통과하면 빈 문자열을 반환합니다. */
export function passwordPolicyError(value: string): string {
  if (!value) return "비밀번호를 입력해 주세요.";
  const missing = passwordRequirements(value)
    .filter((item) => !item.met)
    .map((item) => item.label);
  if (missing.length === 0) return "";
  return `${missing.join(", ")} 조건을 충족해야 합니다.`;
}