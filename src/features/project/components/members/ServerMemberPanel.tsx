import { useCallback, useEffect, useId, useRef, useState } from "react";
import Avatar from "@/components/ui/Avatar";
import { Badge } from "@/components/ui/Badge";
import {
  changeProjectMemberRole,
  fetchAllProjectMembers,
  removeProjectMember,
  type AssignedTask,
  type ProjectActor,
  type ServerProjectMember,
} from "@/features/project/api/projectApi";
import { PROJECT_MEMBER_TEXT } from "@/features/project/i18n/member";
import {
  actorLabel,
  canManageServerMembers,
  isLastPm,
  pmCountOf,
  roleChangeKind,
  roleOptionsFor,
} from "@/features/project/utils/memberRules";
import { interpretRemoveFailure, interpretRoleChangeFailure, memberLoadFailureMessage } from "@/features/project/utils/memberFailure";
import MemberConfirmDialog from "@/features/project/components/members/MemberConfirmDialog";
import { TASK_STATUS_LABEL } from "@/shared/i18n/catalog/status";
import { formatLabel } from "@/shared/i18n/store";

type ListState =
  | { phase: "loading" }
  | { phase: "error"; message: string }
  | { phase: "ready"; members: ServerProjectMember[] };

type Pending =
  | { kind: "role"; member: ServerProjectMember; after: ProjectActor }
  | { kind: "remove"; member: ServerProjectMember };

type Notice = { tone: "ok" | "error"; text: string; tasks: AssignedTask[] } | null;

interface ServerMemberPanelProps {
  projectId: number;
  /** 프로젝트에 지정한 액터. 역할은 이 중에서만 고른다 */
  actors: ProjectActor[];
  /** 로그인한 사용자의 서버 사용자 ID. 서버 멤버 목록에서 PM인지 판단한다 */
  viewerUserId: number | null;
  viewerIsExecutive: boolean;
  /**
   * 화면이 아는 게이트 승인자의 서버 사용자 ID. 승인자는 PM이 될 수 없고 제외할 수 없어 미리 막는다.
   * 고정 단계 이름이 아닌 단계의 승인자는 모를 수 있으므로 최종 판정은 서버(400·409)가 한다.
   */
  approverUserIds?: number[];
  /** 역할·멤버가 바뀐 뒤(이력·화면 프로젝트를 다시 받도록) 알린다 */
  onChanged: () => void;
}

/**
 * api 모드 멤버 목록과 역할 관리 (FR-PRJ-04).
 * - 목록: GET .../members (역할·담당 업무 수)
 * - PM만: 역할 변경(PM 추가·해제 포함, PATCH .../role), 제외(DELETE). 비PM·경영진은 읽기 전용.
 * - 마지막 PM 해제·제외는 화면에서 먼저 막고, 서버 거부(409·400)는 안내 문구로 보여 준다.
 */
