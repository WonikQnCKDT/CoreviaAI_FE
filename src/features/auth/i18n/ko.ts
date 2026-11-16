/**
 * 인증 화면 문구 (ko). 이 프로젝트에는 아직 공통 localization 구조가 없어,
 * 인증 기능의 새 문구는 여기 한곳에 모아 둔다. 다른 언어가 생기면 같은 key로 파일을 추가한다.
 */
export const AUTH_TEXT = {
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
} as const;
