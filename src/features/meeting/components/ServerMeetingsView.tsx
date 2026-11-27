import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { Badge } from "@/components/ui/Badge";
import EmptyState from "@/components/ui/EmptyState";
import { useAuth } from "@/features/auth/authContext";
import {
  createMeeting,
  deleteMeeting,
  fetchMeeting,
  fetchMeetings,
  updateMeeting,
  type MeetingDetail,
  type MeetingInput,
  type MeetingSummary,
} from "@/features/meeting/api/meetingApi";
import MeetingFormDialog from "@/features/meeting/components/MeetingFormDialog";
import { MEETING_TEXT } from "@/features/meeting/i18n/ko";
import {
  canCreateMeeting,
  canEditMeeting,
  emptyMeetingForm,
  formFromMeeting,
  interpretMeetingFailure,
  isProtectedMeeting,
  sameMeetingInput,
  type MeetingAction,
} from "@/features/meeting/utils/meetingRules";
import { newRequestId } from "@/features/mywork/utils/todoRules";
import { kstDateOf, kstTimeOf, kstToday } from "@/features/mywork/utils/scheduleRules";
import { fetchAllProjectMembers, type ServerProjectMember } from "@/features/project/api/projectApi";
import type { WbsViewer } from "@/features/wbs/utils/wbsRules";
import type { ApiResult } from "@/shared/api/client";
import { formatLabel } from "@/shared/i18n/store";
import type { Project } from "@/types";

type ListState =
  | { phase: "loading" }
  | { phase: "unavailable" }
  | { phase: "error"; message: string }
  | { phase: "ready"; items: MeetingSummary[]; nextCursor: string | null; members: ServerProjectMember[] };

type DetailState = { phase: "idle" } | { phase: "loading" } | { phase: "error"; message: string } | { phase: "ready"; meeting: MeetingDetail };
type Notice = { tone: "success" | "error"; text: string } | null;

const heldText = (iso: string) => (iso ? `${kstDateOf(iso)} ${kstTimeOf(iso)}` : "");

/**
 * api 모드 회의록(FR-DOC-01): 목록·검색(커서 더 보기), 상세, 작성·수정(전체 교체)·삭제.
 * 화면은 서버가 성공을 응답한 뒤에만 바뀐다. 본문·결정사항은 텍스트로만 그린다.
 */
