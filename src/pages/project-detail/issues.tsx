import { useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useDemoStore } from "@/stores/DemoStore";
import Modal from "@/components/ui/Modal";
import Avatar from "@/components/ui/Avatar";
import { Badge } from "@/components/ui/Badge";
import EmptyState from "@/components/ui/EmptyState";
import type { Issue, IssueKind, IssueSeverity, IssueStatus, StageKey } from "@/types";
import { diffDays, formatDate, TODAY } from "@/utils/date";
import { STAGES, STAGE_LABEL } from "@/utils/ui";
import {
  ISSUE_FLOW,
  ISSUE_KIND_CLASS,
  ISSUE_KIND_LABEL,
  ISSUE_SEVERITY_CLASS,
  ISSUE_SEVERITY_LABEL,
  ISSUE_STATUS_CLASS,
  ISSUE_STATUS_LABEL,
  canMoveIssue,
  canReopenIssue,
  nextIssueStatus,
} from "@/features/issue/utils/issue";

const EMPTY_FORM = {
  title: "",
  kind: "defect" as IssueKind,
  severity: "high" as IssueSeverity,
  assigneeId: "",
  dueDate: "",
  relatedTaskId: "",
  stage: "dev" as StageKey,
  reproSteps: "",
  environment: "",
};

export default function IssuesPage() {
  const { projectId } = useParams();
  const { projects, issues, tasks, users, currentUser, addIssue, moveIssueStatus, reopenIssue, saveIssueToKnowledge, openTask } = useDemoStore();
  const project = projects.find((p) => p.id === projectId);
  const projectIssues = useMemo(
    () => issues.filter((i) => i.projectId === projectId).sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1)),
    [issues, projectId],
  );
  const projectTasks = tasks.filter((t) => t.projectId === projectId);

  const [query, setQuery] = useState("");
  const [kindFilter, setKindFilter] = useState<"all" | IssueKind>("all");
  const [severityFilter, setSeverityFilter] = useState<"all" | IssueSeverity>("all");
  const [statusFilter, setStatusFilter] = useState<"all" | IssueStatus>("all");
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [notice, setNotice] = useState("");

  const selected = projectIssues.find((i) => i.id === selectedId) || null;

  const filtered = projectIssues.filter((issue) => {
    if (kindFilter !== "all" && issue.kind !== kindFilter) return false;
    if (severityFilter !== "all" && issue.severity !== severityFilter) return false;
    if (statusFilter !== "all" && issue.status !== statusFilter) return false;
    if (query.trim() && !issue.title.toLowerCase().includes(query.trim().toLowerCase())) return false;
    return true;
  });

  const counts = {
    open: projectIssues.filter((i) => i.status !== "closed").length,
    defect: projectIssues.filter((i) => i.kind === "defect" && i.status !== "closed").length,
    overdue: projectIssues.filter((i) => i.status !== "closed" && i.dueDate < TODAY).length,
  };

  const resetForm = () => {
    setForm({ ...EMPTY_FORM, stage: project?.stage || "dev" });
    setErrors({});
  };

  const submit = () => {
    const nextErrors: Record<string, string> = {};
    if (!form.title.trim()) nextErrors.title = "제목을 입력해 주세요.";
    if (!form.kind) nextErrors.kind = "유형을 선택해 주세요.";
    if (!form.severity) nextErrors.severity = "심각도를 선택해 주세요.";
    if (form.kind === "defect" && !form.reproSteps.trim()) nextErrors.reproSteps = "결함은 재현 절차를 필수로 입력해야 합니다.";
    if (!form.dueDate) nextErrors.dueDate = "조치 기한을 선택해 주세요.";
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    if (!projectId) return;
    addIssue({
      projectId,
      title: form.title.trim(),
      kind: form.kind,
      severity: form.severity,
      assigneeId: form.assigneeId || null,
      dueDate: form.dueDate,
      relatedTaskId: form.relatedTaskId || null,
      stage: form.stage,
      reproSteps: form.reproSteps,
      environment: form.environment,
    });
    setFormOpen(false);
    setNotice("이슈가 등록되었습니다. 상세 화면에서 확인 → 조치 → 검증 → 종결 순서로 진행할 수 있습니다.");
    resetForm();
    setTimeout(() => setNotice(""), 4000);
  };

  const handleMove = (issue: Issue) => {
    const check = canMoveIssue(issue, currentUser);
    if (!check.allowed) {
      setNotice(check.reason);
      return;
    }
    const next = nextIssueStatus(issue.status);
    moveIssueStatus(issue.id);
    setNotice(next ? `${ISSUE_STATUS_LABEL[next]} 상태로 변경했습니다.` : "");
  };

  const handleReopen = (issue: Issue) => {
    if (!canReopenIssue(issue, currentUser)) {
      setNotice("재오픈 권한이 없습니다. 결함은 QA·PM, 일반 이슈는 PM만 재오픈할 수 있습니다.");
      return;
    }
    reopenIssue(issue.id);
    setNotice("이슈를 재오픈했습니다. 재오픈 횟수가 증가합니다.");
  };

  const handleKb = (issue: Issue) => {
    if (issue.kbDocId) {
      setNotice("이미 지식 허브에 저장된 이슈입니다.");
      return;
    }
    saveIssueToKnowledge(issue.id);
    setNotice("종결된 이슈를 지식 허브에 저장했습니다.");
  };

  if (!project) return null;

  return (
    <div className="space-y-3">
      {notice && (
        <div className="flex items-start gap-2 rounded-lg border border-primary-200 bg-primary-50 px-3 py-2 text-[12px] text-primary-800">
          <i className="ri-information-line mt-0.5" />
          <span className="flex-1">{notice}</span>
          <button type="button" onClick={() => setNotice("")} className="cursor-pointer text-primary-500">
            <i className="ri-close-line" />
          </button>
        </div>
      )}

      <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
        <div className="card px-3.5 py-2.5">
          <p className="text-[11px] text-foreground-500">미종결 이슈</p>
          <p className="mt-0.5 text-[19px] font-semibold text-foreground-950">{counts.open}건</p>
        </div>
        <div className="card px-3.5 py-2.5">
          <p className="text-[11px] text-foreground-500">미종결 결함</p>
          <p className="mt-0.5 text-[19px] font-semibold text-rose-600">{counts.defect}건</p>
        </div>
        <div className="card px-3.5 py-2.5">
          <p className="text-[11px] text-foreground-500">기한 경과</p>
          <p className="mt-0.5 text-[19px] font-semibold text-amber-600">{counts.overdue}건</p>
        </div>
        <div className="card px-3.5 py-2.5">
          <p className="text-[11px] text-foreground-500">재오픈 발생</p>
          <p className="mt-0.5 text-[19px] font-semibold text-foreground-950">
            {projectIssues.reduce((sum, i) => sum + i.reopenCount, 0)}회
          </p>
        </div>
      </div>

      <section className="card overflow-hidden">
        <div className="flex flex-wrap items-center gap-2 border-b border-background-200 px-3 py-2.5">
          <div className="flex flex-wrap items-center gap-1.5">
            <select className="field w-auto py-1.5 text-[12px]" value={kindFilter} onChange={(e) => setKindFilter(e.target.value as typeof kindFilter)}>
              <option value="all">전체 유형</option>
              <option value="defect">결함</option>
              <option value="issue">일반 이슈</option>
              <option value="request">요청</option>
            </select>
            <select className="field w-auto py-1.5 text-[12px]" value={severityFilter} onChange={(e) => setSeverityFilter(e.target.value as typeof severityFilter)}>
              <option value="all">전체 심각도</option>
              <option value="critical">치명</option>
              <option value="high">높음</option>
              <option value="medium">보통</option>
              <option value="low">낮음</option>
            </select>
            <select className="field w-auto py-1.5 text-[12px]" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}>
              <option value="all">전체 상태</option>
              {ISSUE_FLOW.map((status) => (
                <option key={status} value={status}>{ISSUE_STATUS_LABEL[status]}</option>
              ))}
            </select>
            <div className="relative">
              <i className="ri-search-line pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-[13px] text-foreground-400" />
              <input
                className="field w-[190px] py-1.5 pl-8 text-[12px]"
                placeholder="제목 검색"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </div>
          </div>
          <button type="button" className="btn-primary ml-auto py-1.5" onClick={() => { resetForm(); setFormOpen(true); }}>
            <i className="ri-add-line" /> 이슈 등록
          </button>
        </div>

        {filtered.length === 0 ? (
          <EmptyState
            icon="ri-bug-line"
            title={projectIssues.length === 0 ? "등록된 이슈가 없습니다" : "조건에 맞는 이슈가 없습니다"}
            description={projectIssues.length === 0 ? "결함·일반 이슈·요청을 등록하면 처리 흐름을 관리할 수 있습니다." : "필터를 초기화하거나 다른 검색어를 입력해 주세요."}
            action={
              projectIssues.length === 0 ? (
                <button type="button" className="btn-primary" onClick={() => { resetForm(); setFormOpen(true); }}>
                  <i className="ri-add-line" /> 이슈 등록
                </button>
              ) : (
                <button
                  type="button"
                  className="btn-outline"
                  onClick={() => { setKindFilter("all"); setSeverityFilter("all"); setStatusFilter("all"); setQuery(""); }}
                >
                  필터 초기화
                </button>
              )
            }
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] border-collapse">
              <thead>
                <tr>
                  <th className="th w-[76px]">유형</th>
                  <th className="th">제목</th>
                  <th className="th w-[70px]">심각도</th>
                  <th className="th w-[82px]">상태</th>
                  <th className="th w-[92px]">담당자</th>
                  <th className="th w-[92px]">조치 기한</th>
                  <th className="th w-[78px]">재오픈</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((issue) => {
                  const assignee = users.find((u) => u.id === issue.assigneeId);
                  const overdue = issue.status !== "closed" && issue.dueDate < TODAY;
                  return (
                    <tr
                      key={issue.id}
                      onClick={() => setSelectedId(issue.id)}
                      className="cursor-pointer border-b border-background-200 last:border-0 hover:bg-background-100"
                    >
                      <td className="td">
                        <Badge className={ISSUE_KIND_CLASS[issue.kind]}>{ISSUE_KIND_LABEL[issue.kind]}</Badge>
                      </td>
                      <td className="td">
                        <span className="block max-w-[420px] truncate font-medium text-foreground-900">{issue.title}</span>
                        <span className="mt-0.5 block text-[10.5px] text-foreground-500">
                          {STAGE_LABEL[issue.stage]} · 등록 {formatDate(issue.createdAt)}
                        </span>
                      </td>
                      <td className="td">
                        <Badge className={ISSUE_SEVERITY_CLASS[issue.severity]}>{ISSUE_SEVERITY_LABEL[issue.severity]}</Badge>
                      </td>
                      <td className="td">
                        <Badge className={ISSUE_STATUS_CLASS[issue.status]}>{ISSUE_STATUS_LABEL[issue.status]}</Badge>
                      </td>
                      <td className="td">
                        <span className="flex items-center gap-1.5 text-[12px]">
                          {assignee ? <Avatar name={assignee.name} size="xs" /> : <span className="text-foreground-400">-</span>}
                          {assignee?.name || "미지정"}
                        </span>
                      </td>
                      <td className={`td text-[11.5px] ${overdue ? "font-semibold text-rose-600" : "text-foreground-700"}`}>
                        {formatDate(issue.dueDate)}
                        {overdue && <span className="ml-1 text-[10px]">D+{Math.abs(diffDays(TODAY, issue.dueDate))}</span>}
                      </td>
                      <td className="td text-[11.5px] text-foreground-600">{issue.reopenCount}회</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <div className="flex flex-wrap items-center gap-2 rounded-lg border border-background-200 bg-background-50 px-3 py-2 text-[11px] text-foreground-600">
        <i className="ri-shield-check-line text-primary-600" />
        권한 규칙: 결함 검증·종결은 QA, 일반 이슈·요청 종결은 PM만 가능합니다. 종결 후 재오픈하면 횟수가 기록됩니다.
      </div>

      <Modal
        open={formOpen}
        title="이슈·결함 등록"
        description="유형·심각도·제목·조치 기한은 필수입니다. 결함은 재현 절차를 반드시 입력해 주세요."
        onClose={() => setFormOpen(false)}
        width="max-w-2xl"
        footer={
          <>
            <button type="button" className="btn-outline" onClick={() => setFormOpen(false)}>취소</button>
            <button type="button" className="btn-primary" onClick={submit}><i className="ri-save-line" /> 등록</button>
          </>
        }
      >
        <div className="space-y-3">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label className="block min-w-0">
              <span className="mb-1 block text-[11.5px] font-medium text-foreground-700">유형 <span className="text-rose-500">*</span></span>
              <select className="field text-[12.5px]" value={form.kind} onChange={(e) => setForm({ ...form, kind: e.target.value as IssueKind })}>
                <option value="defect">결함</option>
                <option value="issue">일반 이슈</option>
                <option value="request">요청</option>
              </select>
              {errors.kind && <span className="mt-1 block text-[11px] text-rose-600">{errors.kind}</span>}
            </label>
            <label className="block min-w-0">
              <span className="mb-1 block text-[11.5px] font-medium text-foreground-700">심각도 <span className="text-rose-500">*</span></span>
              <select className="field text-[12.5px]" value={form.severity} onChange={(e) => setForm({ ...form, severity: e.target.value as IssueSeverity })}>
                <option value="critical">치명</option>
                <option value="high">높음</option>
                <option value="medium">보통</option>
                <option value="low">낮음</option>
              </select>
              {errors.severity && <span className="mt-1 block text-[11px] text-rose-600">{errors.severity}</span>}
            </label>
          </div>
          <label className="block">
            <span className="mb-1 block text-[11.5px] font-medium text-foreground-700">제목 <span className="text-rose-500">*</span></span>
            <input className="field text-[12.5px]" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="예: 멤버 전용 프로젝트 접근 시 403 오류" />
            {errors.title && <span className="mt-1 block text-[11px] text-rose-600">{errors.title}</span>}
          </label>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label className="block min-w-0">
              <span className="mb-1 block text-[11.5px] font-medium text-foreground-700">담당자</span>
              <select className="field text-[12.5px]" value={form.assigneeId} onChange={(e) => setForm({ ...form, assigneeId: e.target.value })}>
                <option value="">미지정</option>
                {project.members.map((member) => {
                  const user = users.find((u) => u.id === member.userId);
                  return <option key={member.userId} value={member.userId}>{user?.name} · {user?.roleLabel}</option>;
                })}
              </select>
            </label>
            <label className="block min-w-0">
              <span className="mb-1 block text-[11.5px] font-medium text-foreground-700">조치 기한 <span className="text-rose-500">*</span></span>
              <input type="date" className="field text-[12.5px]" value={form.dueDate} onChange={(e) => setForm({ ...form, dueDate: e.target.value })} />
              {errors.dueDate && <span className="mt-1 block text-[11px] text-rose-600">{errors.dueDate}</span>}
            </label>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label className="block min-w-0">
              <span className="mb-1 block text-[11.5px] font-medium text-foreground-700">관련 작업</span>
              <select className="field text-[12.5px]" value={form.relatedTaskId} onChange={(e) => setForm({ ...form, relatedTaskId: e.target.value })}>
                <option value="">연결 없음</option>
                {projectTasks.map((task) => <option key={task.id} value={task.id}>{task.name}</option>)}
              </select>
            </label>
            <label className="block min-w-0">
              <span className="mb-1 block text-[11.5px] font-medium text-foreground-700">단계</span>
              <select className="field text-[12.5px]" value={form.stage} onChange={(e) => setForm({ ...form, stage: e.target.value as StageKey })}>
                {STAGES.map((stage) => <option key={stage.key} value={stage.key}>{stage.label}</option>)}
              </select>
            </label>
          </div>
          {form.kind === "defect" && (
            <>
              <label className="block">
                <span className="mb-1 block text-[11.5px] font-medium text-foreground-700">재현 절차 <span className="text-rose-500">*</span></span>
                <textarea
                  className="field min-h-[92px] text-[12.5px]"
                  value={form.reproSteps}
                  maxLength={500}
                  onChange={(e) => setForm({ ...form, reproSteps: e.target.value })}
                  placeholder={"1. 멤버 전용 프로젝트 접근\n2. 403 오류 확인"}
                />
                {errors.reproSteps && <span className="mt-1 block text-[11px] text-rose-600">{errors.reproSteps}</span>}
              </label>
              <label className="block">
                <span className="mb-1 block text-[11.5px] font-medium text-foreground-700">환경</span>
                <input className="field text-[12.5px]" value={form.environment} onChange={(e) => setForm({ ...form, environment: e.target.value })} placeholder="예: Chrome 131 / Windows 11 / 사내망" />
              </label>
            </>
          )}
        </div>
      </Modal>

      <Modal
        open={Boolean(selected)}
        title={selected ? `${ISSUE_KIND_LABEL[selected.kind]} 상세` : "이슈 상세"}
        onClose={() => setSelectedId(null)}
        width="max-w-2xl"
        footer={
          selected ? (
            <>
              <button type="button" className="btn-outline" onClick={() => setSelectedId(null)}>닫기</button>
              {selected.kbDocId ? (
                <Link to={`/knowledge?doc=${selected.kbDocId}`} className="btn-outline"><i className="ri-book-read-line" /> KB 문서 보기</Link>
              ) : selected.status === "closed" ? (
                <button type="button" className="btn-outline" onClick={() => handleKb(selected)}><i className="ri-bookmark-line" /> KB로 저장</button>
              ) : null}
              {selected.status === "closed" ? (
                <button type="button" className="btn-primary" onClick={() => handleReopen(selected)}><i className="ri-restart-line" /> 재오픈</button>
              ) : (
                <button type="button" className="btn-primary" onClick={() => handleMove(selected)}>
                  <i className="ri-arrow-right-line" /> {nextIssueStatus(selected.status) ? `${ISSUE_STATUS_LABEL[nextIssueStatus(selected.status)!]}로 변경` : "종결"}
                </button>
              )}
            </>
          ) : null
        }
      >
        {selected && (
          <div className="space-y-3">
            <div>
              <div className="flex flex-wrap items-center gap-1.5">
                <Badge className={ISSUE_KIND_CLASS[selected.kind]}>{ISSUE_KIND_LABEL[selected.kind]}</Badge>
                <Badge className={ISSUE_SEVERITY_CLASS[selected.severity]}>심각도 {ISSUE_SEVERITY_LABEL[selected.severity]}</Badge>
                <Badge className={ISSUE_STATUS_CLASS[selected.status]}>{ISSUE_STATUS_LABEL[selected.status]}</Badge>
                {selected.reopenCount > 0 && <Badge className="border-amber-200 bg-amber-50 text-amber-700">재오픈 {selected.reopenCount}회</Badge>}
              </div>
              <h3 className="mt-1.5 text-[15px] font-semibold text-foreground-950">{selected.title}</h3>
            </div>

            <div className="grid grid-cols-1 gap-x-4 gap-y-2 rounded-lg border border-background-200 bg-background-100 px-3.5 py-3 text-[12px] sm:grid-cols-2">
              <p><span className="text-foreground-500">담당자 </span><span className="font-medium text-foreground-900">{users.find((u) => u.id === selected.assigneeId)?.name || "미지정"}</span></p>
              <p><span className="text-foreground-500">등록자 </span><span className="font-medium text-foreground-900">{users.find((u) => u.id === selected.reporterId)?.name || "-"}</span></p>
              <p><span className="text-foreground-500">조치 기한 </span><span className="font-medium text-foreground-900">{formatDate(selected.dueDate)}</span></p>
              <p><span className="text-foreground-500">단계 </span><span className="font-medium text-foreground-900">{STAGE_LABEL[selected.stage]}</span></p>
              <p className="sm:col-span-2">
                <span className="text-foreground-500">관련 작업 </span>
                {selected.relatedTaskId ? (
                  <button type="button" onClick={() => { openTask(selected.relatedTaskId!); setSelectedId(null); }} className="cursor-pointer font-medium text-primary-700 hover:underline">
                    {tasks.find((t) => t.id === selected.relatedTaskId)?.name || selected.relatedTaskId}
                  </button>
                ) : (
                  <span className="text-foreground-500">연결 없음</span>
                )}
              </p>
            </div>

            <div className="rounded-lg border border-background-200 px-3.5 py-3">
              <p className="mb-2 text-[11.5px] font-semibold text-foreground-800">처리 상태</p>
              <ol className="flex flex-wrap items-center gap-1.5">
                {ISSUE_FLOW.map((status) => {
                  const currentIndex = ISSUE_FLOW.indexOf(selected.status);
                  const index = ISSUE_FLOW.indexOf(status);
                  const done = index < currentIndex;
                  const current = index === currentIndex;
                  return (
                    <li key={status} className="flex items-center gap-1.5">
                      <span
                        className={`flex items-center gap-1 rounded-full border px-2 py-[3px] text-[10.5px] font-medium ${
                          current
                            ? "border-primary-300 bg-primary-50 text-primary-700"
                            : done
                              ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                              : "border-background-300 bg-background-50 text-foreground-500"
                        }`}
                      >
                        {done ? <i className="ri-check-line" /> : <span>{index + 1}</span>}
                        {ISSUE_STATUS_LABEL[status]}
                      </span>
                      {index < ISSUE_FLOW.length - 1 && <i className="ri-arrow-right-s-line text-[11px] text-foreground-300" />}
                    </li>
                  );
                })}
              </ol>
              <p className="mt-2 text-[11px] text-foreground-500">
                {canMoveIssue(selected, currentUser).allowed
                  ? "다음 상태로 진행할 수 있습니다. 종결 시 지식 허브 저장을 권장합니다."
                  : canMoveIssue(selected, currentUser).reason}
              </p>
            </div>

            {selected.kind === "defect" && (
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                <div className="rounded-lg border border-background-200 px-3.5 py-3">
                  <p className="text-[11.5px] font-semibold text-foreground-800">재현 절차</p>
                  <p className="mt-1 whitespace-pre-wrap text-[11.5px] leading-5 text-foreground-700">{selected.reproSteps || "미입력"}</p>
                </div>
                <div className="rounded-lg border border-background-200 px-3.5 py-3">
                  <p className="text-[11.5px] font-semibold text-foreground-800">발생 환경</p>
                  <p className="mt-1 whitespace-pre-wrap text-[11.5px] leading-5 text-foreground-700">{selected.environment || "미입력"}</p>
                </div>
              </div>
            )}

            <div className="rounded-lg border border-background-200 bg-background-100 px-3.5 py-2.5 text-[11px] leading-5 text-foreground-600">
              등록 {formatDate(selected.createdAt)}
              {selected.closedAt && ` · 종결 ${formatDate(selected.closedAt)}`}
              {selected.closedBy && ` (${users.find((u) => u.id === selected.closedBy)?.name})`}
              {selected.reopenCount > 0 && ` · 재오픈 ${selected.reopenCount}회`}
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}