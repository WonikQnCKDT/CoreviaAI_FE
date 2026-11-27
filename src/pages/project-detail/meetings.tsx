import { useEffect, useMemo, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { useDemoStore } from "@/stores/DemoStore";
import { useAuth } from "@/features/auth/authContext";
import ServerMeetingsView from "@/features/meeting/components/ServerMeetingsView";
import { Badge } from "@/components/ui/Badge";
import Avatar from "@/components/ui/Avatar";
import EmptyState from "@/components/ui/EmptyState";
import type { MeetingActionItem, StageKey } from "@/types";
import { STAGES, STAGE_LABEL } from "@/utils/ui";
import { addDays, formatDate, TODAY } from "@/utils/date";
import { analyzeMeetingContent, type MeetingAiDraft } from "@/features/knowledge/utils/aiDraft";
import { capacityLoad } from "@/utils/business";
import { BUTTON_TEXT } from "@/shared/i18n/catalog/button";
import { NOTIFICATION_TEXT } from "@/shared/i18n/catalog/notification";

interface DraftItem extends MeetingActionItem {
  selected: boolean;
}

function DemoMeetingsPage() {
  const { projectId } = useParams();
  const { projects, meetings, users, tasks, currentUser } = useDemoStore();
  const project = projects.find((p) => p.id === projectId);
  const [searchParams] = useSearchParams();
  const meetingParam = searchParams.get("meeting");
  const projectMeetings = useMemo(
    () => meetings.filter((m) => m.projectId === projectId).sort((a, b) => (a.date < b.date ? 1 : -1)),
    [meetings, projectId],
  );
  const [selectedId, setSelectedId] = useState<string | null>(meetingParam || projectMeetings[0]?.id || null);
  // 모바일에서는 목록을 아코디언으로 보여 줍니다. PC(lg 이상)에서는 항상 펼쳐진 고정 목록입니다.
  const [mobileListOpen, setMobileListOpen] = useState(true);

  useEffect(() => {
    if (!projectMeetings.some((m) => m.id === selectedId)) {
      setSelectedId(projectMeetings[0]?.id || null);
    }
  }, [projectMeetings, selectedId]);

  if (!project) return null;
  const selected = projectMeetings.find((m) => m.id === selectedId) || null;
  const isPm = project.pmId === currentUser.id;

  // 회의를 고르면 모바일에서는 목록을 접어 상세 내용이 바로 보이게 합니다.
  const selectMeeting = (id: string) => {
    setSelectedId(id);
    setMobileListOpen(false);
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <div>
          <h3 className="text-[14px] font-semibold text-foreground-950">회의록</h3>
          <p className="mt-0.5 text-[11.5px] text-foreground-500">
            메모에서 AI 정리 초안을 만들고, PM이 승인한 액션아이템만 WBS 업무로 생성합니다.
          </p>
        </div>
        <Badge className="border-amber-200 bg-amber-50 text-amber-700">
          <i className="ri-sparkling-2-line" /> AI 초안 · 데모
        </Badge>
      </div>

      {projectMeetings.length === 0 ? (
        <div className="card">
          <EmptyState icon="ri-file-text-line" title="등록된 회의록이 없습니다" description="회의 메모를 작성하고 액션아이템을 업무로 연결해 보세요." />
        </div>
      ) : (
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start">
          <div className="w-full lg:w-[320px] lg:shrink-0">
            <div className="card overflow-hidden">
              <button
                type="button"
                onClick={() => setMobileListOpen((prev) => !prev)}
                aria-expanded={mobileListOpen}
                aria-controls="meeting-list"
                className="flex w-full cursor-pointer items-center gap-2 border-b border-background-200 px-3 py-2.5 text-left lg:cursor-default"
              >
                <span className="whitespace-nowrap text-[12px] font-semibold text-foreground-900">
                  {BUTTON_TEXT.meetingList} <span className="font-normal text-foreground-500">{projectMeetings.length}건</span>
                </span>
                {!mobileListOpen && selected && (
                  <span className="min-w-0 flex-1 truncate text-[11px] text-foreground-600 lg:hidden">
                    · {selected.title}
                  </span>
                )}
                <span
                  className="ml-auto flex h-5 w-5 shrink-0 items-center justify-center text-foreground-500 lg:hidden"
                  aria-hidden="true"
                >
                  <i className={`text-[15px] ${mobileListOpen ? "ri-arrow-up-s-line" : "ri-arrow-down-s-line"}`} />
                </span>
              </button>
              <ul
                id="meeting-list"
                className={`${mobileListOpen ? "block" : "hidden"} max-h-[420px] divide-y divide-background-200 overflow-y-auto lg:block lg:max-h-[620px]`}
              >
              {projectMeetings.map((meeting) => {
                const pending = meeting.actionItems.filter((a) => !a.taskId).length;
                return (
                  <li key={meeting.id}>
                    <button
                      type="button"
                      onClick={() => selectMeeting(meeting.id)}
                      aria-current={selectedId === meeting.id ? "true" : undefined}
                      className={`w-full cursor-pointer border-l-2 px-3 py-2.5 text-left transition ${
                        selectedId === meeting.id
                          ? "border-primary-500 bg-primary-50/60"
                          : "border-transparent hover:bg-background-100"
                      }`}
                    >
                      <div className="flex items-center gap-1.5">
                        <span className="text-[10.5px] tabular-nums text-foreground-500">{formatDate(meeting.date)}</span>
                        {meeting.status === "approved" ? (
                          <Badge className="border-emerald-200 bg-emerald-50 text-emerald-700">{BUTTON_TEXT.approve}</Badge>
                        ) : (
                          <Badge className="border-background-300 bg-background-100 text-foreground-500">{BUTTON_TEXT.draft}</Badge>
                        )}
                        {meeting.aiDrafted && <Badge className="border-primary-200 bg-primary-50 text-primary-700">AI</Badge>}
                      </div>
                      <p className="mt-1 line-clamp-2 text-[12.5px] font-medium text-foreground-900">{meeting.title}</p>
                      <p className="mt-0.5 text-[10.5px] text-foreground-500">
                        참석 {meeting.attendees.length}명 · 액션 {meeting.actionItems.length}건
                        {pending > 0 && <span className="ml-1 text-amber-600">· 미등록 {pending}</span>}
                      </p>
                    </button>
                  </li>
                );
              })}
              </ul>
            </div>
          </div>

          <div className="min-w-0 flex-1">
            {selected ? (
              <MeetingEditor key={selected.id} meetingId={selected.id} isPm={isPm} />
            ) : (
              <div className="card">
                <EmptyState icon="ri-file-text-line" title="회의록을 선택해 주세요" />
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function MeetingEditor({ meetingId, isPm }: { meetingId: string; isPm: boolean }) {
  const {
    meetings,
    projects,
    users,
    tasks,
    currentUser,
    updateMeeting,
    approveMeetingActionItems,
    saveMeetingToKnowledge,
  } = useDemoStore();
  const meeting = meetings.find((m) => m.id === meetingId);
  const project = projects.find((p) => p.id === meeting?.projectId);
  const projectTasks = tasks.filter((t) => t.projectId === meeting?.projectId);

  const [title, setTitle] = useState(meeting?.title || "");
  const [date, setDate] = useState(meeting?.date || TODAY);
  const [attendees, setAttendees] = useState<string[]>(meeting?.attendees || []);
  const [content, setContent] = useState(meeting?.content || "");
  const [decisions, setDecisions] = useState<string[]>(meeting?.decisions || []);
  const [items, setItems] = useState<DraftItem[]>((meeting?.actionItems || []).map((a) => ({ ...a, selected: false })));
  const [aiDraft, setAiDraft] = useState<MeetingAiDraft | null>(null);
  const [notice, setNotice] = useState("");
  const [decisionInput, setDecisionInput] = useState("");

  useEffect(() => {
    if (!meeting) return;
    setTitle(meeting.title);
    setDate(meeting.date);
    setAttendees(meeting.attendees);
    setContent(meeting.content);
    setDecisions(meeting.decisions);
    setItems(meeting.actionItems.map((a) => ({ ...a, selected: false })));
  }, [meeting?.id, meeting?.updatedAt]);

  if (!meeting || !project) return null;

  const members = project.members.map((m) => users.find((u) => u.id === m.userId)).filter(Boolean);

  const runAi = () => {
    if (!content.trim()) {
      setNotice("회의 내용을 먼저 입력해 주세요.");
      return;
    }
    setAiDraft(analyzeMeetingContent(content));
    setNotice("AI 정리 초안을 생성했습니다. 아래 초안을 확인하고 반영해 주세요. 실제 AI 모델 호출이 아닌 규칙 기반 데모 결과입니다.");
  };

  const applyDraft = () => {
    if (!aiDraft) return;
    const mergedDecisions = Array.from(new Set([...decisions, ...aiDraft.decisions]));
    setDecisions(mergedDecisions);
    const newItems: DraftItem[] = aiDraft.actionItems.map((item) => ({
      id: `local-${item.id}-${Date.now()}`,
      text: item.text,
      assigneeId: null,
      dueDate: addDays(TODAY, 7),
      estimate: item.estimate,
      stage: item.stage,
      approved: false,
      taskId: null,
      selected: true,
    }));
    setItems((prev) => [...prev, ...newItems]);
    setAiDraft(null);
    setNotice("초안을 편집 영역에 반영했습니다. 담당자·기한·예상 작업량을 지정한 뒤 승인해 주세요.");
  };

  const save = () => {
    updateMeeting(meeting.id, { title, date, attendees, content, decisions, actionItems: items.map(({ selected, ...rest }) => rest), aiDrafted: meeting.aiDrafted || Boolean(aiDraft) });
    setNotice("회의록을 저장했습니다.");
  };

  const addDecision = () => {
    if (!decisionInput.trim()) return;
    setDecisions([...decisions, decisionInput.trim()]);
    setDecisionInput("");
  };

  const addEmptyItem = () => {
    setItems([
      ...items,
      {
        id: `local-manual-${Date.now()}`,
        text: "",
        assigneeId: null,
        dueDate: addDays(TODAY, 7),
        estimate: 2,
        stage: project.stage,
        approved: false,
        taskId: null,
        selected: true,
      },
    ]);
  };

  const approvedSelections = items.filter((i) => i.selected && !i.taskId);
  const approve = () => {
    if (!isPm) {
      setNotice("액션아이템 승인과 업무 생성은 PM만 수행할 수 있습니다.");
      return;
    }
    if (approvedSelections.length === 0) {
      setNotice("업무로 생성할 액션아이템을 선택해 주세요.");
      return;
    }
    if (approvedSelections.some((i) => !i.text.trim())) {
      setNotice("액션아이템 내용을 입력해 주세요.");
      return;
    }
    if (approvedSelections.some((i) => !i.dueDate)) {
      setNotice("액션아이템 기한을 지정해 주세요.");
      return;
    }
    updateMeeting(meeting.id, { title, date, attendees, content, decisions, actionItems: items.map(({ selected, ...rest }) => rest) });
    approveMeetingActionItems(
      meeting.id,
      approvedSelections.map((i) => ({
        id: i.id,
        text: i.text,
        assigneeId: i.assigneeId,
        dueDate: i.dueDate,
        estimate: i.estimate,
        stage: i.stage,
      })),
    );
    setNotice(`액션아이템 ${approvedSelections.length}건을 WBS 업무로 생성했습니다. 회의록과 업무가 연결됩니다.`);
  };

  const undoApproval = (item: DraftItem, index: number) => {
    if (!isPm) return;
    const next = items.map((i, idx) => (idx === index ? { ...i, approved: false, taskId: null } : i));
    setItems(next);
    // 업무 자체는 공통 데이터에 남아 있으므로 연결만 해제하지 않고, 승인 취소는 저장 후 재승인 전 상태로 표시합니다.
    updateMeeting(meeting.id, { actionItems: next.map(({ selected, ...rest }) => rest) });
    setNotice("승인 표시를 해제했습니다. 이미 생성된 업무는 WBS에서 직접 관리해 주세요.");
    void item;
  };

  return (
    <div className="space-y-3">
      <div className="card px-4 py-3">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <input
              className="field border-transparent bg-transparent px-0 py-0 text-[15px] font-semibold text-foreground-950 focus:border-transparent focus:shadow-none"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="회의록 제목"
            />
            <div className="mt-1 flex flex-wrap items-center gap-2">
              <input type="date" className="field w-auto py-1 text-[11.5px]" value={date} onChange={(e) => setDate(e.target.value)} />
              <span className="flex items-center gap-1 text-[11px] text-foreground-500">
                <i className="ri-team-line" /> 참석 {attendees.length}명
              </span>
              {meeting.status === "approved" && <Badge className="border-emerald-200 bg-emerald-50 text-emerald-700">승인됨</Badge>}
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            <button type="button" className="btn-outline py-1.5" onClick={save}><i className="ri-save-line" /> {BUTTON_TEXT.save}</button>
            {meeting.kbDocId ? (
              <Link to={`/knowledge?doc=${meeting.kbDocId}`} className="btn-outline py-1.5"><i className="ri-book-read-line" /> KB 문서</Link>
            ) : (
              <button type="button" className="btn-outline py-1.5" onClick={() => { saveMeetingToKnowledge(meeting.id); setNotice(NOTIFICATION_TEXT.meetingSavedToKb); }}>
                <i className="ri-bookmark-line" /> {BUTTON_TEXT.saveToKb}
              </button>
            )}
          </div>
        </div>

        {notice && (
          <div className="mt-2 flex items-start gap-2 rounded-md border border-primary-200 bg-primary-50 px-2.5 py-1.5 text-[11px] text-primary-800">
            <i className="ri-information-line mt-0.5" />
            <span className="flex-1">{notice}</span>
          </div>
        )}

        <div className="mt-2.5 flex flex-wrap gap-1.5">
          {members.map((user) => {
            const active = user && attendees.includes(user.id);
            return (
              <button
                key={user?.id}
                type="button"
                onClick={() => {
                  if (!user) return;
                  setAttendees(active ? attendees.filter((id) => id !== user.id) : [...attendees, user.id]);
                }}
                className={`flex cursor-pointer items-center gap-1.5 rounded-full border px-2 py-[3px] text-[11px] transition ${
                  active ? "border-primary-300 bg-primary-50 text-primary-700" : "border-background-300 bg-background-50 text-foreground-600"
                }`}
              >
                <Avatar name={user?.name || "?"} size="xs" />
                {user?.name}
                {active && <i className="ri-check-line" />}
              </button>
            );
          })}
        </div>
      </div>

      <div className="card px-4 py-3">
        <div className="flex items-center justify-between">
          <p className="text-[12px] font-semibold text-foreground-900">회의 내용</p>
          <button type="button" className="btn-outline py-1.5" onClick={runAi}>
            <i className="ri-sparkling-2-line" /> {BUTTON_TEXT.aiOrganize}
          </button>
        </div>
        <textarea
          className="field mt-1.5 min-h-[120px] text-[12.5px] leading-5"
          value={content}
          maxLength={2000}
          onChange={(e) => setContent(e.target.value)}
          placeholder="회의 메모를 자유롭게 입력하세요. 결정사항과 액션아이템을 문장에서 추출합니다."
        />
        <p className="mt-1 text-[10.5px] text-foreground-400">AI 정리는 규칙 기반 데모입니다. 결과는 반드시 검토 후 반영해 주세요.</p>
      </div>

      {aiDraft && (
        <div className="card border-primary-200 px-4 py-3">
          <div className="flex items-center gap-1.5">
            <p className="text-[12px] font-semibold text-foreground-900">AI 정리 초안</p>
            <Badge className="border-amber-200 bg-amber-50 text-amber-700">데모 결과 · AI 초안</Badge>
          </div>
          <div className="mt-2 space-y-2">
            <div className="rounded-md border border-background-200 bg-background-100 px-3 py-2">
              <p className="text-[10.5px] font-semibold text-foreground-500">요약</p>
              <p className="mt-0.5 text-[11.5px] leading-5 text-foreground-800">{aiDraft.summary}</p>
            </div>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <div className="rounded-md border border-background-200 px-3 py-2">
                <p className="text-[10.5px] font-semibold text-foreground-500">결정사항</p>
                <ul className="mt-1 space-y-1">
                  {aiDraft.decisions.map((d, index) => (
                    <li key={index} className="flex gap-1.5 text-[11px] leading-4 text-foreground-700"><i className="ri-checkbox-circle-line mt-0.5 text-emerald-600" />{d}</li>
                  ))}
                </ul>
              </div>
              <div className="rounded-md border border-background-200 px-3 py-2">
                <p className="text-[10.5px] font-semibold text-foreground-500">액션아이템 후보</p>
                <ul className="mt-1 space-y-1">
                  {aiDraft.actionItems.map((a) => (
                    <li key={a.id} className="flex gap-1.5 text-[11px] leading-4 text-foreground-700">
                      <i className="ri-arrow-right-s-line mt-0.5 text-primary-600" />
                      <span>{a.text} <span className="text-foreground-500">· {STAGE_LABEL[a.stage]} · {a.estimate}인일</span></span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
          <div className="mt-2 flex justify-end gap-1.5">
            <button type="button" className="btn-ghost py-1.5" onClick={() => setAiDraft(null)}>{BUTTON_TEXT.close}</button>
            <button type="button" className="btn-primary py-1.5" onClick={applyDraft}><i className="ri-download-line" /> {BUTTON_TEXT.applyDraft}</button>
          </div>
        </div>
      )}

      <div className="card px-4 py-3">
        <p className="text-[12px] font-semibold text-foreground-900">결정사항</p>
        <ul className="mt-2 space-y-1.5">
          {decisions.map((decision, index) => (
            <li key={index} className="flex items-start gap-2 rounded-md border border-background-200 px-2.5 py-1.5">
              <i className="ri-checkbox-circle-line mt-0.5 text-emerald-600" />
              <span className="min-w-0 flex-1 text-[11.5px] leading-5 text-foreground-800">{decision}</span>
              <button type="button" className="cursor-pointer text-foreground-400 hover:text-rose-600" onClick={() => setDecisions(decisions.filter((_, i) => i !== index))}>
                <i className="ri-close-line" />
              </button>
            </li>
          ))}
          {decisions.length === 0 && <li className="text-[11.5px] text-foreground-500">등록된 결정사항이 없습니다.</li>}
        </ul>
        <div className="mt-2 flex gap-1.5">
          <input className="field py-1.5 text-[12px]" value={decisionInput} onChange={(e) => setDecisionInput(e.target.value)} placeholder="결정사항 추가" />
          <button type="button" className="btn-outline py-1.5" onClick={addDecision}><i className="ri-add-line" /> {BUTTON_TEXT.add}</button>
        </div>
      </div>

      <div className="card overflow-hidden">
        <div className="flex flex-wrap items-center gap-2 border-b border-background-200 px-4 py-2.5">
          <p className="text-[12px] font-semibold text-foreground-900">액션아이템</p>
          <span className="text-[10.5px] text-foreground-500">선택한 항목만 PM 승인 시 업무로 생성됩니다.</span>
          <button type="button" className="btn-ghost ml-auto py-1" onClick={addEmptyItem}><i className="ri-add-line" /> {BUTTON_TEXT.addItem}</button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[860px] border-collapse">
            <thead>
              <tr>
                <th className="th w-[38px]">선택</th>
                <th className="th">액션아이템</th>
                <th className="th w-[118px]">담당자</th>
                <th className="th w-[120px]">기한</th>
                <th className="th w-[92px]">예상 작업량</th>
                <th className="th w-[92px]">WBS 단계</th>
                <th className="th w-[106px]">연결 업무</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item, index) => {
                const user = users.find((u) => u.id === item.assigneeId);
                const load = item.assigneeId ? capacityLoad(projectTasks, item.assigneeId, TODAY) : null;
                const overloaded = load ? load.allocated + (item.taskId ? 0 : item.estimate) > load.capacity : false;
                return (
                  <tr key={item.id} className="border-b border-background-200 last:border-0 align-top">
                    <td className="td">
                      <input
                        type="checkbox"
                        className="mt-1 h-3.5 w-3.5 cursor-pointer accent-primary-500"
                        checked={item.selected}
                        disabled={Boolean(item.taskId)}
                        onChange={(e) => setItems(items.map((i, idx) => (idx === index ? { ...i, selected: e.target.checked } : i)))}
                      />
                    </td>
                    <td className="td">
                      <input
                        className="field py-1 text-[11.5px]"
                        value={item.text}
                        onChange={(e) => setItems(items.map((i, idx) => (idx === index ? { ...i, text: e.target.value } : i)))}
                        placeholder="액션아이템 내용"
                      />
                      {overloaded && (
                        <p className="mt-1 flex items-center gap-1 text-[10px] text-amber-700">
                          <i className="ri-alert-line" /> {user?.name} 가용 인일 초과 (배정 {load?.allocated} / 가용 {load?.capacity}인일)
                        </p>
                      )}
                    </td>
                    <td className="td">
                      <select
                        className="field py-1 text-[11.5px]"
                        value={item.assigneeId || ""}
                        onChange={(e) => setItems(items.map((i, idx) => (idx === index ? { ...i, assigneeId: e.target.value || null } : i)))}
                      >
                        <option value="">미지정</option>
                        {members.map((m) => <option key={m?.id} value={m?.id}>{m?.name}</option>)}
                      </select>
                    </td>
                    <td className="td">
                      <input
                        type="date"
                        className="field py-1 text-[11px]"
                        value={item.dueDate}
                        onChange={(e) => setItems(items.map((i, idx) => (idx === index ? { ...i, dueDate: e.target.value } : i)))}
                      />
                    </td>
                    <td className="td">
                      <input
                        type="number"
                        min={0.5}
                        step={0.5}
                        className="field py-1 text-[11.5px]"
                        value={item.estimate}
                        onChange={(e) => setItems(items.map((i, idx) => (idx === index ? { ...i, estimate: Number(e.target.value) } : i)))}
                      />
                    </td>
                    <td className="td">
                      <select
                        className="field py-1 text-[11.5px]"
                        value={item.stage}
                        onChange={(e) => setItems(items.map((i, idx) => (idx === index ? { ...i, stage: e.target.value as StageKey } : i)))}
                      >
                        {STAGES.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
                      </select>
                    </td>
                    <td className="td">
                      {item.taskId ? (
                        <span className="flex flex-col gap-1">
                          <Badge className="border-emerald-200 bg-emerald-50 text-emerald-700">업무 생성됨</Badge>
                          <button type="button" className="cursor-pointer text-left text-[10px] text-primary-600 hover:underline" onClick={() => undoApproval(item, index)}>{BUTTON_TEXT.unmarkApproval}</button>
                        </span>
                      ) : item.approved ? (
                        <Badge className="border-emerald-200 bg-emerald-50 text-emerald-700">승인됨</Badge>
                      ) : (
                        <span className="text-[10.5px] text-foreground-500">미생성</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="flex flex-wrap items-center gap-2 border-t border-background-200 bg-background-100 px-4 py-2.5">
          <p className="text-[10.5px] text-foreground-500">
            {isPm ? `선택 ${approvedSelections.length}건 · 승인 전에는 업무가 생성되지 않습니다.` : "액션아이템 승인은 프로젝트 PM만 가능합니다."}
          </p>
          <button type="button" className="btn-primary ml-auto py-1.5" onClick={approve} disabled={!isPm || approvedSelections.length === 0}>
            <i className="ri-check-double-line" /> {BUTTON_TEXT.approveSelectedCreateTasks}
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * api 모드의 서버 프로젝트는 서버 회의록 API(08. 회의록)로 그린다. 데모 회의록을 서버 프로젝트에 섞지 않는다.
 * 데모 모드·프론트 데모 프로젝트는 기존 데모 화면(AI 초안 데모 포함)을 그대로 쓴다.
 */
export default function MeetingsPage() {
  const { mode } = useAuth();
  const { projectId } = useParams();
  const { projects } = useDemoStore();
  const project = projects.find((p) => p.id === projectId);
  if (mode === "api" && project?.serverId !== undefined) return <ServerMeetingsView project={{ ...project, serverId: project.serverId }} />;
  return <DemoMeetingsPage />;
}
