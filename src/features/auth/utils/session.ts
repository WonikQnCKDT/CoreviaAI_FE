/**
 * 세션 만료 처리 공통 모듈.
 *
 * 실제 인증 API가 연결되기 전까지는 아래 두 가지만 실제 값으로 판단합니다.
 * 1) 무활동 시간(데모 세션 정책) 초과 여부
 * 2) 브라우저 네트워크 연결 끊김 여부(인증 만료와 구분)
 *
 * 실제 인증 연동 시에는 서버 응답의 401(만료) / 네트워크 예외(일시 오류)를
 * expireSession("expired") / reportNetworkIssue() 로 연결하면 됩니다.
 */

export type SessionEndReason = "expired" | "passwordChanged";

export interface SessionNotice {
  reason: SessionEndReason;
  title: string;
  note: string;
  at: number;
}

/** 데모 세션 무활동 만료 시간(30분). 실제 정책은 인증 서버가 결정해야 합니다. */
export const SESSION_IDLE_LIMIT_MS = 30 * 60 * 1000;

const TOUCH_THROTTLE_MS = 30 * 1000;
const ACTIVITY_KEY = "corevia-session-activity";
const NOTICE_KEY = "corevia-session-notice";
const RETURN_KEY = "corevia-return-to";

interface Activity {
  userId: string;
  lastActiveAt: number;
}

function readJson<T>(key: string): T | null {
  try {
    const raw = sessionStorage.getItem(key);
    if (!raw) return null;
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

function writeJson(key: string, value: unknown) {
  try {
    sessionStorage.setItem(key, JSON.stringify(value));
  } catch {
    // 저장 공간을 사용할 수 없어도 화면 동작은 유지합니다.
  }
}

function removeKey(key: string) {
  try {
    sessionStorage.removeItem(key);
  } catch {
    // 무시
  }
}

export function readSessionActivity(): Activity | null {
  const parsed = readJson<Activity>(ACTIVITY_KEY);
  if (!parsed || typeof parsed.lastActiveAt !== "number" || typeof parsed.userId !== "string") return null;
  return parsed;
}

/** 사용자 활동 시각을 기록합니다. 짧은 간격의 반복 기록은 건너뜁니다. */
export function touchSession(userId: string, force = false) {
  if (!userId) return;
  const now = Date.now();
  const previous = readSessionActivity();
  if (!force && previous && previous.userId === userId && now - previous.lastActiveAt < TOUCH_THROTTLE_MS) {
    return;
  }
  writeJson(ACTIVITY_KEY, { userId, lastActiveAt: now } satisfies Activity);
}

export function clearSessionActivity() {
  removeKey(ACTIVITY_KEY);
}

/** 무활동 시간이 기준을 넘었는지 확인합니다. 기록이 없으면 만료로 보지 않습니다. */
export function isSessionExpired(userId: string, now = Date.now()): boolean {
  const activity = readSessionActivity();
  if (!activity || activity.userId !== userId) return false;
  return now - activity.lastActiveAt >= SESSION_IDLE_LIMIT_MS;
}

/** 로그인 화면에서 한 번만 보여줄 만료 안내를 기록합니다. */
export function markSessionExpiredNotice() {
  const notice: SessionNotice = {
    reason: "expired",
    title: "로그인이 만료되었습니다. 다시 로그인해주세요.",
    note: "일정 시간 동안 활동이 없어 세션이 종료되었습니다. 다시 로그인하면 이전에 보던 화면으로 이동합니다.",
    at: Date.now(),
  };
  writeJson(NOTICE_KEY, notice);
}

/** 비밀번호 변경으로 세션이 끝났을 때 로그인 화면에서 한 번 보여줄 안내를 기록합니다. */
export const markPasswordChangedNotice = function ({ title, note }: { title: string; note: string }) {
  writeJson(NOTICE_KEY, { reason: "passwordChanged", title, note, at: Date.now() } satisfies SessionNotice);
};

/**
 * 안내를 지우지 않고 읽기만 합니다. 화면 첫 렌더에서 읽고, 삭제는 effect에서 clearSessionNotice로 합니다.
 * (StrictMode는 effect를 두 번 실행하므로 effect에서 '읽고 지우기'를 하면 두 번째 실행이 안내를 빈 값으로 덮어씁니다.)
 */
export const peekSessionNotice = function (): SessionNotice | null {
  const notice = readJson<SessionNotice>(NOTICE_KEY);
  if (!notice || (notice.reason !== "expired" && notice.reason !== "passwordChanged")) return null;
  return notice;
};

/** 안내를 읽고 즉시 삭제해 새로고침·재진입 시 중복 표시를 막습니다. */
export function consumeSessionNotice(): SessionNotice | null {
  const notice = readJson<SessionNotice>(NOTICE_KEY);
  removeKey(NOTICE_KEY);
  if (!notice || (notice.reason !== "expired" && notice.reason !== "passwordChanged")) return null;
  return notice;
}

export function clearSessionNotice() {
  removeKey(NOTICE_KEY);
}

/** 세션 종료 직전 화면 경로를 저장합니다. 로그인 후 복귀에 사용합니다. */
export function saveReturnTo(path: string) {
  if (!path || path.startsWith("/login")) return;
  try {
    sessionStorage.setItem(RETURN_KEY, path);
  } catch {
    // 무시
  }
}

export function peekReturnTo(): string | null {
  try {
    return sessionStorage.getItem(RETURN_KEY);
  } catch {
    return null;
  }
}

export function takeReturnTo(): string | null {
  const path = peekReturnTo();
  removeKey(RETURN_KEY);
  return path;
}

export function clearReturnTo() {
  removeKey(RETURN_KEY);
}

/** 일시적인 네트워크 오류와 인증 만료를 구분하기 위한 판별 값입니다. */
export function isOffline(): boolean {
  if (typeof navigator === "undefined") return false;
  return navigator.onLine === false;
}