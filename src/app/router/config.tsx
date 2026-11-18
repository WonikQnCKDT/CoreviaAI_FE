import type { RouteObject } from "react-router-dom";
import ProjectModuleRoute from "@/app/projectModules/ProjectModuleRoute";
import NotFound from "@/pages/NotFound";
import LoginPage from "@/pages/login/page";
import AppLayout from "@/layouts/AppLayout";
import MyWorkPage from "@/pages/mywork/page";
import ProjectsPage from "@/pages/projects/page";
import ProjectCreatePage from "@/pages/project-create/page";
import ProjectDetailLayout from "@/pages/project-detail/layout";
import ProjectOverviewPage from "@/pages/project-detail/overview";
import MissingPage from "@/pages/project-detail/missing";
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
          { path: "settings", element: <ProjectSettingsPage /> },
          { path: "*", element: <ProjectModuleRoute /> },
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