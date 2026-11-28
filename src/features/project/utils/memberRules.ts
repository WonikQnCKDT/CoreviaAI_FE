import type { ProjectActor, ServerProjectMember } from "@/features/project/api/projectApi";
import type { RoleKey } from "@/types";
import { ROLE_LABEL } from "@/shared/i18n/catalog/status";
import { MEMBER_CHANGE_LABEL, MEMBER_EXTRA_ACTOR_LABEL, PROJECT_MEMBER_TEXT } from "@/features/project/i18n/member";

/**
 * 멤버·역할 관리 화면 규칙 (FR-PRJ-04, BE ProjectMemberPolicy와 같은 기준).
 * 화면은 미리 막아 실수를 줄이고, 최종 판정(마지막 PM·승인자·지정 액터)은 서버가 한다.
 */

/** BE ProjectMemberPolicy.MIN_PM_COUNT */
export const MIN_PM_COUNT = 1;

const ROLE_KEYS: readonly string[] = ["pm", "biz", "dev", "qa"];

export const actorLabel = function (actor: ProjectActor | null): string {
  if (actor === null) return PROJECT_MEMBER_TEXT.noActor;
  if (ROLE_KEYS.includes(actor)) return ROLE_LABEL[actor as RoleKey];
  return MEMBER_EXTRA_ACTOR_LABEL[actor as keyof typeof MEMBER_EXTRA_ACTOR_LABEL] ?? actor;
};

/** 모르는 변경 유형은 서버 값을 그대로 보여 준다. */
export const changeTypeLabel = (changeType: string) => MEMBER_CHANGE_LABEL[changeType] ?? changeType;

export const pmCountOf = (members: ServerProjectMember[]) => members.filter(({ actor }) => actor === "pm").length;

/**
 * 멤버를 관리(역할 변경·제외)할 수 있는지. 서버 멤버 목록에서 본인이 PM일 때만이다.
 * 경영진은 프로젝트에서 읽기 전용이라 PM이 될 수 없지만, 화면에서도 한 번 더 막는다.
 */
export const canManageServerMembers = function ({
  members,
  viewerUserId,
  viewerIsExecutive,
}: {
  members: ServerProjectMember[];
  viewerUserId: number | null;
  viewerIsExecutive: boolean;
}) {
  if (viewerUserId === null || viewerIsExecutive) return false;
  return members.some(({ userId, actor }) => userId === viewerUserId && actor === "pm");
};

/** 마지막 PM은 해제·제외할 수 없다(409 LAST_PM_REQUIRED를 미리 막는다). */
export const isLastPm = (member: ServerProjectMember, pmCount: number) => member.actor === "pm" && pmCount <= MIN_PM_COUNT;

/**
 * 고를 수 있는 역할: 프로젝트에 지정한 액터만, 중복 없이 지정 순서대로.
 * 현재 역할은 목록에 없더라도(지정이 바뀐 경우) 선택 상태를 보여 주려고 맨 앞에 둔다.
 */
export const roleOptionsFor = function (member: ServerProjectMember, actors: ProjectActor[]): ProjectActor[] {
  const unique = [...new Set(actors)];
  return unique.includes(member.actor) ? unique : [member.actor, ...unique];
};

export type RoleChangeKind = "pmAdd" | "pmRelease" | "role";

export const roleChangeKind = function (before: ProjectActor, after: ProjectActor): RoleChangeKind {
  if (after === "pm") return "pmAdd";
  if (before === "pm") return "pmRelease";
  return "role";
};

const pageLocale = function () {
  if (typeof document === "undefined") return "ko-KR";
  return document.documentElement.lang || "ko-KR";
};

/** 서버 시각(UTC ISO)을 화면 locale 기준 날짜·시각으로 표시한다. 읽을 수 없으면 원래 값을 그대로 둔다. */
export const formatOccurredAt = function ({ iso, locale = pageLocale() }: { iso: string; locale?: string }) {
  const date = new Date(iso);
  if (!iso || Number.isNaN(date.getTime())) return iso;
  return new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "short" }).format(date);
};
