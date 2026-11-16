import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import BrandLogo from "@/components/ui/BrandLogo";
import { useDemoStore, DEMO_PASSWORD } from "@/stores/DemoStore";
import { isExecutive, isSystemAdmin, canCreateProject, canViewPortfolio, canViewProject } from "@/utils/permission";
import { consumeSessionNotice, peekReturnTo, takeReturnTo, type SessionNotice } from "@/features/auth/utils/session";
import { PASSWORD_POLICY_TEXT } from "@/features/auth/utils/password";
import type { Project, User } from "@/types";

type FieldErrors = { account?: string; password?: string; form?: string };

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
  const { users, projects, login, getLoginState, unlockDemoAccount, signedIn, currentUser } = useDemoStore();
  const [account, setAccount] = useState("seoyeon.kim@corevia.co.kr");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [locked, setLocked] = useState(false);
  const [lockedMessage, setLockedMessage] = useState("");
  const [notice, setNotice] = useState("");
  const [selectKey, setSelectKey] = useState(0);
  const [sessionNotice, setSessionNotice] = useState<SessionNotice | null>(null);
  const [offline, setOffline] = useState(false);

  const activeUsers = useMemo(() => users.filter((u) => u.active), [users]);

  const findUser = (input: string) => {
    const value = input.trim().toLowerCase();
    return users.find((u) => u.email.toLowerCase() === value || u.name === input.trim() || u.id === value) || null;
  };

  const pendingPath = useMemo(() => {
    const fromState = (location.state as { from?: string } | null)?.from;
    return fromState || peekReturnTo() || null;
  }, [location.state]);

  // 만료 안내는 저장된 값을 한 번만 읽고 즉시 삭제해 중복 표시를 막습니다.
  useEffect(() => {
    setSessionNotice(consumeSessionNotice());
    const sync = () => setOffline(navigator.onLine === false);
    sync();
    window.addEventListener("online", sync);
    window.addEventListener("offline", sync);
    return () => {
      window.removeEventListener("online", sync);
      window.removeEventListener("offline", sync);
    };
  }, []);

  // 잠금 여부는 인증 서버(데모)가 알려준 상태만 그대로 표시합니다.
  useEffect(() => {
    const found = findUser(account);
    if (!found) {
      setLocked(false);
      setLockedMessage("");
      return;
    }
    const serverState = getLoginState(found.id);
    setLocked(serverState.locked);
    setLockedMessage(serverState.locked ? "비밀번호 5회 연속 오류로 잠긴 계정입니다." : "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [account, users, getLoginState]);

  useEffect(() => {
    if (!signedIn) return;
    takeReturnTo();
    navigate(resolveAccessPath(pendingPath, currentUser, projects), { replace: true });
  }, [signedIn, navigate, pendingPath, currentUser, projects]);

  if (signedIn) return null;

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const nextErrors: FieldErrors = {};
    setNotice("");

    if (!account.trim()) nextErrors.account = "아이디를 입력해 주세요.";
    if (!password) nextErrors.password = "비밀번호를 입력해 주세요.";
    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      return;
    }

    const found = findUser(account);
    if (!found) {
      setErrors({ account: "등록된 계정을 찾을 수 없습니다. 아이디를 확인해 주세요." });
      return;
    }

    // 네트워크 오류는 인증 실패와 구분하며, 실패 횟수에 포함되지 않습니다.
    if (navigator.onLine === false) {
      setOffline(true);
      setErrors({ form: "네트워크 연결이 끊겨 로그인 서버에 연결하지 못했습니다. 연결 상태를 확인한 뒤 다시 시도해 주세요." });
      return;
    }

    const result = login(found.id, password);
    if (result.ok) {
      setErrors({});
      takeReturnTo();
      const signedUser = users.find((u) => u.id === found.id) || currentUser;
      navigate(resolveAccessPath(pendingPath, signedUser, projects), { replace: true });
      return;
    }

    if (result.code === "locked") {
      setLocked(true);
      setLockedMessage(result.message);
      setErrors({ password: "계정이 잠겨 있습니다." });
      return;
    }

    if (result.code === "inactive") {
      setErrors({ account: result.message });
      return;
    }

    setErrors({ password: result.message });
  };

  const quickFill = (email: string) => {
    setAccount(email);
    setPassword(DEMO_PASSWORD);
    setErrors({});
    setNotice("데모 계정이 입력되었습니다. 로그인 버튼을 눌러 주세요.");
    setSelectKey((prev) => prev + 1);
  };

  const handleUnlock = () => {
    const found = findUser(account);
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
          <h1 className="mt-4 text-[20px] font-semibold text-foreground-950">로그인</h1>
          <p className="mt-1 text-[12.5px] text-foreground-600">사내 계정으로 로그인해 주세요.</p>
        </div>

        {sessionNotice && (
          <div className="mb-3 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5" role="alert">
            <i className="ri-time-line mt-0.5 text-[13px] text-amber-600" aria-hidden="true" />
            <div className="min-w-0 flex-1">
              <p className="text-[12px] font-semibold text-amber-900">{sessionNotice.title}</p>
              <p className="mt-0.5 text-[11px] leading-4 text-amber-800">{sessionNotice.note}</p>
            </div>
            <button
              type="button"
              aria-label="안내 닫기"
              title="닫기"
              onClick={() => setSessionNotice(null)}
              className="flex h-6 w-6 shrink-0 cursor-pointer items-center justify-center rounded text-amber-700 hover:bg-amber-100"
            >
              <i className="ri-close-line" aria-hidden="true" />
            </button>
          </div>
        )}

        <form className="card space-y-3.5 p-5 md:p-6" onSubmit={handleSubmit} noValidate>
          <div>
            <label htmlFor="login-account" className="mb-1.5 block text-[12px] font-medium text-foreground-800">
              아이디 (이메일)
            </label>
            <div className="relative">
              <i className="ri-user-line pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[14px] text-foreground-400" />
              <input
                id="login-account"
                name="account"
                type="text"
                autoComplete="username"
                className={`field pl-9 text-[13px] ${errors.account ? "border-rose-300" : ""}`}
                placeholder="name@corevia.co.kr"
                value={account}
                onChange={(event) => {
                  setAccount(event.target.value);
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
              비밀번호
            </label>
            <div className="relative">
              <i className="ri-lock-line pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[14px] text-foreground-400" />
              <input
                id="login-password"
                name="password"
                type={showPassword ? "text" : "password"}
                autoComplete="current-password"
                className={`field px-9 text-[13px] ${errors.password ? "border-rose-300" : ""}`}
                placeholder="비밀번호 입력"
                value={password}
                onChange={(event) => {
                  setPassword(event.target.value);
                  setErrors((prev) => ({ ...prev, password: undefined, form: undefined }));
                }}
                aria-invalid={Boolean(errors.password)}
                aria-describedby={errors.password ? "login-password-error" : undefined}
              />
              <button
                type="button"
                onClick={() => setShowPassword((prev) => !prev)}
                aria-label={showPassword ? "비밀번호 숨기기" : "비밀번호 표시"}
                title={showPassword ? "숨기기" : "표시"}
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
            <p className="mt-1 text-[10.5px] leading-4 text-foreground-500">5회 연속 실패하면 계정이 잠깁니다.</p>
          </div>

          {locked && (
            <div className="rounded-lg border border-background-300 bg-background-100 px-3 py-2.5">
              <p className="flex items-start gap-1.5 text-[11.5px] leading-5 text-foreground-700">
                <i className="ri-lock-2-line mt-0.5 text-[13px] text-foreground-500" aria-hidden="true" />
                <span>
                  {lockedMessage || "비밀번호 5회 연속 오류로 잠긴 계정입니다."} 잠금 시간과 해제 방식은 기존 인증 정책을
                  따릅니다.
                </span>
              </p>
              <button
                type="button"
                onClick={handleUnlock}
                className="btn-outline mt-2 w-full py-1.5 text-[11.5px]"
              >
                <i className="ri-lock-unlock-line" />
                데모 계정 잠금 해제
              </button>
            </div>
          )}

          {errors.form && (
            <p role="alert" className="flex items-start gap-1.5 rounded-md border border-background-300 bg-background-100 px-2.5 py-2 text-[11.5px] leading-5 text-foreground-700">
              <i className="ri-wifi-off-line mt-0.5 text-[13px] text-foreground-500" aria-hidden="true" />
              {errors.form}
            </p>
          )}

          {notice && (
            <p role="status" className="rounded-md border border-background-300 bg-background-100 px-2.5 py-2 text-[11.5px] leading-5 text-foreground-700">
              <i className="ri-information-line mr-1" aria-hidden="true" />
              {notice}
            </p>
          )}

          <button type="submit" className="btn-primary w-full py-2.5 text-[13.5px]" disabled={locked}>
            로그인
          </button>
        </form>

        <div className="mt-4 rounded-lg border border-background-300 bg-background-50 p-3.5">
          <label htmlFor="demo-account" className="block text-[11.5px] font-medium text-foreground-700">
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
          <p className="mt-1.5 text-[10.5px] leading-4 text-foreground-500">
            데모 고정 비밀번호 <span className="font-mono text-foreground-700">corevia1234</span> · 실제 인증 서버 미연결
          </p>
        </div>

        <p className="mt-4 text-center text-[10.5px] leading-4 text-foreground-400">
          비밀번호 정책: {PASSWORD_POLICY_TEXT} · 회원가입·소셜 로그인은 제공하지 않습니다.
        </p>
      </div>
    </div>
  );
}