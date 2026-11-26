import type { PointerEvent as ReactPointerEvent } from "react";
import { Link, useLocation } from "react-router-dom";
import BrandLogo from "@/components/ui/BrandLogo";
import { useDemoStore } from "@/stores/DemoStore";
import { canUseSystemAdmin, canViewPortfolio } from "@/utils/permission";
import { BUTTON_TEXT } from "@/shared/i18n/catalog/button";
import { MENU_TEXT } from "@/shared/i18n/catalog/menu";

interface SidebarProps {
  mobileOpen: boolean;
  onClose: () => void;
  collapsed: boolean;
  onToggleCollapse: () => void;
  onResizeStart?: (event: ReactPointerEvent<HTMLDivElement>) => void;
}

interface NavEntry {
  label: string;
  path: string;
  icon: string;
}

export default function Sidebar({ mobileOpen, onClose, collapsed, onToggleCollapse, onResizeStart }: SidebarProps) {
  const location = useLocation();
  const { currentUser, projects } = useDemoStore();

  const canPortfolio = canViewPortfolio(projects, currentUser);
  const isAdmin = canUseSystemAdmin(currentUser);

  const mainNav: NavEntry[] = [
    { label: MENU_TEXT.myWork, path: "/", icon: "ri-todo-line" },
    { label: MENU_TEXT.projects, path: "/projects", icon: "ri-folder-chart-line" },
    { label: MENU_TEXT.knowledge, path: "/knowledge", icon: "ri-book-read-line" },
    ...(canPortfolio ? [{ label: MENU_TEXT.portfolio, path: "/portfolio", icon: "ri-pie-chart-line" }] : []),
  ];

  const adminNav: NavEntry[] = isAdmin
    ? [{ label: MENU_TEXT.admin, path: "/admin", icon: "ri-settings-3-line" }]
    : [];

  const isActive = (path: string) => {
    if (path === "/") return location.pathname === "/";
    if (path === "/projects") return location.pathname.startsWith("/projects");
    return location.pathname.startsWith(path);
  };

  const renderItem = (entry: NavEntry) => {
    const active = isActive(entry.path);
    return (
      <Link
        key={entry.path}
        to={entry.path}
        onClick={onClose}
        title={collapsed ? entry.label : undefined}
        aria-label={entry.label}
        className={`nav-item group relative ${active ? "nav-item-active" : ""} ${
          collapsed ? "lg:justify-center lg:gap-0 lg:px-0" : ""
        }`}
      >
        <span className="flex h-4 w-4 shrink-0 items-center justify-center">
          <i className={`${entry.icon} text-[15px]`} aria-hidden="true" />
        </span>
        <span className={`flex-1 truncate ${collapsed ? "lg:hidden" : ""}`}>{entry.label}</span>
        {collapsed && (
          <span
            role="tooltip"
            className="pointer-events-none absolute left-full top-1/2 z-50 ml-2 hidden -translate-y-1/2 whitespace-nowrap rounded-md bg-foreground-950 px-2 py-1 text-[11.5px] font-medium text-background-50 opacity-0 shadow-panel transition-opacity duration-150 group-hover:opacity-100 group-focus-visible:opacity-100 lg:block"
          >
            {entry.label}
          </span>
        )}
      </Link>
    );
  };

  return (
    <>
      {mobileOpen && (
        <button
          type="button"
          aria-label={BUTTON_TEXT.closeMenu}
          onClick={onClose}
          className="fixed inset-0 z-40 cursor-pointer bg-foreground-950/30 lg:hidden"
        />
      )}
      <aside
        className={`fixed inset-y-0 left-0 z-50 flex w-[220px] flex-col border-r border-background-300 bg-background-50 transition-transform duration-200 lg:translate-x-0 ${
          collapsed ? "lg:w-[64px]" : "lg:w-[var(--sidebar-w)]"
        } ${mobileOpen ? "translate-x-0" : "-translate-x-full"}`}
      >
        <div className={`flex h-16 items-center gap-2 border-b border-background-200 px-3 ${collapsed ? "lg:justify-center lg:px-0" : ""}`}>
          <Link to="/" className="flex min-w-0 items-center gap-2.5" onClick={onClose} aria-label={MENU_TEXT.home}>
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary-500 text-background-50">
              <BrandLogo className="h-[18px] w-auto" />
            </span>
            <span className={`truncate text-[15px] font-semibold tracking-tight text-foreground-950 ${collapsed ? "lg:hidden" : ""}`}>
              Corevia<span className="text-primary-600">AI</span>
            </span>
          </Link>
          <button
            type="button"
            onClick={onClose}
            aria-label={BUTTON_TEXT.closeMenu}
            className="ml-auto flex h-8 w-8 cursor-pointer items-center justify-center rounded-md text-foreground-500 hover:bg-background-100 lg:hidden"
          >
            <i className="ri-close-line" aria-hidden="true" />
          </button>
        </div>

        {!collapsed && onResizeStart && (
          <div
            role="separator"
            aria-label={MENU_TEXT.resizeMenu}
            aria-orientation="vertical"
            title={MENU_TEXT.hintResizeMenu}
            onPointerDown={onResizeStart}
            className="group absolute inset-y-0 right-0 z-0 hidden w-1.5 cursor-col-resize items-center justify-center lg:flex"
          >
            <span className="h-full w-px bg-transparent transition-colors group-hover:bg-primary-300" />
          </div>
        )}

        <button
          type="button"
          onClick={onToggleCollapse}
          aria-label={collapsed ? BUTTON_TEXT.expandMenu : BUTTON_TEXT.collapseMenu}
          aria-expanded={!collapsed}
          title={collapsed ? BUTTON_TEXT.expandMenu : BUTTON_TEXT.collapseMenu}
          className="absolute right-0 top-[22px] z-20 hidden h-6 w-6 translate-x-1/2 cursor-pointer items-center justify-center rounded-full border border-background-300 bg-background-50 text-foreground-500 shadow-sm transition-colors hover:border-primary-300 hover:bg-primary-50 hover:text-primary-600 lg:flex"
        >
          <i
            className={`${collapsed ? "ri-arrow-right-s-line" : "ri-arrow-left-s-line"} text-[15px]`}
            aria-hidden="true"
          />
        </button>

        <nav
          aria-label={MENU_TEXT.mainNav}
          className={`flex-1 space-y-0.5 px-2 py-3 ${
            collapsed ? "overflow-y-auto lg:overflow-visible" : "overflow-y-auto"
          }`}
        >
          {mainNav.map(renderItem)}
          {adminNav.length > 0 && (
            <>
              <span aria-hidden="true" className="my-2 block h-px bg-background-200" />
              {adminNav.map(renderItem)}
            </>
          )}
        </nav>

        <div className="border-t border-background-200 px-2 py-2">
          <div className={`flex items-center gap-1.5 px-1 pt-1 ${collapsed ? "lg:flex-col lg:gap-1 lg:px-0" : ""}`}>
            <span
              className={`flex items-center gap-1.5 whitespace-nowrap text-[11px] text-foreground-500 ${
                collapsed ? "lg:hidden" : ""
              }`}
            >
              <span className="h-1.5 w-1.5 rounded-full bg-amber-500" aria-hidden="true" />
              {MENU_TEXT.demoEnvironment}
            </span>
            <Link
              to="/demo-settings"
              onClick={onClose}
              title={MENU_TEXT.demoSettings}
              aria-label={MENU_TEXT.demoSettings}
              className={`group relative ml-auto flex h-7 w-7 cursor-pointer items-center justify-center rounded-md text-foreground-500 hover:bg-background-100 hover:text-foreground-900 ${
                collapsed ? "lg:mx-auto" : ""
              }`}
            >
              <i className="ri-settings-3-line text-[14px]" aria-hidden="true" />
              {collapsed && (
                <span
                  role="tooltip"
                  className="pointer-events-none absolute left-full top-1/2 z-50 ml-2 hidden -translate-y-1/2 whitespace-nowrap rounded-md bg-foreground-950 px-2 py-1 text-[11.5px] font-medium text-background-50 opacity-0 shadow-panel transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100 lg:block"
                >
                  {MENU_TEXT.demoSettings}
                </span>
              )}
            </Link>
          </div>
        </div>
      </aside>
    </>
  );
}