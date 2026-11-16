import { useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useDemoStore } from "@/stores/DemoStore";
import { Badge } from "@/components/ui/Badge";
import Avatar from "@/components/ui/Avatar";
import Modal from "@/components/ui/Modal";
import EmptyState from "@/components/ui/EmptyState";
import type { RiskSuggestion } from "@/types";
import { addDays, formatDate, TODAY } from "@/utils/date";
import { STAGE_LABEL, riskLevel } from "@/utils/ui";
import { affectedMilestones, impactOf, riskFactors, topRippleTasks } from "@/features/risk/utils/risk";
import { PRIORITY_LABEL } from "@/utils/ui";

export default function RiskPage() {
  const { projectId } = useParams();
  const { projects, tasks, issues, users, currentUser, riskSettings, riskSuggestions, decideRiskSuggestion, openTask } = useDemoStore();
  const project = projects.find((p) => p.id === projectId);
  const isPm = project?.pmId === currentUser.id;
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [editTarget, setEditTarget] = useState<RiskSuggestion | null>(null);
  const [editAssignee, setEditAssignee] = useState("");
  const [editEndDate, setEditEndDate] = useState("");
  const [notice, setNotice] = useState("");

  const projectTasks = useMemo(() => tasks.filter((t) => t.projectId === projectId), [tasks, projectId]);

  const factors = useMemo(
    () => (project ? riskFactors(project, tasks, issues, users, riskSettings) : []),
    [project, tasks, issues, users, riskSettings],
  );
  const ripple = useMemo(() => topRippleTasks(projectTasks, 5), [projectTasks]);
  const activeTaskId = selectedTaskId || ripple[0]?.task.id || null;
  const impacts = useMemo(() => (activeTaskId ? impactOf(activeTaskId, tasks) : []), [activeTaskId, tasks]);
  const milestones = useMemo(() => (project ? affectedMilestones(project, impacts) : []), [project, impacts]);
  const rootTask = projectTasks.find((t) => t.id === activeTaskId);
  const suggestions = riskSuggestions.filter((r) => r.projectId === projectId);

  if (!project) return null;

  const level = riskLevel(project.riskScore);
  const gradeLabel = level === "danger" ? "위험" : level === "caution" ? "주의" : "정상";
  const gradeClass = level === "danger" ? "text-rose-600" : level === "caution" ? "text-amber-600" : "text-emerald-600";
  const scoreColor = level === "danger" ? "bg-rose-500" : level === "caution" ? "bg-amber-500" : "bg-emerald-500";

  const decide = (suggestion: RiskSuggestion, decision: "approved" | "rejected") => {
    if (!isPm) {
      setNotice("대응 제안 승인·거절은 PM만 수행할 수 있습니다.");
      return;
    }
    decideRiskSuggestion(suggestion.id, decision);
    setNotice(decision === "approved" ? "제안을 승인했습니다. 관련 일정·담당자가 공통 데이터에 반영되고 처리 이력이 남습니다." : "제안을 거절했습니다. 기존 데이터는 변경되지 않았습니다.");
  };

  const saveEditedApproval = () => {
    if (!editTarget) return;
    const override: { assigneeId?: string | null; endDate?: string } = {};
    if (editTarget.proposed.assigneeId !== undefined || editAssignee) override.assigneeId = editAssignee || null;
    if (editTarget.proposed.endDate !== undefined || editEndDate) override.endDate = editEndDate;
    decideRiskSuggestion(editTarget.id, "approved", override);
    setEditTarget(null);
    setNotice("수정 후 승인했습니다. 변경된 값이 공통 데이터에 반영되었습니다.");
  };

  const verifySelected = (taskId: string) => {
    setSelectedTaskId(taskId);
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <div>
          <h3 className="text-[14px] font-semibold text-foreground-950">AI 리스크</h3>
          <p className="mt-0.5 text-[11.5px] text-foreground-500">일정 지연·병목·인력 편중·파급 효과를 규칙 기반으로 감지합니다. 실제 분석 엔진은 연결되어 있지 않습니다.</p>
        </div>
        <div className="ml-auto flex flex-wrap items-center gap-1.5">
          <Badge className="border-amber-200 bg-amber-50 text-amber-700"><i className="ri-flask-line" /> 샘플 결과 · 데모</Badge>
          <Badge className="border-background-300 bg-background-100 text-foreground-600">마지막 계산 {formatDate(TODAY)} 09:00</Badge>
        </div>
      </div>

      {notice && (
        <div className="flex items-start gap-2 rounded-lg border border-primary-200 bg-primary-50 px-3 py-2 text-[12px] text-primary-800">
          <i className="ri-information-line mt-0.5" />
          <span className="flex-1">{notice}</span>
          <button type="button" onClick={() => setNotice("")} className="cursor-pointer opacity-60"><i className="ri-close-line" /></button>
        </div>
      )}

      <div className="grid grid-cols-1 gap-3 xl:grid-cols-[320px_1fr]">
        <section className="card px-4 py-4">
          <div className="flex items-center justify-between">
            <p className="text-[12px] font-semibold text-foreground-900">프로젝트 리스크 점수</p>
            <span className="rounded border border-background-300 bg-background-100 px-1.5 py-[1px] text-[9.5px] text-foreground-500">규칙 기반 샘플</span>
          </div>
          <div className="mt-2 flex items-end gap-1.5">
            <span className="text-[46px] font-semibold leading-none text-foreground-950">{project.riskScore}</span>
            <span className="pb-1 text-[13px] text-foreground-500">/ 100</span>
            <span className={`pb-1.5 text-[15px] font-semibold ${gradeClass}`}>{gradeLabel}</span>
          </div>
          <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-background-300">
            <div className={`h-2 rounded-full ${scoreColor}`} style={{ width: `${project.riskScore}%` }} />
          </div>
          <p className="mt-1.5 text-[10.5px] text-foreground-500">
            실제 계산 결과가 아닌 데모 샘플 점수입니다. 등급 기준 {riskSettings.thresholds.caution}점 / {riskSettings.thresholds.danger}점은 확정 요구사항이 아닌 데모 설정입니다.
          </p>

          <div className="mt-3 border-t border-background-200 pt-2.5">
            <p className="mb-1.5 text-[11px] font-semibold text-foreground-700">주요 기여 요인 3개</p>
            <ul className="space-y-1.5">
              {factors.slice(0, 3).map((factor) => (
                <li key={factor.key} className="rounded-md border border-background-200 bg-background-50 px-2.5 py-1.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="flex items-center gap-1.5 text-[11.5px] text-foreground-800">
                      <span className={`h-1.5 w-1.5 rounded-full ${factor.tone === "danger" ? "bg-rose-500" : factor.tone === "caution" ? "bg-amber-500" : "bg-emerald-500"}`} />
                      {factor.label}
                    </span>
                    <span className="text-[11.5px] font-semibold text-foreground-900">{factor.value}</span>
                  </div>
                  <div className="mt-0.5 flex items-center justify-between gap-2">
                    <span className="text-[10px] text-foreground-500">{factor.detail}</span>
                    <Link to={`/projects/${project.id}/wbs`} className="shrink-0 text-[10px] font-medium text-primary-600 hover:underline">근거 보기</Link>
                  </div>
                </li>
              ))}
            </ul>
          </div>

          <div className="mt-3 rounded-md border border-dashed border-background-300 bg-background-100 px-2.5 py-2">
            <p className="text-[10px] font-semibold text-foreground-600">데모 계산 설정 (확정 아님)</p>
            <p className="mt-0.5 text-[10px] leading-4 text-foreground-500">
              가중치 — 일정 {riskSettings.weights.schedule} · 병목 {riskSettings.weights.bottleneck} · 인력 {riskSettings.weights.workload} · 파급 {riskSettings.weights.impact}
            </p>
          </div>
        </section>

        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
            {factors.map((factor) => (
              <div key={factor.key} className="card px-3 py-2.5">
                <p className="text-[10.5px] text-foreground-500">{factor.label}</p>
                <p className={`mt-0.5 text-[18px] font-semibold ${factor.tone === "danger" ? "text-rose-600" : factor.tone === "caution" ? "text-amber-600" : "text-emerald-600"}`}>{factor.value}</p>
                <p className="mt-0.5 line-clamp-2 text-[10px] leading-4 text-foreground-500">{factor.detail}</p>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
            <section className="card overflow-hidden">
              <div className="border-b border-background-200 px-3.5 py-2.5">
                <p className="text-[12px] font-semibold text-foreground-900">파급력이 큰 작업 상위 5개</p>
                <p className="mt-0.5 text-[10.5px] text-foreground-500">후행 작업 수와 예상 작업량 기준</p>
              </div>
              {ripple.length === 0 ? (
                <EmptyState icon="ri-node-tree" title="의존 관계가 없습니다" />
              ) : (
                <ul className="divide-y divide-background-200">
                  {ripple.map((item, index) => {
                    const assignee = users.find((u) => u.id === item.task.assigneeId);
                    return (
                      <li key={item.task.id}>
                        <button
                          type="button"
                          onClick={() => verifySelected(item.task.id)}
                          className={`flex w-full cursor-pointer items-center gap-2 px-3.5 py-2 text-left transition ${
                            activeTaskId === item.task.id ? "bg-primary-50/60" : "hover:bg-background-100"
                          }`}
                        >
                          <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-background-200 text-[10px] font-semibold text-foreground-600">{index + 1}</span>
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-[12px] font-medium text-foreground-900">{item.task.name}</span>
                            <span className="mt-0.5 block text-[10px] text-foreground-500">
                              {STAGE_LABEL[item.task.stage || "analysis"]} · 후행 {item.downstreamCount}개 · 누적 예상 작업량 {item.estimate}인일
                            </span>
                          </span>
                          {assignee && <Avatar name={assignee.name} size="xs" />}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>

            <section className="card px-3.5 py-3">
              <div className="flex items-center gap-1.5">
                <p className="text-[12px] font-semibold text-foreground-900">선택 작업 영향 분석</p>
                <Badge className="border-primary-200 bg-primary-50 text-primary-700">규칙 기반</Badge>
              </div>
              {!rootTask ? (
                <EmptyState icon="ri-node-tree" title="작업을 선택해 주세요" />
              ) : (
                <div className="mt-2">
                  <div className="rounded-md border border-background-200 bg-background-100 px-2.5 py-2">
                    <button type="button" onClick={() => openTask(rootTask.id)} className="cursor-pointer text-left text-[12px] font-semibold text-foreground-900 hover:text-primary-700">
                      {rootTask.name} <i className="ri-external-link-line text-[10px]" />
                    </button>
                    <p className="mt-0.5 text-[10.5px] text-foreground-500">
                      기존 종료일 {formatDate(rootTask.endDate)} → 예상 종료일 {formatDate(rootTask.endDate < TODAY ? TODAY : rootTask.endDate)}
                    </p>
                  </div>

                  <p className="mt-2 text-[10.5px] font-semibold text-foreground-600">영향받는 후행 작업 {impacts.length}건</p>
                  {impacts.length === 0 ? (
                    <p className="mt-1 text-[11px] text-foreground-500">후행 작업이 없습니다.</p>
                  ) : (
                    <ul className="mt-1 max-h-[150px] space-y-1 overflow-y-auto">
                      {impacts.map((impact) => (
                        <li key={impact.task.id} className="flex items-center justify-between gap-2 rounded border border-background-200 px-2 py-1 text-[10.5px]">
                          <span className="min-w-0 flex-1 truncate text-foreground-800">{impact.task.name}</span>
                          <span className="shrink-0 text-rose-600">+{impact.delayDays}일</span>
                          <span className="shrink-0 text-foreground-500">{formatDate(impact.expectedEnd)}</span>
                        </li>
                      ))}
                    </ul>
                  )}

                  <p className="mt-2 text-[10.5px] font-semibold text-foreground-600">영향받는 마일스톤</p>
                  {milestones.length === 0 ? (
                    <p className="mt-1 text-[11px] text-foreground-500">지연이 예상되는 마일스톤이 없습니다.</p>
                  ) : (
                    <ul className="mt-1 space-y-1">
                      {milestones.map((m) => (
                        <li key={m.milestone.id} className="flex flex-wrap items-center gap-1.5 rounded border border-amber-200 bg-amber-50 px-2 py-1 text-[10.5px] text-amber-800">
                          <i className="ri-flag-2-line" />
                          <span className="font-medium">{m.milestone.name}</span>
                          <span>{formatDate(m.milestone.date)} → {formatDate(m.expectedDate)}</span>
                          <span className="font-semibold">(+{m.delayDays}일)</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </section>
          </div>

          <section className="card overflow-hidden">
            <div className="flex flex-wrap items-center gap-2 border-b border-background-200 px-3.5 py-2.5">
              <p className="text-[12px] font-semibold text-foreground-900">PM 대응 제안</p>
              <Badge className="border-amber-200 bg-amber-50 text-amber-700">LLM 영역 · 데모 초안</Badge>
              <span className="text-[10.5px] text-foreground-500">승인 전에는 데이터가 변경되지 않습니다.</span>
              {!isPm && <Badge className="ml-auto border-background-300 bg-background-100 text-foreground-500">PM만 처리 가능</Badge>}
            </div>
            {suggestions.length === 0 ? (
              <EmptyState icon="ri-lightbulb-line" title="대응 제안이 없습니다" />
            ) : (
              <ul className="divide-y divide-background-200">
                {suggestions.map((suggestion) => {
                  const task = projectTasks.find((t) => t.id === suggestion.taskId);
                  return (
                    <li key={suggestion.id} className="px-3.5 py-3">
                      <div className="flex flex-wrap items-start gap-2">
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span className="text-[12.5px] font-semibold text-foreground-900">{suggestion.title}</span>
                            {suggestion.status === "pending" && <Badge className="border-primary-200 bg-primary-50 text-primary-700">검토 대기</Badge>}
                            {suggestion.status === "approved" && <Badge className="border-emerald-200 bg-emerald-50 text-emerald-700">승인됨</Badge>}
                            {suggestion.status === "rejected" && <Badge className="border-background-300 bg-background-100 text-foreground-500">거절됨</Badge>}
                          </div>
                          <p className="mt-0.5 text-[11px] text-foreground-600">대상 업무: {task?.name || suggestion.taskId}</p>
                          <p className="mt-1 text-[11px] leading-5 text-foreground-700">{suggestion.reason}</p>
                          <ul className="mt-1.5 flex flex-wrap gap-1.5">
                            {suggestion.changes.map((change, index) => (
                              <li key={index} className="rounded border border-background-300 bg-background-50 px-2 py-1 text-[10.5px] text-foreground-700">
                                {change.label}: <span className="text-foreground-500 line-through">{change.before}</span> → <span className="font-semibold text-primary-700">{change.after}</span>
                              </li>
                            ))}
                          </ul>
                          {suggestion.decidedAt && (
                            <p className="mt-1 text-[10px] text-foreground-500">
                              {suggestion.status === "approved" ? "승인" : "거절"} · {users.find((u) => u.id === suggestion.decidedBy)?.name} · {suggestion.decidedAt.slice(0, 16).replace("T", " ")}
                            </p>
                          )}
                        </div>
                        {suggestion.status === "pending" && (
                          <div className="flex flex-wrap items-center gap-1.5">
                            <button type="button" className="btn-primary py-1.5 text-[11px]" onClick={() => decide(suggestion, "approved")} disabled={!isPm}><i className="ri-check-line" /> 승인</button>
                            <button
                              type="button"
                              className="btn-outline py-1.5 text-[11px]"
                              disabled={!isPm}
                              onClick={() => {
                                setEditTarget(suggestion);
                                setEditAssignee(suggestion.proposed.assigneeId || "");
                                setEditEndDate(suggestion.proposed.endDate || "");
                              }}
                            >
                              <i className="ri-edit-line" /> 수정 후 승인
                            </button>
                            <button type="button" className="btn-ghost py-1.5 text-[11px] text-rose-600" onClick={() => decide(suggestion, "rejected")} disabled={!isPm}><i className="ri-close-line" /> 거절</button>
                          </div>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          <p className="rounded-lg border border-background-200 bg-background-50 px-3 py-2 text-[10.5px] leading-4 text-foreground-500">
            점수·감지·집계는 규칙 기반 데모이며, 제안 문구와 설명은 LLM 영역으로 구분됩니다. 실제 분석 엔진 연결 전에는 이 화면의 모든 수치가 샘플 결과입니다.
          </p>
        </div>
      </div>

      <Modal
        open={Boolean(editTarget)}
        title="제안 수정 후 승인"
        description="변경 값을 조정해 승인합니다. 승인 시 관련 공통 데이터에 반영됩니다."
        onClose={() => setEditTarget(null)}
        footer={
          <>
            <button type="button" className="btn-outline" onClick={() => setEditTarget(null)}>취소</button>
            <button type="button" className="btn-primary" onClick={saveEditedApproval}>수정 후 승인</button>
          </>
        }
      >
        {editTarget && (
          <div className="space-y-3">
            <p className="rounded-md bg-background-100 px-3 py-2 text-[11.5px] text-foreground-700">{editTarget.title}</p>
            {editTarget.proposed.endDate !== undefined && (
              <label className="block">
                <span className="mb-1 block text-[11.5px] font-medium text-foreground-700">변경 종료일</span>
                <input type="date" className="field text-[12.5px]" value={editEndDate} onChange={(e) => setEditEndDate(e.target.value)} />
                <span className="mt-1 block text-[10.5px] text-foreground-500">제안값 {formatDate(editTarget.proposed.endDate)} · 후행 작업 영향이 함께 반영됩니다.</span>
              </label>
            )}
            {editTarget.proposed.assigneeId !== undefined && (
              <label className="block">
                <span className="mb-1 block text-[11.5px] font-medium text-foreground-700">변경 담당자</span>
                <select className="field text-[12.5px]" value={editAssignee} onChange={(e) => setEditAssignee(e.target.value)}>
                  {project.members.map((m) => {
                    const user = users.find((u) => u.id === m.userId);
                    return <option key={m.userId} value={m.userId}>{user?.name} · {user?.roleLabel}</option>;
                  })}
                </select>
              </label>
            )}
            <label className="block">
              <span className="mb-1 block text-[11.5px] font-medium text-foreground-700">우선순위 (선택)</span>
              <select className="field text-[12.5px]" value={editTarget.proposed.priority || "normal"} onChange={() => undefined} disabled>
                <option value="high">{PRIORITY_LABEL.high}</option>
                <option value="normal">{PRIORITY_LABEL.normal}</option>
                <option value="low">{PRIORITY_LABEL.low}</option>
              </select>
              <span className="mt-1 block text-[10.5px] text-foreground-500">이 제안에는 우선순위 변경이 포함되지 않았습니다.</span>
            </label>
            <p className="text-[10.5px] text-foreground-500">예상 반영일 {formatDate(addDays(TODAY, 0))} · 처리 이력이 타임라인에 기록됩니다.</p>
          </div>
        )}
      </Modal>
    </div>
  );
}