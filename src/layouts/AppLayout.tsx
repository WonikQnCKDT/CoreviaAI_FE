import { useEffect, useRef, useState } from "react";
import type { CSSProperties, PointerEvent as ReactPointerEvent } from "react";
import { Navigate, Outlet, useLocation, useNavigate } from "react-router-dom";
import Sidebar from "@/layouts/Sidebar";
import TopBar from "@/layouts/TopBar";
import TaskDetailPanel from "@/features/task/components/TaskDetailPanel";
import { useSessionGuard } from "@/features/auth/hooks/useSessionGuard";
import { useAuth } from "@/features/auth/authContext";
import AuthStatusScreen from "@/features/auth/components/AuthStatusScreen";
import PasswordChangeModal from "@/features/auth/components/PasswordChangeModal";

const SIDEBAR_STORAGE_KEY = "corevia-sidebar-collapsed";
const SIDEBAR_WIDTH_KEY = "corevia-sidebar-width";
const SIDEBAR_MIN = 180;
const SIDEBAR_MAX = 360;
const SIDEBAR_DEFAULT = 220;

function loadCollapsed(): boolean {
  try {
    return localStorage.getItem(SIDEBAR_STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

function loadWidth(): number {
  try {
    const saved = Number(localStorage.getItem(SIDEBAR_WIDTH_KEY));
    if (Number.isFinite(saved) && saved >= SIDEBAR_MIN && saved <= SIDEBAR_MAX) return saved;
  } catch {
    // 저장된 값이 없으면 기본 폭을 사용합니다.
  }
  return SIDEBAR_DEFAULT;
}

export default function AppLayout() {
  const [menuOpen, setMenuOpen] = useState(false);
  // 사용자가 직접 접고 편 상태를 기억합니다. 화면 이동이나 크기 변경으로 자동 펼침되지 않습니다.
  const [collapsed, setCollapsed] = useState<boolean>(loadCollapsed);
  // 사용자가 드래그로 조절한 메뉴 폭도 함께 기억합니다.
  const [sidebarWidth, setSidebarWidth] = useState<number>(loadWidth);
  const widthRef = useRef(sidebarWidth);
  const { status, mustChangePassword, recheck } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const { offline } = useSessionGuard();

  useEffect(() => {
    try {
      localStorage.setItem(SIDEBAR_STORAGE_KEY, collapsed ? "1" : "0");
    } catch {
      // 저장에 실패해도 화면 동작에는 영향이 없습니다.
    }
  }, [collapsed]);

  useEffect(() => {
    widthRef.current = sidebarWidth;
    try {
      localStorage.setItem(SIDEBAR_WIDTH_KEY, String(sidebarWidth));
    } catch {
      // 저장에 실패해도 화면 동작에는 영향이 없습니다.
    }
  }, [sidebarWidth]);

  const startResize = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (typeof window === "undefined" || window.innerWidth < 1024) return;
    event.preventDefault();
    const startX = event.clientX;
    const startWidth = widthRef.current;
    document.body.style.userSelect = "none";
    document.body.style.cursor = "col-resize";

    const onMove = (moveEvent: PointerEvent) => {
      const next = Math.min(Math.max(startWidth + (moveEvent.clientX - startX), SIDEBAR_MIN), SIDEBAR_MAX);
      setSidebarWidth(Math.round(next));
    };

    const onUp = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      document.body.style.userSelect = "";
      document.body.style.cursor = "";
    };

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  };

  if (status === "checking") return <AuthStatusScreen kind="checking" />;
  if (status === "unreachable") {
    return (
      <AuthStatusScreen
        kind="unreachable"
        onRetry={recheck}
        onGoToLogin={() => navigate("/login", { replace: true, state: { from: `${location.pathname}${location.search}` } })}
      />
    );
  }
  if (status !== "signedIn") {
    return <Navigate to="/login" replace state={{ from: `${location.pathname}${location.search}` }} />;
  }

  return (
    <div className="min-h-screen bg-background-100" style={{ "--sidebar-w": `${sidebarWidth}px` } as CSSProperties}>
      <Sidebar
        mobileOpen={menuOpen}
        onClose={() => setMenuOpen(false)}
        collapsed={collapsed}
        onToggleCollapse={() => setCollapsed((prev) => !prev)}
        onResizeStart={startResize}
      />
      <div
        className={`transition-[padding] duration-200 ${collapsed ? "lg:pl-[64px]" : "lg:pl-[var(--sidebar-w)]"}`}
      >
        <TopBar onOpenMenu={() => setMenuOpen(true)} />
        {offline && (
          <div
            role="status"
            className="flex items-center gap-2 border-b border-amber-200 bg-amber-50 px-4 py-2 text-[11.5px] leading-5 text-amber-900 md:px-6"
          >
            <i className="ri-wifi-off-line text-[14px]" aria-hidden="true" />
            <span>
              네트워크 연결이 끊겼습니다. 일시적인 통신 오류는 로그아웃 사유가 아니며, 연결이 복구되면 자동으로 다시
              확인합니다.
            </span>
          </div>
        )}
        <main className="mx-auto w-full max-w-[1440px] px-4 py-5 md:px-6 md:py-6">
          <Outlet />
        </main>
      </div>
      <TaskDetailPanel />
      {/* 비밀번호 변경 강제 계정: 변경 전까지 닫을 수 없는 변경 창을 띄운다 */}
      {mustChangePassword && <PasswordChangeModal open forced onClose={() => undefined} />}
    </div>
  );
}