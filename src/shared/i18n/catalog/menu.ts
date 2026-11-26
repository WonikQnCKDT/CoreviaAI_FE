import { defineLabels } from "@/shared/i18n/defineLabels";

/** 주요 메뉴·페이지 제목 */
export const MENU_TEXT = defineLabels("menu", {
  myWork: "내 업무",
  projects: "프로젝트",
  projectCreate: "프로젝트 생성",
  knowledge: "지식 허브",
  portfolio: "전체 현황",
  admin: "시스템 관리",
  demoSettings: "데모 설정",
  home: "CoreviaAI 홈",
  mainNav: "주요 메뉴",
  resizeMenu: "메뉴 폭 조절",
  hintResizeMenu: "드래그해서 메뉴 폭 조절",
  demoEnvironment: "데모 환경",
});

/** 프로젝트 상세 메뉴 */
export const PROJECT_MENU_TEXT = defineLabels("menu.project", {
  nav: "프로젝트 메뉴",
  overview: "개요",
  missing: "누락 의심 업무",
  workPlan: "업무 계획",
  wbs: "WBS",
  gantt: "간트",
  kanban: "칸반",
  wbsDraft: "AI WBS 초안",
  issues: "이슈·결함",
  collab: "협업 문서",
  meeting: "회의록",
  board: "게시판",
  deliverables: "산출물·검수",
  risk: "AI 리스크",
  report: "주간 리포트",
  settings: "멤버·설정",
  workPlanViews: "업무 보기 전환",
});

/** 내 업무 탭 */
export const MYWORK_TAB_TEXT = defineLabels("menu.mywork", {
  todo: "TODO",
  approval: "승인 요청",
  calendar: "캘린더",
  journal: "업무일지",
  views: "내 업무 보기",
});

/** 지식 허브 탭 */
export const KNOWLEDGE_TAB_TEXT = defineLabels("menu.knowledge", {
  docs: "지식 문서",
  glossary: "용어집",
  qa: "AI 질문",
  views: "지식 허브 보기",
});

/** 누락 의심 업무 탭 */
export const MISSING_TAB_TEXT = defineLabels("menu.missing", {
  all: "전체",
  meeting: "회의 액션 미등록",
  unassigned: "담당자·기한 미지정",
  overdue: "마감 경과",
  stale: "진척 기록 없음",
});

/** 기간 보기 전환(캘린더·간트) */
export const VIEW_MODE_TEXT = defineLabels("menu.view", {
  day: "일",
  week: "주",
  month: "월",
});

/** 시스템 관리 탭 */
export const ADMIN_TAB_TEXT = defineLabels("menu.admin", {
  nav: "시스템 관리",
  usersAndOrg: "사용자 · 조직",
  users: "사용자",
  departments: "부서",
  codes: "공통 코드",
  labels: "다국어 라벨",
  risk: "AI · 리스크 설정",
  audit: "보안 · 접속 로그",
  hintUsers: "계정·부서·역할",
  hintDepartments: "조직 트리",
  hintCodes: "정렬 순서",
  hintLabels: "문구·번역",
  hintRisk: "임계값·가중치·이력",
  hintAudit: "읽기 전용 감사 로그",
  hintDemoData: "데모 데이터",
  adminOnly: "시스템 관리자",
});
