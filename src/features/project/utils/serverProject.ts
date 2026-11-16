import type { Health, Project, RoleKey, StageKey, User } from "@/types";
import type {
  ServerProjectDetail,
  ServerProjectPhase,
  ServerProjectSummary,
} from "@/features/project/api/projectApi";

/**
 * 서버 프로젝트 → 화면(프론트) 프로젝트 연결.
 * 서버에 없는 값(리스크 점수·공지·마일스톤·칸반 WIP·색상 등)은 프론트 값을 쓰고,
 * 이미 연결된 프로젝트면 프론트에서 바꾼 값을 그대로 둔다.
 */

const ROLE_KEYS: RoleKey[] = ["pm", "biz", "dev", "qa"];
const COLOR_KEYS = ["primary", "accent", "emerald", "secondary", "amber"];
const DEFAULT_WIP = { todo: 5, progress: 4, review: 3, done: 99 };

const isRoleKey = (value: string): value is RoleKey => (ROLE_KEYS as string[]).includes(value);

/** 화면 라우트에서 쓰는 프로젝트 id. 서버 id를 그대로 쓴다 (예: /projects/12). */
export const serverProjectRouteId = (serverId: number) => String(serverId);

/** 서버 사용자 id → 화면 사용자. 없으면 서버가 준 이름으로 만든다. */
export const ensureServerUser = function ({
  users,
  serverUserId,
  name,
}: {
  users: User[];
  serverUserId: number;
  name: string;
}): { users: User[]; userId: string } {
  const found = users.find((user) => user.serverUserId === serverUserId);
  if (found) return { users, userId: found.id };
  const userId = `server-${serverUserId}`;
  const existing = users.find((user) => user.id === userId);
  if (existing) return { users, userId };
  const created: User = {
    id: userId,
    name,
    dept: "-",
    job: "-",
    role: "biz",
    roleLabel: "구성원",
    email: "",
    systemRole: "user",
    active: true,
    canCreateProject: false,
    serverUserId,
  };
  return { users: [...users, created], userId };
};

const healthFrom = function ({ status }: ServerProjectSummary, existing?: Project): Health {
  if (status === "completed") return "done";
  if (status === "onHold" || status === "cancelled") return "caution";
  // 진행 상태는 리스크 계산 결과(화면 값)를 유지한다.
  if (existing && existing.status !== "done") return existing.status;
  return "normal";
};

const stageFrom = function (phases: ServerProjectPhase[] | null, existing?: Project): StageKey {
  if (!phases || phases.length === 0) return existing?.stage ?? "analysis";
  const current = phases.find(({ status }) => status === "inProgress");
  if (current) return current.stage;
  const next = phases.find(({ status }) => status === "notStarted");
  return next ? next.stage : phases[phases.length - 1].stage;
};

/** 목록·상세 공통 정보로 화면 프로젝트를 만들거나 갱신한다. */
export const mergeServerSummary = function ({
  summary,
  existing,
  users,
}: {
  summary: ServerProjectSummary;
  existing?: Project;
  users: User[];
}): { project: Project; users: User[] } {
  const { id, code, name, methodology, visibility, departmentName, pmUserId, pmName, startDate, endDate } = summary;
  const pm = ensureServerUser({ users, serverUserId: pmUserId, name: pmName });
  const base: Project = existing ?? {
    id: serverProjectRouteId(id),
    name,
    code,
    dept: departmentName,
    pmId: pm.userId,
    method: methodology,
    stage: "analysis",
    startDate,
    endDate,
    status: "normal",
    visibility,
    actors: ["pm"],
    members: [{ userId: pm.userId, role: "pm" }],
    milestones: [],
    notice: "",
    riskScore: 0,
    kanbanWip: DEFAULT_WIP,
    colorKey: COLOR_KEYS[id % COLOR_KEYS.length],
    description: "",
    gateApprovers: {},
  };
  // 서버 PM이 바뀌었으면(PM 위임) 멤버 목록의 PM 역할도 맞춘다.
  const members = base.members.some(({ userId, role }) => userId === pm.userId && role === "pm")
    ? base.members
    : [{ userId: pm.userId, role: "pm" as RoleKey }, ...base.members.filter(({ userId }) => userId !== pm.userId)];
  return {
    users: pm.users,
    project: {
      ...base,
      serverId: id,
      name,
      code,
      dept: departmentName,
      pmId: pm.userId,
      method: methodology,
      startDate,
      endDate,
      visibility,
      status: healthFrom(summary, existing),
      members,
      // 목록 응답에는 단계가 없다. 상세에서 단계를 받은 적이 없으면 '모름'으로 둔다.
      serverStageKnown: existing?.serverStageKnown ?? false,
    },
  };
};

/** 상세(액터·멤버)와 폭포수 단계(진행 단계·게이트 승인자)까지 반영한다. */
export const mergeServerDetail = function ({
  detail,
  phases,
  existing,
  users,
}: {
  detail: ServerProjectDetail;
  phases: ServerProjectPhase[] | null;
  existing?: Project;
  users: User[];
}): { project: Project; users: User[] } {
  const merged = mergeServerSummary({ summary: detail, existing, users });
  let nextUsers = merged.users;
  const toUserId = (serverUserId: number, name: string) => {
    const result = ensureServerUser({ users: nextUsers, serverUserId, name });
    nextUsers = result.users;
    return result.userId;
  };

  const members = detail.members
    .filter(({ actor }) => isRoleKey(actor))
    .map(({ userId, name, actor }) => ({ userId: toUserId(userId, name), role: actor as RoleKey }));
  const actors = detail.actors.filter(isRoleKey);

  const gateApprovers: Partial<Record<StageKey, string>> = {};
  (phases ?? []).forEach(({ stage, gateApproverUserId, gateApproverName }) => {
    if (gateApproverUserId !== null) gateApprovers[stage] = toUserId(gateApproverUserId, gateApproverName ?? "");
  });

  return {
    users: nextUsers,
    project: {
      ...merged.project,
      actors: actors.length > 0 ? actors : merged.project.actors,
      members: members.length > 0 ? members : merged.project.members,
      stage: stageFrom(phases, existing),
      serverStageKnown: Boolean(phases && phases.length > 0),
      gateApprovers: phases ? gateApprovers : merged.project.gateApprovers,
    },
  };
};
