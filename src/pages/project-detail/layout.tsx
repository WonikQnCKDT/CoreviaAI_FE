import { Link, Outlet, useLocation, useParams } from "react-router-dom";
import { useEffect, useRef } from "react";
import { useDemoStore } from "@/stores/DemoStore";
import EmptyState from "@/components/ui/EmptyState";
import { canEditProject, isProjectMember, isSystemAdmin } from "@/utils/permission";
import { PROJECT_TEXT, useServerProjectDetail } from "@/features/project/hooks/useServerProjects";

interface TabItem {
  label: string;
  basePath: string;
  children?: { label: string; path: string }[];
}

const TABS: TabItem[] = [
  {
    label: "개요",
    basePath: "",
    children: [
      { label: "개요", path: "" },
      { label: "누락 의심 업무", path: "missing" },
    ],
  },
  {
    label: "업무 계획",
    basePath: "wbs",
    children: [
      { label: "WBS", path: "wbs" },
      { label: "간트", path: "gantt" },
      { label: "칸반", path: "kanban" },
      { label: "AI WBS 초안", path: "wbs/draft" },
    ],
  },
  { label: "이슈·결함", basePath: "issues" },
  {
    label: "협업 문서",
    basePath: "collab/meeting",
    children: [
      { label: "회의록", path: "collab/meeting" },
      { label: "게시판", path: "collab/board" },
      { label: "산출물·검수", path: "collab/deliverables" },
    ],
  },
  { label: "AI 리스크", basePath: "risk" },
  { label: "주간 리포트", basePath: "report" },
  { label: "멤버·설정", basePath: "settings" },
];

export default function ProjectDetailLayout() {
  const { projectId } = useParams();
  const location = useLocation();
  const { projects, currentUser } = useDemoStore();
  const navRef = useRef<HTMLElement | null>(null);
  const activeRef = useRef<HTMLAnchorElement | null>(null);

  // api 모드: 들어올 때마다 서버 상세·폭포수 단계를 받아 화면 프로젝트에 반영한다.
  const { state: serverState, reload: reloadServer } = useServerProjectDetail(projectId);
  const found = projects.find((p) => p.id === projectId);
  const project = serverState.phase === "notFound" ? undefined : found;

  const suffix = location.pathname.split(`/projects/${projectId}`)[1]?.replace(/^\//, "") || "";
  const activeGroup =
    TABS.find((tab) => tab.children?.some((child) => child.path === suffix)) ||
    TABS.find((tab) => tab.basePath === suffix);

  // 작은 화면에서 메뉴를 가로로 넘겨도 선택된 메뉴가 항상 보이도록 합니다.
  useEffect(() => {
    const nav = navRef.current;
    const active = activeRef.current;
    if (!nav || !active) return;
    const left = active.offsetLeft - nav.clientWidth / 2 + active.clientWidth / 2;
    nav.scrollTo({ left: Math.max(left, 0), behavior: "smooth" });
  }, [suffix]);

  if (!project && serverState.phase === "loading") {
    return (
      <p role="status" className="card px-4 py-12 text-center text-sm text-foreground-500">
        {PROJECT_TEXT.loading}
      </p>
    );
  }

  if (!project && serverState.phase === "error") {
    return (
      <div role="alert" className="card px-4 py-12 text-center">
        <p className="text-sm font-medium text-foreground-900">{PROJECT_TEXT.loadDetailFailed}</p>
        <p className="mt-1 text-xs text-foreground-600">{serverState.message}</p>
        <button type="button" className="btn-outline mt-3" onClick={reloadServer}>
          {PROJECT_TEXT.retry}
        </button>
      </div>
    );
  }

  if (!project) {
    return (
      <div className="card">
        <EmptyState
          icon="ri-lock-2-line"
          title="프로젝트를 찾을 수 없거나 접근 권한이 없습니다"
          description="삭제되었거나 공개 범위에서 제외된 프로젝트입니다. 프로젝트 목록에서 다시 확인해 주세요."
          tone="danger"
          action={
            <Link to="/projects" className="btn-outline">
              프로젝트 목록으로
            </Link>
          }
        />
      </div>
    );
  }

  const canSeeSettings =
    canEditProject(project, currentUser) ||
    isProjectMember(project, currentUser.id) ||
    isSystemAdmin(currentUser);
  const visibleTabs = TABS.filter((tab) => tab.basePath !== "settings" || canSeeSettings);
  // 업무 계획의 세부 보기는 각 화면 안의 보기 전환으로 옮겼습니다.
  // 나머지 그룹은 큰 박스 없이 얇은 선만 있는 짧은 링크 줄로 구분합니다.
  const subItems =
    activeGroup?.label === "개요"
      ? activeGroup.children?.filter((child) => child.path !== "")
      : activeGroup?.label === "협업 문서"
        ? activeGroup.children
        : undefined;

  return (
    <div className="space-y-3">
      <div className="border-b border-background-300">
        <nav
          ref={navRef}
          aria-label="프로젝트 메뉴"
          className="relative flex items-center gap-0.5 overflow-x-auto px-0.5"
        >
          {visibleTabs.map((tab) => {
            const active = activeGroup?.label === tab.label;
            return (
              <Link
                key={tab.label}
                ref={active ? activeRef : undefined}
                to={tab.basePath ? `/projects/${project.id}/${tab.basePath}` : `/projects/${project.id}`}
                aria-current={active ? "page" : undefined}
                className={`relative shrink-0 whitespace-nowrap px-3 py-2.5 text-[12.5px] font-medium transition ${
                  active ? "text-primary-700" : "text-foreground-600 hover:text-foreground-950"
                }`}
              >
                {tab.label}
                {active && <span className="absolute inset-x-2.5 bottom-0 h-0.5 rounded-full bg-primary-500" />}
              </Link>
            );
          })}
        </nav>
      </div>

      {serverState.phase === "error" && (
        <div role="alert" className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-rose-200 bg-rose-50 px-3.5 py-2.5 text-xs text-rose-700">
          <span>
            최신 프로젝트 정보를 불러오지 못해 마지막으로 받은 내용을 보여주고 있습니다. {serverState.message}
          </span>
          <button type="button" className="shrink-0 font-medium underline underline-offset-2" onClick={reloadServer}>
            {PROJECT_TEXT.retry}
          </button>
        </div>
      )}

      {subItems && (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
          {subItems.map((child) => {
            const active = suffix === child.path;
            return (
              <Link
                key={child.path || "base"}
                to={child.path ? `/projects/${project.id}/${child.path}` : `/projects/${project.id}`}
                aria-current={active ? "page" : undefined}
                className={`border-b py-0.5 text-[11.5px] transition ${
                  active
                    ? "border-primary-500 font-medium text-primary-700"
                    : "border-transparent text-foreground-600 hover:text-foreground-950"
                }`}
              >
                {child.label}
              </Link>
            );
          })}
        </div>
      )}

      <Outlet />
    </div>
  );
}