export default function ServerMeetingsView({ project }: { project: Project & { serverId: number } }) {
  const projectId = project.serverId;
  const { account } = useAuth();
  const [list, setList] = useState<ListState>({ phase: "loading" });
  const [keyword, setKeyword] = useState("");
  const [appliedKeyword, setAppliedKeyword] = useState("");
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [detail, setDetail] = useState<DetailState>({ phase: "idle" });
  const [dialog, setDialog] = useState<"create" | "edit" | null>(null);
  const [dialogError, setDialogError] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<Notice>(null);
  const busyRef = useRef(false);
  const pendingRef = useRef<{ requestId: string; input: MeetingInput } | null>(null);
  const listController = useRef<AbortController | null>(null);
  const detailController = useRef<AbortController | null>(null);
  // '더 보기' 응답이 늦게 와도 그 사이 검색어가 바뀌었으면 붙이지 않는다
  const keywordRef = useRef(appliedKeyword);
  keywordRef.current = appliedKeyword;

  const loadList = useCallback(() => {
    listController.current?.abort();
    const controller = new AbortController();
    listController.current = controller;
    const { signal } = controller;
    setList((prev) => (prev.phase === "ready" ? prev : { phase: "loading" }));
    Promise.all([fetchMeetings({ projectId, keyword: appliedKeyword, signal }), fetchAllProjectMembers({ projectId, signal })]).then(([page, members]) => {
      if (signal.aborted) return;
      if (page.ok === false) {
        if (page.failure.kind === "http" && page.failure.status === 404) setList({ phase: "unavailable" });
        else setList({ phase: "error", message: interpretMeetingFailure("load", page.failure).message });
        return;
      }
      if (members.ok === false) {
        setList({ phase: "error", message: interpretMeetingFailure("load", members.failure).message });
        return;
      }
      setList({ phase: "ready", items: page.data.items, nextCursor: page.data.hasNext ? page.data.nextCursor : null, members: members.data });
      setSelectedId((prev) => (prev !== null && page.data.items.some((m) => m.id === prev) ? prev : (page.data.items[0]?.id ?? null)));
    });
  }, [projectId, appliedKeyword]);

  const loadDetail = useCallback(
    (meetingId: number) => {
      detailController.current?.abort();
      const controller = new AbortController();
      detailController.current = controller;
      setDetail({ phase: "loading" });
      fetchMeeting({ projectId, meetingId, signal: controller.signal }).then((result) => {
        if (controller.signal.aborted) return;
        if (result.ok === true) setDetail({ phase: "ready", meeting: result.data });
        else setDetail({ phase: "error", message: result.failure.kind === "http" && result.failure.status === 404 ? MEETING_TEXT.notFound : MEETING_TEXT.detailFailed });
      });
    },
    [projectId],
  );

  useEffect(() => {
    loadList();
    return () => listController.current?.abort();
  }, [loadList]);

  useEffect(() => {
    if (selectedId === null) setDetail({ phase: "idle" });
    else loadDetail(selectedId);
    return () => detailController.current?.abort();
  }, [selectedId, loadDetail]);

  const loadMore = async () => {
    if (list.phase !== "ready" || !list.nextCursor) return;
    const requested = appliedKeyword;
    const result = await fetchMeetings({ projectId, keyword: requested, cursor: list.nextCursor });
    if (keywordRef.current !== requested) return;
    if (result.ok === false) {
      setNotice({ tone: "error", text: interpretMeetingFailure("load", result.failure).message });
      return;
    }
    setList((prev) => {
      if (prev.phase !== "ready") return prev;
      const known = new Set(prev.items.map((m) => m.id));
      return { ...prev, items: [...prev.items, ...result.data.items.filter((m) => !known.has(m.id))], nextCursor: result.data.hasNext ? result.data.nextCursor : null };
    });
  };

  const members = list.phase === "ready" ? list.members : [];
  const userId = account?.userId ?? null;
  const viewer: WbsViewer = { userId, actor: members.find((m) => m.userId === userId)?.actor ?? null };

  const run = async function <T>(action: MeetingAction, request: () => Promise<ApiResult<T>>, onSuccess: (data: T) => void, inDialog: boolean): Promise<boolean> {
    if (busyRef.current) return false;
    busyRef.current = true;
    setBusy(true);
    setDialogError("");
    const result = await request();
    busyRef.current = false;
    setBusy(false);
    if (result.ok === true) {
      onSuccess(result.data);
      return true;
    }
    const view = interpretMeetingFailure(action, result.failure);
    if (action === "create" && view.resetRequest) pendingRef.current = null;
    if (inDialog && !view.reload) {
      setDialogError(view.message);
      return false;
    }
    setNotice({ tone: "error", text: view.message });
    if (inDialog) setDialog(null);
    if (view.reload) {
      loadList();
      if (selectedId !== null) loadDetail(selectedId);
    }
    return false;
  };

  const submit = async (input: MeetingInput) => {
    if (dialog === "create") {
      const pending = pendingRef.current;
      const requestId = pending && sameMeetingInput(pending.input, input) ? pending.requestId : newRequestId();
      pendingRef.current = { requestId, input };
      await run("create", () => createMeeting({ projectId, requestId, input }), (meeting) => {
        pendingRef.current = null;
        setDialog(null);
        setNotice({ tone: "success", text: formatLabel(MEETING_TEXT.created, { name: meeting.title }) });
        setSelectedId(meeting.id);
        setDetail({ phase: "ready", meeting });
        loadList();
      }, true);
      return;
    }
    if (detail.phase !== "ready") return;
    const { meeting } = detail;
    await run("update", () => updateMeeting({ projectId, meetingId: meeting.id, version: meeting.version, input }), (updated) => {
      setDialog(null);
      setNotice({ tone: "success", text: formatLabel(MEETING_TEXT.updated, { name: updated.title }) });
      setDetail({ phase: "ready", meeting: updated });
      loadList();
    }, true);
  };

  const remove = (meeting: MeetingDetail) => {
    if (!window.confirm(formatLabel(MEETING_TEXT.confirmDelete, { name: meeting.title }))) return;
    void run("delete", () => deleteMeeting({ projectId, meetingId: meeting.id }), () => {
      setNotice({ tone: "success", text: formatLabel(MEETING_TEXT.deleted, { name: meeting.title }) });
      setSelectedId(null);
      loadList();
    }, false);
  };

  const closeDialog = () => {
    // 결과를 모르는 등록이 있었으면 목록을 다시 받아 실제로 만들어졌는지 보이게 하고, 키는 버린다
    if (pendingRef.current) loadList();
    pendingRef.current = null;
    setDialog(null);
  };

  const applySearch = (event: FormEvent) => {
    event.preventDefault();
    setAppliedKeyword(keyword.trim());
  };

  if (list.phase === "loading") return <p role="status" className="py-10 text-center text-[13px] text-foreground-500">{MEETING_TEXT.loading}</p>;
  if (list.phase === "unavailable") return <EmptyState icon="ri-file-list-3-line" title={MEETING_TEXT.unavailable} />;
  if (list.phase === "error") {
    return <EmptyState tone="danger" icon="ri-error-warning-line" title={MEETING_TEXT.loadFailed} description={list.message}
      action={<button type="button" className="btn-outline" onClick={loadList}>{MEETING_TEXT.retry}</button>} />;
  }

  const detailBody = () => {
    if (detail.phase === "idle") return <p className="text-[12.5px] text-foreground-500">{MEETING_TEXT.select}</p>;
    if (detail.phase === "loading") return <p role="status" className="text-[12.5px] text-foreground-500">{MEETING_TEXT.loading}</p>;
    if (detail.phase === "error") {
      return (
        <div className="space-y-2">
          <p role="alert" className="text-[12.5px] text-rose-700">{detail.message}</p>
          {selectedId !== null && <button type="button" className="btn-outline" onClick={() => loadDetail(selectedId)}>{MEETING_TEXT.retry}</button>}
        </div>
      );
    }
    const { meeting } = detail;
    const editable = canEditMeeting(viewer, meeting);
    const locked = isProtectedMeeting(meeting);
    return (
      <article className="space-y-3" aria-label={meeting.title}>
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <h4 className="text-[15px] font-semibold text-foreground-950">{meeting.title}</h4>
            <p className="text-[11.5px] text-foreground-500">{MEETING_TEXT.heldAt} {heldText(meeting.heldAt)} · {MEETING_TEXT.author} {meeting.authorName || `#${meeting.authorUserId}`}</p>
          </div>
          {editable && !locked && (
            <div className="flex gap-1">
              <button type="button" className="btn-outline px-2 py-1 text-[12px]" disabled={busy} onClick={() => { setDialogError(""); setDialog("edit"); }}>{MEETING_TEXT.edit}</button>
              <button type="button" className="btn-ghost px-2 py-1 text-[12px] text-rose-600" disabled={busy} onClick={() => remove(meeting)}>{MEETING_TEXT.delete}</button>
            </div>
          )}
        </div>
        {!editable && <p className="text-[11.5px] text-foreground-500">{MEETING_TEXT.editorOnly}</p>}
        {editable && locked && <p className="rounded-md bg-amber-50 px-3 py-2 text-[12px] text-amber-800">{MEETING_TEXT.protected}</p>}

        <section>
          <h5 className="text-[12.5px] font-semibold text-foreground-900">{MEETING_TEXT.attendees}</h5>
          <p className="text-[12.5px] text-foreground-700">
            {meeting.attendees.length === 0 ? MEETING_TEXT.none : meeting.attendees.map((a) => (a.external ? `${a.name} (${MEETING_TEXT.external})` : a.name)).join(", ")}
          </p>
        </section>
        <section>
          <h5 className="text-[12.5px] font-semibold text-foreground-900">{MEETING_TEXT.content}</h5>
          <p className="whitespace-pre-wrap break-words text-[12.5px] text-foreground-700">{meeting.content || MEETING_TEXT.none}</p>
        </section>
        <section>
          <h5 className="text-[12.5px] font-semibold text-foreground-900">{MEETING_TEXT.decisions}</h5>
          {meeting.decisions.length === 0 ? <p className="text-[12.5px] text-foreground-500">{MEETING_TEXT.none}</p> : (
            <ol className="list-decimal space-y-0.5 pl-5 text-[12.5px] text-foreground-700">
              {meeting.decisions.map((d, i) => (
                <li key={i} className="break-words">{d.content} {d.source === "ai" && <Badge className="border-violet-200 bg-violet-50 text-violet-700">{MEETING_TEXT.aiSource}</Badge>}</li>
              ))}
            </ol>
          )}
        </section>
        <section>
          <h5 className="text-[12.5px] font-semibold text-foreground-900">{MEETING_TEXT.actionItems}</h5>
          {meeting.actionItems.length === 0 ? <p className="text-[12.5px] text-foreground-500">{MEETING_TEXT.none}</p> : (
            <ul className="space-y-1 text-[12.5px] text-foreground-700">
              {meeting.actionItems.map((a, i) => (
                <li key={i} className="flex flex-wrap items-center gap-1.5">
                  <span className="break-words">{a.content}</span>
                  <span className="text-[11.5px] text-foreground-500">· {a.assigneeName || (a.assigneeUserId ? `#${a.assigneeUserId}` : MEETING_TEXT.unassigned)}</span>
                  {a.dueDate && <span className="text-[11.5px] text-foreground-500">· {formatLabel(MEETING_TEXT.due, { date: a.dueDate })}</span>}
                  {a.source === "ai" && <Badge className="border-violet-200 bg-violet-50 text-violet-700">{MEETING_TEXT.aiSource}</Badge>}
                  {a.status === "converted" && <Badge className="border-primary-200 bg-primary-50 text-primary-700">{MEETING_TEXT.converted}</Badge>}
                  {a.status === "dismissed" && <Badge className="border-background-300 text-foreground-500">{MEETING_TEXT.dismissed}</Badge>}
                </li>
              ))}
            </ul>
          )}
        </section>
      </article>
    );
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h3 className="text-[14px] font-semibold text-foreground-950">{MEETING_TEXT.title}</h3>
          <p className="mt-0.5 text-[11.5px] text-foreground-500">{MEETING_TEXT.description} {MEETING_TEXT.scopeNote}</p>
        </div>
        {canCreateMeeting(viewer) ? (
          <button type="button" className="btn-primary" onClick={() => { setDialogError(""); setDialog("create"); }}>
            <i className="ri-add-line" /> {MEETING_TEXT.add}
          </button>
        ) : (
          <span className="text-[11.5px] text-foreground-500">{MEETING_TEXT.memberOnly}</span>
        )}
      </div>

      {notice && (
        <p role={notice.tone === "error" ? "alert" : "status"} className={`rounded-md px-3 py-2 text-[12px] ${notice.tone === "error" ? "bg-rose-50 text-rose-700" : "bg-emerald-50 text-emerald-700"}`}>
          {notice.text}
        </p>
      )}

      <div className="grid gap-3 lg:grid-cols-[300px_1fr]">
        <aside className="card space-y-2 p-3">
          <form className="flex gap-1" onSubmit={applySearch} role="search">
            <input className="field w-full text-[12.5px]" maxLength={200} aria-label={MEETING_TEXT.search} placeholder={MEETING_TEXT.searchPlaceholder} value={keyword} onChange={(e) => setKeyword(e.target.value)} />
            <button type="submit" className="btn-outline px-2 py-1 text-[12px]">{MEETING_TEXT.search}</button>
          </form>
          {appliedKeyword && (
            <button type="button" className="btn-ghost py-0.5 text-[11.5px]" onClick={() => { setKeyword(""); setAppliedKeyword(""); }}>{MEETING_TEXT.clearSearch}</button>
          )}
          {list.items.length === 0 ? (
            <p className="py-4 text-center text-[12px] text-foreground-500">{appliedKeyword ? MEETING_TEXT.emptySearch : MEETING_TEXT.empty}</p>
          ) : (
            <ul className="space-y-1">
              {list.items.map((m) => (
                <li key={m.id}>
                  <button type="button" aria-pressed={m.id === selectedId} onClick={() => setSelectedId(m.id)}
                    className={`w-full rounded-md px-2.5 py-2 text-left ${m.id === selectedId ? "bg-primary-50 text-primary-800" : "hover:bg-background-100"}`}>
                    <span className="block truncate text-[12.5px] font-medium">{m.title}</span>
                    <span className="block text-[11px] text-foreground-500">{heldText(m.heldAt)} · {m.authorName}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
          {list.nextCursor && <button type="button" className="btn-ghost w-full py-1 text-[12px]" onClick={loadMore}>{MEETING_TEXT.more}</button>}
        </aside>
        <section className="card p-4">{detailBody()}</section>
      </div>

      {dialog && (
        <MeetingFormDialog
          mode={dialog}
          initial={dialog === "edit" && detail.phase === "ready" ? formFromMeeting(detail.meeting) : emptyMeetingForm(kstToday())}
          members={members}
          existingPeople={
            dialog === "edit" && detail.phase === "ready"
              ? [
                  ...detail.meeting.attendees.filter((a) => !a.external && a.userId !== null).map((a) => ({ userId: a.userId as number, name: a.name })),
                  ...detail.meeting.actionItems.filter((a) => a.assigneeUserId !== null).map((a) => ({ userId: a.assigneeUserId as number, name: a.assigneeName })),
                ]
              : []
          }
          submitting={busy}
          error={dialogError}
          onClose={closeDialog}
          onSubmit={submit}
        />
      )}
    </div>
  );
}
