/**
 * 로그인 직후 미확인 알림 안내를 한 세션에서 한 번만 보여주기 위한 기록입니다.
 * 페이지 이동이나 새로고침으로 같은 안내가 반복되지 않도록 sessionStorage를 사용합니다.
 */
const NOTICE_SHOWN_KEY = "coreviaai-login-notice-shown-v1";

function readShownTokens(): string[] {
  try {
    const raw = sessionStorage.getItem(NOTICE_SHOWN_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((value): value is string => typeof value === "string") : [];
  } catch {
    return [];
  }
}

export function hasShownLoginNotice(token: string): boolean {
  return readShownTokens().includes(token);
}

export function markLoginNoticeShown(token: string): void {
  const tokens = readShownTokens();
  if (tokens.includes(token)) return;
  try {
    sessionStorage.setItem(NOTICE_SHOWN_KEY, JSON.stringify([...tokens, token]));
  } catch {
    // 저장에 실패하면 안내가 한 번 더 보일 수 있지만 화면 동작에는 영향이 없습니다.
  }
}

/** 로그아웃·계정 전환 시 다음 로그인에서 다시 안내할 수 있도록 기록을 지웁니다. */
export function clearLoginNotices(): void {
  try {
    sessionStorage.removeItem(NOTICE_SHOWN_KEY);
  } catch {
    // 무시
  }
}