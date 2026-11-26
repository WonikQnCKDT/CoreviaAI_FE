import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type {
  AuditLog,
  AuditType,
  BoardAttachment,
  BoardPost,
  Comment,
  Deliverable,
  DemoState,
  GateRecord,
  GlossaryEntry,
  HistoryEntry,
  Issue,
  IssueKind,
  IssueSeverity,
  Journal,
  KanbanWip,
  KnowledgeDoc,
  KnowledgeQuestion,
  Meeting,
  MeetingActionItem,
  NotificationItem,
  Priority,
  Project,
  ProjectMember,
  RiskSettings,
  RiskSettingHistoryEntry,
  RiskSuggestion,
  RoleKey,
  Schedule,
  StageKey,
  Task,
  TaskStatus,
  User,
  Visibility,
} from "@/types";
import { users as mockUsers } from "@/mocks/users";
import { projects as mockProjects } from "@/mocks/projects";
import { tasks as mockTasks } from "@/mocks/tasks";
import { journals as mockJournals } from "@/mocks/journals";
import { schedules as mockSchedules } from "@/mocks/schedules";
import { issues as mockIssues } from "@/mocks/issues";
import { notifications as mockNotifications } from "@/mocks/notifications";
import { auditLogs as mockAuditLogs } from "@/mocks/auditLogs";
import { comments as mockComments } from "@/mocks/comments";
import { meetings as mockMeetings } from "@/mocks/meetings";
import { boardPosts as mockBoardPosts } from "@/mocks/board";
import { deliverables as mockDeliverables, gateRecords as mockGateRecords } from "@/mocks/deliverables";
import { riskSuggestions as mockRiskSuggestions, riskSettings as defaultRiskSettings } from "@/mocks/risk";
import { knowledgeDocs as mockKnowledgeDocs, glossary as mockGlossary, knowledgeQuestions as mockKnowledgeQuestions } from "@/mocks/knowledge";
import { PRIORITY_LABEL, STAGE_LABEL, STAGES, TASK_STATUS_LABEL } from "@/utils/ui";
import { nextOrder, normalizeOrders } from "@/features/task/utils/taskTree";
import { addDays, diffDays, formatDate, isoNow, nowStamp, TODAY } from "@/utils/date";
import { ISSUE_KIND_LABEL, nextIssueStatus } from "@/features/issue/utils/issue";
import { blockingDeliverables, bumpVersion, nextStage } from "@/features/gate/utils/deliverable";
import { clearSessionActivity, touchSession } from "@/features/auth/utils/session";
import { passwordPolicyError } from "@/features/auth/utils/password";
import type { AuthAccount } from "@/features/auth/api/authApi";
import type {
  ServerProjectDetail,
  ServerProjectPhase,
  ServerProjectMember,
  ServerProjectSummary,
} from "@/features/project/api/projectApi";
import { mergeServerDetail, mergeServerSummary } from "@/features/project/utils/serverProject";
import { assigneeIdsOf, assigneeNameText, settleAssignees } from "@/utils/assignee";
import { clearLoginNotices } from "@/features/notification/utils/notificationNotice";
import { isSystemAdmin } from "@/utils/permission";
import { gateApproverId, validateGateApprover, type GateAssignResult } from "@/features/gate/utils/gate";

const STORAGE_KEY = "coreviaai-demo-state-v3";

/** 데모 로그인 비밀번호. 실제 사용자 비밀번호는 저장하지 않습니다. */
export const DEMO_PASSWORD = "corevia1234";

/** 인증 정책: 비밀번호 5회 연속 실패 시 계정이 잠깁니다. */
export const MAX_LOGIN_ATTEMPTS = 5;
const LOGIN_LOCK_KEY = "coreviaai-login-lock-v1";

interface LoginLockRecord {
  failures: number;
  lockedAt: string | null;
}

type LoginLockMap = Record<string, LoginLockRecord>;

