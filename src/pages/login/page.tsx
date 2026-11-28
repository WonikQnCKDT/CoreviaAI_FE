import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import BrandLogo from "@/components/ui/BrandLogo";
import { useDemoStore, DEMO_PASSWORD } from "@/stores/DemoStore";
import { isExecutive, isSystemAdmin, canCreateProject, canViewPortfolio, canViewProject } from "@/utils/permission";
import {
  clearSessionNotice,
  peekReturnTo,
  peekSessionNotice,
  takeReturnTo,
  type SessionNotice,
} from "@/features/auth/utils/session";
import { useAuth } from "@/features/auth/authContext";
import { AUTH_TEXT } from "@/features/auth/i18n/ko";
import type { Project, User } from "@/types";
import { BUTTON_TEXT } from "@/shared/i18n/catalog/button";
import { formatLabel } from "@/shared/i18n/store";

type FieldErrors = { account?: string; password?: string; form?: string };

const LOGIN_ID_MAX_LENGTH = 50;
const PASSWORD_INPUT_MAX_LENGTH = 128;

/** 로그인 후 복귀 경로가 현재 사용자의 접근 권한 안에 있는지 확인합니다. */
function resolveAccessPath(path: string | null, user: User, projects: Project[]): string {
  if (!path || !path.startsWith("/") || path.startsWith("/login")) return "/";
  if (path === "/demo-settings") return path;
  if (path === "/admin") return isSystemAdmin(user) ? path : "/";
  if (path === "/portfolio" || path.startsWith("/portfolio/")) {
    return canViewPortfolio(projects, user) ? path : "/";
  }
  if (path === "/projects/new" || path.startsWith("/projects/new/")) {
    return canCreateProject(user) ? path : "/projects";
  }
  const projectMatch = path.match(/^\/projects\/([^/?#]+)/);
  if (projectMatch) {
    const project = projects.find((p) => p.id === projectMatch[1]);
    if (!project || !canViewProject(project, user)) return "/projects";
    return path;
  }
  if (path === "/" || path === "/projects" || path === "/knowledge") return path;
  if (path.startsWith("/knowledge/")) return path;
  return "/";
}

export default function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { users, projects, getLoginState, unlockDemoAccount, currentUser } = useDemoStore();
  const { mode, status, signIn } = useAuth();
  const isApi = mode === "api";
  const signedIn = status === "signedIn";
  const [account, setAccount] = useState(isApi ? "" : "seoyeon.kim@corevia.co.kr");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [locked, setLocked] = useState(false);
  const [lockedMessage, setLockedMessage] = useState("");
  const [notice, setNotice] = useState("");
  const [selectKey, setSelectKey] = useState(0);
  // 첫 렌더에서 읽고, 저장된 값은 아래 effect에서 지워 새로고침 시 다시 보이지 않게 한다.
  const [sessionNotice, setSessionNotice] = useState<SessionNotice | null>(peekSessionNotice);
  const [offline, setOffline] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const controllerRef = useRef<AbortController | null>(null);

  const activeUsers = useMemo(() => users.filter((u) => u.active), [users]);

  const findDemoUser = (input: string) => {
    const value = input.trim().toLowerCase();
    return users.find((u) => u.email.toLowerCase() === value || u.name === input.trim() || u.id === value) || null;
  };

  const pendingPath = useMemo(() => {
    const fromState = (location.state as { from?: string } | null)?.from;
    return fromState || peekReturnTo() || null;
  }, [location.state]);

  // 만료·비밀번호 변경 안내는 저장된 값을 한 번만 읽고 즉시 삭제해 중복 표시를 막습니다.
  useEffect(() => {
    clearSessionNotice();
    const sync = () => setOffline(navigator.onLine === false);
    sync();
    window.addEventListener("online", sync);
    window.addEventListener("offline", sync);
    return () => {
      window.removeEventListener("online", sync);
      window.removeEventListener("offline", sync);
      controllerRef.current?.abort();
    };
  }, []);

  // 데모 모드: 잠금 여부는 데모 인증 저장소가 알려준 상태를 그대로 표시합니다.
  // api 모드: 계정 존재를 노출하지 않도록 미리 조회하지 않고, 로그인 응답(423)으로만 알립니다.
  useEffect(() => {
    if (isApi) {
      setLocked(false);
      setLockedMessage("");
      return;
    }
    const found = findDemoUser(account);
    if (!found) {
      setLocked(false);
      setLockedMessage("");
      return;
    }
    const serverState = getLoginState(found.id);
    setLocked(serverState.locked);
    setLockedMessage(serverState.locked ? "비밀번호 5회 연속 오류로 잠긴 계정입니다." : "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [account, users, getLoginState, isApi]);

  useEffect(() => {
    if (!signedIn) return;
    takeReturnTo();
    navigate(resolveAccessPath(pendingPath, currentUser, projects), { replace: true });
  }, [signedIn, navigate, pendingPath, currentUser, projects]);

  if (signedIn) return null;

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (submitting) return;
    const nextErrors: FieldErrors = {};
    setNotice("");

    if (!account.trim()) nextErrors.account = AUTH_TEXT.loginIdRequired;
    else if (account.trim().length > LOGIN_ID_MAX_LENGTH) nextErrors.account = AUTH_TEXT.loginIdTooLong;
    if (!password.trim()) nextErrors.password = AUTH_TEXT.passwordRequired;
    else if (password.length > PASSWORD_INPUT_MAX_LENGTH) nextErrors.password = AUTH_TEXT.passwordTooLong;
    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      return;
    }

    // 네트워크 오류는 인증 실패와 구분하며, 실패 횟수에 포함되지 않습니다.
    if (navigator.onLine === false) {
      setOffline(true);
      setErrors({ form: AUTH_TEXT.network });
      return;
    }

    controllerRef.current?.abort();
    const controller = new AbortController();
    controllerRef.current = controller;
    setSubmitting(true);
    const outcome = await signIn({ loginId: account, password, signal: controller.signal });
    if (controller.signal.aborted) return;
    setSubmitting(false);

    switch (outcome.kind) {
      case "success":
        // 이동은 signedIn 상태 변화를 보고 위 effect가 처리합니다.
        // 비밀번호 변경 강제 계정이면 이동한 화면에서 변경 창이 바로 열립니다.
        setErrors({});
        setPassword("");
        return;
      case "locked":
        setLocked(true);
        setLockedMessage(outcome.message);
        setErrors({ password: AUTH_TEXT.accountLockedShort });
        return;
      case "rejected":
        setErrors({ [outcome.field]: outcome.message });
        return;
      case "failed":
        setErrors({ form: outcome.message });
        return;
      default:
    }
  };

  const quickFill = (email: string) => {
    setAccount(email);
    setPassword(DEMO_PASSWORD);
    setErrors({});
    setNotice("데모 계정이 입력되었습니다. 로그인 버튼을 눌러 주세요.");
    setSelectKey((prev) => prev + 1);
  };

  const handleUnlock = () => {
    const found = findDemoUser(account);
    if (found) unlockDemoAccount(found.id);
    setLocked(false);
    setLockedMessage("");
    setErrors({});
    setNotice("데모 계정 잠금을 해제했습니다. 관리자 초기화를 시뮬레이션한 것입니다.");
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background-100 px-4 py-10">
      <div className="w-full max-w-[400px]">
        <div className="mb-6 flex flex-col items-center text-center">
          <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary-500 text-background-50">
            <BrandLogo className="h-[24px] w-auto" />
          </span>
          <span className="mt-3 text-[17px] font-semibold tracking-tight text-foreground-950">CoreviaAI</span>
          <h1 className="mt-4 text-[20px] font-semibold text-foreground-950">{AUTH_TEXT.loginTitle}</h1>
          <p className="mt-1 text-[12.5px] text-foreground-600">{AUTH_TEXT.loginSubtitle}</p>
        </div>

        {sessionNotice && (
          <div className="mb-3 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5" role="alert">
            <i
              className={`${sessionNotice.reason === "passwordChanged" ? "ri-lock-password-line" : "ri-time-line"} mt-0.5 text-[13px] text-amber-600`}
              aria-hidden="true"
            />
            <div className="min-w-0 flex-1">
              <p className="text-[12px] font-semibold text-amber-900">{sessionNotice.title}</p>
              <p className="mt-0.5 text-[11px] leading-4 text-amber-800">{sessionNotice.note}</p>
            </div>
            <button
              type="button"
              aria-label={BUTTON_TEXT.closeNotice}
              title={BUTTON_TEXT.close}
              onClick={() => setSessionNotice(null)}
              className="flex h-6 w-6 shrink-0 cursor-pointer items-center justify-center rounded text-amber-700 hover:bg-amber-100"
            >
              <i className="ri-close-line" aria-hidden="true" />
            </button>
          </div>
        )}

        <form className="card space-y-3.5 p-5 md:p-6" onSubmit={handleSubmit} noValidate aria-busy={submitting}>
          <div>
            <label htmlFor="login-account" className="mb-1.5 block text-[12px] font-medium text-foreground-800">
              {isApi ? AUTH_TEXT.loginIdLabel : AUTH_TEXT.loginIdEmailLabel}
            </label>
            <div className="relative">
              <i
                className="ri-user-line pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[14px] text-foreground-400"
                aria-hidden="true"
              />
              <input
                id="login-account"
                name="account"
                type="text"
                autoComplete="username"
                maxLength={LOGIN_ID_MAX_LENGTH}
                className={`field pl-9 text-[13px] ${errors.account ? "border-rose-300" : ""}`}
                placeholder={isApi ? AUTH_TEXT.loginIdPlaceholder : "name@corevia.co.kr"}
                value={account}
                onChange={(event) => {
                  setAccount(event.target.value);
                  setLocked(false);
                  setErrors((prev) => ({ ...prev, account: undefined, form: undefined }));
                }}
                aria-invalid={Boolean(errors.account)}
                aria-describedby={errors.account ? "login-account-error" : undefined}
              />
            </div>
            {errors.account && (
              <p id="login-account-error" role="alert" className="mt-1 flex items-center gap-1 text-[11px] text-rose-600">
                <i className="ri-error-warning-line" aria-hidden="true" /> {errors.account}
              </p>
            )}
          </div>

          <div>
            <label htmlFor="login-password" className="mb-1.5 block text-[12px] font-medium text-foreground-800">
              {AUTH_TEXT.passwordLabel}
            </label>
            <div className="relative">
              <i
                className="ri-lock-line pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[14px] text-foreground-400"
                aria-hidden="true"
              />
              <input
                id="login-password"
                name="password"
                type={showPassword ? "text" : "password"}
                autoComplete="current-password"
                maxLength={PASSWORD_INPUT_MAX_LENGTH}
                className={`field px-9 text-[13px] ${errors.password ? "border-rose-300" : ""}`}
                placeholder={AUTH_TEXT.passwordPlaceholder}
                value={password}
                onChange={(event) => {
                  setPassword(event.target.value);
                  setErrors((prev) => ({ ...prev, password: undefined, form: undefined }));
                }}
                aria-invalid={Boolean(errors.password)}
                aria-describedby={errors.password ? "login-password-error" : "login-password-hint"}
              />
              <button
                type="button"
                onClick={() => setShowPassword((prev) => !prev)}
                aria-label={showPassword ? BUTTON_TEXT.hidePassword : BUTTON_TEXT.showPassword}
                title={showPassword ? BUTTON_TEXT.hide : BUTTON_TEXT.show}
                className="absolute right-1.5 top-1/2 flex h-7 w-7 -translate-y-1/2 cursor-pointer items-center justify-center rounded text-foreground-500 hover:bg-background-200 hover:text-foreground-800"
              >
                <i className={showPassword ? "ri-eye-off-line" : "ri-eye-line"} aria-hidden="true" />
              </button>
            </div>
            {errors.password && (
              <p id="login-password-error" role="alert" className="mt-1 flex items-start gap-1 text-[11px] leading-4 text-rose-600">
                <i className="ri-error-warning-line mt-0.5" aria-hidden="true" /> {errors.password}
              </p>
            )}
            <p id="login-password-hint" className="mt-1 text-[11px] leading-4 text-foreground-500">
              {AUTH_TEXT.lockoutHint}
            </p>
          </div>

          {locked && (
            <div className="rounded-lg border border-background-300 bg-background-100 px-3 py-2.5">
              <p className="flex items-start gap-1.5 text-[12px] leading-5 text-foreground-700">
                <i className="ri-lock-2-line mt-0.5 text-[13px] text-foreground-500" aria-hidden="true" />
                <span>{lockedMessage || AUTH_TEXT.accountLocked}</span>
              </p>
              {!isApi && (
                <button type="button" onClick={handleUnlock} className="btn-outline mt-2 w-full py-1.5 text-[12px]">
                  <i className="ri-lock-unlock-line" aria-hidden="true" />
                  {BUTTON_TEXT.unlockDemoAccount}
                </button>
              )}
            </div>
          )}

          {errors.form && (
            <p
              role="alert"
              className="flex items-start gap-1.5 rounded-md border border-background-300 bg-background-100 px-2.5 py-2 text-[12px] leading-5 text-foreground-700"
            >
              <i
                className={`${offline ? "ri-wifi-off-line" : "ri-error-warning-line"} mt-0.5 text-[13px] text-foreground-500`}
                aria-hidden="true"
              />
              {errors.form}
            </p>
          )}

          {notice && (
            <p
              role="status"
              className="rounded-md border border-background-300 bg-background-100 px-2.5 py-2 text-[12px] leading-5 text-foreground-700"
            >
              <i className="ri-information-line mr-1" aria-hidden="true" />
              {notice}
            </p>
          )}

          <button
            type="submit"
            className="btn-primary w-full py-2.5 text-[13.5px]"
            disabled={submitting || (!isApi && locked)}
          >
            {submitting ? (
              <>
                <i className="ri-loader-4-line animate-spin motion-reduce:animate-none" aria-hidden="true" />
                {BUTTON_TEXT.signingIn}
              </>
            ) : (
              BUTTON_TEXT.signIn
            )}
          </button>
        </form>

        {!isApi && (
          <div className="mt-4 rounded-lg border border-background-300 bg-background-50 p-3.5">
            <label htmlFor="demo-account" className="block text-[12px] font-medium text-foreground-700">
              데모 계정
            </label>
            <select
              key={selectKey}
              id="demo-account"
              className="field mt-1.5 text-[12.5px]"
              defaultValue=""
              onChange={(event) => {
                if (event.target.value) quickFill(event.target.value);
              }}
            >
              <option value="">계정을 선택하면 자동 입력됩니다</option>
              {activeUsers.map((user) => (
                <option key={user.id} value={user.email}>
                  {user.name} · {isSystemAdmin(user) ? "시스템 관리자" : isExecutive(user) ? "경영진" : user.dept}
                </option>
              ))}
            </select>
            <p className="mt-1.5 text-[11px] leading-4 text-foreground-500">
              데모 고정 비밀번호 <span className="font-mono text-foreground-700">corevia1234</span> · 실제 인증 서버 미연결
            </p>
          </div>
        )}

        <p className="mt-4 text-center text-[11px] leading-4 text-foreground-500">
          {formatLabel(AUTH_TEXT.loginFooterPolicy, { policy: AUTH_TEXT.passwordPolicy })}
        </p>
      </div>
    </div>
  );
}
