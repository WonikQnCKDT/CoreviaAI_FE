import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useDemoStore } from "@/stores/DemoStore";
import {
  changeMyPasswordRequest,
  fetchMyAccount,
  loginRequest,
  logoutRequest,
  resetUserPasswordRequest,
  type AuthAccount,
} from "@/features/auth/api/authApi";
import {
  AUTH_MODE,
  AuthContext,
  type AuthContextValue,
  type AuthStatus,
} from "@/features/auth/authContext";
import { AUTH_TEXT } from "@/features/auth/i18n/ko";
import { toChangePasswordOutcome, toResetOutcome, toSignInOutcome } from "@/features/auth/utils/authFailure";
import { markPasswordChangedNotice, markSessionExpiredNotice } from "@/features/auth/utils/session";
import { subscribeAuthEvents } from "@/shared/api/authEvents";
import { resetCodeCache } from "@/shared/codes/codeStore";

type ApiAuthState =
  | { status: "checking" }
  | { status: "signedOut" }
  | { status: "unreachable" }
  | { status: "signedIn"; account: AuthAccount };

/**
 * 인증 상태의 단일 소유자.
 * - api 모드: 인증 서버 응답만 믿는다. 로그인 여부는 새로고침 때마다 GET /auth/me로 확인한다.
 * - demo 모드: 기존 DemoStore 데모 로그인을 같은 인터페이스로 감싼다.
 */