/** 잠금 상태는 인증 서버가 관리하는 값으로 취급합니다. 화면에서 임의로 추정하지 않습니다. */
function readLoginLock(): LoginLockMap {
  try {
    const raw = localStorage.getItem(LOGIN_LOCK_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as LoginLockMap;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function writeLoginLock(next: LoginLockMap) {
  try {
    localStorage.setItem(LOGIN_LOCK_KEY, JSON.stringify(next));
  } catch {
    // 저장에 실패해도 로그인 화면 동작은 유지합니다.
  }
}

function uid(prefix: string): string {
  return `${prefix}${Date.now()}${Math.floor(Math.random() * 10000)}`;
}

function makeHistory(taskId: string, userId: string, field: string, before: string, after: string): HistoryEntry {
  return { id: uid("h"), taskId, userId, field, before, after, createdAt: isoNow() };
}

export function createInitialState(): DemoState {
  return {
    users: mockUsers.map((u) => ({ ...u })),
    projects: mockProjects.map((p) => ({
      ...p,
      members: p.members.map((m) => ({ ...m })),
      milestones: p.milestones.map((m) => ({ ...m })),
      actors: [...p.actors],
      kanbanWip: { ...p.kanbanWip },
      gateApprovers: { ...(p.gateApprovers || {}) },
    })),
    tasks: mockTasks.map((t) => ({
      ...t,
      ...settleAssignees(assigneeIdsOf(t)),
      predecessors: [...t.predecessors],
    })),
    journals: mockJournals.map((j) => ({ ...j })),
    schedules: mockSchedules.map((s) => ({ ...s })),
    issues: mockIssues.map((i) => ({ ...i })),
    comments: mockComments.map((c) => ({ ...c })),
    history: [],
    notifications: mockNotifications.map((n) => ({ ...n })),
    meetings: mockMeetings.map((m) => ({ ...m, attendees: [...m.attendees], actionItems: m.actionItems.map((a) => ({ ...a })), decisions: [...m.decisions] })),
    boardPosts: mockBoardPosts.map((p) => ({ ...p, attachments: p.attachments.map((a) => ({ ...a })) })),
    deliverables: mockDeliverables.map((d) => ({ ...d, versions: d.versions.map((v) => ({ ...v })) })),
    gateRecords: mockGateRecords.map((g) => ({ ...g })),
    riskSuggestions: mockRiskSuggestions.map((r) => ({ ...r, changes: r.changes.map((c) => ({ ...c })), proposed: { ...r.proposed } })),
    riskSettings: {
      weights: { ...defaultRiskSettings.weights },
      thresholds: { ...defaultRiskSettings.thresholds },
      bottleneckWip: defaultRiskSettings.bottleneckWip,
      workloadShare: defaultRiskSettings.workloadShare,
    },
    riskSettingHistory: [],
    knowledgeDocs: mockKnowledgeDocs.map((d) => ({ ...d, tags: [...d.tags], versions: d.versions.map((v) => ({ ...v })) })),
    glossary: mockGlossary.map((g) => ({ ...g, synonyms: [...g.synonyms], relatedDocIds: [...g.relatedDocIds], history: [] })),
    knowledgeQuestions: mockKnowledgeQuestions.map((q) => ({ ...q, sourceDocIds: [...q.sourceDocIds] })),
    auditLogs: mockAuditLogs.map((l) => ({ ...l })),
    currentUserId: "u1",
    authUserId: null,
  };
}

function loadState(): DemoState {
  const base = createInitialState();
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<DemoState>;
      if (parsed && Array.isArray(parsed.projects) && Array.isArray(parsed.tasks) && Array.isArray(parsed.users)) {
        const merged = {
          ...base,
          ...parsed,
          riskSettings: parsed.riskSettings || base.riskSettings,
          riskSettingHistory: parsed.riskSettingHistory || base.riskSettingHistory,
          auditLogs: parsed.auditLogs || base.auditLogs,
        } as DemoState;
        const sessionUser = merged.users.find((u) => u.id === merged.authUserId);
        if (!sessionUser || !sessionUser.active) merged.authUserId = null;
        // 이전 버전에 저장된 데이터도 복수 담당자 형태로 맞춰 줍니다.
        merged.tasks = merged.tasks.map((t) => ({ ...t, ...settleAssignees(assigneeIdsOf(t)) }));
        // 이전에 역할 기준으로 자동 지정되던 승인자 값을 정리합니다. PM·비멤버는 승인자가 될 수 없습니다.
        merged.projects = merged.projects.map((p) => {
          const approvers: Partial<Record<StageKey, string>> = {};
          Object.entries(p.gateApprovers || {}).forEach(([key, value]) => {
            const stage = key as StageKey;
            if (value && value !== p.pmId && p.members.some((m) => m.userId === value)) approvers[stage] = value;
          });
          return { ...p, gateApprovers: approvers };
        });
        // 단계 승인자가 비어 있으면 기존 산출물의 승인자에서 복원합니다. (PM·비멤버 제외)
        merged.projects = merged.projects.map((p) => {
          const approvers: Partial<Record<StageKey, string>> = { ...(p.gateApprovers || {}) };
          merged.deliverables.forEach((d) => {
            if (d.projectId !== p.id || approvers[d.stage]) return;
            const id = d.gateApproverId;
            if (id && id !== p.pmId && p.members.some((m) => m.userId === id)) approvers[d.stage] = id;
          });
          return { ...p, gateApprovers: approvers };
        });
        merged.deliverables = merged.deliverables.map((d) => {
          const project = merged.projects.find((p) => p.id === d.projectId);
          if (!project) return d;
          const stageApprover = project.gateApprovers?.[d.stage] || null;
          const fallback = d.gateApproverId && d.gateApproverId !== project.pmId ? d.gateApproverId : null;
          return { ...d, gateApproverId: stageApprover || fallback };
        });
        return merged;
      }
    }
  } catch {
    // 저장된 데모 데이터를 읽지 못하면 초기 데이터로 시작합니다.
  }
  return base;
}

export interface NewTaskInput {
  projectId: string | null;
  parentId?: string | null;
  level?: 2 | 3;
  stage?: StageKey | null;
  name: string;
  /** 단일 담당자 지정(개인 할 일 등). */
  assigneeId?: string | null;
  /** 복수 담당자 지정. 하나의 업무를 여러 명이 공동 담당합니다. */
  assigneeIds?: string[];
  startDate: string;
  endDate: string;
  estimate?: number;
  priority?: Priority;
  description?: string;
  doneCondition?: string;
  type?: "task" | "defect";
  personal?: boolean;
}

export interface NewProjectInput {
  name: string;
  /** 생성 화면에서 입력한 프로젝트 설명. 비어 있으면 기본 개요를 사용합니다. */
  description?: string;
  code: string;
  dept: string;
  startDate: string;
  endDate: string;
  pmId: string;
  visibility: Visibility;
  actors: RoleKey[];
  members: ProjectMember[];
  /** 생성 시 지정하는 게이트 승인자. 지정하면 모든 게이트에 동일하게 적용됩니다. */
  gateApproverId?: string | null;
}

export interface NewIssueInput {
  projectId: string;
  title: string;
  kind: IssueKind;
  severity: IssueSeverity;
  assigneeId: string | null;
  dueDate: string;
  relatedTaskId: string | null;
  stage: StageKey;
  reproSteps: string;
  environment: string;
}

export interface NewMeetingInput {
  projectId: string;
  title: string;
  date: string;
  attendees: string[];
  content: string;
  decisions: string[];
  actionItems: { text: string; assigneeId: string | null; dueDate: string; estimate: number; stage: StageKey }[];
}

export interface MeetingSelection {
  id: string;
  text?: string;
  assigneeId: string | null;
  dueDate: string;
  estimate: number;
  stage: StageKey;
}

export interface NewBoardPostInput {
  projectId: string;
  type: "notice" | "share";
  title: string;
  body: string;
  attachments: BoardAttachment[];
}

export interface KnowledgeDocInput {
  title: string;
  body: string;
  tags: string[];
  dept: string;
  projectId: string | null;
  visibility: Visibility;
}

export interface WbsDraftApplyItem {
  stage: StageKey;
  name: string;
  estimate: number;
  description: string;
}

export interface WbsDraftApplyMilestone {
  stage: StageKey;
  name: string;
  date: string;
}

export type LoginCode = "ok" | "invalid" | "inactive" | "locked" | "network" | "unavailable";

/** 알림 목록 불러오기 상태. 빈 목록(ready)과 실패(error)를 구분합니다. */
export type NotificationLoadStatus = "idle" | "loading" | "ready" | "error";

export interface LoginResult {
  ok: boolean;
  code: LoginCode;
  message: string;
  /** 인증 서버가 알려준 남은 시도 횟수. 화면에서 임의로 계산하지 않습니다. */
  attemptsRemaining?: number;
  locked?: boolean;
}

export interface NewUserInput {
  name: string;
  dept: string;
  job: string;
  email: string;
  systemRole: User["systemRole"];
}

/** PM 위임 결과. 화면에서는 message를 그대로 안내문으로 사용합니다. */
export type PmChangeCode = "ok" | "forbidden" | "same" | "gate_approver" | "inactive" | "not_found";

export interface PmChangeResult {
  ok: boolean;
  code: PmChangeCode;
  message: string;
}

interface DemoStoreValue extends DemoState {
  currentUser: DemoState["users"][number];
  activeTaskId: string | null;
  openTask: (taskId: string) => void;
  closeTask: () => void;
  resetDemo: () => void;
  updateTask: (taskId: string, patch: Partial<Task>) => void;
  setTaskAssignees: (taskId: string, userIds: string[]) => void;
  changeProjectPm: (projectId: string, nextPmId: string) => PmChangeResult;
  clearGateApprover: (projectId: string, stage: StageKey) => void;
  setTaskStatus: (taskId: string, status: TaskStatus) => void;
  addTask: (input: NewTaskInput) => string;
  deleteTask: (taskId: string) => void;
  moveTask: (taskId: string, direction: "up" | "down" | "indent" | "outdent") => void;
  setPredecessors: (taskId: string, ids: string[]) => void;
  addJournal: (input: { date: string; content: string; taskId: string | null; progress: number; hours: number }) => void;
  addSchedule: (input: { title: string; date: string; startTime: string; endTime: string; type: "personal" | "meeting" }) => void;
  updateSchedule: (scheduleId: string, patch: Partial<Schedule>) => void;
  deleteSchedule: (scheduleId: string) => void;
  addComment: (taskId: string, content: string) => void;
  createProject: (input: NewProjectInput) => string;
  setKanbanWip: (projectId: string, wip: KanbanWip) => void;
  markNotificationsRead: () => void;
  addIssue: (input: NewIssueInput) => string;
  moveIssueStatus: (issueId: string) => void;
  reopenIssue: (issueId: string) => void;
  saveIssueToKnowledge: (issueId: string) => void;
  addMeeting: (input: NewMeetingInput) => string;
  updateMeeting: (meetingId: string, patch: Partial<Meeting>) => void;
  approveMeetingActionItems: (meetingId: string, selections: MeetingSelection[]) => void;
  saveMeetingToKnowledge: (meetingId: string) => void;
  addBoardPost: (input: NewBoardPostInput) => void;
  updateBoardPost: (postId: string, patch: Partial<BoardPost>) => void;
  deleteBoardPost: (postId: string) => void;
  togglePinPost: (postId: string) => void;
  addDeliverableVersion: (deliverableId: string, input: { note: string; fileName: string }) => void;
  reviewDeliverable: (deliverableId: string, decision: "approved" | "rejected", comment: string) => void;
  setGateApprover: (projectId: string, stage: StageKey, approverId: string | null) => GateAssignResult;
  setAllGateApprovers: (projectId: string, approverId: string | null) => GateAssignResult;
  advanceProjectStage: (projectId: string) => { ok: boolean; message: string };
  decideRiskSuggestion: (
    suggestionId: string,
    decision: "approved" | "rejected",
    override?: { assigneeId?: string | null; endDate?: string; startDate?: string; priority?: Priority },
  ) => void;
  applyWbsDraft: (projectId: string, tasks: WbsDraftApplyItem[], milestones: WbsDraftApplyMilestone[]) => number;
  addKnowledgeDoc: (input: KnowledgeDocInput) => string;
  updateKnowledgeDoc: (docId: string, input: KnowledgeDocInput, note: string) => void;
  addGlossaryTerm: (input: { term: string; definition: string; synonyms: string[]; relatedDocIds: string[] }) => string;
  updateGlossaryTerm: (id: string, input: { term: string; definition: string; synonyms: string[]; relatedDocIds: string[] }) => void;
  saveKnowledgeQuestion: (input: { question: string; answer: string; sourceDocIds: string[] }) => void;
  /* ===== 로그인 · 계정 · 권한 ===== */
  signedIn: boolean;
  login: (userId: string, password: string) => LoginResult;
  logout: () => void;
  /** 실제 인증 서버로 로그인한 계정을 화면용 사용자에 연결합니다. */
  signInWithAccount: (account: AuthAccount) => void;
  /** 서버 프로젝트 목록을 화면 프로젝트로 연결합니다. 목록에서 빠진(볼 수 없게 된) 서버 프로젝트는 지웁니다. */
  syncServerProjects: (summaries: ServerProjectSummary[]) => void;
  /** 서버 프로젝트 상세·폭포수 단계를 화면 프로젝트에 반영합니다. */
  syncServerProjectDetail: (input: {
    detail: ServerProjectDetail;
    phases: ServerProjectPhase[] | null;
    members: ServerProjectMember[] | null;
  }) => void;
  /** 볼 수 없게 된(404) 서버 프로젝트를 화면에서 지웁니다. */
  removeServerProject: (serverId: number) => void;
  switchDemoUser: (userId: string) => void;
  requestPasswordChange: (currentPassword: string, nextPassword: string) => LoginResult;
  resetUserPassword: (userId: string) => void;
  getLoginState: (userId: string) => { locked: boolean; attemptsRemaining: number };
  unlockDemoAccount: (userId: string) => void;
  updateUser: (userId: string, patch: Partial<User>) => void;
  addUser: (input: NewUserInput) => string;
  markNotificationRead: (notificationId: string) => void;
  notificationStatus: NotificationLoadStatus;
  notificationError: string | null;
  loadNotifications: () => void;
  updateRiskSettings: (next: RiskSettings, note: string) => void;
  addAuditLog: (type: AuditType, detail: string, userId?: string) => void;
}

const DemoStoreContext = createContext<DemoStoreValue | null>(null);

const FIELD_LABELS: Record<string, string> = {
  name: "업무명",
  status: "상태",
  progress: "진척률",
  assigneeId: "담당자",
  assigneeIds: "담당자",
  startDate: "시작일",
  endDate: "종료일",
  estimate: "예상 작업량",
  priority: "우선순위",
  predecessors: "선행작업",
};

export function DemoStoreProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<DemoState>(loadState);
  const [activeTaskId, setActiveTaskId] = useState<string | null>(null);
  const [notificationStatus, setNotificationStatus] = useState<NotificationLoadStatus>("idle");
  const [notificationError, setNotificationError] = useState<string | null>(null);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      // 저장 공간이 부족한 경우에도 화면 동작은 유지합니다.
    }
  }, [state]);

  const currentUser = useMemo(
    () => state.users.find((u) => u.id === state.currentUserId) || state.users[0],
    [state.users, state.currentUserId],
  );

  const openTask = useCallback((taskId: string) => setActiveTaskId(taskId), []);
  const closeTask = useCallback(() => setActiveTaskId(null), []);

  const resetDemo = useCallback(() => {
    const next = createInitialState();
    setState(next);
    setActiveTaskId(null);
  }, []);

  const updateTask = useCallback((taskId: string, patch: Partial<Task>) => {
    setState((prev) => {
      const target = prev.tasks.find((t) => t.id === taskId);
      if (!target) return prev;
      // 복수 담당자를 함께 넘기면 대표 담당자(첫 번째)도 같이 맞춥니다.
      const nextPatch: Partial<Task> = patch.assigneeIds
        ? { ...patch, ...settleAssignees(patch.assigneeIds) }
        : patch;
      const entries: HistoryEntry[] = [];
      Object.keys(nextPatch).forEach((key) => {
        const field = key as keyof Task;
        if (patch.assigneeIds && key === "assigneeId") return;
        const before = target[field];
        const after = nextPatch[field];
        const sameArray =
          Array.isArray(before) && Array.isArray(after) && JSON.stringify(before) === JSON.stringify(after);
        if (sameArray || before === after) return;
        if (!FIELD_LABELS[key]) return;
        const format = (value: unknown) => {
          if (value === null || value === undefined || value === "" || (Array.isArray(value) && value.length === 0)) return "없음";
          if (key === "assigneeIds") return assigneeNameText(value as string[], prev.users);
          if (key === "assigneeId") return prev.users.find((u) => u.id === value)?.name || "없음";
          if (key === "status") return TASK_STATUS_LABEL[value as TaskStatus] || String(value);
          if (key === "priority") return PRIORITY_LABEL[value as Priority] || String(value);
          if (key === "estimate") return `${value} 인일`;
          if (key === "progress") return `${value}%`;
          if (key === "predecessors") {
            const ids = value as string[];
            return ids.map((id) => prev.tasks.find((t) => t.id === id)?.name || id).join(", ");
          }
          return String(value);
        };
        entries.push(makeHistory(taskId, prev.currentUserId, FIELD_LABELS[key], format(before), format(after)));
      });
      const recent = prev.history.filter((h) => h.taskId === taskId).slice(0, 20);
      const nowMs = Date.now();
      const deduped = entries.filter(
        (entry) =>
          !recent.some(
            (h) =>
              h.field === entry.field &&
              h.after === entry.after &&
              nowMs - new Date(h.createdAt).getTime() < 3000,
          ),
      );
      return {
        ...prev,
        tasks: prev.tasks.map((t) => (t.id === taskId ? { ...t, ...nextPatch, lastUpdated: isoNow() } : t)),
        history: [...deduped, ...prev.history],
      };
    });
  }, []);

  /** 복수 담당자 지정. 새로 배정된 담당자에게만 배정 알림을 보냅니다. */
  const setTaskAssignees = useCallback((taskId: string, userIds: string[]) => {
    setState((prev) => {
      const target = prev.tasks.find((t) => t.id === taskId);
      if (!target) return prev;
      const before = assigneeIdsOf(target);
      const settled = settleAssignees(userIds);
      if (JSON.stringify(before.slice().sort()) === JSON.stringify(settled.assigneeIds.slice().sort())) return prev;

      const project = target.projectId ? prev.projects.find((p) => p.id === target.projectId) : null;
      const actor = prev.users.find((u) => u.id === prev.currentUserId);
      const added = settled.assigneeIds.filter((id) => !before.includes(id));
      const notifications: NotificationItem[] = added.map((userId) => ({
        id: uid("n"),
        title: "공동 담당 업무로 배정되었습니다",
        body: `${project ? `${project.name} · ` : ""}${target.name} 업무의 담당자로 배정되었습니다.${
          settled.assigneeIds.length > 1 ? ` 공동 담당 ${settled.assigneeIds.length}명.` : ""
        }`,
        createdAt: isoNow(),
        read: false,
        projectId: target.projectId,
        type: "assign" as const,
        targetPath: target.projectId ? `/projects/${target.projectId}/wbs` : "/",
        evidence: `배정자 ${actor?.name || "시스템"}`,
      }));

      return {
        ...prev,
        tasks: prev.tasks.map((t) =>
          t.id === taskId
            ? { ...t, ...settled, lastUpdated: isoNow() }
            : t,
        ),
        notifications: [...notifications, ...prev.notifications],
        history: [
          makeHistory(taskId, prev.currentUserId, "담당자", assigneeNameText(before, prev.users), assigneeNameText(settled.assigneeIds, prev.users)),
          ...prev.history,
        ],
      };
    });
  }, []);

  const setTaskStatus = useCallback((taskId: string, status: TaskStatus) => {
    setState((prev) => {
      const target = prev.tasks.find((t) => t.id === taskId);
      if (!target || target.status === status) return prev;
      let progress = target.progress;
      if (status === "done") progress = 100;
      if (target.status === "done" && status !== "done" && progress === 100) progress = 90;
      const entry = makeHistory(taskId, prev.currentUserId, "상태", TASK_STATUS_LABEL[target.status], TASK_STATUS_LABEL[status]);
      const progressEntry = progress !== target.progress
        ? makeHistory(taskId, prev.currentUserId, "진척률", `${target.progress}%`, `${progress}%`)
        : null;
      return {
        ...prev,
        tasks: prev.tasks.map((t) => (t.id === taskId ? { ...t, status, progress, lastUpdated: isoNow() } : t)),
        history: [...(progressEntry ? [progressEntry, entry] : [entry]), ...prev.history],
      };
    });
  }, []);

  const addTask = useCallback((input: NewTaskInput) => {
    const id = uid("t");
    setState((prev) => {
      const level = input.level || 2;
      const task: Task = {
        id,
        projectId: input.projectId,
        parentId: input.parentId ?? null,
        level,
        stage: input.stage ?? null,
        name: input.name,
        type: input.type || "task",
        assigneeId: input.assigneeId ?? prev.currentUserId,
        ...settleAssignees(
          input.assigneeIds ?? assigneeIdsOf({ assigneeId: input.assigneeId ?? prev.currentUserId }),
        ),
        startDate: input.startDate,
        endDate: input.endDate,
        estimate: input.estimate ?? 1,
        progress: 0,
        status: "todo",
        priority: input.priority || "normal",
        description: input.description || "",
        doneCondition: input.doneCondition || "",
        predecessors: [],
        order: nextOrder(prev.tasks, input.projectId, input.stage ?? null, input.parentId ?? null, level),
        personal: input.personal,
        lastUpdated: isoNow(),
      };
      return { ...prev, tasks: normalizeOrders([...prev.tasks, task]) };
    });
    return id;
  }, []);

  const deleteTask = useCallback((taskId: string) => {
    setState((prev) => {
      const removeIds = new Set<string>([taskId]);
      let changed = true;
      while (changed) {
        changed = false;
        prev.tasks.forEach((t) => {
          if (t.parentId && removeIds.has(t.parentId) && !removeIds.has(t.id)) {
            removeIds.add(t.id);
            changed = true;
          }
        });
      }
      return { ...prev, tasks: prev.tasks.filter((t) => !removeIds.has(t.id)) };
    });
    setActiveTaskId((prev) => (prev === taskId ? null : prev));
  }, []);

  const moveTask = useCallback((taskId: string, direction: "up" | "down" | "indent" | "outdent") => {
    setState((prev) => {
      const tasks = prev.tasks.map((t) => ({ ...t }));
      const current = tasks.find((t) => t.id === taskId);
      if (!current) return prev;

      const siblingsOf = (target: Task) =>
        tasks
          .filter(
            (t) =>
              t.projectId === target.projectId &&
              t.stage === target.stage &&
              t.parentId === target.parentId &&
              t.level === target.level,
          )
          .sort((a, b) => a.order - b.order);

      if (direction === "up" || direction === "down") {
        const siblings = siblingsOf(current);
        const index = siblings.findIndex((t) => t.id === taskId);
        const targetIndex = direction === "up" ? index - 1 : index + 1;
        if (targetIndex < 0 || targetIndex >= siblings.length) return prev;
        const other = siblings[targetIndex];
        const swap = current.order;
        current.order = other.order;
        other.order = swap;
        return { ...prev, tasks: normalizeOrders(tasks) };
      }

      if (direction === "indent") {
        if (current.level !== 2) return prev;
        const siblings = siblingsOf(current);
        const index = siblings.findIndex((t) => t.id === taskId);
        if (index <= 0) return prev;
        const prevSibling = siblings[index - 1];
        current.level = 3;
        current.parentId = prevSibling.id;
        current.order = nextOrder(tasks, current.projectId, current.stage, prevSibling.id, 3);
        return { ...prev, tasks: normalizeOrders(tasks) };
      }

      if (current.level !== 3 || !current.parentId) return prev;
      const parent = tasks.find((t) => t.id === current.parentId);
      current.level = 2;
      current.parentId = null;
      current.order = parent ? parent.order + 0.5 : 999;
      return { ...prev, tasks: normalizeOrders(tasks) };
    });
  }, []);

  const setPredecessors = useCallback((taskId: string, ids: string[]) => {
    setState((prev) => {
      const target = prev.tasks.find((t) => t.id === taskId);
      if (!target) return prev;
      const before = target.predecessors.map((id) => prev.tasks.find((t) => t.id === id)?.name || id).join(", ");
      const after = ids.map((id) => prev.tasks.find((t) => t.id === id)?.name || id).join(", ");
      if (before === after) return prev;
      return {
        ...prev,
        tasks: prev.tasks.map((t) => (t.id === taskId ? { ...t, predecessors: ids } : t)),
        history: [makeHistory(taskId, prev.currentUserId, "선행작업", before || "없음", after || "없음"), ...prev.history],
      };
    });
  }, []);

  const addJournal = useCallback(
    (input: { date: string; content: string; taskId: string | null; progress: number; hours: number }) => {
      setState((prev) => {
        const journal: Journal = {
          id: uid("j"),
          date: input.date,
          userId: prev.currentUserId,
          content: input.content,
          taskId: input.taskId,
          progress: input.progress,
          hours: input.hours,
          createdAt: isoNow(),
        };
        let tasks = prev.tasks;
        let history = prev.history;
        if (input.taskId) {
          const target = prev.tasks.find((t) => t.id === input.taskId);
          if (target && target.progress !== input.progress) {
            history = [makeHistory(input.taskId, prev.currentUserId, "진척률", `${target.progress}%`, `${input.progress}%`), ...history];
            tasks = prev.tasks.map((t) =>
              t.id === input.taskId
                ? {
                    ...t,
                    progress: input.progress,
                    status: input.progress >= 100 ? "done" : t.status === "todo" && input.progress > 0 ? "progress" : t.status,
                    lastUpdated: isoNow(),
                  }
                : t,
            );
          }
        }
        return { ...prev, journals: [journal, ...prev.journals], tasks, history };
      });
    },
    [],
  );

  const addSchedule = useCallback(
    (input: { title: string; date: string; startTime: string; endTime: string; type: "personal" | "meeting" }) => {
      setState((prev) => {
        const schedule: Schedule = {
          id: uid("s"),
          userId: prev.currentUserId,
          title: input.title,
          date: input.date,
          startTime: input.startTime,
          endTime: input.endTime,
          type: input.type,
          projectId: null,
        };
        return { ...prev, schedules: [...prev.schedules, schedule] };
      });
    },
    [],
  );

  const updateSchedule = useCallback((scheduleId: string, patch: Partial<Schedule>) => {
    setState((prev) => ({
      ...prev,
      schedules: prev.schedules.map((s) => (s.id === scheduleId ? { ...s, ...patch } : s)),
    }));
  }, []);

  const deleteSchedule = useCallback((scheduleId: string) => {
    setState((prev) => ({ ...prev, schedules: prev.schedules.filter((s) => s.id !== scheduleId) }));
  }, []);

  const addComment = useCallback((taskId: string, content: string) => {
    setState((prev) => {
      const comment: Comment = { id: uid("c"), taskId, userId: prev.currentUserId, content, createdAt: isoNow() };
      return { ...prev, comments: [...prev.comments, comment] };
    });
  }, []);

  const createProject = useCallback((input: NewProjectInput) => {
    const id = uid("p");
    setState((prev) => {
      const totalDays = Math.max(diffDays(input.startDate, input.endDate), 20);
      const segment = Math.max(Math.floor(totalDays / 5), 3);
      const templates: { stage: StageKey; names: string[] }[] = [
        { stage: "analysis", names: ["현황 분석 및 요구사항 정의", "요구사항 검토·확정"] },
        { stage: "design", names: ["화면·데이터 설계", "설계 리뷰"] },
        { stage: "dev", names: ["핵심 기능 개발", "통합 및 단위 테스트 준비"] },
        { stage: "test", names: ["통합 테스트 수행", "결함 조치 및 재검증"] },
        { stage: "deploy", names: ["이행 계획 수립", "운영 이관 및 안정화"] },
      ];
      const newTasks: Task[] = [];
      templates.forEach((template, stageIndex) => {
        const stageStart = addDays(input.startDate, segment * stageIndex);
        const stageEnd = addDays(input.startDate, Math.min(segment * (stageIndex + 1) - 1, totalDays));
        const mid = addDays(stageStart, Math.max(Math.floor(diffDays(stageStart, stageEnd) / 2), 1));
        newTasks.push({
          id: `${id}-t${stageIndex}-1`,
          projectId: id,
          parentId: null,
          level: 2,
          stage: template.stage,
          name: template.names[0],
          type: "task",
          assigneeId: null,
          startDate: stageStart,
          endDate: mid,
          estimate: 5,
          progress: 0,
          status: "todo",
          priority: "normal",
          description: "",
          doneCondition: "",
          predecessors: stageIndex > 0 ? [`${id}-t${stageIndex - 1}-2`] : [],
          order: 1,
        });
        newTasks.push({
          id: `${id}-t${stageIndex}-2`,
          projectId: id,
          parentId: null,
          level: 2,
          stage: template.stage,
          name: template.names[1],
          type: "task",
          assigneeId: null,
          startDate: addDays(mid, 1),
          endDate: stageEnd,
          estimate: 3,
          progress: 0,
          status: "todo",
          priority: "normal",
          description: "",
          doneCondition: "",
          predecessors: [`${id}-t${stageIndex}-1`],
          order: 2,
        });
      });

      const members: ProjectMember[] = [{ userId: input.pmId, role: "pm" }];
      input.members.forEach((m) => {
        if (!members.some((existing) => existing.userId === m.userId)) members.push(m);
      });

      // 생성 시 승인자를 지정하면 모든 게이트에 동일하게 적용합니다.
      // 지정하지 않아도 생성할 수 있으며, 이 경우 승인자 미지정 상태로 남습니다(자동 승인 없음).
      const gateApprovers: Partial<Record<StageKey, string>> = {};
      const requestedApprover =
        input.gateApproverId && input.gateApproverId !== input.pmId && members.some((m) => m.userId === input.gateApproverId)
          ? input.gateApproverId
          : null;
      if (requestedApprover) {
        STAGES.forEach((stage) => {
          gateApprovers[stage.key] = requestedApprover;
        });
      }

      const project: Project = {
        id,
        name: input.name,
        code: input.code,
        dept: input.dept,
        pmId: input.pmId,
        method: "waterfall",
        stage: "analysis",
        startDate: input.startDate,
        endDate: input.endDate,
        status: "normal",
        visibility: input.visibility,
        actors: input.actors,
        members,
        milestones: [
          { id: `${id}-m1`, name: "요구사항 확정", date: addDays(input.startDate, segment - 1), stage: "analysis" },
          { id: `${id}-m2`, name: "설계 완료", date: addDays(input.startDate, segment * 2 - 1), stage: "design" },
          { id: `${id}-m3`, name: "개발 완료", date: addDays(input.startDate, segment * 3 - 1), stage: "dev" },
          { id: `${id}-m4`, name: "테스트 완료", date: addDays(input.startDate, segment * 4 - 1), stage: "test" },
          { id: `${id}-m5`, name: "이행 완료", date: input.endDate, stage: "deploy" },
        ],
        notice: "프로젝트가 생성되었습니다. 5단계 WBS 기본 업무를 확인하고 담당자를 지정해 주세요.",
        riskScore: 20,
        kanbanWip: { todo: 5, progress: 4, review: 3, done: 99 },
        colorKey: "primary",
        description:
          input.description?.trim() ||
          "프로젝트 생성 시 자동으로 만들어진 기본 개요입니다. 개요는 프로젝트 설정에서 수정할 수 있습니다.",
        gateApprovers,
      };

      const approverNotifications: NotificationItem[] = requestedApprover
        ? [
            {
              id: uid("n"),
              title: "게이트 승인자로 지정되었습니다",
              body: `${project.name} 프로젝트의 모든 단계 게이트 승인자로 지정되었습니다. 승인 요청이 발생하면 알림으로 안내합니다.`,
              createdAt: isoNow(),
              read: false,
              projectId: id,
              type: "deliverable" as const,
              targetPath: `/projects/${id}/settings`,
              evidence: "프로젝트 생성 시 지정 · 전 단계 적용",
            },
          ]
        : [];

      return {
        ...prev,
        projects: [project, ...prev.projects],
        tasks: [...prev.tasks, ...newTasks],
        notifications: [...approverNotifications, ...prev.notifications],
        history: [makeHistory("", prev.currentUserId, "프로젝트 생성", "-", `${project.name} (${project.code})`), ...prev.history],
      };
    });
    return id;
  }, []);

  const setKanbanWip = useCallback((projectId: string, wip: KanbanWip) => {
    setState((prev) => ({
      ...prev,
      projects: prev.projects.map((p) => (p.id === projectId ? { ...p, kanbanWip: wip } : p)),
    }));
  }, []);

  const markNotificationsRead = useCallback(() => {
    setState((prev) => ({ ...prev, notifications: prev.notifications.map((n) => ({ ...n, read: true })) }));
  }, []);

  /**
   * 알림 목록 불러오기.
   * 실제 알림 서버는 연결되어 있지 않아 이 브라우저에 저장된 데모 알림을 읽습니다.
   * 읽기에 실패하면 빈 목록과 구분되는 오류 상태로 남깁니다.
   */
  const loadNotifications = useCallback(async () => {
    setNotificationStatus("loading");
    setNotificationError(null);
    try {
      await new Promise((resolve) => window.setTimeout(resolve, 320));
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as Partial<DemoState>;
        if (parsed.notifications !== undefined && !Array.isArray(parsed.notifications)) {
          throw new Error("invalid-notifications");
        }
      }
      setNotificationStatus("ready");
    } catch {
      setNotificationError("알림을 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.");
      setNotificationStatus("error");
    }
  }, []);

  /* ===== 이슈 · 결함 ===== */
  const addIssue = useCallback((input: NewIssueInput) => {
    const id = uid("i");
    setState((prev) => {
      const issue: Issue = {
        id,
        projectId: input.projectId,
        title: input.title,
        kind: input.kind,
        severity: input.severity,
        status: "registered",
        assigneeId: input.assigneeId,
        reporterId: prev.currentUserId,
        createdAt: TODAY,
        dueDate: input.dueDate,
        relatedTaskId: input.relatedTaskId,
        stage: input.stage,
        reproSteps: input.kind === "defect" ? input.reproSteps : "",
        environment: input.kind === "defect" ? input.environment : "",
        reopenCount: 0,
      };
      return { ...prev, issues: [issue, ...prev.issues] };
    });
    return id;
  }, []);

  const moveIssueStatus = useCallback((issueId: string) => {
    setState((prev) => {
      const issue = prev.issues.find((i) => i.id === issueId);
      if (!issue) return prev;
      const next = nextIssueStatus(issue.status);
      if (!next) return prev;
      return {
        ...prev,
        issues: prev.issues.map((i) =>
          i.id === issueId
            ? {
                ...i,
                status: next,
                closedAt: next === "closed" ? TODAY : i.closedAt,
                closedBy: next === "closed" ? prev.currentUserId : i.closedBy,
              }
            : i,
        ),
      };
    });
  }, []);

  const reopenIssue = useCallback((issueId: string) => {
    setState((prev) => ({
      ...prev,
      issues: prev.issues.map((i) =>
        i.id === issueId && i.status === "closed"
          ? { ...i, status: "confirmed", reopenCount: i.reopenCount + 1, closedAt: undefined, closedBy: undefined }
          : i,
      ),
    }));
  }, []);

  const saveIssueToKnowledge = useCallback((issueId: string) => {
    setState((prev) => {
      const issue = prev.issues.find((i) => i.id === issueId);
      if (!issue || issue.kbDocId) return prev;
      const project = prev.projects.find((p) => p.id === issue.projectId);
      const now = new Date().toISOString();
      const docId = uid("kd");
      const doc: KnowledgeDoc = {
        id: docId,
        title: `[${ISSUE_KIND_LABEL[issue.kind]} 종결] ${issue.title}`,
        body: `프로젝트: ${project?.name || "-"}\n유형: ${ISSUE_KIND_LABEL[issue.kind]} · 심각도 ${issue.severity}\n\n[내용]\n${issue.title}\n\n[재현 절차]\n${issue.reproSteps || "해당 없음"}\n\n[환경]\n${issue.environment || "해당 없음"}\n\n[종결] ${formatDate(issue.closedAt || TODAY)} · 재오픈 ${issue.reopenCount}회`,
        tags: [ISSUE_KIND_LABEL[issue.kind], STAGE_LABEL[issue.stage], "이슈"],
        dept: project?.dept || prev.users.find((u) => u.id === prev.currentUserId)?.dept,
        projectId: issue.projectId,
        visibility: project?.visibility || "department",
        authorId: prev.currentUserId,
        createdAt: now,
        updatedAt: now,
        currentVersion: 1,
        versions: [
          {
            id: uid("kv"),
            version: 1,
            title: `[${ISSUE_KIND_LABEL[issue.kind]} 종결] ${issue.title}`,
            body: issue.reproSteps || issue.title,
            editedBy: prev.currentUserId,
            editedAt: now,
            note: "이슈 종결 시 지식 허브에 저장",
          },
        ],
        sourceType: "issue",
        sourceId: issue.id,
      };
      return {
        ...prev,
        knowledgeDocs: [doc, ...prev.knowledgeDocs],
        issues: prev.issues.map((i) => (i.id === issueId ? { ...i, kbDocId: docId } : i)),
      };
    });
  }, []);

  /* ===== 회의록 ===== */
  const addMeeting = useCallback((input: NewMeetingInput) => {
    const id = uid("mt");
    setState((prev) => {
      const meeting: Meeting = {
        id,
        projectId: input.projectId,
        title: input.title,
        date: input.date,
        attendees: input.attendees,
        content: input.content,
        decisions: input.decisions,
        actionItems: input.actionItems.map((item) => ({
          id: uid("ma"),
          text: item.text,
          assigneeId: item.assigneeId,
          dueDate: item.dueDate,
          estimate: item.estimate,
          stage: item.stage,
          approved: false,
          taskId: null,
        })),
        status: "draft",
        createdAt: isoNow(),
        updatedAt: isoNow(),
      };
      return { ...prev, meetings: [meeting, ...prev.meetings] };
    });
    return id;
  }, []);

  const updateMeeting = useCallback((meetingId: string, patch: Partial<Meeting>) => {
    setState((prev) => ({
      ...prev,
      meetings: prev.meetings.map((m) => (m.id === meetingId ? { ...m, ...patch, updatedAt: isoNow() } : m)),
    }));
  }, []);

  const approveMeetingActionItems = useCallback((meetingId: string, selections: MeetingSelection[]) => {
    setState((prev) => {
      const meeting = prev.meetings.find((m) => m.id === meetingId);
      if (!meeting) return prev;
      const selected = new Map(selections.map((s) => [s.id, s]));
      const newTasks: Task[] = [];
      const actionItems: MeetingActionItem[] = meeting.actionItems.map((item) => {
        const selection = selected.get(item.id);
        if (!selection) return item;
        if (item.taskId) {
          return { ...item, ...selection, approved: true };
        }
        const taskId = uid("t");
        const startDate = selection.dueDate >= TODAY ? TODAY : selection.dueDate;
        newTasks.push({
          id: taskId,
          projectId: meeting.projectId,
          parentId: null,
          level: 2,
          stage: selection.stage,
          name: selection.text || item.text,
          type: "task",
          assigneeId: selection.assigneeId,
          startDate,
          endDate: selection.dueDate,
          estimate: selection.estimate,
          progress: 0,
          status: "todo",
          priority: "normal",
          description: `${meeting.title} 회의 액션아이템에서 생성되었습니다.`,
          doneCondition: "",
          predecessors: [],
          order: nextOrder(prev.tasks, meeting.projectId, selection.stage, null, 2),
        });
        return { ...item, ...selection, approved: true, taskId };
      });
      return {
        ...prev,
        tasks: normalizeOrders([...prev.tasks, ...newTasks]),
        meetings: prev.meetings.map((m) => (m.id === meetingId ? { ...m, actionItems, updatedAt: isoNow() } : m)),
      };
    });
  }, []);

  const saveMeetingToKnowledge = useCallback((meetingId: string) => {
    setState((prev) => {
      const meeting = prev.meetings.find((m) => m.id === meetingId);
      if (!meeting || meeting.kbDocId) return prev;
      const project = prev.projects.find((p) => p.id === meeting.projectId);
      const now = new Date().toISOString();
      const docId = uid("kd");
      const body = `회의일: ${meeting.date}\n참석자: ${meeting.attendees.map((id) => prev.users.find((u) => u.id === id)?.name || id).join(", ")}\n\n[회의 내용]\n${meeting.content}\n\n[결정사항]\n${meeting.decisions.map((d) => `- ${d}`).join("\n")}\n\n[액션아이템]\n${meeting.actionItems.map((a) => `- ${a.text} (${prev.users.find((u) => u.id === a.assigneeId)?.name || "미지정"}, ${a.dueDate})`).join("\n")}`;
      const doc: KnowledgeDoc = {
        id: docId,
        title: `[회의록] ${meeting.title}`,
        body,
        tags: ["회의록", ...meeting.decisions.slice(0, 2).map((d) => d.slice(0, 8))],
        dept: project?.dept || prev.users.find((u) => u.id === prev.currentUserId)?.dept,
        projectId: meeting.projectId,
        visibility: project?.visibility || "department",
        authorId: prev.currentUserId,
        createdAt: now,
        updatedAt: now,
        currentVersion: 1,
        versions: [{ id: uid("kv"), version: 1, title: `[회의록] ${meeting.title}`, body, editedBy: prev.currentUserId, editedAt: now, note: "회의록에서 지식 허브로 저장" }],
        sourceType: "meeting",
        sourceId: meeting.id,
      };
      return {
        ...prev,
        knowledgeDocs: [doc, ...prev.knowledgeDocs],
        meetings: prev.meetings.map((m) => (m.id === meetingId ? { ...m, kbDocId: docId } : m)),
      };
    });
  }, []);

  /* ===== 게시판 ===== */
  const addBoardPost = useCallback((input: NewBoardPostInput) => {
    setState((prev) => {
      const post: BoardPost = {
        id: uid("b"),
        projectId: input.projectId,
        type: input.type,
        title: input.title,
        body: input.body,
        authorId: prev.currentUserId,
        pinned: false,
        attachments: input.attachments,
        createdAt: isoNow(),
        updatedAt: isoNow(),
      };
      return { ...prev, boardPosts: [post, ...prev.boardPosts] };
    });
  }, []);

  const updateBoardPost = useCallback((postId: string, patch: Partial<BoardPost>) => {
    setState((prev) => ({
      ...prev,
      boardPosts: prev.boardPosts.map((p) => (p.id === postId ? { ...p, ...patch, updatedAt: isoNow() } : p)),
    }));
  }, []);

  const deleteBoardPost = useCallback((postId: string) => {
    setState((prev) => ({ ...prev, boardPosts: prev.boardPosts.filter((p) => p.id !== postId) }));
  }, []);

  const togglePinPost = useCallback((postId: string) => {
    setState((prev) => {
      const target = prev.boardPosts.find((p) => p.id === postId);
      if (!target) return prev;
      const willPin = !target.pinned;
      const posts = prev.boardPosts.map((p) => {
        if (p.projectId !== target.projectId) return p;
        if (p.id === postId) return { ...p, pinned: willPin };
        return willPin && p.type === "notice" ? { ...p, pinned: false } : p;
      });
      return {
        ...prev,
        boardPosts: posts,
        projects: prev.projects.map((project) => {
          if (project.id !== target.projectId) return project;
          if (willPin && target.type === "notice") {
            return { ...project, notice: `${target.title} — ${target.body}`.slice(0, 180) };
          }
          return project;
        }),
      };
    });
  }, []);

  /* ===== 산출물 · 검수 ===== */
  const addDeliverableVersion = useCallback((deliverableId: string, input: { note: string; fileName: string }) => {
    setState((prev) => {
      const target = prev.deliverables.find((d) => d.id === deliverableId);
      if (!target) return prev;
      const project = prev.projects.find((p) => p.id === target.projectId) || null;
      const approverId = gateApproverId(project, target.stage);
      const submitter = prev.users.find((u) => u.id === prev.currentUserId);
      const version = bumpVersion(target.currentVersion);

      // 승인 요청은 지정된 승인자에게만 알림으로 전달합니다.
      // 승인자가 없으면 요청은 보내지 않고, 자동 승인도 일어나지 않습니다.
      const requestNotifications: NotificationItem[] = [];
      if (project && approverId) {
        requestNotifications.push({
          id: uid("n"),
          title: "산출물 승인 요청이 도착했습니다",
          body: `${project.name} · ${target.name} ${version} 검수가 요청되었습니다. 검수 의견을 입력해 승인 또는 반려해 주세요.`,
          createdAt: isoNow(),
          read: false,
          projectId: project.id,
          type: "deliverable" as const,
          targetPath: `/projects/${project.id}/collab/deliverables`,
          evidence: `요청자 ${submitter?.name || "시스템"}`,
        });
      } else if (project) {
        requestNotifications.push({
          id: uid("n"),
          title: "게이트 승인자가 지정되지 않았습니다",
          body: `${project.name} · ${target.name} ${version} 이 제출되었지만 승인자가 없어 검수를 진행할 수 없습니다. 승인자 미지정은 자동 승인으로 처리되지 않습니다.`,
          createdAt: isoNow(),
          read: false,
          projectId: project.id,
          type: "deliverable" as const,
          targetPath: `/projects/${project.id}/settings`,
          evidence: "승인자 미지정 · 자동 승인 없음",
        });
      }

      return {
        ...prev,
        notifications: [...requestNotifications, ...prev.notifications],
        deliverables: prev.deliverables.map((d) => {
          if (d.id !== deliverableId) return d;
          return {
            ...d,
            currentVersion: version,
            status: "submitted",
            actualDate: null,
            gateApproverId: approverId,
            reviewComment: "",
            reviewedBy: null,
            reviewedAt: null,
            versions: [
              ...d.versions,
              {
                id: uid("dv"),
                version,
                submitterId: prev.currentUserId,
                submittedAt: TODAY,
                note: input.note,
                fileName: input.fileName,
              },
            ],
          };
        }),
      };
    });
  }, []);

  const reviewDeliverable = useCallback((deliverableId: string, decision: "approved" | "rejected", comment: string) => {
    if (!comment.trim()) return;
    setState((prev) => ({
      ...prev,
      deliverables: prev.deliverables.map((d) =>
        d.id === deliverableId
          ? {
              ...d,
              status: decision,
              reviewComment: comment,
              reviewedBy: prev.currentUserId,
              reviewedAt: TODAY,
              actualDate: decision === "approved" ? TODAY : d.actualDate,
            }
          : d,
      ),
    }));
  }, []);

  const setGateApprover = useCallback(
    (projectId: string, stage: StageKey, approverId: string | null): GateAssignResult => {
      const project = state.projects.find((p) => p.id === projectId);
      if (!project) return { ok: false, message: "프로젝트를 찾을 수 없습니다." };
      if (project.pmId !== state.currentUserId) {
        return { ok: false, message: "게이트 승인자는 현재 PM만 지정할 수 있습니다." };
      }
      if (approverId) {
        const validation = validateGateApprover(project, state.users, approverId);
        if (!validation.ok) return validation;
      }

      setState((prev) => {
        const current = prev.projects.find((p) => p.id === projectId);
        if (!current) return prev;
        const nextApprovers = { ...(current.gateApprovers || {}) };
        if (approverId) nextApprovers[stage] = approverId;
        else delete nextApprovers[stage];
        return {
          ...prev,
          projects: prev.projects.map((p) => (p.id === projectId ? { ...p, gateApprovers: nextApprovers } : p)),
          deliverables: prev.deliverables.map((d) =>
            d.projectId === projectId && d.stage === stage ? { ...d, gateApproverId: approverId } : d,
          ),
        };
      });

      return {
        ok: true,
        message: approverId
          ? `${STAGE_LABEL[stage]} 단계 게이트 승인자를 지정했습니다.`
          : `${STAGE_LABEL[stage]} 단계 승인자 지정을 해제했습니다. 승인자가 없으면 검수와 단계 전환이 진행되지 않습니다.`,
      };
    },
    [state.projects, state.users, state.currentUserId],
  );

  /** 모든 게이트에 같은 승인자를 적용하거나 전체 해제합니다. */
  const setAllGateApprovers = useCallback(
    (projectId: string, approverId: string | null): GateAssignResult => {
      const project = state.projects.find((p) => p.id === projectId);
      if (!project) return { ok: false, message: "프로젝트를 찾을 수 없습니다." };
      if (project.pmId !== state.currentUserId) {
        return { ok: false, message: "게이트 승인자는 현재 PM만 지정할 수 있습니다." };
      }
      if (approverId) {
        const validation = validateGateApprover(project, state.users, approverId);
        if (!validation.ok) return validation;
      }

      setState((prev) => {
        const current = prev.projects.find((p) => p.id === projectId);
        if (!current) return prev;
        const nextApprovers: Partial<Record<StageKey, string>> = {};
        if (approverId) STAGES.forEach((stage) => {
          nextApprovers[stage.key] = approverId;
        });
        return {
          ...prev,
          projects: prev.projects.map((p) => (p.id === projectId ? { ...p, gateApprovers: nextApprovers } : p)),
          deliverables: prev.deliverables.map((d) =>
            d.projectId === projectId ? { ...d, gateApproverId: approverId } : d,
          ),
        };
      });

      return {
        ok: true,
        message: approverId
          ? "모든 게이트 승인자를 동일하게 지정했습니다."
          : "모든 게이트 승인자 지정을 해제했습니다. 승인자가 없으면 자동 승인되지 않습니다.",
      };
    },
    [state.projects, state.users, state.currentUserId],
  );

  /**
   * 게이트 승인자 지정 해제.
   * PM 위임 시 승인자 역할을 자동으로 풀지 않기 위해, 사용자가 직접 실행하는 해제 동작만 둡니다.
   */
  const clearGateApprover = useCallback((projectId: string, stage: StageKey) => {
    setState((prev) => ({
      ...prev,
      projects: prev.projects.map((p) => {
        if (p.id !== projectId) return p;
        const nextApprovers = { ...(p.gateApprovers || {}) };
        delete nextApprovers[stage];
        return { ...p, gateApprovers: nextApprovers };
      }),
      deliverables: prev.deliverables.map((d) =>
        d.projectId === projectId && d.stage === stage ? { ...d, gateApproverId: null } : d,
      ),
    }));
  }, []);

  /**
   * PM 변경·위임.
   * - 현재 PM 또는 시스템 관리자만 실행할 수 있습니다.
   * - 위임 대상이 게이트 승인자이면 차단하고, 승인자 지정을 자동으로 해제하지 않습니다.
   * - 완료 후 프로젝트 PM 표시와 PM 역할 권한이 함께 바뀝니다.
   */
  const changeProjectPm = useCallback(
    (projectId: string, nextPmId: string): PmChangeResult => {
      const project = state.projects.find((p) => p.id === projectId);
      const actor = state.users.find((u) => u.id === state.currentUserId);
      if (!project) {
        return { ok: false, code: "not_found", message: "프로젝트를 찾을 수 없습니다." };
      }
      if (project.pmId !== state.currentUserId && !isSystemAdmin(actor)) {
        return {
          ok: false,
          code: "forbidden",
          message: "PM을 변경할 권한이 없습니다. 현재 PM 또는 시스템 관리자만 위임할 수 있습니다.",
        };
      }
      if (project.pmId === nextPmId) {
        return { ok: false, code: "same", message: "이미 이 프로젝트의 PM입니다. 다른 멤버를 선택해 주세요." };
      }
      const nextUser = state.users.find((u) => u.id === nextPmId);
      if (!nextUser) {
        return { ok: false, code: "not_found", message: "위임 대상 사용자를 찾을 수 없습니다." };
      }
      if (!nextUser.active) {
        return { ok: false, code: "inactive", message: "비활성화된 계정입니다. 활성 계정으로만 PM을 위임할 수 있습니다." };
      }
      const blockedStages = STAGES.filter((s) => project.gateApprovers?.[s.key] === nextPmId);
      if (blockedStages.length > 0) {
        return {
          ok: false,
          code: "gate_approver",
          message:
            "게이트 승인자로 지정된 멤버입니다. 해당 멤버의 게이트 승인자 지정을 먼저 해제한 후 PM을 위임해 주세요.",
        };
      }

      const previousPm = state.users.find((u) => u.id === project.pmId);
      setState((prev) => {
        const current = prev.projects.find((p) => p.id === projectId);
        if (!current) return prev;
        const members: ProjectMember[] = current.members.some((m) => m.userId === nextPmId)
          ? current.members.map((m) => {
              if (m.userId === nextPmId) return { ...m, role: "pm" as RoleKey };
              if (m.userId === current.pmId && m.role === "pm") return { ...m, role: "biz" as RoleKey };
              return m;
            })
          : [
              ...current.members.map((m) =>
                m.userId === current.pmId && m.role === "pm" ? { ...m, role: "biz" as RoleKey } : m,
              ),
              { userId: nextPmId, role: "pm" as RoleKey },
            ];
        return {
          ...prev,
          projects: prev.projects.map((p) => (p.id === projectId ? { ...p, pmId: nextPmId, members } : p)),
          notifications: [
            {
              id: uid("n"),
              title: "프로젝트 PM으로 위임되었습니다",
              body: `${current.name} 프로젝트의 PM으로 지정되었습니다. PM 권한이 함께 부여되었습니다.`,
              createdAt: isoNow(),
              read: false,
              projectId: current.id,
              type: "assign" as const,
              targetPath: `/projects/${current.id}/settings`,
              evidence: `이전 PM ${previousPm?.name || "-"}`,
            },
            ...(previousPm
              ? [
                  {
                    id: uid("n"),
                    title: "프로젝트 PM 역할이 이관되었습니다",
                    body: `${current.name} 프로젝트의 PM이 ${nextUser.name} 님으로 변경되어 PM 권한이 종료되었습니다.`,
                    createdAt: isoNow(),
                    read: false,
                    projectId: current.id,
                    type: "assign" as const,
                    targetPath: `/projects/${current.id}`,
                    evidence: `위임자 ${nextUser.name}`,
                  },
                ]
              : []),
          ],
          auditLogs: [
            {
              id: uid("log"),
              type: "permission",
              userId: nextUser.id,
              userName: nextUser.name,
              ip: "10.20.5.12",
              at: isoNow(),
              detail: `프로젝트 PM 위임 · ${current.name} (${previousPm?.name || "-"} → ${nextUser.name})`,
            },
            ...prev.auditLogs,
          ],
        };
      });

      return {
        ok: true,
        code: "ok",
        message: `PM이 ${previousPm?.name || "-"} 님에서 ${nextUser.name} 님으로 변경되었습니다.`,
      };
    },
    [state.projects, state.users, state.currentUserId],
  );

  const advanceProjectStage = useCallback(
    (projectId: string) => {
      const project = state.projects.find((p) => p.id === projectId);
      if (!project) return { ok: false, message: "프로젝트를 찾을 수 없습니다." };
      const blockers = blockingDeliverables(projectId, project.stage, state.deliverables);
      // 승인자 미지정 상태를 자동 승인으로 처리하지 않습니다.
      const approverId = gateApproverId(project, project.stage);
      if (!approverId) {
        return {
          ok: false,
          message: "게이트 승인자가 지정되지 않아 단계 전환을 진행할 수 없습니다. 멤버·설정에서 승인자를 먼저 지정해 주세요.",
        };
      }
      if (blockers.length > 0) {
        const names = blockers.map((b) => b.name).join(", ");
        const record: GateRecord = {
          id: uid("g"),
          projectId,
          stage: project.stage,
          decision: "blocked",
          approverId,
          decidedAt: isoNow(),
          comment: `필수 산출물 미승인: ${names}`,
        };
        setState((prev) => ({ ...prev, gateRecords: [record, ...prev.gateRecords] }));
        return { ok: false, message: `필수 산출물이 승인되지 않아 전환할 수 없습니다: ${names}` };
      }
      const next = nextStage(project.stage);
      const record: GateRecord = {
        id: uid("g"),
        projectId,
        stage: project.stage,
        decision: "approved",
        approverId,
        decidedAt: isoNow(),
        comment: next ? `${STAGE_LABEL[next]} 단계로 전환` : "프로젝트 완료 처리",
      };
      setState((prev) => ({
        ...prev,
        gateRecords: [record, ...prev.gateRecords],
        projects: prev.projects.map((p) =>
          p.id === projectId ? { ...p, stage: next || p.stage, status: next ? p.status : "done" } : p,
        ),
      }));
      return {
        ok: true,
        message: next ? `${STAGE_LABEL[next]} 단계로 전환했습니다.` : "모든 단계가 완료되어 프로젝트를 완료 처리했습니다.",
      };
    },
    [state.projects, state.deliverables],
  );

  /* ===== AI 리스크 ===== */
  const decideRiskSuggestion = useCallback(
    (
      suggestionId: string,
      decision: "approved" | "rejected",
      override?: { assigneeId?: string | null; endDate?: string; startDate?: string; priority?: Priority },
    ) => {
      setState((prev) => {
        const suggestion = prev.riskSuggestions.find((r) => r.id === suggestionId);
        if (!suggestion || suggestion.status !== "pending") return prev;
        let tasks = prev.tasks;
        let history = prev.history;
        if (decision === "approved") {
          const patch = { ...suggestion.proposed, ...(override || {}) };
          const target = prev.tasks.find((t) => t.id === suggestion.taskId);
          if (target) {
            const entries: HistoryEntry[] = [];
            const format = (key: string, value: unknown) => {
              if (key === "assigneeId") return prev.users.find((u) => u.id === value)?.name || "미지정";
              if (key === "priority") return PRIORITY_LABEL[value as Priority] || String(value);
              return String(value);
            };
            (Object.keys(patch) as (keyof typeof patch)[]).forEach((key) => {
              const value = patch[key];
              if (value === undefined) return;
              if (target[key as keyof Task] === value) return;
              const label = key === "assigneeId" ? "담당자" : key === "endDate" ? "종료일" : key === "startDate" ? "시작일" : "우선순위";
              entries.push(makeHistory(target.id, prev.currentUserId, `리스크 제안 반영 · ${label}`, format(key, target[key as keyof Task]), format(key, value)));
            });
            tasks = prev.tasks.map((t) => (t.id === target.id ? { ...t, ...patch, lastUpdated: isoNow() } : t));
            history = [...entries, ...prev.history];
          }
        }
        return {
          ...prev,
          tasks,
          history,
          riskSuggestions: prev.riskSuggestions.map((r) =>
            r.id === suggestionId ? { ...r, status: decision, decidedBy: prev.currentUserId, decidedAt: isoNow() } : r,
          ),
        };
      });
    },
    [],
  );

  /* ===== AI WBS 초안 반영 ===== */
  const applyWbsDraft = useCallback(
    (projectId: string, draftTasks: WbsDraftApplyItem[], draftMilestones: WbsDraftApplyMilestone[]) => {
      const project = state.projects.find((p) => p.id === projectId);
      if (!project) return 0;
      const existing = new Set(
        state.tasks.filter((t) => t.projectId === projectId).map((t) => `${t.stage}|${t.name}`),
      );
      const toCreate = draftTasks.filter((t) => !existing.has(`${t.stage}|${t.name}`));
      const existingMilestones = new Set(project.milestones.map((m) => `${m.stage}|${m.name}`));
      const newMilestones = draftMilestones.filter((m) => !existingMilestones.has(`${m.stage}|${m.name}`));
      if (toCreate.length === 0 && newMilestones.length === 0) return 0;

      setState((prev) => {
        const stageIndex = (stage: StageKey) => STAGES.findIndex((s) => s.key === stage);
        const created: Task[] = toCreate.map((item, index) => {
          const idx = Math.max(stageIndex(item.stage), 0);
          const stageTaskCount = toCreate.filter((t) => t.stage === item.stage).length || 1;
          const offset = toCreate.filter((t) => t.stage === item.stage).indexOf(item);
          const start = addDays(project.startDate, Math.round(Math.max(0, diffDays(project.startDate, project.endDate) / 5) * idx));
          return {
            id: uid("t"),
            projectId,
            parentId: null,
            level: 2,
            stage: item.stage,
            name: item.name,
            type: "task",
            assigneeId: null,
            startDate: start,
            endDate: addDays(start, Math.max(Math.round(item.estimate * 1.5), 2)),
            estimate: item.estimate,
            progress: 0,
            status: "todo",
            priority: "normal",
            description: item.description,
            doneCondition: "",
            predecessors: [],
            order: index + 1 + offset / stageTaskCount,
          };
        });
        const milestones = newMilestones.map((m) => ({ id: uid("m"), name: m.name, date: m.date, stage: m.stage }));
        return {
          ...prev,
          tasks: normalizeOrders([...prev.tasks, ...created]),
          projects: prev.projects.map((p) => (p.id === projectId ? { ...p, milestones: [...p.milestones, ...milestones] } : p)),
        };
      });
      return toCreate.length;
    },
    [state.tasks, state.projects],
  );

  /* ===== 지식사전 ===== */
  const addKnowledgeDoc = useCallback((input: KnowledgeDocInput) => {
    const id = uid("kd");
    setState((prev) => {
      const now = new Date().toISOString();
      const doc: KnowledgeDoc = {
        id,
        ...input,
        authorId: prev.currentUserId,
        createdAt: now,
        updatedAt: now,
        currentVersion: 1,
        versions: [{ id: uid("kv"), version: 1, title: input.title, body: input.body, editedBy: prev.currentUserId, editedAt: now, note: "최초 작성" }],
        sourceType: null,
        sourceId: null,
      };
      return { ...prev, knowledgeDocs: [doc, ...prev.knowledgeDocs] };
    });
    return id;
  }, []);

  const updateKnowledgeDoc = useCallback((docId: string, input: KnowledgeDocInput, note: string) => {
    setState((prev) => {
      const doc = prev.knowledgeDocs.find((d) => d.id === docId);
      if (!doc) return prev;
      const now = new Date().toISOString();
      const nextVersion = doc.currentVersion + 1;
      return {
        ...prev,
        knowledgeDocs: prev.knowledgeDocs.map((d) =>
          d.id === docId
            ? {
                ...d,
                ...input,
                updatedAt: now,
                currentVersion: nextVersion,
                versions: [
                  ...d.versions,
                  { id: uid("kv"), version: nextVersion, title: input.title, body: input.body, editedBy: prev.currentUserId, editedAt: now, note: note || "내용 수정" },
                ],
              }
            : d,
        ),
      };
    });
  }, []);

  const addGlossaryTerm = useCallback((input: { term: string; definition: string; synonyms: string[]; relatedDocIds: string[] }) => {
    const id = uid("gl");
    setState((prev) => {
      const term: GlossaryEntry = {
        id,
        ...input,
        updatedBy: prev.currentUserId,
        updatedAt: new Date().toISOString(),
        history: [],
      };
      return { ...prev, glossary: [term, ...prev.glossary] };
    });
    return id;
  }, []);

  const updateGlossaryTerm = useCallback(
    (termId: string, input: { term: string; definition: string; synonyms: string[]; relatedDocIds: string[] }) => {
      setState((prev) => ({
        ...prev,
        glossary: prev.glossary.map((g) => {
          if (g.id !== termId) return g;
          const changed = g.definition !== input.definition || g.term !== input.term;
          return {
            ...g,
            ...input,
            updatedBy: prev.currentUserId,
            updatedAt: new Date().toISOString(),
            history: changed
              ? [
                  {
                    id: uid("gh"),
                    before: `${g.term}: ${g.definition}`,
                    after: `${input.term}: ${input.definition}`,
                    editedBy: prev.currentUserId,
                    editedAt: new Date().toISOString(),
                  },
                  ...g.history,
                ]
              : g.history,
          };
        }),
      }));
    },
    [],
  );

  const saveKnowledgeQuestion = useCallback((input: { question: string; answer: string; sourceDocIds: string[] }) => {
    setState((prev) => {
      const question: KnowledgeQuestion = {
        id: uid("kq"),
        ...input,
        askedBy: prev.currentUserId,
        createdAt: new Date().toISOString(),
      };
      return { ...prev, knowledgeQuestions: [question, ...prev.knowledgeQuestions] };
    });
  }, []);

  /* ===== 로그인 · 계정 ===== */
  const login = useCallback(
    (userId: string, password: string): LoginResult => {
      const user = state.users.find((u) => u.id === userId);
      const now = isoNow();
      const ip = "10.20.31.14";
      if (!user) {
        return { ok: false, code: "invalid", message: "입력한 계정을 찾을 수 없습니다. 계정을 다시 확인해 주세요." };
      }

      // 잠금 여부와 남은 시도 횟수는 인증 서버(데모) 응답만 사용합니다.
      const lockMap = readLoginLock();
      const record = lockMap[user.id];
      if (record?.lockedAt) {
        return {
          ok: false,
          code: "locked",
          locked: true,
          attemptsRemaining: 0,
          message: `비밀번호를 ${MAX_LOGIN_ATTEMPTS}회 연속 잘못 입력하여 계정이 잠겼습니다.`,
        };
      }

      if (!user.active) {
        setState((prev) => ({
          ...prev,
          auditLogs: [
            { id: uid("log"), type: "login_fail", userId: user.id, userName: user.name, ip, at: now, detail: "비활성화된 계정 로그인 시도 차단" },
            ...prev.auditLogs,
          ],
        }));
        return { ok: false, code: "inactive", message: "비활성화된 계정입니다. 시스템 관리자에게 문의해 주세요." };
      }

      if (password !== DEMO_PASSWORD) {
        const failures = (record?.failures || 0) + 1;
        const isLocked = failures >= MAX_LOGIN_ATTEMPTS;
        writeLoginLock({
          ...lockMap,
          [user.id]: { failures: isLocked ? MAX_LOGIN_ATTEMPTS : failures, lockedAt: isLocked ? now : null },
        });
        setState((prev) => ({
          ...prev,
          auditLogs: [
            {
              id: uid("log"),
              type: "login_fail",
              userId: user.id,
              userName: user.name,
              ip,
              at: now,
              detail: isLocked
                ? `비밀번호 ${MAX_LOGIN_ATTEMPTS}회 연속 불일치 · 계정 잠금`
                : `비밀번호 불일치 (${failures}/${MAX_LOGIN_ATTEMPTS}회)`,
            },
            ...prev.auditLogs,
          ],
        }));
        if (isLocked) {
          return {
            ok: false,
            code: "locked",
            locked: true,
            attemptsRemaining: 0,
            message: `비밀번호를 ${MAX_LOGIN_ATTEMPTS}회 연속 잘못 입력하여 계정이 잠겼습니다.`,
          };
        }
        return {
          ok: false,
          code: "invalid",
          attemptsRemaining: MAX_LOGIN_ATTEMPTS - failures,
          message: `아이디 또는 비밀번호가 올바르지 않습니다. 남은 시도 ${MAX_LOGIN_ATTEMPTS - failures}회`,
        };
      }

      const nextLock = { ...lockMap };
      delete nextLock[user.id];
      writeLoginLock(nextLock);

      setState((prev) => ({
        ...prev,
        authUserId: user.id,
        currentUserId: user.id,
        auditLogs: [
          { id: uid("log"), type: "login_success", userId: user.id, userName: user.name, ip, at: now, detail: "ID/PW 로그인 성공 · 데모 세션" },
          ...prev.auditLogs,
        ],
      }));
      touchSession(user.id, true);
      return { ok: true, code: "ok", message: "" };
    },
    [state.users],
  );

  /** 인증 서버가 들고 있는 계정 잠금 상태 조회 */
  const getLoginState = useCallback((userId: string) => {
    const record = readLoginLock()[userId];
    const failures = record?.failures || 0;
    return {
      locked: Boolean(record?.lockedAt),
      attemptsRemaining: Math.max(MAX_LOGIN_ATTEMPTS - failures, 0),
    };
  }, []);

  /** 데모 전용 잠금 해제(관리자 초기화 시뮬레이션) */
  const unlockDemoAccount = useCallback((userId: string) => {
    const next = { ...readLoginLock() };
    delete next[userId];
    writeLoginLock(next);
  }, []);

  const logout = useCallback(() => {
    setState((prev) => {
      const user = prev.users.find((u) => u.id === prev.currentUserId);
      return {
        ...prev,
        authUserId: null,
        auditLogs: user
          ? [
              { id: uid("log"), type: "login_success", userId: user.id, userName: user.name, ip: "10.20.31.14", at: isoNow(), detail: "로그아웃 · 데모 세션 종료" },
              ...prev.auditLogs,
            ]
          : prev.auditLogs,
      };
    });
    clearSessionActivity();
    setActiveTaskId(null);
    clearLoginNotices();
  }, []);

  /**
   * 인증 서버 계정 → 화면용 사용자 연결.
   * 1) 이미 연결된 서버 사용자 ID, 2) loginId와 같은 데모 이메일 또는 이메일 앞부분 순으로 찾고,
   * 없으면 서버가 준 이름·권한으로 사용자를 새로 만듭니다. 권한(systemRole)은 항상 서버 값을 따릅니다.
   */
  const signInWithAccount = useCallback((account: AuthAccount) => {
    const { userId: serverUserId, loginId, name, systemRole } = account;
    const key = loginId.trim().toLowerCase();
    clearLoginNotices();
    setState((prev) => {
      const matched =
        prev.users.find((u) => u.serverUserId === serverUserId) ||
        prev.users.find((u) => {
          const email = u.email.toLowerCase();
          return email === key || email.split("@")[0] === key;
        });
      const targetId = matched ? matched.id : `server-${serverUserId}`;
      const linked: User = matched
        ? { ...matched, serverUserId, systemRole, isSystemAdmin: systemRole === "admin" }
        : {
            id: targetId,
            name,
            dept: "-",
            job: "-",
            role: "biz",
            roleLabel: "구성원",
            email: loginId,
            systemRole,
            active: true,
            isSystemAdmin: systemRole === "admin",
            serverUserId,
          };
      const users = matched
        ? prev.users.map((u) => (u.id === matched.id ? linked : u))
        : [...prev.users.filter((u) => u.id !== targetId), linked];
      return {
        ...prev,
        users,
        authUserId: targetId,
        currentUserId: targetId,
        auditLogs: [
          { id: uid("log"), type: "login_success", userId: targetId, userName: linked.name, ip: "-", at: isoNow(), detail: "로그인 성공 · 인증 서버" },
          ...prev.auditLogs,
        ],
      };
    });
    setActiveTaskId(null);
  }, []);

  const syncServerProjects = useCallback((summaries: ServerProjectSummary[]) => {
    setState((prev) => {
      let users = prev.users;
      const synced = summaries.map((summary) => {
        const existing = prev.projects.find((p) => p.serverId === summary.id);
        const merged = mergeServerSummary({ summary, existing, users });
        users = merged.users;
        return merged.project;
      });
      const syncedIds = new Set(synced.map((p) => p.id));
      // 프론트 데모 프로젝트는 그대로 두고, 서버 프로젝트는 서버 목록 기준으로 맞춘다.
      const others = prev.projects.filter((p) => p.serverId === undefined && !syncedIds.has(p.id));
      return { ...prev, users, projects: [...synced, ...others] };
    });
  }, []);

  const syncServerProjectDetail = useCallback(
    ({
      detail,
      phases,
      members,
    }: {
      detail: ServerProjectDetail;
      phases: ServerProjectPhase[] | null;
      members: ServerProjectMember[] | null;
    }) => {
      setState((prev) => {
        const existing = prev.projects.find((p) => p.serverId === detail.id);
        const { project, users } = mergeServerDetail({ detail, phases, members, existing, users: prev.users });
        const projects = existing ? prev.projects.map((p) => (p.serverId === detail.id ? project : p)) : [project, ...prev.projects];
        return { ...prev, users, projects };
      });
    },
    [],
  );

  const removeServerProject = useCallback((serverId: number) => {
    setState((prev) => ({ ...prev, projects: prev.projects.filter((p) => p.serverId !== serverId) }));
  }, []);

  const switchDemoUser = useCallback((userId: string) => {
    clearLoginNotices();
    setState((prev) => {
      const user = prev.users.find((u) => u.id === userId);
      if (!user || !user.active) return prev;
      return {
        ...prev,
        authUserId: userId,
        currentUserId: userId,
        auditLogs: [
          { id: uid("log"), type: "permission", userId, userName: user.name, ip: "10.20.31.14", at: isoNow(), detail: "데모 전용 계정 전환" },
          ...prev.auditLogs,
        ],
      };
    });
    touchSession(userId, true);
    setActiveTaskId(null);
  }, []);

  /**
   * 비밀번호 변경 요청.
   * 실제 인증 API가 없으므로 어떤 경우에도 성공을 반환하지 않습니다.
   * 입력값(비밀번호)은 저장하거나 로그에 남기지 않습니다.
   */
  const requestPasswordChange = useCallback(
    (currentPassword: string, nextPassword: string): LoginResult => {
      if (!currentPassword) {
        return { ok: false, code: "invalid", message: "현재 비밀번호를 입력해 주세요." };
      }
      if (!nextPassword) {
        return { ok: false, code: "invalid", message: "새 비밀번호를 입력해 주세요." };
      }
      const policyError = passwordPolicyError(nextPassword);
      if (policyError) {
        return { ok: false, code: "invalid", message: policyError };
      }
      if (currentPassword !== DEMO_PASSWORD) {
        return { ok: false, code: "invalid", message: "현재 비밀번호가 일치하지 않습니다." };
      }
      setState((prev) => {
        const user = prev.users.find((u) => u.id === prev.currentUserId);
        return {
          ...prev,
          auditLogs: user
            ? [
                {
                  id: uid("log"),
                  type: "permission",
                  userId: user.id,
                  userName: user.name,
                  ip: "10.20.31.14",
                  at: isoNow(),
                  detail: "비밀번호 변경 요청 · 인증 서버 미연결로 실제 변경 없음",
                },
                ...prev.auditLogs,
              ]
            : prev.auditLogs,
        };
      });
      return {
        ok: false,
        code: "unavailable",
        message: "인증 서버가 연결되지 않아 비밀번호는 변경되지 않았습니다. 실제 인증 연동 후 사용할 수 있습니다.",
      };
    },
    [],
  );

  const resetUserPassword = useCallback((userId: string) => {
    setState((prev) => {
      const target = prev.users.find((u) => u.id === userId);
      return {
        ...prev,
        auditLogs: [
          {
            id: uid("log"),
            type: "approval",
            userId: target?.id || userId,
            userName: target?.name || userId,
            ip: "10.20.31.14",
            at: isoNow(),
            detail: "관리자 비밀번호 초기화 요청 (데모 · 실제 변경 없음)",
          },
          ...prev.auditLogs,
        ],
      };
    });
  }, []);

  const updateUser = useCallback((userId: string, patch: Partial<User>) => {
    setState((prev) => {
      const target = prev.users.find((u) => u.id === userId);
      const users = prev.users.map((u) => (u.id === userId ? { ...u, ...patch } : u));
      const nextAuth = patch.active === false && prev.authUserId === userId ? null : prev.authUserId;
      return {
        ...prev,
        users,
        authUserId: nextAuth,
        auditLogs: target
          ? [
              {
                id: uid("log"),
                type: "permission",
                userId: target.id,
                userName: target.name,
                ip: "10.20.5.12",
                at: isoNow(),
                detail: `사용자 정보 변경 · ${Object.keys(patch).join(", ")}`,
              },
              ...prev.auditLogs,
            ]
          : prev.auditLogs,
      };
    });
  }, []);

  const addUser = useCallback((input: NewUserInput) => {
    const id = uid("u");
    setState((prev) => {
      const roleLabel = input.systemRole === "admin" ? "일반 사용자" : input.systemRole === "exec" ? "경영진" : "일반 사용자";
      const user: User = {
        id,
        name: input.name,
        dept: input.dept,
        job: input.job,
        email: input.email,
        role: "biz",
        roleLabel,
        systemRole: input.systemRole,
        active: true,
      };
      return {
        ...prev,
        users: [...prev.users, user],
        auditLogs: [
          { id: uid("log"), type: "permission", userId: id, userName: input.name, ip: "10.20.5.12", at: isoNow(), detail: "신규 사용자 추가" },
          ...prev.auditLogs,
        ],
      };
    });
    return id;
  }, []);

  const markNotificationRead = useCallback((notificationId: string) => {
    setState((prev) => ({
      ...prev,
      notifications: prev.notifications.map((n) => (n.id === notificationId ? { ...n, read: true } : n)),
    }));
  }, []);

  const updateRiskSettings = useCallback((next: RiskSettings, note: string) => {
    setState((prev) => {
      const format = (settings: RiskSettings) =>
        `가중치(지연 ${settings.weights.schedule}% · 병목 ${settings.weights.bottleneck}% · 편중 ${settings.weights.workload}% · 파급 ${settings.weights.impact}%) / 등급 기준(주의 ${settings.thresholds.caution}점, 위험 ${settings.thresholds.danger}점)`;
      const user = prev.users.find((u) => u.id === prev.currentUserId);
      const entry: RiskSettingHistoryEntry = {
        id: uid("rsh"),
        changedBy: prev.currentUserId,
        changedAt: isoNow(),
        note: note || "리스크 설정 변경",
        before: format(prev.riskSettings),
        after: format(next),
      };
      return {
        ...prev,
        riskSettings: { ...next, updatedAt: isoNow(), updatedBy: prev.currentUserId },
        riskSettingHistory: [entry, ...prev.riskSettingHistory],
        auditLogs: [
          {
            id: uid("log"),
            type: "permission",
            userId: prev.currentUserId,
            userName: user?.name || "",
            ip: "10.20.5.12",
            at: isoNow(),
            detail: `AI·리스크 설정 변경 · 다음 계산부터 적용 (${note || "사유 미입력"})`,
          },
          ...prev.auditLogs,
        ],
      };
    });
  }, []);

  const addAuditLog = useCallback((type: AuditType, detail: string, userId?: string) => {
    setState((prev) => {
      const user = prev.users.find((u) => u.id === (userId || prev.currentUserId));
      return {
        ...prev,
        auditLogs: [
          { id: uid("log"), type, userId: user?.id || "", userName: user?.name || "", ip: "10.20.31.14", at: isoNow(), detail },
          ...prev.auditLogs,
        ],
      };
    });
  }, []);

  const value: DemoStoreValue = {
    ...state,
    currentUser,
    signedIn: Boolean(state.authUserId),
    activeTaskId,
    openTask,
    closeTask,
    resetDemo,
    updateTask,
    setTaskStatus,
    addTask,
    deleteTask,
    moveTask,
    setPredecessors,
    addJournal,
    addSchedule,
    updateSchedule,
    deleteSchedule,
    addComment,
    createProject,
    setKanbanWip,
    markNotificationsRead,
    addIssue,
    moveIssueStatus,
    reopenIssue,
    saveIssueToKnowledge,
    addMeeting,
    updateMeeting,
    approveMeetingActionItems,
    saveMeetingToKnowledge,
    addBoardPost,
    updateBoardPost,
    deleteBoardPost,
    togglePinPost,
    addDeliverableVersion,
    reviewDeliverable,
    setGateApprover,
    setAllGateApprovers,
    changeProjectPm,
    clearGateApprover,
    setTaskAssignees,
    advanceProjectStage,
    decideRiskSuggestion,
    applyWbsDraft,
    addKnowledgeDoc,
    updateKnowledgeDoc,
    addGlossaryTerm,
    updateGlossaryTerm,
    saveKnowledgeQuestion,
    login,
    logout,
    signInWithAccount,
    syncServerProjects,
    syncServerProjectDetail,
    removeServerProject,
    switchDemoUser,
    requestPasswordChange,
    resetUserPassword,
    getLoginState,
    unlockDemoAccount,
    updateUser,
    addUser,
    markNotificationRead,
    updateRiskSettings,
    addAuditLog,
    notificationStatus,
    notificationError,
    loadNotifications,
  };

  return <DemoStoreContext.Provider value={value}>{children}</DemoStoreContext.Provider>;
}

export function useDemoStore(): DemoStoreValue {
  const context = useContext(DemoStoreContext);
  if (!context) throw new Error("DemoStoreProvider가 필요합니다.");
  return context;
}

export function stageBounds(project: Project, stage: StageKey): { start: string; end: string } {
  const totalDays = Math.max(diffDays(project.startDate, project.endDate), 1);
  const segment = Math.ceil(totalDays / 5);
  const index = ["analysis", "design", "dev", "test", "deploy"].indexOf(stage);
  return {
    start: addDays(project.startDate, segment * index),
    end: addDays(project.startDate, Math.min(segment * (index + 1) - 1, totalDays)),
  };
}

export const DEMO_STAGE_LABEL = STAGE_LABEL;
export const DEMO_TODAY = TODAY;
export const DEMO_STAMP = nowStamp;