export type TaskStatus = "todo" | "progress" | "review" | "done";

export type Priority = "high" | "normal" | "low";

export type StageKey = "analysis" | "design" | "dev" | "test" | "deploy";

export type Health = "normal" | "caution" | "danger" | "done";

export type RoleKey = "pm" | "biz" | "dev" | "qa";

export type Visibility = "company" | "department" | "members";

/** 운영 방식. none = 단계 없음(업무 목록으로 운영), waterfall = 폭포수, agile = 애자일(MVP 선택 비활성) */
export type MethodKey = "none" | "waterfall" | "agile";

/** 시스템 역할과 프로젝트 역할은 분리해서 관리합니다. */
export type SystemRole = "user" | "exec" | "admin";

export interface User {
  id: string;
  name: string;
  dept: string;
  job: string;
  /** 대표 프로젝트 역할 (프로젝트별 역할과 별개로, 기본값 표시용) */
  role: RoleKey;
  roleLabel: string;
  email: string;
  systemRole: SystemRole;
  active: boolean;
  scopeDepts?: string[];
  isSystemAdmin?: boolean;
  /** 인증 서버의 사용자 ID. 실제 서버로 로그인한 적이 있는 사용자에만 있습니다. */
  serverUserId?: number;
}

export interface Milestone {
  id: string;
  name: string;
  date: string;
  stage: StageKey;
}

export interface ProjectMember {
  userId: string;
  role: RoleKey;
}

export interface KanbanWip {
  todo: number;
  progress: number;
  review: number;
  done: number;
}

export interface Project {
  id: string;
  name: string;
  code: string;
  dept: string;
  pmId: string;
  method: MethodKey;
  stage: StageKey;
  startDate: string;
  endDate: string;
  status: Health;
  visibility: Visibility;
  actors: RoleKey[];
  members: ProjectMember[];
  milestones: Milestone[];
  notice: string;
  riskScore: number;
  kanbanWip: KanbanWip;
  colorKey: string;
  description: string;
  gateApprovers?: Partial<Record<StageKey, string>>;
  /** 인증 서버(프로젝트 API)에서 온 프로젝트의 서버 ID. 프론트 데모 프로젝트에는 없습니다. */
  serverId?: number;
  /** 서버 프로젝트의 현재 단계를 폭포수 단계 API로 확인했는지. false면 stage는 기본값이라 화면에 표시하지 않습니다. */
  serverStageKnown?: boolean;
}

export interface Task {
  id: string;
  projectId: string | null;
  parentId: string | null;
  level: 2 | 3;
  stage: StageKey | null;
  name: string;
  type: "task" | "defect";
  /** 대표 담당자(복수 담당자 중 첫 번째). 기존 화면·권한 계산과의 호환용입니다. */
  assigneeId: string | null;
  /** 공동 담당자 전체 목록. 하나의 업무를 여러 명이 함께 담당합니다. */
  assigneeIds?: string[];
  startDate: string;
  endDate: string;
  estimate: number;
  progress: number;
  status: TaskStatus;
  priority: Priority;
  description: string;
  doneCondition: string;
  predecessors: string[];
  order: number;
  personal?: boolean;
  lastUpdated?: string;
}

export interface Journal {
  id: string;
  date: string;
  userId: string;
  content: string;
  taskId: string | null;
  progress: number;
  hours: number;
  createdAt: string;
}

export interface Schedule {
  id: string;
  userId: string;
  title: string;
  date: string;
  startTime: string;
  endTime: string;
  type: "personal" | "meeting";
  projectId: string | null;
}

/* ===== 이슈 · 결함 ===== */
export type IssueKind = "defect" | "issue" | "request";
export type IssueSeverity = "critical" | "high" | "medium" | "low";
export type IssueStatus = "registered" | "confirmed" | "fixing" | "verifying" | "closed";

export interface Issue {
  id: string;
  projectId: string;
  title: string;
  kind: IssueKind;
  severity: IssueSeverity;
  status: IssueStatus;
  assigneeId: string | null;
  reporterId: string;
  createdAt: string;
  dueDate: string;
  relatedTaskId: string | null;
  stage: StageKey;
  reproSteps: string;
  environment: string;
  reopenCount: number;
  closedAt?: string;
  closedBy?: string;
  kbDocId?: string;
}

/* ===== 회의록 ===== */
export interface MeetingActionItem {
  id: string;
  text: string;
  assigneeId: string | null;
  dueDate: string;
  estimate: number;
  stage: StageKey;
  approved: boolean;
  taskId: string | null;
}

export interface Meeting {
  id: string;
  projectId: string;
  title: string;
  date: string;
  attendees: string[];
  content: string;
  decisions: string[];
  actionItems: MeetingActionItem[];
  status: "draft" | "approved";
  createdAt: string;
  updatedAt: string;
  kbDocId?: string;
  aiDrafted?: boolean;
}

/* ===== 게시판 ===== */
export interface BoardAttachment {
  id: string;
  name: string;
  size: string;
  local: boolean;
}

