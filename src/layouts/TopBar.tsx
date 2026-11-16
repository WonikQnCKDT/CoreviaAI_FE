import { useMemo, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useDemoStore } from "@/stores/DemoStore";
import Avatar from "@/components/ui/Avatar";
import Modal from "@/components/ui/Modal";
import PasswordChangeModal from "@/features/auth/components/PasswordChangeModal";
import NotificationBell from "@/features/notification/components/NotificationBell";
import { SYSTEM_ROLE_LABEL } from "@/utils/permission";
import { getUnsavedGuard } from "@/utils/navGuard";
import { projectProgress } from "@/features/task/utils/taskTree";
import { HEALTH_DOT, HEALTH_LABEL, STAGE_LABEL, riskLevel } from "@/utils/ui";

interface PageMeta {
  title: string;
}

const STATIC_META: Record<string, PageMeta> = {
  "/": { title: "내 업무" },
  "/projects": { title: "프로젝트" },
  "/projects/new": { title: "프로젝트 생성" },
  "/knowledge": { title: "지식 허브" },
  "/portfolio": { title: "전체 현황" },
  "/admin": { title: "시스템 관리" },
  "/demo-settings": { title: "데모 설정" },
};

export default function TopBar({ onOpenMenu }: { onOpenMenu: () => void }) {
  const location = useLocation();
  const navigate = useNavigate();
  const { projects, tasks, currentUser, activeTaskId, closeTask, logout } = useDemoStore();
  const [userOpen, setUserOpen] = useState(false);
  const [pwOpen, setPwOpen] = useState(false);
  const [leaveOpen, setLeaveOpen] = useState(false);

  const meta = useMemo<PageMeta>(() => {
    const staticMeta = STATIC_META[location.pathname];
    if (staticMeta) return staticMeta;
    const match = location.pathname.match(/^\/projects\/([^/]+)/);
    if (match) {
      const project = projects.find((p) => p.id === match[1]);
      // 프로젝트명은 상단 제목에서 한 번만 표시합니다. 경로 안내에는 반복하지 않습니다.
      if (project) return { title: project.name };
    }
    return { title: "내 업무" };
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
      progress: projectProgress(tasks, activeProject.id),
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
          aria-label="메뉴 열기"
          className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-md border border-background-300 text-foreground-600 lg:hidden"
        >
          <i className="ri-menu-line" />
        </button>

        {showBack && (
          <button
            type="button"
            onClick={handleBack}
            aria-label="뒤로 가기"
            title="이전 화면으로"
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
                진척률 <span className="font-semibold tabular-nums text-primary-600">{summary.progress}%</span>
              </span>
              <span aria-hidden="true" className="text-foreground-300">
                ·
              </span>
              <span className="whitespace-nowrap">현재 단계 {summary.stage}</span>
              <span aria-hidden="true" className="text-foreground-300">
                ·
              </span>
              <span className="flex items-center gap-1 whitespace-nowrap">
                <span className={`h-1.5 w-1.5 rounded-full ${HEALTH_DOT[summary.level]}`} aria-hidden="true" />
                {summary.levelLabel} <span className="tabular-nums">{summary.score}점</span>
              </span>
            </p>
          )}
        </div>

        <div className="flex items-center gap-2">
          <NotificationBell />

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
                  aria-label="사용자 메뉴 닫기"
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
                      {currentUser.canCreateProject && (
                        <span className="rounded border border-emerald-200 bg-emerald-50 px-1.5 py-[1px] text-[10px] text-emerald-700">
                          프로젝트 생성 가능
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="p-1.5">
                    <Link
                      to="/demo-settings"
                      onClick={() => setUserOpen(false)}
                      className="flex items-center gap-2 rounded-md px-2.5 py-2 text-[12.5px] text-foreground-700 hover:bg-background-100"
                    >
                      <i className="ri-flask-line" /> 데모 계정 전환
                    </Link>
                    <button
                      type="button"
                      onClick={() => {
                        setPwOpen(true);
                        setUserOpen(false);
                      }}
                      className="flex w-full cursor-pointer items-center gap-2 rounded-md px-2.5 py-2 text-left text-[12.5px] text-foreground-700 hover:bg-background-100"
                    >
                      <i className="ri-lock-password-line" /> 비밀번호 변경
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setUserOpen(false);
                        logout();
                        navigate("/login", { replace: true });
                      }}
                      className="flex w-full cursor-pointer items-center gap-2 rounded-md px-2.5 py-2 text-left text-[12.5px] text-rose-600 hover:bg-rose-50"
                    >
                      <i className="ri-logout-box-r-line" /> 로그아웃
                    </button>
                    <span className="mt-1 block rounded-md bg-background-100 px-2.5 py-2 text-[11px] leading-4 text-foreground-500">
                      데모 세션입니다. 실제 인증·세션 관리는 연결되어 있지 않습니다.
                    </span>
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
        title="저장하지 않은 내용이 있습니다"
        description="이 화면에서 나가면 작성 중인 내용은 저장되지 않습니다."
        onClose={() => setLeaveOpen(false)}
        width="max-w-md"
        footer={
          <>
            <button type="button" className="btn-outline whitespace-nowrap" onClick={() => setLeaveOpen(false)}>
              계속 작성
            </button>
            <button
              type="button"
              className="btn-primary whitespace-nowrap"
              onClick={() => {
                setLeaveOpen(false);
                goBackTo(backFallback);
              }}
            >
              나가기
            </button>
          </>
        }
      >
        <p className="text-[12.5px] leading-6 text-foreground-700">
          저장하지 않은 입력이 있을 때만 이 확인을 표시합니다. 입력을 마무리하려면 계속 작성하기를 선택해 주세요.
        </p>
      </Modal>
    </header>
  );
}