import type {
  AuditType,
  DeliverableStatus,
  Health,
  IssueKind,
  IssueSeverity,
  IssueStatus,
  MethodKey,
  Priority,
  RoleKey,
  StageKey,
  SystemRole,
  TaskStatus,
  Visibility,
} from "@/types";
import { defineLabelMap, defineLabels } from "@/shared/i18n/defineLabels";

/**
 * 상태·역할 표시 문구.
 * 서버 공통 코드(02-3)와 값이 같은 것은 서버 시드 키(code.<GROUP>.<CODE>, BE V9)를 그대로 쓴다.
 * 그래서 관리자가 공통 코드 문구를 고치면 화면에도 바로 반영되고, BE에 따로 등록할 필요가 없다.
 */

/** 리스크·건강 상태. normal·caution·danger는 공통 코드 RISK_LEVEL과 같다. */
export const HEALTH_LABEL = defineLabelMap<Health>("상태 · 리스크 수준", {
  normal: ["code.RISK_LEVEL.NORMAL", "정상"],
  caution: ["code.RISK_LEVEL.CAUTION", "주의"],
  danger: ["code.RISK_LEVEL.DANGER", "위험"],
  done: ["status.health.done", "완료"],
});

/** 업무 상태. 공통 코드 TASK_STATUS(TODO·IN_PROGRESS·REVIEW·DONE)와 같다. */
export const TASK_STATUS_LABEL = defineLabelMap<TaskStatus>("상태 · 업무", {
  todo: ["code.TASK_STATUS.TODO", "대기"],
  progress: ["code.TASK_STATUS.IN_PROGRESS", "진행"],
  review: ["code.TASK_STATUS.REVIEW", "검토"],
  done: ["code.TASK_STATUS.DONE", "완료"],
});

/** 공통 코드 그룹 이름. BE V8·V9 시드 키(codeGroup.*)를 그대로 쓴다. */
export const CODE_GROUP_LABEL = defineLabelMap("공통 코드 그룹", {
  RISK_LEVEL: ["codeGroup.RISK_LEVEL", "위험 수준"],
  TASK_STATUS: ["codeGroup.TASK_STATUS", "업무 진행 상태"],
  REQUEST_RESULT: ["codeGroup.REQUEST_RESULT", "요청 처리 결과"],
  PROJECT_STATUS: ["codeGroup.PROJECT_STATUS", "프로젝트 상태"],
});

/** 프로젝트 상태. 공통 코드 PROJECT_STATUS와 같다. */
export const PROJECT_STATUS_LABEL = defineLabelMap("상태 · 프로젝트", {
  planned: ["code.PROJECT_STATUS.PLANNED", "계획"],
  inProgress: ["code.PROJECT_STATUS.IN_PROGRESS", "진행 중"],
  onHold: ["code.PROJECT_STATUS.ON_HOLD", "보류"],
  completed: ["code.PROJECT_STATUS.COMPLETED", "완료"],
  cancelled: ["code.PROJECT_STATUS.CANCELLED", "취소"],
});

/** 요청 처리 결과. 공통 코드 REQUEST_RESULT와 같다. */
export const REQUEST_RESULT_LABEL = defineLabelMap("상태 · 요청 결과", {
  success: ["code.REQUEST_RESULT.SUCCESS", "성공"],
  failure: ["code.REQUEST_RESULT.FAILURE", "실패"],
});

export const PRIORITY_LABEL: Record<Priority, string> = defineLabels("status.priority", {
  high: "높음",
  normal: "보통",
  low: "낮음",
});

export const ROLE_LABEL: Record<RoleKey, string> = defineLabels("status.projectRole", {
  pm: "PM",
  biz: "현업 담당자",
  dev: "개발자",
  qa: "QA",
});

export const SYSTEM_ROLE_LABEL: Record<SystemRole, string> = defineLabels("status.systemRole", {
  user: "일반 사용자",
  exec: "경영진",
  admin: "시스템 관리자",
});

export const VISIBILITY_LABEL: Record<Visibility, string> = defineLabels("status.visibility", {
  company: "전사 공개",
  department: "부서 공개",
  members: "멤버 전용",
});

export const STAGE_LABEL: Record<StageKey, string> = defineLabels("status.stage", {
  analysis: "분석",
  design: "설계",
  dev: "개발",
  test: "테스트",
  deploy: "이행",
});

export const ACTIVITY_ISSUE_LABEL: Record<string, string> = defineLabels("status.activityIssue", {
  open: "접수",
  progress: "처리중",
  resolved: "해결",
});

export const METHODOLOGY_LABEL: Record<MethodKey, string> = defineLabels("status.methodology", {
  none: "단계 없음",
  waterfall: "폭포수",
  agile: "애자일",
});

export const RECORD_STATUS_LABEL = defineLabels("status.record", {
  active: "활성",
  inactive: "비활성",
});

export const ISSUE_KIND_LABEL: Record<IssueKind, string> = defineLabels("status.issueKind", {
  defect: "결함",
  issue: "일반 이슈",
  request: "요청",
});

export const ISSUE_SEVERITY_LABEL: Record<IssueSeverity, string> = defineLabels("status.issueSeverity", {
  critical: "치명",
  high: "높음",
  medium: "보통",
  low: "낮음",
});

export const ISSUE_STATUS_LABEL: Record<IssueStatus, string> = defineLabels("status.issue", {
  registered: "등록",
  confirmed: "확인",
  fixing: "조치",
  verifying: "검증",
  closed: "종결",
});

export const DELIVERABLE_STATUS_LABEL: Record<DeliverableStatus, string> = defineLabels("status.deliverable", {
  pending: "미제출",
  submitted: "검수 대기",
  approved: "승인",
  rejected: "반려",
});

/** 내 업무 필터 */
export const TASK_FILTER_LABEL = defineLabels("status.taskFilter", {
  open: "진행 중",
  today: "오늘",
  soon: "마감 임박",
  late: "지연",
  done: "완료",
  all: "전체",
});

export const TASK_FILTER_HINT = defineLabels("status.taskFilterHint", {
  open: "완료되지 않은 업무",
  today: "오늘 마감인 미완료 업무",
  soon: "3일 이내 마감 예정",
  late: "마감일이 지난 미완료 업무",
  done: "완료 처리한 업무",
  all: "완료 포함 전체 업무",
});

/** 프로젝트 목록·전체 현황의 지표 필터 */
export const PROJECT_FOCUS_LABEL = defineLabels("status.projectFocus", {
  all: "전체 프로젝트",
  ongoing: "진행 중",
  late: "지연",
  done: "완료",
});

export const PROJECT_SORT_LABEL = defineLabels("status.projectSort", {
  risk: "리스크 높은 순",
  endDate: "종료일 임박 순",
  progressDesc: "진척률 높은 순",
  progressAsc: "진척률 낮은 순",
  name: "프로젝트명 순",
});

/** 감사 로그 유형 */
export const AUDIT_TYPE_LABEL: Record<AuditType, string> = defineLabels("status.auditType", {
  login_success: "로그인 성공",
  login_fail: "로그인 실패",
  permission: "권한·설정 변경",
  download: "다운로드",
  ai: "AI 요청",
  approval: "승인",
});
