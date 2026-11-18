import type { ProjectModule } from "@/core/projectModules/contracts";
import WbsPage from "@/pages/project-detail/wbs";
import WbsDraftPage from "@/pages/project-detail/wbs-draft";
import GanttPage from "@/pages/project-detail/gantt";
import KanbanPage from "@/pages/project-detail/kanban";
import IssuesPage from "@/pages/project-detail/issues";
import MeetingsPage from "@/pages/project-detail/meetings";
import BoardPage from "@/pages/project-detail/board";
import DeliverablesPage from "@/pages/project-detail/deliverables";
import RiskPage from "@/pages/project-detail/risk";
import ReportPage from "@/pages/project-detail/report";

export const builtInProjectModules: readonly ProjectModule[] = [
  {
    id: "work-plan",
    label: "업무 계획",
    pages: [
      { path: "wbs", label: "WBS", Component: WbsPage },
      { path: "gantt", label: "간트", Component: GanttPage },
      { path: "kanban", label: "칸반", Component: KanbanPage },
      { path: "wbs/draft", label: "AI WBS 초안", Component: WbsDraftPage },
    ],
  },
  { id: "issues", label: "이슈·결함", pages: [{ path: "issues", label: "이슈·결함", Component: IssuesPage }] },
  {
    id: "collaboration",
    label: "협업 문서",
    showPageLinks: true,
    pages: [
      { path: "collab/meeting", label: "회의록", Component: MeetingsPage },
      { path: "collab/board", label: "게시판", Component: BoardPage },
      { path: "collab/deliverables", label: "산출물·검수", Component: DeliverablesPage },
    ],
  },
  { id: "risk", label: "AI 리스크", pages: [{ path: "risk", label: "AI 리스크", Component: RiskPage }] },
  { id: "report", label: "주간 리포트", pages: [{ path: "report", label: "주간 리포트", Component: ReportPage }] },
];
