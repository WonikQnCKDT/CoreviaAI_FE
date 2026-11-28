import { useMemo, useState } from "react";
import type { Project, StageKey } from "@/types";
import { useDemoStore } from "@/stores/DemoStore";
import { Badge } from "@/components/ui/Badge";
import Avatar from "@/components/ui/Avatar";
import {
  gateApproverCandidates,
  gateStageInfos,
  type GateAssignResult,
} from "@/features/gate/utils/gate";
import { BUTTON_TEXT } from "@/shared/i18n/catalog/button";

interface GateApproverPanelProps {
  project: Project;
  /** PM만 수정할 수 있습니다. 읽기 전용으로 보여줄 때 false를 넘깁니다. */
  editable?: boolean;
  compact?: boolean;
  /** 모든 게이트에 같은 승인자를 적용하는 일괄 지정 영역 표시 */
  showBulk?: boolean;
}

/**
 * 게이트별 승인자 지정과 승인 상태를 관리합니다.
 * 승인자는 직무와 무관하게 프로젝트 멤버 중에서 PM이 직접 지정합니다.
 * 현재 PM은 승인자가 될 수 없고, 승인자 미지정은 자동 승인으로 처리되지 않습니다.
 */
export default function GateApproverPanel({
  project,
  editable = false,
  compact = false,
  showBulk = true,
}: GateApproverPanelProps) {
  const { users, deliverables, gateRecords, currentUser, setGateApprover, setAllGateApprovers } = useDemoStore();
  const isPm = project.pmId === currentUser.id;
  const canEdit = editable && isPm;

  const candidates = useMemo(() => gateApproverCandidates(project, users), [project, users]);
  const infos = useMemo(
    () => gateStageInfos(project, deliverables, gateRecords, users),
    [project, deliverables, gateRecords, users],
  );

  const [feedback, setFeedback] = useState<GateAssignResult | null>(null);
  const [bulkId, setBulkId] = useState("");

  const apply = (stage: StageKey, value: string) => {
    const result = setGateApprover(project.id, stage, value || null);
    setFeedback(result);
  };

  const applyAll = (value: string) => {
    const result = setAllGateApprovers(project.id, value || null);
    setFeedback(result);
  };

  return (
    <div className="space-y-2.5">
      {showBulk && canEdit && (
        <div className="flex flex-wrap items-end gap-2 rounded-lg border border-background-300 bg-background-100 px-3 py-2.5">
          <label className="min-w-0 flex-1">
            <span className="mb-1 block text-[11px] font-medium text-foreground-700">모든 게이트에 동일 승인자 적용</span>
            <select
              className="field text-[12px]"
              value={bulkId}
              onChange={(event) => setBulkId(event.target.value)}
            >
              <option value="">승인자 선택</option>
              {candidates.map((user) => (
                <option key={user.id} value={user.id}>
                  {user.name} · {user.dept}
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            className="btn-outline whitespace-nowrap py-1.5"
            onClick={() => applyAll(bulkId)}
          >
            <i className="ri-shield-check-line" /> {BUTTON_TEXT.applyAll}
          </button>
          <button
            type="button"
            className="btn-ghost whitespace-nowrap py-1.5"
            onClick={() => {
              setBulkId("");
              applyAll("");
            }}
          >
            {BUTTON_TEXT.clearAll}
          </button>
        </div>
      )}

      {feedback && (
        <div
          className={`flex items-start gap-1.5 rounded-lg border px-3 py-2 text-[11.5px] ${
            feedback.ok
              ? "border-primary-200 bg-primary-50 text-primary-800"
              : "border-rose-200 bg-rose-50 text-rose-700"
          }`}
        >
          <i className={`${feedback.ok ? "ri-information-line" : "ri-error-warning-line"} mt-0.5`} />
          <span className="flex-1 leading-5">{feedback.message}</span>
          <button type="button" className="cursor-pointer opacity-60" onClick={() => setFeedback(null)} aria-label={BUTTON_TEXT.closeNotice}>
            <i className="ri-close-line" />
          </button>
        </div>
      )}

      <div className="overflow-hidden rounded-lg border border-background-200">
        <div
          className={`grid grid-cols-[92px_1fr_auto] items-center gap-2 border-b border-background-200 bg-background-100 px-3 py-2 text-[10.5px] font-semibold text-foreground-500 ${
            compact ? "" : "sm:grid-cols-[100px_1fr_150px_auto]"
          }`}
        >
          <span>단계</span>
          <span>게이트 승인자</span>
          {!compact && <span className="hidden sm:block">필수 산출물 승인</span>}
          <span className="text-right">승인 상태</span>
        </div>
        <ul className="divide-y divide-background-200">
          {infos.map((info) => (
            <li
              key={info.stage}
              className={`grid grid-cols-[92px_1fr_auto] items-center gap-2 px-3 py-2 ${
                compact ? "" : "sm:grid-cols-[100px_1fr_150px_auto]"
              } ${info.isCurrent ? "bg-primary-50/40" : ""}`}
            >
              <span className="flex items-center gap-1.5">
                <span className="text-[11.5px] font-medium text-foreground-900">{info.label}</span>
                {info.isCurrent && <span className="h-1.5 w-1.5 rounded-full bg-primary-500" aria-label="현재 단계" />}
              </span>

              <span className="min-w-0">
                {canEdit ? (
                  <select
                    className="field text-[11.5px]"
                    value={info.approverId || ""}
                    onChange={(event) => apply(info.stage, event.target.value)}
                    aria-label={`${info.label} 단계 게이트 승인자`}
                  >
                    <option value="">승인자 미지정</option>
                    {candidates.map((user) => (
                      <option key={user.id} value={user.id}>
                        {user.name} · {user.dept}
                      </option>
                    ))}
                  </select>
                ) : (
                  <span className="flex items-center gap-1.5">
                    {info.approver ? (
                      <>
                        <Avatar name={info.approver.name} size="xs" />
                        <span className="truncate text-[11.5px] text-foreground-800">{info.approver.name}</span>
                      </>
                    ) : (
                      <span className="flex items-center gap-1 text-[11.5px] text-rose-600">
                        <i className="ri-user-unfollow-line text-[12px]" /> 미지정
                      </span>
                    )}
                  </span>
                )}
              </span>

              {!compact && (
                <span className="hidden text-[11px] text-foreground-600 sm:block">
                  {info.requiredTotal > 0 ? `${info.approvedCount} / ${info.requiredTotal}건 승인` : "필수 산출물 없음"}
                  {info.pendingCount > 0 && <span className="ml-1 text-primary-600">· 검수 대기 {info.pendingCount}</span>}
                  {info.rejectedCount > 0 && <span className="ml-1 text-rose-600">· 반려 {info.rejectedCount}</span>}
                </span>
              )}

              <span className="flex justify-end">
                <Badge className={info.state.className}>{info.state.label}</Badge>
              </span>
            </li>
          ))}
        </ul>
      </div>

      <p className="rounded-md border border-background-300 bg-background-100 px-2.5 py-2 text-[10.5px] leading-4 text-foreground-600">
        승인자는 직무와 무관하게 프로젝트 멤버 중에서 지정합니다. 현재 PM은 승인자가 될 수 없고, 승인자 미지정 상태는
        자동 승인으로 처리되지 않습니다.
      </p>
    </div>
  );
}