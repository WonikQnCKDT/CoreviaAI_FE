import { useEffect, useId, useRef, useState } from "react";
import UserSearchPicker from "@/features/project/components/UserSearchPicker";
import type { DirectoryUser } from "@/features/project/api/directoryApi";
import { inviteProjectMembers, type ProjectActor } from "@/features/project/api/projectApi";
import { PROJECT_SETTINGS_TEXT, USER_SEARCH_TEXT } from "@/features/project/i18n/ko";
import { PROJECT_MEMBER_TEXT } from "@/features/project/i18n/member";
import { actorLabel, inviteRoleOptions, MAX_INVITE_MEMBERS } from "@/features/project/utils/memberRules";
import { interpretInviteFailure } from "@/features/project/utils/memberFailure";
import { formatLabel } from "@/shared/i18n/store";

interface Candidate {
  user: DirectoryUser;
  actor: ProjectActor;
}

type Notice = { tone: "ok" | "error"; text: string } | null;

interface ServerMemberInvitePanelProps {
  projectId: number;
  /** 프로젝트에 지정한 액터. 초대 역할은 이 중 PM을 뺀 것에서 고른다 */
  actors: ProjectActor[];
  /** 이미 멤버인 서버 사용자 ID(검색 결과에서 뺀다. 최종 판정은 서버 409) */
  memberUserIds: readonly number[];
  /** 현재 PM이고 경영진이 아니어야 초대할 수 있다 */
  canInvite: boolean;
  /** 초대 성공·목록이 낡았을 때 멤버 목록·이력·화면 프로젝트를 다시 받도록 알린다 */
  onInvited: () => void;
}

/**
 * api 모드 멤버·설정 › 멤버 초대 (POST /api/projects/{id}/members, FR-PRJ-04).
 * 이름으로 찾아(GET /api/users/search, UserSearchPicker) 1~100명을 고르고 각자 역할을 정해 한 번에 보낸다.
 * 서버는 한 명이라도 거부하면 아무도 초대하지 않으므로, 실패하면 고른 목록을 그대로 두고 사유를 보여 준다.
 */
