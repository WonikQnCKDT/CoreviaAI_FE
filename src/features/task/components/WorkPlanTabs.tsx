import { Link } from "react-router-dom";
import { PROJECT_MENU_TEXT } from "@/shared/i18n/catalog/menu";

export type WorkPlanView = "wbs" | "gantt" | "kanban";

const VIEWS: { key: WorkPlanView; label: string; icon: string }[] = [
  { key: "wbs", icon: "ri-node-tree", get label() { return PROJECT_MENU_TEXT.wbs; } },
  { key: "gantt", icon: "ri-bar-chart-horizontal-line", get label() { return PROJECT_MENU_TEXT.gantt; } },
  { key: "kanban", icon: "ri-layout-grid-line", get label() { return PROJECT_MENU_TEXT.kanban; } },
];

interface WorkPlanTabsProps {
  projectId: string;
  active: WorkPlanView;
}

/** 업무 계획 안에서만 쓰는 작은 보기 전환입니다. 프로젝트 공통 메뉴와 구분됩니다. */
export default function WorkPlanTabs({ projectId, active }: WorkPlanTabsProps) {
  return (
    <div
      role="tablist"
      aria-label="업무 보기 전환"
      className="inline-flex shrink-0 items-center gap-0.5 rounded-lg border border-background-300 bg-background-100 p-0.5"
    >
      {VIEWS.map((view) => {
        const isActive = view.key === active;
        return (
          <Link
            key={view.key}
            role="tab"
            aria-selected={isActive}
            to={`/projects/${projectId}/${view.key}`}
            className={`flex items-center gap-1.5 whitespace-nowrap rounded-md px-2.5 py-1 text-[11.5px] font-medium transition ${
              isActive
                ? "bg-background-50 text-primary-700 shadow-card"
                : "text-foreground-600 hover:text-foreground-950"
            }`}
          >
            <i className={`${view.icon} text-[13px]`} aria-hidden="true" />
            {view.label}
          </Link>
        );
      })}
    </div>
  );
}