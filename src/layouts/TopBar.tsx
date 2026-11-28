import { useMemo, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useDemoStore } from "@/stores/DemoStore";
import Avatar from "@/components/ui/Avatar";
import Modal from "@/components/ui/Modal";
import PasswordChangeModal from "@/features/auth/components/PasswordChangeModal";
import { useAuth } from "@/features/auth/authContext";
import NotificationBell from "@/features/notification/components/NotificationBell";
import ServerNotificationBell from "@/features/notification/components/ServerNotificationBell";
import { SYSTEM_ROLE_LABEL } from "@/utils/permission";
import { getUnsavedGuard } from "@/utils/navGuard";
import { displayProjectProgress } from "@/features/task/utils/taskTree";
import { HEALTH_DOT, HEALTH_LABEL, STAGE_LABEL, riskLevel } from "@/utils/ui";
import { BUTTON_TEXT } from "@/shared/i18n/catalog/button";
import { COMMON_UI_TEXT, TOPBAR_TEXT } from "@/shared/i18n/catalog/common";
import { MENU_TEXT } from "@/shared/i18n/catalog/menu";
import { formatLabel } from "@/shared/i18n/store";
import LanguageMenu from "@/layouts/LanguageMenu";

interface PageMeta {
  title: string;
}

/** 경로별 제목. 문구는 렌더링할 때 읽어 현재 언어를 따른다. */
const STATIC_TITLE: Record<string, () => string> = {
  "/": () => MENU_TEXT.myWork,
  "/projects": () => MENU_TEXT.projects,
  "/projects/new": () => MENU_TEXT.projectCreate,
  "/knowledge": () => MENU_TEXT.knowledge,
  "/portfolio": () => MENU_TEXT.portfolio,
  "/admin": () => MENU_TEXT.admin,
  "/demo-settings": () => MENU_TEXT.demoSettings,
};

