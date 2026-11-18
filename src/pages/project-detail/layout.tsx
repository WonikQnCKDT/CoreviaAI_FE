import { Link, Outlet, useLocation, useParams } from "react-router-dom";
import { useEffect, useMemo, useRef } from "react";
import { createProjectCore } from "@/app/projectModules/projectCore";
import { projectModules } from "@/app/projectModules/projectModules";
import type { ProjectDetailOutlet } from "@/app/projectModules/ProjectModuleRoute";
import type { ProjectModuleScope } from "@/core/projectModules/contracts";
import { useDemoStore } from "@/stores/DemoStore";
import EmptyState from "@/components/ui/EmptyState";
import { canEditProject, isProjectMember, isSystemAdmin } from "@/utils/permission";
import { PROJECT_TEXT, useServerProjectDetail } from "@/features/project/hooks/useServerProjects";

const overviewTab = {
  basePath: "",
  label: "개요",
  pages: [{ path: "missing", label: "누락 의심 업무" }],
  showPageLinks: true,
};

const settingsTab = { basePath: "settings", label: "멤버·설정", pages: [], showPageLinks: false };

export default function ProjectDetailLayout() {
  const { projectId } = useParams();
  const location = useLocation();
  const { projects, currentUser, tasks, notifications } = useDemoStore();
  const navRef = useRef<HTMLElement | null>(null);
  const activeRef = useRef<HTMLAnchorElement | null>(null);

  // api 모드: 들어올 때마다 서버 상세·폭포수 단계를 받아 화면 프로젝트에 반영한다.
  const { state: serverState, reload: reloadServer } = useServerProjectDetail(projectId);
  const found = projects.find((p) => p.id === projectId);
  const project = serverState.phase === "notFound" ? undefined : found;

  const suffix = location.pathname.split(`/projects/${projectId}`)[1]?.replace(/^\/+|\/+$/g, "") || "";
  const scope = useMemo<ProjectModuleScope | null>(() => project ? ({
    projectId: project.id,
    ...(project.moduleProfile ?? { departmentType: null, method: project.method, actors: project.actors }),
  }) : null, [project]);
  const core = useMemo(() => project ? createProjectCore(project, tasks, notifications) : null, [project, tasks, notifications]);
  const modules = scope ? projectModules.list(scope, project?.serverId === undefined || serverState.phase === "ready") : [];
  const tabs = [
    overviewTab,
    ...modules.map(({ label, pages, showPageLinks }) => ({ label, pages, showPageLinks, basePath: pages[0].path })),
    settingsTab,
  ];
  const activeGroup = tabs.find((tab) => tab.basePath === suffix || tab.pages.some((page) => page.path === suffix));

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

  if (!project || !scope || !core) {
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
    project.serverId !== undefined ||
    canEditProject(project, currentUser) ||
    isProjectMember(project, currentUser.id) ||
    isSystemAdmin(currentUser);
  const visibleTabs = tabs.filter((tab) => tab !== settingsTab || canSeeSettings);
  const subItems = activeGroup?.showPageLinks ? activeGroup.pages : null;
  const outlet: ProjectDetailOutlet = {
    reload: reloadServer,
    props: { scope, core },
    pages: modules.flatMap(({ pages }) => pages),
    loading: serverState.phase === "loading",
    loadFailed: serverState.phase === "error",
  };

  return (
    <div className="space-y-3">
      <div className="border-b border-background-300">
        <nav
          ref={navRef}
          aria-label="프로젝트 메뉴"
          className="relative flex items-center gap-0.5 overflow-x-auto px-0.5"
        >
          {visibleTabs.map((tab) => {
            const active = activeGroup === tab;
            return (
              <Link
                key={tab.basePath}
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

      <Outlet context={outlet} />
    </div>
  );
}