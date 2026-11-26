import type { Health, Project, ProjectMember, RoleKey, StageKey, User } from "@/types";
import type {
  NamedRef,
  ServerProjectDetail,
  ServerProjectMember,
  ServerProjectPhase,
  ServerProjectSummary,
} from "@/features/project/api/projectApi";

/**
 * 서버 프로젝트 → 화면(프론트) 프로젝트 연결 (03. 프로젝트 API v9).
 * 서버에 없는 값(리스크 점수·공지·마일스톤·칸반 WIP·색상 등)은 프론트 값을 쓰고,
 * 이미 연결된 프로젝트면 프론트에서 바꾼 값을 그대로 둔다.
 * 화면 모델은 대표 PM 한 명(pmId)과 주관 부서 이름 한 줄(dept)을 쓰므로 서버의 복수 값을 그에 맞춰 줄인다.
 */

const ROLE_KEYS: RoleKey[] = ["pm", "biz", "dev", "qa"];
const COLOR_KEYS = ["primary", "accent", "emerald", "secondary", "amber"];
const DEFAULT_WIP = { todo: 5, progress: 4, review: 3, done: 99 };
const NO_DEPARTMENT = "-";

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
    serverUserId,
  };
  return { users: [...users, created], userId };
};

/** 주관 부서 0~N개 → 화면의 부서 한 줄. 없으면 '-' */
export const departmentLabel = (departments: NamedRef[]) =>
  departments.length > 0 ? departments.map(({ name }) => name).join(", ") : NO_DEPARTMENT;

const healthFrom = function ({ status }: ServerProjectSummary, existing?: Project): Health {
  if (status === "completed") return "done";
  if (status === "onHold" || status === "cancelled") return "caution";
  // 진행 상태는 리스크 계산 결과(화면 값)를 유지한다.
  if (existing && existing.status !== "done") return existing.status;
  return "normal";
};

/** 고정 단계로 볼 수 있는(기본 폭포수 이름의) 단계만 쓴다. 사용자 정의 단계는 화면의 고정 단계 표시에 쓰지 않는다. */
const knownPhases = (phases: ServerProjectPhase[] | null) =>
  (phases ?? []).filter((phase): phase is ServerProjectPhase & { stage: StageKey } => phase.stage !== null);

const stageFrom = function (phases: ServerProjectPhase[] | null, existing?: Project): StageKey {
  const known = knownPhases(phases);
  if (known.length === 0) return existing?.stage ?? "analysis";
  const current = known.find(({ status }) => status === "inProgress");
  if (current) return current.stage;
  const next = known.find(({ status }) => status === "notStarted");
  return next ? next.stage : known[known.length - 1].stage;
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
  const { id, code, name, methodology, visibility, departments, pms, startDate, endDate } = summary;
  let nextUsers = users;
  const pmIds = pms.map((pm) => {
    const result = ensureServerUser({ users: nextUsers, serverUserId: pm.id, name: pm.name });
    nextUsers = result.users;
    return result.userId;
  });
  // 활성 PM이 없는 프로젝트도 있다(관리자 재지정 전). 그때는 대표 PM을 비워 아무도 PM 권한을 갖지 않게 한다.
  const pmId = pmIds[0] ?? "";
  const dept = departmentLabel(departments);
  const base: Project = existing ?? {
    id: serverProjectRouteId(id),
    name,
    code,
    dept,
    pmId,
    method: methodology,
    stage: "analysis",
    startDate: startDate ?? "",
    endDate: endDate ?? "",
    status: "normal",
    visibility,
    actors: ["pm"],
    members: [],
    milestones: [],
    notice: "",
    riskScore: 0,
    kanbanWip: DEFAULT_WIP,
    colorKey: COLOR_KEYS[id % COLOR_KEYS.length],
    description: "",
    gateApprovers: {},
  };
  // 서버 PM 목록에 맞춘다: 목록에 없는 사람의 PM 역할은 뺀다(새 역할은 멤버 API에서 받는다), 목록의 PM은 PM으로 둔다.
  const pmSet = new Set(pmIds);
  const others = base.members.filter(({ userId, role }) => !pmSet.has(userId) && role !== "pm");
  const members: ProjectMember[] = [...pmIds.map((userId) => ({ userId, role: "pm" as RoleKey })), ...others];
  return {
    users: nextUsers,
    project: {
      ...base,
      serverId: id,
      name,
      code,
      dept,
      pmId,
      method: methodology,
      // 기간은 생성 후 입력할 수 있어 비어 있을 수 있다. 화면은 빈 값을 '-'로 표시한다.
      startDate: startDate ?? "",
      endDate: endDate ?? "",
      visibility,
      status: healthFrom(summary, existing),
      members,
      // 목록 응답에는 단계가 없다. 상세에서 단계를 받은 적이 없으면 '모름'으로 둔다.
      serverStageKnown: existing?.serverStageKnown ?? false,
    },
  };
};

/**
 * 상세(액터)·멤버 목록·단계(진행 단계·게이트 승인자)까지 반영한다.
 * members가 null이면(받지 못함) 목록에서 만든 멤버를 그대로 둔다.
 */
export const mergeServerDetail = function ({
  detail,
  phases,
  members,
  existing,
  users,
}: {
  detail: ServerProjectDetail;
  phases: ServerProjectPhase[] | null;
  members: ServerProjectMember[] | null;
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

  const serverMembers =
    members === null
      ? merged.project.members
      : members
          .filter(({ actor }) => isRoleKey(actor))
          .map(({ userId, name, actor }) => ({ userId: toUserId(userId, name), role: actor as RoleKey }));
  const actors = detail.actors.filter(isRoleKey);

  const known = knownPhases(phases);
  const gateApprovers: Partial<Record<StageKey, string>> = {};
  known.forEach(({ stage, gateApproverUserId, gateApproverName }) => {
    if (gateApproverUserId !== null) gateApprovers[stage] = toUserId(gateApproverUserId, gateApproverName ?? "");
  });

  return {
    users: nextUsers,
    project: {
      ...merged.project,
      actors: actors.length > 0 ? actors : merged.project.actors,
      members: serverMembers,
      stage: stageFrom(phases, existing),
      serverStageKnown: known.length > 0,
      gateApprovers: phases ? gateApprovers : merged.project.gateApprovers,
    },
  };
};
