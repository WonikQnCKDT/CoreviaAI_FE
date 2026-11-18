import { useEffect, useRef, useState, type FormEvent } from "react";
import { useCursorList } from "@/features/admin/hooks/useCursorList";
import {
  changeProjectMemberRole, delegateProjectPm, fetchProjectMemberHistory, fetchProjectMembers,
  inviteProjectMember, removeProjectMember, type ProjectActor,
} from "@/features/project/api/projectApi";
import { PROJECT_ACTOR_LABEL, projectApiError } from "@/features/project/i18n/ko";
import { positiveServerId } from "@/features/project/utils/serverProjectInput";
import type { ApiResult } from "@/shared/api/client";

interface Props {
  projectId: number;
  actors: ProjectActor[];
  isPm: boolean;
  onPmChanged: () => void;
}

export default function ServerProjectMembers({ projectId, actors, isPm, onPmChanged }: Props) {
  const members = useCursorList({
    queryKey: String(projectId),
    fetchPage: ({ cursor, signal }) => fetchProjectMembers({ projectId, cursor, signal }),
  });
  const history = useCursorList({
    queryKey: String(projectId),
    fetchPage: ({ cursor, signal }) => fetchProjectMemberHistory({ projectId, cursor, signal }),
  });
  const [inviteId, setInviteId] = useState("");
  const [role, setRole] = useState("");
  const [nextPmId, setNextPmId] = useState("");
  const [previousRole, setPreviousRole] = useState("");
  const [removing, setRemoving] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{ error: boolean; message: string } | null>(null);
  const pending = useRef<AbortController | null>(null);
  const roles = actors.filter((actor) => actor !== "pm");

  useEffect(() => () => pending.current?.abort(), []);

  const mutate = async (request: (signal: AbortSignal) => Promise<ApiResult<unknown>>, onSuccess?: () => void) => {
    if (pending.current) return;
    const controller = new AbortController();
    pending.current = controller;
    setBusy(true);
    setNotice(null);
    try {
      const result = await request(controller.signal);
      if (controller.signal.aborted) return;
      if (result.ok === false) {
        setNotice({ error: true, message: projectApiError(result.failure) });
        return;
      }
      setNotice({ error: false, message: "변경사항을 저장했습니다." });
      members.reload();
      history.reload();
      onSuccess?.();
      onPmChanged();
    } finally {
      pending.current = null;
      if (!controller.signal.aborted) setBusy(false);
    }
  };

  const invite = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const userId = positiveServerId(inviteId);
    const actor = roles.find((value) => value === role);
    if (!userId || !actor) {
      setNotice({ error: true, message: "사용자 ID와 초대 역할을 확인해 주세요." });
      return;
    }
    void mutate((signal) => inviteProjectMember({ projectId, userId, actor, signal }), () => setInviteId(""));
  };

  const delegate = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const newPmUserId = positiveServerId(nextPmId);
    const actor = roles.find((value) => value === previousRole);
    if (!newPmUserId || (!actor && previousRole !== "REMOVE")) {
      setNotice({ error: true, message: "새 PM과 기존 PM의 처리 방식을 선택해 주세요." });
      return;
    }
    void mutate((signal) => delegateProjectPm({ projectId, newPmUserId, previousPmActor: actor ?? null, signal }), () => { setNextPmId(""); setPreviousRole(""); });
  };

  return (
    <div className="space-y-4">
      <section className="card space-y-3" aria-labelledby="server-project-members">
        <h2 id="server-project-members" className="text-lg font-semibold">프로젝트 멤버</h2>
        {notice && <p role={notice.error ? "alert" : "status"}>{notice.message}</p>}
        {isPm && roles.length > 0 && (
          <form onSubmit={invite} className="flex flex-wrap items-end gap-2">
            <label>초대할 사용자 ID<input className="field" required inputMode="numeric" value={inviteId} onChange={(e) => setInviteId(e.target.value)} /></label>
            <label>초대 역할<select className="field" required value={role} onChange={(e) => setRole(e.target.value)}>
              <option value="">선택</option>
              {roles.map((actor) => <option key={actor} value={actor}>{PROJECT_ACTOR_LABEL[actor]}</option>)}
            </select></label>
            <button className="btn-primary" disabled={busy}>초대</button>
          </form>
        )}
        {members.state.phase === "loading" && <p role="status">멤버를 불러오는 중입니다.</p>}
        {members.state.phase === "error" && <p role="alert">{members.state.message} <button type="button" className="btn-outline" onClick={members.reload}>다시 시도</button></p>}
        {members.state.phase === "ready" && (
          <>
            {members.state.items.length === 0 && <p>등록된 멤버가 없습니다.</p>}
            <ul className="divide-y divide-background-200">
              {members.state.items.map((member) => (
                <li key={member.userId} className="flex flex-wrap items-center gap-3 py-2">
                  <span className="font-medium">{member.name}</span>
                  <span>{PROJECT_ACTOR_LABEL[member.actor]}</span>
                  <span>담당 업무 {member.assignedTaskCount}건</span>
                  {isPm && member.actor !== "pm" && (
                    <>
                      <select className="field w-auto" aria-label={`${member.name} 역할 변경`} value={member.actor} disabled={busy}
                        onChange={(e) => {
                          const actor = roles.find((value) => value === e.target.value);
                          if (actor) void mutate((signal) => changeProjectMemberRole({ projectId, userId: member.userId, actor, signal }));
                        }}>
                        {roles.map((actor) => <option key={actor} value={actor}>{PROJECT_ACTOR_LABEL[actor]}</option>)}
                      </select>
                      {removing === member.userId ? (
                        <>
                          <button type="button" className="btn-outline" disabled={busy} onClick={() => void mutate(
                            (signal) => removeProjectMember({ projectId, userId: member.userId, signal }),
                            () => setRemoving(null),
                          )}>제외 확인</button>
                          <button type="button" className="btn-outline" disabled={busy} onClick={() => setRemoving(null)}>취소</button>
                        </>
                      ) : <button type="button" className="btn-outline" disabled={busy} onClick={() => setRemoving(member.userId)}>멤버 제외</button>}
                    </>
                  )}
                </li>
              ))}
            </ul>
            {members.state.more.phase === "error" && <p role="alert">{members.state.more.message}</p>}
            {members.state.hasNext && <button type="button" className="btn-outline" disabled={members.state.more.phase === "loading"} onClick={members.loadMore}>멤버 더 보기</button>}
            {isPm && members.state.items.some((member) => member.actor !== "pm") && (
              <form className="flex flex-wrap items-end gap-2" onSubmit={delegate}>
                <label>새 PM<select className="field" required value={nextPmId} onChange={(e) => setNextPmId(e.target.value)}>
                  <option value="">선택</option>
                  {members.state.items.filter((member) => member.actor !== "pm").map((member) => <option key={member.userId} value={member.userId}>{member.name}</option>)}
                </select></label>
                <label>기존 PM 처리<select className="field" required value={previousRole} onChange={(e) => setPreviousRole(e.target.value)}>
                  <option value="">선택</option>
                  {roles.map((actor) => <option key={actor} value={actor}>{PROJECT_ACTOR_LABEL[actor]}로 변경</option>)}
                  <option value="REMOVE">멤버에서 제외</option>
                </select></label>
                <button className="btn-outline" disabled={busy}>PM 위임</button>
              </form>
            )}
          </>
        )}
      </section>

      <section className="card space-y-3" aria-labelledby="server-member-history">
        <h2 id="server-member-history" className="text-lg font-semibold">멤버 변경 이력</h2>
        {history.state.phase === "loading" && <p role="status">변경 이력을 불러오는 중입니다.</p>}
        {history.state.phase === "error" && <p role="alert">{history.state.message} <button type="button" className="btn-outline" onClick={history.reload}>다시 시도</button></p>}
        {history.state.phase === "ready" && (
          <>
            {history.state.items.length === 0 && <p>변경 이력이 없습니다.</p>}
            <ul className="divide-y divide-background-200">
              {history.state.items.map((entry) => (
                <li key={entry.id} className="flex flex-wrap gap-3 py-2">
                  <span>{entry.userName}</span>
                  <span>{entry.beforeActor ? PROJECT_ACTOR_LABEL[entry.beforeActor] : "미등록"} → {entry.afterActor ? PROJECT_ACTOR_LABEL[entry.afterActor] : "제외"}</span>
                  <span>{entry.changedByName}</span>
                  <time dateTime={entry.occurredAt}>{new Date(entry.occurredAt).toLocaleString("ko-KR")}</time>
                </li>
              ))}
            </ul>
            {history.state.more.phase === "error" && <p role="alert">{history.state.more.message}</p>}
            {history.state.hasNext && <button type="button" className="btn-outline" disabled={history.state.more.phase === "loading"} onClick={history.loadMore}>이력 더 보기</button>}
          </>
        )}
      </section>
    </div>
  );
}