const ServerMemberInvitePanel = function ({ projectId, actors, memberUserIds, canInvite, onInvited }: ServerMemberInvitePanelProps) {
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [notice, setNotice] = useState<Notice>(null);
  const submittingRef = useRef(false);
  const controllerRef = useRef<AbortController | null>(null);
  const titleId = useId();
  const searchId = useId();

  useEffect(() => () => controllerRef.current?.abort(), []);

  const roleOptions = inviteRoleOptions(actors);
  const noRole = roleOptions.length === 0;
  const atLimit = candidates.length >= MAX_INVITE_MEMBERS;
  const pickerReason = noRole
    ? PROJECT_MEMBER_TEXT.inviteNeedActor
    : atLimit
      ? formatLabel(PROJECT_MEMBER_TEXT.inviteLimit, { max: MAX_INVITE_MEMBERS })
      : undefined;

  if (!canInvite) {
    return (
      <section className="card px-4 py-3" aria-labelledby={titleId}>
        <h4 id={titleId} className="text-[13px] font-semibold text-foreground-950">
          {PROJECT_SETTINGS_TEXT.inviteTitle}
        </h4>
        <p className="mt-2 flex items-start gap-1.5 text-[11px] leading-5 text-foreground-600">
          <i className="ri-information-line mt-0.5 shrink-0" aria-hidden="true" />
          <span>{PROJECT_SETTINGS_TEXT.pmOnlyInvite}</span>
        </p>
      </section>
    );
  }

  const add = (user: DirectoryUser) => {
    const [firstRole] = roleOptions;
    if (!firstRole) return;
    setNotice(null);
    setCandidates((prev) =>
      prev.length >= MAX_INVITE_MEMBERS || prev.some((item) => item.user.id === user.id) ? prev : [...prev, { user, actor: firstRole }],
    );
  };

  const submit = async () => {
    if (submittingRef.current || candidates.length === 0) return;
    submittingRef.current = true;
    setSubmitting(true);
    setNotice(null);
    controllerRef.current?.abort();
    const controller = new AbortController();
    controllerRef.current = controller;
    const result = await inviteProjectMembers({
      projectId,
      members: candidates.map(({ user, actor }) => ({ userId: user.id, actor })),
      signal: controller.signal,
    });
    if (controller.signal.aborted) return;
    submittingRef.current = false;
    setSubmitting(false);
    if (result.ok === false) {
      const view = interpretInviteFailure(result.failure);
      setNotice({ tone: "error", text: view.message });
      if (view.stale) onInvited();
      return;
    }
    setNotice({ tone: "ok", text: formatLabel(PROJECT_MEMBER_TEXT.invited, { count: candidates.length }) });
    setCandidates([]);
    onInvited();
  };

  const excluded = [...memberUserIds, ...candidates.map(({ user }) => user.id)];

  return (
    <section className="card space-y-2.5 px-4 py-3" aria-labelledby={titleId}>
      <div>
        <h4 id={titleId} className="text-[13px] font-semibold text-foreground-950">
          {PROJECT_SETTINGS_TEXT.inviteTitle}
        </h4>
        <p className="mt-0.5 text-[10.5px] leading-4 text-foreground-500">
          {PROJECT_MEMBER_TEXT.inviteHint}
        </p>
      </div>

      <UserSearchPicker
        id={searchId}
        label={PROJECT_MEMBER_TEXT.inviteSearch}
        onSelect={add}
        excludeUserIds={excluded}
        disabled={submitting || noRole || atLimit}
        disabledReason={pickerReason}
      />

      {candidates.length === 0 ? (
        <p className="text-[11.5px] text-foreground-500">{PROJECT_MEMBER_TEXT.inviteEmpty}</p>
      ) : (
        <ul className="divide-y divide-background-200 rounded-lg border border-background-300" aria-label={PROJECT_SETTINGS_TEXT.inviteTitle}>
          {candidates.map(({ user, actor }) => (
            <li key={user.id} className="flex flex-wrap items-center gap-2 px-3 py-2">
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[12px] font-medium text-foreground-900">{user.name}</span>
                <span className="block truncate text-[10.5px] text-foreground-500">
                  {[user.departmentName ?? USER_SEARCH_TEXT.noDepartment, user.jobTitle].filter(Boolean).join(" · ")}
                </span>
              </span>
              <select
                className="field w-auto text-[12px]"
                aria-label={formatLabel(PROJECT_MEMBER_TEXT.inviteRole, { name: user.name })}
                value={actor}
                disabled={submitting}
                onChange={(event) => {
                  const next = event.target.value as ProjectActor;
                  setCandidates((prev) => prev.map((item) => (item.user.id === user.id ? { ...item, actor: next } : item)));
                }}
              >
                {roleOptions.map((role) => (
                  <option key={role} value={role}>
                    {actorLabel(role)}
                  </option>
                ))}
              </select>
              <button
                type="button"
                className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg text-foreground-500 hover:bg-background-200 hover:text-foreground-900"
                aria-label={formatLabel(PROJECT_MEMBER_TEXT.inviteRemove, { name: user.name })}
                disabled={submitting}
                onClick={() => setCandidates((prev) => prev.filter((item) => item.user.id !== user.id))}
              >
                <i className="ri-close-line text-[15px]" aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>
      )}

      {notice && (
        <p
          role={notice.tone === "error" ? "alert" : "status"}
          className={`rounded-md border px-3 py-2 text-[11px] leading-5 ${
            notice.tone === "ok" ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-rose-200 bg-rose-50 text-rose-700"
          }`}
        >
          {notice.text}
        </p>
      )}

      <div className="flex justify-end">
        <button type="button" className="btn-primary whitespace-nowrap" onClick={submit} disabled={submitting || candidates.length === 0}>
          {submitting ? (
            <>
              <i className="ri-loader-4-line animate-spin motion-reduce:animate-none" aria-hidden="true" />
              {PROJECT_MEMBER_TEXT.inviting}
            </>
          ) : (
            <>
              <i className="ri-user-add-line" aria-hidden="true" /> {formatLabel(PROJECT_MEMBER_TEXT.inviteSubmit, { count: candidates.length })}
            </>
          )}
        </button>
      </div>
    </section>
  );
};

export default ServerMemberInvitePanel;