export interface BoardPost {
  id: string;
  projectId: string;
  type: "notice" | "share";
  title: string;
  body: string;
  authorId: string;
  pinned: boolean;
  attachments: BoardAttachment[];
  createdAt: string;
  updatedAt: string;
}

/* ===== 산출물 · 검수 · 게이트 ===== */
export type DeliverableStatus = "pending" | "submitted" | "approved" | "rejected";

export interface DeliverableVersion {
  id: string;
  version: string;
  submitterId: string;
  submittedAt: string;
  note: string;
  fileName: string;
}

export interface Deliverable {
  id: string;
  projectId: string;
  stage: StageKey;
  name: string;
  required: boolean;
  gateApproverId: string | null;
  plannedDate: string;
  actualDate: string | null;
  status: DeliverableStatus;
  currentVersion: string;
  versions: DeliverableVersion[];
  reviewComment: string;
  reviewedBy: string | null;
  reviewedAt: string | null;
}

export interface GateRecord {
  id: string;
  projectId: string;
  stage: StageKey;
  decision: "approved" | "blocked";
  approverId: string;
  decidedAt: string;
  comment: string;
}

/* ===== AI 리스크 ===== */
export type RiskSuggestionStatus = "pending" | "approved" | "rejected";

export interface RiskChange {
  field: string;
  label: string;
  before: string;
  after: string;
}

export interface RiskSuggestion {
  id: string;
  projectId: string;
  taskId: string;
  title: string;
  reason: string;
  changes: RiskChange[];
  proposed: { assigneeId?: string | null; endDate?: string; startDate?: string; priority?: Priority };
  status: RiskSuggestionStatus;
  createdAt: string;
  decidedBy?: string;
  decidedAt?: string;
}

export interface RiskSettings {
  weights: { schedule: number; bottleneck: number; workload: number; impact: number };
  thresholds: { caution: number; danger: number };
  /** 병목·편중 임계값 (데모 설정) */
  bottleneckWip?: number;
  workloadShare?: number;
  updatedAt?: string;
  updatedBy?: string;
}

export interface RiskSettingHistoryEntry {
  id: string;
  changedBy: string;
  changedAt: string;
  note: string;
  before: string;
  after: string;
}

/* ===== 지식사전 ===== */
export interface KnowledgeVersion {
  id: string;
  version: number;
  title: string;
  body: string;
  editedBy: string;
  editedAt: string;
  note: string;
}

export interface KnowledgeDoc {
  id: string;
  title: string;
  body: string;
  tags: string[];
  dept: string;
  projectId: string | null;
  visibility: Visibility;
  authorId: string;
  createdAt: string;
  updatedAt: string;
  versions: KnowledgeVersion[];
  currentVersion: number;
  sourceType: "meeting" | "issue" | null;
  sourceId: string | null;
}

export interface GlossaryHistory {
  id: string;
  before: string;
  after: string;
  editedBy: string;
  editedAt: string;
}

export interface GlossaryEntry {
  id: string;
  term: string;
  definition: string;
  synonyms: string[];
  relatedDocIds: string[];
  updatedBy: string;
  updatedAt: string;
  history: GlossaryHistory[];
}

export interface KnowledgeQuestion {
  id: string;
  question: string;
  answer: string;
  sourceDocIds: string[];
  askedBy: string;
  createdAt: string;
}

/* ===== 공통 ===== */
export interface Comment {
  id: string;
  taskId: string;
  userId: string;
  content: string;
  createdAt: string;
}

export interface HistoryEntry {
  id: string;
  taskId: string;
  userId: string;
  field: string;
  before: string;
  after: string;
  createdAt: string;
}

export type NotificationType = "assign" | "mention" | "status" | "due" | "deliverable" | "missing" | "risk";

export interface NotificationItem {
  id: string;
  title: string;
  body: string;
  createdAt: string;
  read: boolean;
  projectId: string | null;
  type: NotificationType;
  targetPath: string | null;
  evidence?: string;
}

export interface DemoState {
  users: User[];
  projects: Project[];
  tasks: Task[];
  journals: Journal[];
  schedules: Schedule[];
  issues: Issue[];
  comments: Comment[];
  history: HistoryEntry[];
  notifications: NotificationItem[];
  meetings: Meeting[];
  boardPosts: BoardPost[];
  deliverables: Deliverable[];
  gateRecords: GateRecord[];
  riskSuggestions: RiskSuggestion[];
  riskSettings: RiskSettings;
  riskSettingHistory: RiskSettingHistoryEntry[];
  knowledgeDocs: KnowledgeDoc[];
  glossary: GlossaryEntry[];
  knowledgeQuestions: KnowledgeQuestion[];
  auditLogs: AuditLog[];
  currentUserId: string;
  /** 로그인 세션. 비밀번호는 저장하지 않습니다. */
  authUserId: string | null;
}

/* ===== 감사 · 접속 로그 ===== */
export type AuditType = "login_success" | "login_fail" | "permission" | "download" | "ai" | "approval";

export interface AuditLog {
  id: string;
  type: AuditType;
  userId: string;
  userName: string;
  ip: string;
  at: string;
  detail: string;
}