const ServerMemberPanel = function ({
  projectId,
  actors,
  viewerUserId,
  viewerIsExecutive,
  approverUserIds = [],
  onChanged,
}: ServerMemberPanelProps) {
  const [list, setList] = useState<ListState>({ phase: "loading" });
  const [pending, setPending] = useState<Pending | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [notice, setNotice] = useState<Notice>(null);
  const loadRef = useRef<AbortController | null>(null);
  const actionRef = useRef<AbortController | null>(null);
  const submittingRef = useRef(false);
  const titleId = useId();
  const lastPmHintId = useId();
  const approverHintId = useId();

  const reload = useCallback(() => {
    loadRef.current?.abort();
    const controller = new AbortController();
    loadRef.current = controller;
    setList((prev) => (prev.phase === "ready" ? prev : { phase: "loading" }));
    fetchAllProjectMembers({ projectId, signal: controller.signal }).then((result) => {
      if (controller.signal.aborted) return;
      if (result.ok === false) {
        setList({ phase: "error", message: memberLoadFailureMessage(result.failure, PROJECT_MEMBER_TEXT.loadFailed) });
        return;
      }
      setList({ phase: "ready", members: result.data });
    });
  }, [projectId]);

  // 프로젝트가 바뀌면 부모가 key로 새로 만든다. 다시 받을 때는 받은 목록을 유지한 채 바꾼다.
  useEffect(() => {
    reload();
    return () => {
      loadRef.current?.abort();
      actionRef.current?.abort();
    };
  }, [reload]);

  if (list.phase === "loading") {
    return (
      <section className="card px-4 py-6" aria-busy="true">
        <p role="status" className="text-center text-[12px] text-foreground-500">
          {PROJECT_MEMBER_TEXT.loading}
        </p>
      </section>
    );
  }

  if (list.phase === "error") {
    return (
      <section role="alert" className="card px-4 py-6 text-center">
        <p className="text-[12.5px] font-medium text-foreground-900">{PROJECT_MEMBER_TEXT.loadFailed}</p>
        {list.message !== PROJECT_MEMBER_TEXT.loadFailed && <p className="mt-1 text-[11px] text-foreground-600">{list.message}</p>}
        <button type="button" className="btn-outline mt-3" onClick={reload}>
          {PROJECT_MEMBER_TEXT.retry}
        </button>
      </section>
    );
  }

  const { members } = list;
  const pmCount = pmCountOf(members);
  const canManage = canManageServerMembers({ members, viewerUserId, viewerIsExecutive });

  const close = () => {
    if (!submittingRef.current) setPending(null);
  };

  const finish = (next: Notice, { stale, changed }: { stale: boolean; changed: boolean }) => {
    submittingRef.current = false;
    setSubmitting(false);
    setPending(null);
    setNotice(next);
    if (stale) reload();
    if (changed) onChanged();
  };

  const confirm = async () => {
    if (!pending || submittingRef.current) return;
    submittingRef.current = true;
    setSubmitting(true);
    actionRef.current?.abort();
    const controller = new AbortController();
    actionRef.current = controller;
    const { member } = pending;
    const name = member.name || PROJECT_MEMBER_TEXT.unknownName;

    if (pending.kind === "role") {
      const { after } = pending;
      const result = await changeProjectMemberRole({ projectId, userId: member.userId, actor: after, signal: controller.signal });
      if (controller.signal.aborted) return;
      if (result.ok === false) {
        const view = interpretRoleChangeFailure(result.failure, roleChangeKind(member.actor, after));
        finish({ tone: "error", text: view.message, tasks: [] }, { stale: view.stale, changed: false });
        return;
      }
      const updated = result.data;
      // 서버가 화면이 모르는 역할을 돌려주면(null) 반영은 됐으므로 목록을 다시 받는다.
      if (updated) {
        setList((prev) =>
          prev.phase === "ready" ? { ...prev, members: prev.members.map((item) => (item.userId === updated.userId ? updated : item)) } : prev,
        );
      }
      finish(
        { tone: "ok", text: formatLabel(PROJECT_MEMBER_TEXT.roleChanged, { name, after: actorLabel(after) }), tasks: [] },
        { stale: !updated, changed: true },
      );
      return;
    }

    const result = await removeProjectMember({ projectId, userId: member.userId, signal: controller.signal });
    if (controller.signal.aborted) return;
    if (result.ok === false) {
      const view = interpretRemoveFailure(result.failure);
      finish({ tone: "error", text: view.message, tasks: view.tasks }, { stale: view.stale, changed: false });
      return;
    }
    setList((prev) => (prev.phase === "ready" ? { ...prev, members: prev.members.filter((item) => item.userId !== member.userId) } : prev));
    finish({ tone: "ok", text: formatLabel(PROJECT_MEMBER_TEXT.removed, { name }), tasks: [] }, { stale: false, changed: true });
  };

  const pendingKind = pending?.kind === "role" ? roleChangeKind(pending.member.actor, pending.after) : null;
  const pendingTitle =
    pending?.kind === "remove"
      ? PROJECT_MEMBER_TEXT.confirmRemoveTitle
      : pendingKind === "pmAdd"
        ? PROJECT_MEMBER_TEXT.confirmPmAddTitle
        : pendingKind === "pmRelease"
          ? PROJECT_MEMBER_TEXT.confirmPmReleaseTitle
          : PROJECT_MEMBER_TEXT.confirmRoleTitle;

  return (
    <section className="card overflow-hidden" aria-labelledby={titleId}>
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-background-200 px-4 py-3">
        <h4 id={titleId} className="text-[13px] font-semibold text-foreground-950">
          {formatLabel(PROJECT_MEMBER_TEXT.title, { count: members.length })}
        </h4>
        <span className="flex flex-wrap items-center gap-1.5 text-[10.5px] text-foreground-500">
          <Badge className="border-primary-200 bg-primary-50 text-primary-700">{formatLabel(PROJECT_MEMBER_TEXT.pmCount, { count: pmCount })}</Badge>
          {!canManage && (
            <Badge className="border-background-300 bg-background-100 text-foreground-600">
              <i className="ri-eye-line" aria-hidden="true" /> {PROJECT_MEMBER_TEXT.readOnly}
            </Badge>
          )}
        </span>
      </div>

      {notice && (
        <div
          role={notice.tone === "error" ? "alert" : "status"}
          className={`mx-4 mt-3 rounded-md border px-3 py-2 text-[11px] leading-5 ${
            notice.tone === "ok" ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-rose-200 bg-rose-50 text-rose-700"
          }`}
        >
          <p>{notice.text}</p>
          {notice.tasks.length > 0 && (
            <ul className="mt-1 list-disc pl-4">
              {notice.tasks.map((task) => (
                <li key={task.taskId}>
                  {task.title} · {TASK_STATUS_LABEL[task.status]}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {members.length === 0 ? (
        <p className="px-4 py-6 text-center text-[12px] text-foreground-500">{PROJECT_MEMBER_TEXT.empty}</p>
      ) : (
        <ul className="grid grid-cols-1 gap-2 px-4 py-3 sm:grid-cols-2 xl:grid-cols-3">
          {members.map((member) => {
            const name = member.name || PROJECT_MEMBER_TEXT.unknownName;
            const locked = isLastPm(member, pmCount);
            const isMe = member.userId === viewerUserId;
            const isApprover = member.actor !== "pm" && approverUserIds.includes(member.userId);
            const describedBy = locked ? lastPmHintId : isApprover ? approverHintId : undefined;
            return (
              <li
                key={member.userId}
                className="flex flex-col gap-2 rounded-lg border border-background-200 bg-background-50 px-3 py-2"
                data-testid={`member-${member.userId}`}
              >
                <div className="flex items-center gap-2.5">
                  <Avatar name={name} size="sm" />
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-1.5">
                      <span className="truncate text-[12.5px] font-medium text-foreground-900">{name}</span>
                      {isMe && <Badge className="border-background-300 bg-background-100 text-foreground-600">{PROJECT_MEMBER_TEXT.me}</Badge>}
                      {member.actor === "pm" && <Badge className="border-primary-200 bg-primary-50 text-primary-700">{actorLabel("pm")}</Badge>}
                      {isApprover && <Badge className="border-accent-200 bg-accent-50 text-accent-800">{PROJECT_MEMBER_TEXT.approver}</Badge>}
                    </span>
                    <span className="block truncate text-[10.5px] text-foreground-500">
                      {actorLabel(member.actor)} · {formatLabel(PROJECT_MEMBER_TEXT.assignedTasks, { count: member.assignedTaskCount })}
                    </span>
                  </span>
                </div>
                {canManage && (
                  <div className="flex items-center gap-1.5">
                    <select
                      className="field min-w-0 flex-1 text-[11.5px]"
                      value={member.actor}
                      aria-label={formatLabel(PROJECT_MEMBER_TEXT.roleSelect, { name })}
                      aria-describedby={describedBy}
                      disabled={submitting || locked}
                      onChange={(event) => {
                        const after = event.target.value as ProjectActor;
                        if (after === member.actor) return;
                        setNotice(null);
                        setPending({ kind: "role", member, after });
                      }}
                    >
                      {roleOptionsFor(member, actors).map((actor) => (
                        <option key={actor} value={actor} disabled={isApprover && actor === "pm"}>
                          {actorLabel(actor)}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      className="btn-outline whitespace-nowrap px-2 text-[11px] disabled:cursor-not-allowed disabled:opacity-60"
                      aria-label={formatLabel(PROJECT_MEMBER_TEXT.removeAria, { name })}
                      aria-describedby={describedBy}
                      disabled={submitting || locked || isApprover}
                      onClick={() => {
                        setNotice(null);
                        setPending({ kind: "remove", member });
                      }}
                    >
                      <i className="ri-user-unfollow-line" aria-hidden="true" /> {PROJECT_MEMBER_TEXT.remove}
                    </button>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {canManage && pmCount <= 1 && (
        <p id={lastPmHintId} className="px-4 pb-3 text-[10.5px] leading-4 text-foreground-500">
          {PROJECT_MEMBER_TEXT.lastPmHint}
        </p>
      )}

      {canManage && members.some((member) => member.actor !== "pm" && approverUserIds.includes(member.userId)) && (
        <p id={approverHintId} className="px-4 pb-3 text-[10.5px] leading-4 text-foreground-500">
          {PROJECT_MEMBER_TEXT.approverHint}
        </p>
      )}

      <MemberConfirmDialog
        open={pending !== null}
        title={pendingTitle}
        confirmLabel={pending?.kind === "remove" ? PROJECT_MEMBER_TEXT.confirmRemove : PROJECT_MEMBER_TEXT.confirmChange}
        tone={pending?.kind === "remove" || pendingKind === "pmRelease" ? "danger" : "default"}
        submitting={submitting}
        onConfirm={confirm}
        onClose={close}
      >
        {pending?.kind === "remove" && (
          <p>{formatLabel(PROJECT_MEMBER_TEXT.confirmRemoveBody, { name: pending.member.name || PROJECT_MEMBER_TEXT.unknownName })}</p>
        )}
        {pending?.kind === "role" && (
          <>
            <p>
              {formatLabel(PROJECT_MEMBER_TEXT.confirmRoleBody, {
                name: pending.member.name || PROJECT_MEMBER_TEXT.unknownName,
                before: actorLabel(pending.member.actor),
                after: actorLabel(pending.after),
              })}
            </p>
            {pendingKind === "pmAdd" && <p className="text-[11px] text-foreground-600">{PROJECT_MEMBER_TEXT.pmAddNote}</p>}
            {pendingKind === "pmRelease" && pending.member.userId === viewerUserId && (
              <p className="text-[11px] text-rose-700">{PROJECT_MEMBER_TEXT.pmReleaseSelfNote}</p>
            )}
          </>
        )}
      </MemberConfirmDialog>
    </section>
  );
};

export default ServerMemberPanel;