const AuthProvider = function ({ children }: { children: ReactNode }) {
  const demo = useDemoStore();
  const { signInWithAccount, logout: clearLocalSession } = demo;
  const [apiState, setApiState] = useState<ApiAuthState>({ status: AUTH_MODE === "api" ? "checking" : "signedOut" });
  const statusRef = useRef<ApiAuthState["status"]>(apiState.status);
  const checkControllerRef = useRef<AbortController | null>(null);

  statusRef.current = apiState.status;

  const endLocalSession = useCallback(() => {
    resetCodeCache();
    setApiState({ status: "signedOut" });
    clearLocalSession();
  }, [clearLocalSession]);

  const applyAccount = useCallback(
    (account: AuthAccount) => {
      signInWithAccount(account);
      setApiState({ status: "signedIn", account });
    },
    [signInWithAccount],
  );

  const recheck = useCallback(() => {
    if (AUTH_MODE !== "api") return;
    checkControllerRef.current?.abort();
    const controller = new AbortController();
    checkControllerRef.current = controller;
    setApiState({ status: "checking" });

    fetchMyAccount({ signal: controller.signal }).then((result) => {
      if (controller.signal.aborted) return;
      if (result.ok === true) {
        applyAccount(result.data);
        return;
      }
      const { failure } = result;
      if (failure.kind === "http" && (failure.status === 401 || failure.status === 404)) {
        endLocalSession();
        return;
      }
      setApiState({ status: "unreachable" });
    });
  }, [applyAccount, endLocalSession]);

  // 새로고침 직후 로그인 상태 확인
  useEffect(() => {
    if (AUTH_MODE !== "api") return undefined;
    recheck();
    return () => checkControllerRef.current?.abort();
    // 최초 1회만 확인한다. recheck는 사용자가 '다시 시도'를 누를 때 다시 호출된다.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 네트워크 계층이 알려주는 세션 종료·비밀번호 변경 강제
  useEffect(() => {
    if (AUTH_MODE !== "api") return undefined;
    return subscribeAuthEvents((event) => {
      if (event.type === "passwordChangeRequired") {
        setApiState((prev) =>
          prev.status === "signedIn" ? { status: "signedIn", account: { ...prev.account, mustChangePassword: true } } : prev,
        );
        return;
      }
      const wasSignedIn = statusRef.current === "signedIn";
      if (wasSignedIn && event.reason === "expired") markSessionExpiredNotice();
      if (wasSignedIn || statusRef.current === "checking") endLocalSession();
    });
  }, [endLocalSession]);

  /* ===== api 모드 동작 ===== */

  const apiSignIn = useCallback<AuthContextValue["signIn"]>(
    async ({ loginId, password, signal }) => {
      const result = await loginRequest({ loginId: loginId.trim(), password, signal });
      if (result.ok === false) return toSignInOutcome(result.failure);
      applyAccount(result.data);
      return { kind: "success", mustChangePassword: result.data.mustChangePassword };
    },
    [applyAccount],
  );

  const apiSignOut = useCallback(async () => {
    // 멱등 API라 실패해도 화면은 로그아웃 상태로 만든다. 쿠키는 서버가 만료시킨다.
    await logoutRequest();
    endLocalSession();
  }, [endLocalSession]);

  const apiChangePassword = useCallback<AuthContextValue["changePassword"]>(
    async ({ currentPassword, newPassword, signal }) => {
      const result = await changeMyPasswordRequest({ currentPassword, newPassword, signal });
      if (result.ok === false) return toChangePasswordOutcome(result.failure);
      // 서버가 모든 기기의 세션을 끝냈으므로 새 비밀번호로 다시 로그인해야 한다.
      markPasswordChangedNotice({ title: AUTH_TEXT.passwordChangedTitle, note: AUTH_TEXT.passwordChangedNote });
      endLocalSession();
      return { kind: "success" };
    },
    [endLocalSession],
  );

  const apiResetPassword = useCallback<AuthContextValue["resetPassword"]>(async ({ userId, signal }) => {
    if (!Number.isInteger(userId) || userId < 1) return { kind: "failed", message: AUTH_TEXT.resetUserIdInvalid };
    const result = await resetUserPasswordRequest({ userId, signal });
    if (result.ok === false) return toResetOutcome(result.failure);
    return { kind: "success", temporaryPassword: result.data.temporaryPassword };
  }, []);

  /* ===== demo 모드 동작 (기존 DemoStore 위임) ===== */

  const { users, login: demoLogin, requestPasswordChange, signedIn: demoSignedIn } = demo;

  const demoSignIn = useCallback<AuthContextValue["signIn"]>(
    async ({ loginId, password }) => {
      const input = loginId.trim();
      const key = input.toLowerCase();
      const found = users.find((u) => u.email.toLowerCase() === key || u.name === input || u.id === key);
      if (!found) return { kind: "rejected", field: "account", message: "등록된 계정을 찾을 수 없습니다. 아이디를 확인해 주세요." };
      const { ok, code, message } = demoLogin(found.id, password);
      if (ok) return { kind: "success", mustChangePassword: false };
      if (code === "locked") return { kind: "locked", message };
      if (code === "inactive") return { kind: "rejected", field: "account", message };
      return { kind: "rejected", field: "password", message };
    },
    [users, demoLogin],
  );

  const demoSignOut = useCallback(async () => {
    clearLocalSession();
  }, [clearLocalSession]);

  const demoChangePassword = useCallback<AuthContextValue["changePassword"]>(
    async ({ currentPassword, newPassword }) => {
      const { ok, message } = requestPasswordChange(currentPassword, newPassword);
      return ok ? { kind: "success" } : { kind: "failed", message };
    },
    [requestPasswordChange],
  );

  const demoResetPassword = useCallback<AuthContextValue["resetPassword"]>(
    async () => ({ kind: "failed", message: AUTH_TEXT.resetDemoOnly }),
    [],
  );

  const value = useMemo<AuthContextValue>(() => {
    if (AUTH_MODE === "api") {
      const { status } = apiState;
      return {
        mode: "api",
        status,
        account: apiState.status === "signedIn" ? apiState.account : null,
        mustChangePassword: apiState.status === "signedIn" && apiState.account.mustChangePassword,
        signIn: apiSignIn,
        signOut: apiSignOut,
        changePassword: apiChangePassword,
        resetPassword: apiResetPassword,
        recheck,
      };
    }
    const status: AuthStatus = demoSignedIn ? "signedIn" : "signedOut";
    return {
      mode: "demo",
      status,
      account: null,
      mustChangePassword: false,
      signIn: demoSignIn,
      signOut: demoSignOut,
      changePassword: demoChangePassword,
      resetPassword: demoResetPassword,
      recheck: () => undefined,
    };
  }, [
    apiState,
    apiSignIn,
    apiSignOut,
    apiChangePassword,
    apiResetPassword,
    recheck,
    demoSignedIn,
    demoSignIn,
    demoSignOut,
    demoChangePassword,
    demoResetPassword,
  ]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export default AuthProvider;
