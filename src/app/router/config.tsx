import type { RouteObject } from "react-router-dom";
import NotFound from "@/pages/NotFound";
import LoginPage from "@/pages/login/page";
import AppLayout from "@/layouts/AppLayout";
import MyWorkPage from "@/pages/mywork/page";
import ProjectsPage from "@/pages/projects/page";
import ProjectCreatePage from "@/pages/project-create/page";
import ProjectDetailLayout from "@/pages/project-detail/layout";
import ProjectOverviewPage from "@/pages/project-detail/overview";
import WbsPage from "@/pages/project-detail/wbs";
import GanttPage from "@/pages/project-detail/gantt";
import KanbanPage from "@/pages/project-detail/kanban";
import IssuesPage from "@/pages/project-detail/issues";
import MeetingsPage from "@/pages/project-detail/meetings";
import BoardPage from "@/pages/project-detail/board";
import DeliverablesPage from "@/pages/project-detail/deliverables";
import MissingPage from "@/pages/project-detail/missing";
import RiskPage from "@/pages/project-detail/risk";
import WbsDraftPage from "@/pages/project-detail/wbs-draft";
import ReportPage from "@/pages/project-detail/report";
import ProjectSettingsPage from "@/pages/project-detail/settings";
import KnowledgePage from "@/pages/knowledge/page";
import PortfolioPage from "@/pages/portfolio/page";
import AdminPage from "@/pages/admin/page";
import DemoSettingsPage from "@/pages/demo-settings/page";

const routes: RouteObject[] = [
  { path: "/login", element: <LoginPage /> },
  {
    path: "/",
    element: <AppLayout />,
    children: [
      { index: true, element: <MyWorkPage /> },
      { path: "projects", element: <ProjectsPage /> },
      { path: "projects/new", element: <ProjectCreatePage /> },
      {
        path: "projects/:projectId",
        element: <ProjectDetailLayout />,
        children: [
          { index: true, element: <ProjectOverviewPage /> },
          { path: "missing", element: <MissingPage /> },
          { path: "wbs", element: <WbsPage /> },
          { path: "wbs/draft", element: <WbsDraftPage /> },
          { path: "gantt", element: <GanttPage /> },
          { path: "kanban", element: <KanbanPage /> },
          { path: "issues", element: <IssuesPage /> },
          { path: "collab/meeting", element: <MeetingsPage /> },
          { path: "collab/board", element: <BoardPage /> },
          { path: "collab/deliverables", element: <DeliverablesPage /> },
          { path: "risk", element: <RiskPage /> },
          { path: "report", element: <ReportPage /> },
          { path: "settings", element: <ProjectSettingsPage /> },
        ],
      },
      { path: "knowledge", element: <KnowledgePage /> },
      { path: "portfolio", element: <PortfolioPage /> },
      { path: "admin", element: <AdminPage /> },
      { path: "demo-settings", element: <DemoSettingsPage /> },
      { path: "*", element: <NotFound /> },
    ],
  },
];

export default routes;