export default function TopBar({ onOpenMenu }: { onOpenMenu: () => void }) {
  const location = useLocation();
  const navigate = useNavigate();
  const { projects, tasks, currentUser, activeTaskId, closeTask } = useDemoStore();
  const { mode, signOut } = useAuth();
  const [signingOut, setSigningOut] = useState(false);
  const [userOpen, setUserOpen] = useState(false);
  const [pwOpen, setPwOpen] = useState(false);
  const [leaveOpen, setLeaveOpen] = useState(false);

  const meta = useMemo<PageMeta>(() => {
    const staticTitle = STATIC_TITLE[location.pathname];
    if (staticTitle) return { title: staticTitle() };
    const match = location.pathname.match(/^\/projects\/([^/]+)/);
    if (match) {
      const project = projects.find((p) => p.id === match[1]);
      // 프로젝트명은 상단 제목에서 한 번만 표시합니다. 경로 안내에는 반복하지 않습니다.
      if (project) return { title: project.name };
    }
    return { title: MENU_TEXT.myWork };
  }, [location.pathname, projects]);

  // 프로젝트 화면에서는 제목 아래 한 줄 요약만 보여 줍니다. 큰 카드로 다시 만들지 않습니다.
  const activeProject = useMemo(() => {
    const match = location.pathname.match(/^\/projects\/([^/]+)/);
    if (!match || match[1] === "new") return null;
    return projects.find((p) => p.id === match[1]) || null;
  }, [location.pathname, projects]);

  const summary = useMemo(() => {
    if (!activeProject) return null;
    const level = riskLevel(activeProject.riskScore);
    return {
      progress: displayProjectProgress(tasks, activeProject),
      stage: STAGE_LABEL[activeProject.stage],
      score: activeProject.riskScore,
      level,
      levelLabel: HEALTH_LABEL[level],
    };
  }, [activeProject, tasks]);

  const backFallback = useMemo(() => {
    if (location.pathname.startsWith("/projects/")) return "/projects";
    return "/";
  }, [location.pathname]);

  const historyIndex = (window.history.state as { idx?: number } | null)?.idx ?? 0;
  const showBack = location.pathname !== "/" || historyIndex > 0;

  const goBackTo = (fallback: string) => {
    // 실제 브라우저 방문 이력이 있을 때만 이전 화면으로 이동합니다.
    const idx = (window.history.state as { idx?: number } | null)?.idx ?? 0;
    if (idx > 0) navigate(-1);
    else navigate(fallback, { replace: true });
  };

  const handleBack = () => {
    if (activeTaskId) {
      closeTask();
      return;
    }
    if (getUnsavedGuard()) {
      setLeaveOpen(true);
      return;
    }
    goBackTo(backFallback);
  };

  return (
    <header className="sticky top-0 z-30 border-b border-background-300 bg-background-50">
      <div className="flex min-h-16 items-center gap-3 px-4 py-2 md:px-6">
        <button
          type="button"
          onClick={onOpenMenu}
          aria-label={BUTTON_TEXT.openMenu}
          className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-md border border-background-300 text-foreground-600 lg:hidden"
        >
          <i className="ri-menu-line" />
        </button>

        {showBack && (
          <button
            type="button"
            onClick={handleBack}
            aria-label={BUTTON_TEXT.goBack}
            title={BUTTON_TEXT.hintGoBack}
            className="flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-md border border-background-300 bg-background-50 text-foreground-600 hover:bg-background-100"
          >
            <i className="ri-arrow-left-line text-[16px]" aria-hidden="true" />
          </button>
        )}

        <div className="min-w-0 flex-1">
          <h1 className="truncate text-[17px] font-semibold leading-6 text-foreground-950">{meta.title}</h1>
          {summary && (
            <p className="mt-0.5 flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-[11.5px] leading-4 text-foreground-500">
              <span className="whitespace-nowrap">
                {TOPBAR_TEXT.progress} <span className="font-semibold tabular-nums text-primary-600">{summary.progress === null ? "-" : `${summary.progress}%`}</span>
              </span>
              <span aria-hidden="true" className="text-foreground-300">
                ·
              </span>
              <span className="whitespace-nowrap">{formatLabel(TOPBAR_TEXT.currentStage, { stage: summary.stage })}</span>
              <span aria-hidden="true" className="text-foreground-300">
                ·
              </span>
              <span className="flex items-center gap-1 whitespace-nowrap">
                <span className={`h-1.5 w-1.5 rounded-full ${HEALTH_DOT[summary.level]}`} aria-hidden="true" />
                {summary.levelLabel} <span className="tabular-nums">{formatLabel(COMMON_UI_TEXT.scoreUnit, { score: summary.score })}</span>
              </span>
            </p>
          )}
        </div>

        <div className="flex items-center gap-2">
          {/* api 모드는 서버 알림(12. 알림 API), 데모 모드는 데모 알림 */}
          {mode === "api" ? <ServerNotificationBell /> : <NotificationBell />}

          <div className="relative">
            <button
              type="button"
              onClick={() => setUserOpen((prev) => !prev)}
              className="flex h-12 cursor-pointer items-center gap-2 rounded-md border border-background-300 bg-background-50 py-0 pl-1.5 pr-3 hover:bg-background-100"
            >
              <Avatar name={currentUser.name} size="sm" />
              <span className="hidden min-w-0 text-left sm:block">
                <span className="block max-w-[140px] truncate text-[12.5px] font-medium leading-4 text-foreground-900">
                  {currentUser.name}
                </span>
                <span className="block max-w-[140px] truncate text-[10.5px] leading-4 text-foreground-500">
                  {SYSTEM_ROLE_LABEL[currentUser.systemRole]}
                </span>
              </span>
              <i className="ri-arrow-down-s-line shrink-0 text-[13px] text-foreground-400" aria-hidden="true" />
            </button>
            {userOpen && (
              <>
                <button
                  type="button"
                  aria-label={BUTTON_TEXT.closeUserMenu}
                  className="fixed inset-0 z-30 cursor-default"
                  onClick={() => setUserOpen(false)}
                />
                <div className="absolute right-0 z-40 mt-2 w-[258px] overflow-hidden rounded-xl border border-background-300 bg-background-50 shadow-panel">
                  <div className="border-b border-background-200 px-4 py-3">
                    <p className="text-[13px] font-semibold text-foreground-950">{currentUser.name}</p>
                    <p className="mt-0.5 text-[11.5px] text-foreground-600">{currentUser.email}</p>
                    <div className="mt-2 flex flex-wrap gap-1">
                      <span className="rounded border border-primary-200 bg-primary-50 px-1.5 py-[1px] text-[10px] text-primary-700">
                        {SYSTEM_ROLE_LABEL[currentUser.systemRole]}
                      </span>
                    </div>
                  </div>
                  <LanguageMenu />
                  <div className="p-1.5">
                    <Link
                      to="/demo-settings"
                      onClick={() => setUserOpen(false)}
                      className="flex items-center gap-2 rounded-md px-2.5 py-2 text-[12.5px] text-foreground-700 hover:bg-background-100"
                    >
                      <i className="ri-flask-line" /> {BUTTON_TEXT.switchDemoAccount}
                    </Link>
                    <button
                      type="button"
                      onClick={() => {
                        setPwOpen(true);
                        setUserOpen(false);
                      }}
                      className="flex w-full cursor-pointer items-center gap-2 rounded-md px-2.5 py-2 text-left text-[12.5px] text-foreground-700 hover:bg-background-100"
                    >
                      <i className="ri-lock-password-line" /> {BUTTON_TEXT.changePassword}
                    </button>
                    <button
                      type="button"
                      disabled={signingOut}
                      onClick={async () => {
                        // 중복 클릭 방지. 서버 로그아웃이 실패해도(멱등 API) 화면은 로그아웃한다.
                        if (signingOut) return;
                        setSigningOut(true);
                        await signOut();
                        setSigningOut(false);
                        setUserOpen(false);
                        navigate("/login", { replace: true });
                      }}
                      className="flex w-full cursor-pointer items-center gap-2 rounded-md px-2.5 py-2 text-left text-[12.5px] text-rose-600 hover:bg-rose-50 disabled:cursor-wait disabled:opacity-60"
                    >
                      <i className="ri-logout-box-r-line" aria-hidden="true" /> {signingOut ? BUTTON_TEXT.signingOut : BUTTON_TEXT.logout}
                    </button>
                    {mode === "demo" && (
                      <span className="mt-1 block rounded-md bg-background-100 px-2.5 py-2 text-[11px] leading-4 text-foreground-500">
                        {TOPBAR_TEXT.demoSessionNote}
                      </span>
                    )}
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      <PasswordChangeModal open={pwOpen} onClose={() => setPwOpen(false)} />

      <Modal
        open={leaveOpen}
        title={TOPBAR_TEXT.unsavedTitle}
        description={TOPBAR_TEXT.unsavedDescription}
        onClose={() => setLeaveOpen(false)}
        width="max-w-md"
        footer={
          <>
            <button type="button" className="btn-outline whitespace-nowrap" onClick={() => setLeaveOpen(false)}>
              {BUTTON_TEXT.keepWriting}
            </button>
            <button
              type="button"
              className="btn-primary whitespace-nowrap"
              onClick={() => {
                setLeaveOpen(false);
                goBackTo(backFallback);
              }}
            >
              {BUTTON_TEXT.leave}
            </button>
          </>
        }
      >
        <p className="text-[12.5px] leading-6 text-foreground-700">
          {TOPBAR_TEXT.unsavedBody}
        </p>
      </Modal>
    </header>
  );
}