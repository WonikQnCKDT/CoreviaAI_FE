import { useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { useDemoStore } from "@/stores/DemoStore";
import { Badge } from "@/components/ui/Badge";
import Avatar from "@/components/ui/Avatar";
import Modal from "@/components/ui/Modal";
import EmptyState from "@/components/ui/EmptyState";
import type { Deliverable, StageKey } from "@/types";
import { STAGES, STAGE_LABEL } from "@/utils/ui";
import { diffDays, formatDate, TODAY } from "@/utils/date";
import { DELIVERABLE_STATUS_CLASS, DELIVERABLE_STATUS_LABEL, blockingDeliverables } from "@/features/gate/utils/deliverable";
import { gateApproverId, gateStageInfo } from "@/features/gate/utils/gate";
import { canReviewDeliverable } from "@/utils/permission";
import GateApproverPanel from "@/features/gate/components/GateApproverPanel";
import { BUTTON_TEXT } from "@/shared/i18n/catalog/button";

export default function DeliverablesPage() {
  const { projectId } = useParams();
  const {
    projects,
    deliverables,
    gateRecords,
    users,
    currentUser,
    addDeliverableVersion,
    reviewDeliverable,
    advanceProjectStage,
  } = useDemoStore();
  const project = projects.find((p) => p.id === projectId);
  const isPm = project?.pmId === currentUser.id;

  const [stage, setStage] = useState<StageKey>(project?.stage || "analysis");
  const [versionTarget, setVersionTarget] = useState<Deliverable | null>(null);
  const [versionNote, setVersionNote] = useState("");
  const [versionFile, setVersionFile] = useState("");
  const [versionError, setVersionError] = useState("");
  const [reviewTarget, setReviewTarget] = useState<Deliverable | null>(null);
  const [reviewDecision, setReviewDecision] = useState<"approved" | "rejected">("approved");
  const [reviewComment, setReviewComment] = useState("");
  const [reviewError, setReviewError] = useState("");
  const [expanded, setExpanded] = useState<string | null>(null);
  const [notice, setNotice] = useState("");

  const projectDeliverables = useMemo(
    () => deliverables.filter((d) => d.projectId === projectId),
    [deliverables, projectId],
  );
  const stageItems = projectDeliverables.filter((d) => d.stage === stage);
  const blockers = project ? blockingDeliverables(project.id, project.stage, deliverables) : [];
  const records = gateRecords.filter((g) => g.projectId === projectId);

  if (!project) return null;

  const stageGate = gateStageInfo(project, project.stage, deliverables, gateRecords, users);

  const submitVersion = () => {
    if (!versionTarget) return;
    if (!versionFile.trim()) {
      setVersionError("로컬 데모 파일명을 입력하거나 파일을 선택해 주세요.");
      return;
    }
    addDeliverableVersion(versionTarget.id, { note: versionNote.trim(), fileName: versionFile.trim() });
    setVersionTarget(null);
    setVersionNote("");
    setVersionFile("");
    setVersionError("");
    setNotice("새 버전을 제출했습니다. 이전 버전 이력은 그대로 유지됩니다. 로컬 데모이므로 실제 파일은 업로드되지 않았습니다.");
  };

  const submitReview = () => {
    if (!reviewTarget) return;
    if (!reviewComment.trim()) {
      setReviewError("검수 의견은 필수입니다.");
      return;
    }
    reviewDeliverable(reviewTarget.id, reviewDecision, reviewComment.trim());
    setReviewTarget(null);
    setReviewComment("");
    setReviewError("");
    setNotice(reviewDecision === "approved" ? "산출물을 승인했습니다." : "산출물을 반려했습니다. 사유가 기록됩니다.");
  };

  const handleAdvance = () => {
    if (!isPm) {
      setNotice("단계 전환은 프로젝트 PM만 수행할 수 있습니다.");
      return;
    }
    const result = advanceProjectStage(project.id);
    setNotice(result.message);
    if (result.ok) {
      const nextIndex = STAGES.findIndex((s) => s.key === project.stage) + 1;
      if (nextIndex < STAGES.length) setStage(STAGES[nextIndex].key);
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <div>
          <h3 className="text-[14px] font-semibold text-foreground-950">산출물·검수</h3>
          <p className="mt-0.5 text-[11.5px] text-foreground-500">단계별 필수 산출물이 모두 승인되어야 다음 단계로 전환할 수 있습니다.</p>
        </div>
        <div className="ml-auto flex flex-wrap items-center gap-1.5">
          <Badge className="border-primary-200 bg-primary-50 text-primary-700">현재 단계 {STAGE_LABEL[project.stage]}</Badge>
          <Badge className={stageGate.state.className}>{stageGate.state.label}</Badge>
          <button type="button" className="btn-primary py-1.5" onClick={handleAdvance} disabled={!isPm}>
            <i className="ri-arrow-right-double-line" /> {BUTTON_TEXT.advanceStage}
          </button>
        </div>
      </div>

      {notice && (
        <div className={`flex items-start gap-2 rounded-lg border px-3 py-2 text-[12px] ${notice.includes("승인되지 않아") || notice.includes("지정되지 않아") || notice.includes("필수") ? "border-rose-200 bg-rose-50 text-rose-800" : "border-primary-200 bg-primary-50 text-primary-800"}`}>
          <i className="ri-information-line mt-0.5" />
          <span className="flex-1">{notice}</span>
          <button type="button" onClick={() => setNotice("")} className="cursor-pointer opacity-60"><i className="ri-close-line" /></button>
        </div>
      )}

      <div className="grid grid-cols-1 gap-3 xl:grid-cols-[1fr_320px]">
        <div className="space-y-3">
          <div className="card px-3 py-2.5">
            <div className="flex flex-wrap items-center gap-1.5">
              {STAGES.map((s, index) => {
                const items = projectDeliverables.filter((d) => d.stage === s.key && d.required);
                const approved = items.filter((d) => d.status === "approved").length;
                const active = stage === s.key;
                return (
                  <button
                    key={s.key}
                    type="button"
                    onClick={() => setStage(s.key)}
                    className={`flex cursor-pointer items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[11.5px] font-medium transition ${
                      active ? "border-primary-300 bg-primary-50 text-primary-700" : "border-background-300 bg-background-50 text-foreground-600 hover:border-background-400"
                    }`}
                  >
                    <span className="flex h-4 w-4 items-center justify-center rounded-full bg-background-200 text-[9.5px]">{index + 1}</span>
                    {s.label}
                    <span className={`text-[10px] ${active ? "text-primary-600" : "text-foreground-400"}`}>{approved}/{items.length}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {blockers.length > 0 && (
            <div className="rounded-lg border border-rose-200 bg-rose-50 px-3.5 py-2.5">
              <p className="flex items-center gap-1.5 text-[12px] font-semibold text-rose-800">
                <i className="ri-lock-2-line" /> 다음 단계 전환 차단 · 필수 산출물 {blockers.length}건 미승인
              </p>
              <p className="mt-1 text-[11px] leading-5 text-rose-700">{blockers.map((b) => `${b.name}(${DELIVERABLE_STATUS_LABEL[b.status]})`).join(", ")}</p>
            </div>
          )}

          {stageItems.length === 0 ? (
            <div className="card"><EmptyState icon="ri-file-list-3-line" title={`${STAGE_LABEL[stage]} 단계 산출물이 없습니다`} description="산출물 목록이 정의되면 검수 흐름을 관리할 수 있습니다." /></div>
          ) : (
            <div className="space-y-2.5">
              {stageItems.map((item) => {
                const latest = item.versions[item.versions.length - 1];
                const itemApproverId = gateApproverId(project, item.stage, item);
                const canReview = item.status === "submitted" && canReviewDeliverable(project, currentUser, itemApproverId);
                const approver = users.find((u) => u.id === itemApproverId);
                const submitter = latest ? users.find((u) => u.id === latest.submitterId) : null;
                const delayed = item.actualDate && item.actualDate > item.plannedDate;
                return (
                  <article key={item.id} className="card px-4 py-3">
                    <div className="flex flex-wrap items-start gap-2">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="text-[13px] font-semibold text-foreground-950">{item.name}</span>
                          {item.required ? <Badge className="border-rose-200 bg-rose-50 text-rose-700">필수</Badge> : <Badge className="border-background-300 bg-background-100 text-foreground-500">선택</Badge>}
                          <Badge className={DELIVERABLE_STATUS_CLASS[item.status]}>{DELIVERABLE_STATUS_LABEL[item.status]}</Badge>
                          <Badge className="border-background-300 bg-background-50 text-foreground-600">현재 {item.currentVersion}</Badge>
                        </div>
                        <p className="mt-1 text-[11px] text-foreground-500">
                          검수자 {approver?.name || "-"} · 계획 {formatDate(item.plannedDate)} · 실제 {formatDate(item.actualDate)}
                          {delayed && <span className="ml-1 font-medium text-amber-700">(계획 대비 {diffDays(item.plannedDate, item.actualDate!)}일 지연)</span>}
                        </p>
                        {item.reviewComment && (
                          <p className="mt-1.5 rounded-md border border-background-200 bg-background-100 px-2.5 py-1.5 text-[11px] leading-4 text-foreground-700">
                            <span className="font-semibold text-foreground-800">검수 의견</span> · {item.reviewComment}
                            {item.reviewedBy && <span className="text-foreground-500"> — {users.find((u) => u.id === item.reviewedBy)?.name}, {formatDate(item.reviewedAt)}</span>}
                          </p>
                        )}
                      </div>
                      <div className="flex flex-wrap items-center gap-1.5">
                        <button type="button" className="btn-outline py-1.5" onClick={() => { setVersionTarget(item); setVersionNote(""); setVersionFile(""); setVersionError(""); }}>
                          <i className="ri-upload-2-line" /> {BUTTON_TEXT.submitNewVersion}
                        </button>
                        {canReview && (
                          <>
                            <button type="button" className="btn-primary py-1.5" onClick={() => { setReviewTarget(item); setReviewDecision("approved"); setReviewComment(""); setReviewError(""); }}>{BUTTON_TEXT.review}</button>
                          </>
                        )}
                        <button type="button" className="btn-ghost py-1.5" onClick={() => setExpanded(expanded === item.id ? null : item.id)}>
                          <i className={expanded === item.id ? "ri-arrow-up-s-line" : "ri-history-line"} /> {BUTTON_TEXT.history} {item.versions.length}
                        </button>
                      </div>
                    </div>

                    {expanded === item.id && (
                      <div className="mt-2.5 rounded-lg border border-background-200 bg-background-100 px-3 py-2">
                        <p className="mb-1.5 text-[10.5px] font-semibold text-foreground-600">버전 이력 (최신 버전 이력 유지)</p>
                        {item.versions.length === 0 ? (
                          <p className="text-[11px] text-foreground-500">제출된 버전이 없습니다.</p>
                        ) : (
                          <ul className="space-y-1.5">
                            {[...item.versions].reverse().map((version) => (
                              <li key={version.id} className="flex flex-wrap items-center gap-2 text-[11px]">
                                <Badge className="border-background-300 bg-background-50 text-foreground-700">{version.version}</Badge>
                                <span className="text-foreground-800">{version.fileName}</span>
                                <span className="flex items-center gap-1 text-foreground-500">
                                  <Avatar name={users.find((u) => u.id === version.submitterId)?.name || "?"} size="xs" />
                                  {users.find((u) => u.id === version.submitterId)?.name}
                                </span>
                                <span className="text-foreground-500">{formatDate(version.submittedAt)}</span>
                                {version.note && <span className="text-foreground-500">· {version.note}</span>}
                                <span className="rounded bg-background-200 px-1 text-[9.5px] text-foreground-500">로컬 데모</span>
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                    )}
                  </article>
                );
              })}
            </div>
          )}
        </div>

        <div className="space-y-3">
          <div className="card px-4 py-3">
            <div className="flex flex-wrap items-center justify-between gap-1.5">
              <p className="text-[12px] font-semibold text-foreground-900">게이트 승인자</p>
              <span className="text-[10px] text-foreground-500">PM이 단계별로 지정</span>
            </div>
            <div className="mt-2.5">
              <GateApproverPanel project={project} editable={isPm} compact showBulk={false} />
            </div>
          </div>

          <div className="card overflow-hidden">
            <div className="border-b border-background-200 px-4 py-2.5">
              <p className="text-[12px] font-semibold text-foreground-900">게이트 결과 기록</p>
            </div>
            <ul className="max-h-[300px] divide-y divide-background-200 overflow-y-auto">
              {records.length === 0 && <li className="px-4 py-6 text-center text-[11px] text-foreground-500">기록이 없습니다.</li>}
              {records.map((record) => (
                <li key={record.id} className="px-4 py-2.5">
                  <div className="flex items-center gap-1.5">
                    <Badge className={record.decision === "approved" ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-rose-200 bg-rose-50 text-rose-700"}>
                      {record.decision === "approved" ? "승인" : "차단"}
                    </Badge>
                    <span className="text-[11.5px] font-medium text-foreground-900">{STAGE_LABEL[record.stage]} 단계</span>
                  </div>
                  <p className="mt-0.5 text-[10.5px] leading-4 text-foreground-600">{record.comment}</p>
                  <p className="mt-0.5 text-[10px] text-foreground-500">
                    {users.find((u) => u.id === record.approverId)?.name || "-"} · {record.decidedAt.slice(0, 10)}
                  </p>
                </li>
              ))}
            </ul>
          </div>

          <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[10.5px] leading-4 text-amber-800">
            파일 업로드는 로컬 데모입니다. 서버에 저장되지 않으며, 실제 서비스 연결 전에는 업로드 완료로 표시하지 않습니다.
          </p>
        </div>
      </div>

      <Modal
        open={Boolean(versionTarget)}
        title={versionTarget ? `${versionTarget.name} · 새 버전 제출` : "새 버전 제출"}
        description="이전 버전 이력은 유지됩니다. 로컬 데모 파일명만 기록됩니다."
        onClose={() => setVersionTarget(null)}
        footer={
          <>
            <button type="button" className="btn-outline" onClick={() => setVersionTarget(null)}>{BUTTON_TEXT.cancel}</button>
            <button type="button" className="btn-primary" onClick={submitVersion}><i className="ri-upload-2-line" /> {BUTTON_TEXT.submit}</button>
          </>
        }
      >
        <div className="space-y-3">
          <div className="rounded-md border border-background-200 bg-background-100 px-3 py-2 text-[11px] text-foreground-600">
            현재 버전 <span className="font-semibold text-foreground-900">{versionTarget?.currentVersion}</span> → 제출 시 자동으로 다음 버전이 부여됩니다.
          </div>
          <label className="block">
            <span className="mb-1 block text-[11.5px] font-medium text-foreground-700">파일 선택 (로컬 데모)</span>
            <label className="flex cursor-pointer items-center justify-center gap-1.5 rounded-lg border border-dashed border-background-300 bg-background-100 px-3 py-3 text-[11.5px] text-foreground-600">
              <i className="ri-upload-2-line" /> {versionFile || "파일을 선택하면 파일명이 기록됩니다"}
              <input
                type="file"
                className="hidden"
                onChange={(e) => setVersionFile(e.target.files?.[0]?.name || "")}
              />
            </label>
          </label>
          <label className="block">
            <span className="mb-1 block text-[11.5px] font-medium text-foreground-700">제출 메모</span>
            <textarea className="field min-h-[70px] text-[12px]" value={versionNote} maxLength={300} onChange={(e) => setVersionNote(e.target.value)} placeholder="변경 사항이나 검수 요청 사항" />
          </label>
          {versionError && <p className="text-[11px] text-rose-600">{versionError}</p>}
        </div>
      </Modal>

      <Modal
        open={Boolean(reviewTarget)}
        title={reviewTarget ? `${reviewTarget.name} 검수` : "검수"}
        description="승인 또는 반려와 함께 검수 의견을 필수로 입력해 주세요."
        onClose={() => setReviewTarget(null)}
        footer={
          <>
            <button type="button" className="btn-outline" onClick={() => setReviewTarget(null)}>{BUTTON_TEXT.cancel}</button>
            <button type="button" className="btn-primary" onClick={submitReview}>{BUTTON_TEXT.saveReview}</button>
          </>
        }
      >
        <div className="space-y-3">
          <div className="flex gap-1.5">
            {(["approved", "rejected"] as const).map((decision) => (
              <button
                key={decision}
                type="button"
                onClick={() => setReviewDecision(decision)}
                className={`flex-1 cursor-pointer rounded-lg border px-3 py-2 text-[12px] font-medium ${
                  reviewDecision === decision
                    ? decision === "approved"
                      ? "border-emerald-300 bg-emerald-50 text-emerald-700"
                      : "border-rose-300 bg-rose-50 text-rose-700"
                    : "border-background-300 bg-background-50 text-foreground-600"
                }`}
              >
                {decision === "approved" ? BUTTON_TEXT.approve : BUTTON_TEXT.returnForRevision}
              </button>
            ))}
          </div>
          <label className="block">
            <span className="mb-1 block text-[11.5px] font-medium text-foreground-700">검수 의견 <span className="text-rose-500">*</span></span>
            <textarea className="field min-h-[90px] text-[12px]" value={reviewComment} maxLength={500} onChange={(e) => setReviewComment(e.target.value)} placeholder="검수 결과와 사유를 입력하세요" />
          </label>
          {reviewError && <p className="text-[11px] text-rose-600">{reviewError}</p>}
          <p className="rounded-md bg-background-100 px-2.5 py-1.5 text-[10.5px] text-foreground-500">검수자: {users.find((u) => u.id === currentUser.id)?.name} · {formatDate(TODAY)}</p>
        </div>
      </Modal>
    </div>
  );
}