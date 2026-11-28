/**
 * 네트워크 계층이 인증 상태 변화를 화면 쪽에 알리는 통로.
 * 요청 함수는 화면 상태를 직접 바꾸지 않고 이벤트만 보낸다.
 */
export type AuthEvent =
  | { type: "sessionEnded"; reason: "expired" }
  | { type: "passwordChangeRequired" };

type AuthEventListener = (event: AuthEvent) => void;

const listeners = new Set<AuthEventListener>();

export const subscribeAuthEvents = function (listener: AuthEventListener) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

export const emitAuthEvent = function (event: AuthEvent) {
  listeners.forEach((listener) => listener(event));
};
