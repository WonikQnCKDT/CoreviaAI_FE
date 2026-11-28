import { defineLabels } from "@/shared/i18n/defineLabels";

/**
 * 인증 화면 문구. 값은 한국어 기본 문구이고, 화면은 라벨 키(auth.*)로 다국어 문구를 읽는다(02-4).
 * 로그인 전 화면도 공개 라벨 API(GET /api/i18n/labels)로 문구를 받는다.
 */
export const AUTH_TEXT = defineLabels("auth", {
  // 로그인
  loginIdRequired: "아이디를 입력해 주세요.",
  loginIdTooLong: "아이디는 50자 이하로 입력해 주세요.",
  passwordRequired: "비밀번호를 입력해 주세요.",
  passwordTooLong: "비밀번호는 128자 이하로 입력해 주세요.",
  invalidCredentials: "아이디 또는 비밀번호가 올바르지 않습니다.",
  accountDisabled: "비활성화된 계정입니다. 시스템 관리자에게 문의해 주세요.",
  accountLocked: "비밀번호를 5회 연속 잘못 입력해 계정이 잠겼습니다. 시스템 관리자에게 비밀번호 초기화를 요청해 주세요.",
  serviceUnavailable: "로그인 서버에 일시적인 문제가 있습니다. 잠시 후 다시 시도해 주세요.",

  // 공통 네트워크
  network: "서버에 연결하지 못했습니다. 네트워크 상태를 확인한 뒤 다시 시도해 주세요.",
  timeout: "서버 응답이 늦어 요청을 중단했습니다. 다시 시도해 주세요.",
  unknown: "요청을 처리하지 못했습니다. 잠시 후 다시 시도해 주세요.",

  // 세션 확인 화면
  checkingSession: "로그인 상태를 확인하는 중입니다",
  unreachableTitle: "서버에 연결하지 못했습니다",
  unreachableBody: "로그인 상태를 확인할 수 없습니다. 네트워크와 서버 상태를 확인한 뒤 다시 시도해 주세요.",
  retry: "다시 시도",
  goToLogin: "로그인 화면으로",

  // 비밀번호 변경
  currentPasswordMismatch: "현재 비밀번호가 일치하지 않습니다.",
  newPasswordInvalid: "새 비밀번호가 비밀번호 규칙에 맞지 않습니다.",
  sameAsCurrent: "현재 비밀번호와 다른 비밀번호를 입력해 주세요.",
  accountNotFound: "계정 정보를 찾을 수 없습니다. 시스템 관리자에게 문의해 주세요.",
  forcedChangeTitle: "비밀번호 변경 필요",
  forcedChangeDescription: "임시 비밀번호로 로그인했습니다. 비밀번호를 변경해야 다른 기능을 사용할 수 있습니다.",
  passwordChangedTitle: "비밀번호가 변경되었습니다.",
  passwordChangedNote: "보안을 위해 모든 기기에서 로그아웃되었습니다. 새 비밀번호로 다시 로그인해 주세요.",

  // 관리자 비밀번호 초기화
  resetForbidden: "시스템 관리자만 비밀번호를 초기화할 수 있습니다.",
  resetUserNotFound: "대상 사용자를 찾을 수 없습니다. 서버 사용자 ID를 확인해 주세요.",
  resetUserIdInvalid: "서버 사용자 ID는 1 이상의 숫자로 입력해 주세요.",
  resetDemoOnly: "데모 모드에서는 실제 비밀번호를 변경하지 않습니다.",

  // 로그인 화면 UI
  loginTitle: "로그인",
  loginSubtitle: "사내 계정으로 로그인해 주세요.",
  loginIdLabel: "아이디",
  loginIdEmailLabel: "아이디 (이메일)",
  loginIdPlaceholder: "아이디 입력",
  passwordLabel: "비밀번호",
  passwordPlaceholder: "비밀번호 입력",
  lockoutHint: "5회 연속 실패하면 계정이 잠깁니다.",
  accountLockedShort: "계정이 잠겨 있습니다.",
  loginFooterPolicy: "비밀번호 규칙: {policy} · 회원가입·소셜 로그인은 제공하지 않습니다.",

  // 세션 만료 안내
  sessionExpiredTitle: "로그인이 만료되었습니다. 다시 로그인해주세요.",
  sessionExpiredNote: "일정 시간 동안 활동이 없어 세션이 종료되었습니다. 다시 로그인하면 이전에 보던 화면으로 이동합니다.",

  // 비밀번호 규칙 및 변경 모달
  passwordPolicy: "영문·숫자·특수문자를 각 1자 이상 포함한 8~64자 (공백·한글 불가)",
  passwordRuleLength: "{min}~{max}자",
  passwordRuleLetter: "영문 포함",
  passwordRuleDigit: "숫자 포함",
  passwordRuleSpecial: "특수문자 포함",
  passwordRuleCharset: "공백·한글 없음",
  passwordPolicyUnmet: "{missing} 조건을 충족해야 합니다.",
  changeModalTitle: "비밀번호 변경",
  changeModalDescription: "비밀번호는 {policy}여야 합니다.",
  currentPasswordLabel: "현재 비밀번호",
  currentPasswordPlaceholder: "현재(또는 임시) 비밀번호 입력",
  newPasswordLabel: "새 비밀번호",
  newPasswordPlaceholder: "새 비밀번호 입력",
  confirmPasswordLabel: "새 비밀번호 확인",
  confirmPasswordPlaceholder: "새 비밀번호 다시 입력",
  currentPasswordRequired: "현재 비밀번호를 입력해 주세요.",
  newPasswordRequired: "새 비밀번호를 입력해 주세요.",
  newPasswordRulesUnmet: "비밀번호 규칙을 모두 충족해야 합니다.",
  confirmPasswordRequired: "새 비밀번호 확인을 입력해 주세요.",
  confirmPasswordMismatch: "새 비밀번호와 일치하지 않습니다.",
  hideFieldPassword: "{label} 숨기기",
  showFieldPassword: "{label} 표시",
  passwordRulesAria: "비밀번호 규칙",
  ruleMet: "충족",
  ruleUnmet: "미충족",
  changeModalFooterNote:
    "비밀번호 규칙: {policy}. 대문자는 필수가 아닙니다. 변경하면 모든 기기에서 로그아웃되며 새 비밀번호로 다시 로그인해야 합니다.",
});
