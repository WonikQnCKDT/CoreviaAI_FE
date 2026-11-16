/**
 * 저장하지 않은 입력이 있는 화면이 자신의 상태를 알려 주면,
 * 앱 내부 뒤로가기 버튼이 이탈 확인을 먼저 띄웁니다.
 * 값이 없으면 확인 없이 바로 이동합니다.
 */
let activeMessage: string | null = null;

export function setUnsavedGuard(message: string | null) {
  activeMessage = message && message.trim() ? message : null;
}

export function getUnsavedGuard(): string | null {
  return activeMessage;
}

export function clearUnsavedGuard(message?: string) {
  if (!message || activeMessage === message) activeMessage = null;
}