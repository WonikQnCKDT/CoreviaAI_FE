import { useOutletContext, useParams } from "react-router-dom";
import type { ProjectModulePage, ProjectModuleProps } from "@/core/projectModules/contracts";
import NotFound from "@/pages/NotFound";

export interface ProjectDetailOutlet {
  reload: () => void;
  props: ProjectModuleProps;
  pages: readonly ProjectModulePage[];
  loading: boolean;
  loadFailed: boolean;
}

export default function ProjectModuleRoute() {
  const { "*": path } = useParams();
  const { props, pages, loading, loadFailed } = useOutletContext<ProjectDetailOutlet>();
  const Page = pages.find((page) => page.path === path?.replace(/\/+$/, ""))?.Component;
  if (Page) return <Page {...props} />;
  if (loading) return <p role="status">프로젝트 기능을 불러오는 중입니다.</p>;
  if (loadFailed) return null;
  return <NotFound />;
}
