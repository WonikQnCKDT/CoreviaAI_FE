import { useEffect, useRef, useState } from "react";
import { Badge } from "@/components/ui/Badge";
import {
  createMilestone,
  deleteMilestone,
  replaceMilestoneTasks,
  updateMilestone,
  type Milestone,
} from "@/features/wbs/api/milestoneApi";
import type { WbsItem } from "@/features/wbs/api/wbsApi";
import MilestoneDialog, { type MilestoneDialogInput, type MilestoneDialogTarget } from "@/features/wbs/components/MilestoneDialog";
import { useServerMilestones } from "@/features/wbs/hooks/useServerMilestones";
import { MILESTONE_TEXT } from "@/features/wbs/i18n/ko";
import {
  canManageMilestones,
  dDayLabel,
  interpretMilestoneFailure,
  milestoneTone,
  taskSummaryLabel,
  type MilestoneAction,
  type MilestoneTone,
} from "@/features/wbs/utils/milestoneRules";
import type { WbsViewer } from "@/features/wbs/utils/wbsRules";
import type { ApiResult } from "@/shared/api/client";
import { formatLabel } from "@/shared/i18n/store";

type Notice = { tone: "success" | "error"; text: string } | null;

const DDAY_CLASS: Record<MilestoneTone, string> = {
  delayed: "border-rose-200 bg-rose-50 text-rose-700",
  due: "border-amber-200 bg-amber-50 text-amber-800",
  upcoming: "border-background-300 bg-background-50 text-foreground-700",
};

interface Props {
  projectId: number;
  /** WBS 트리. 연결 작업 선택지이고, 바뀌면(작업 상태·삭제) 지연 판단도 바뀌므로 목록을 다시 받는다 */
  tree: WbsItem[];
  viewer: WbsViewer;
}

/**
 * api 모드 마일스톤(FR-WBS-04). 목록·D-day·지연 경고는 서버 계산값을 그대로 보여 준다.
 * PM만 추가·수정·삭제·연결 작업 변경 버튼을 본다(3.3 WBS-04). 최종 판정은 서버가 한다.
 */
export default function ServerMilestonePanel({ projectId, tree, viewer }: Props) {
  const { state, reload, upsert, remove } = useServerMilestones(projectId);
  const [target, setTarget] = useState<MilestoneDialogTarget | null>(null);
  const [dialogError, setDialogError] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<Notice>(null);
  const busyRef = useRef(false);
  const pm = canManageMilestones(viewer);

  useEffect(() => {
    reload();
  }, [reload, tree]);

  const closeDialog = () => {
    setTarget(null);
    setDialogError("");
  };

  /** 변경 요청 하나를 보내고 결과를 반영한다. 동시에 두 요청을 보내지 않는다 */
  const run = async function (
    action: MilestoneAction,
    request: () => Promise<ApiResult<Milestone | null>>,
    onSuccess: (data: Milestone | null) => string,
    { inDialog }: { inDialog: boolean },
  ): Promise<boolean> {
    if (busyRef.current) return false;
    busyRef.current = true;
    setBusy(true);
    setDialogError("");
    const result = await request();
    busyRef.current = false;
    setBusy(false);
    if (result.ok === true) {
      setNotice({ tone: "success", text: onSuccess(result.data) });
      return true;
    }
    const view = interpretMilestoneFailure(action, result.failure);
    if (view.reload) reload();
    if (inDialog && !view.reload) setDialogError(view.message);
    else {
      setNotice({ tone: "error", text: view.message });
      if (inDialog) closeDialog();
    }
    return false;
  };

  const saved = (template: string, name: string) => (data: Milestone | null) => {
    if (data) upsert(data);
    return formatLabel(template, { name: data?.name || name });
  };

  const submit = async (input: MilestoneDialogInput) => {
    if (!target) return;
    const current = target;
    let ok: boolean;
    if (current.kind === "create") {
      ok = await run(
        "create",
        () => createMilestone({ projectId, name: input.name, targetDate: input.targetDate, taskIds: input.taskIds }),
        saved(MILESTONE_TEXT.created, input.name),
        { inDialog: true },
      );
    } else if (current.kind === "edit") {
      const { milestone } = current;
      ok = await run(
        "update",
        () => updateMilestone({ projectId, milestoneId: milestone.id, name: input.name, targetDate: input.targetDate, version: milestone.version }),
        saved(MILESTONE_TEXT.updated, input.name),
        { inDialog: true },
      );
    } else {
      const { milestone } = current;
      ok = await run(
        "tasks",
        () => replaceMilestoneTasks({ projectId, milestoneId: milestone.id, taskIds: input.taskIds, version: milestone.version }),
        saved(MILESTONE_TEXT.tasksSaved, milestone.name),
        { inDialog: true },
      );
    }
    if (ok) closeDialog();
  };

  const removeMilestone = (milestone: Milestone) => {
    if (!window.confirm(formatLabel(MILESTONE_TEXT.confirmDelete, { name: milestone.name }))) return;
    void run(
      "delete",
      () => deleteMilestone({ projectId, milestoneId: milestone.id }),
      () => {
        remove(milestone.id);
        return formatLabel(MILESTONE_TEXT.deleted, { name: milestone.name });
      },
      { inDialog: false },
    );
  };

  const body = () => {
    if (state.phase === "loading") {
      return <p className="px-4 py-4 text-[12px] text-foreground-500" role="status">{MILESTONE_TEXT.loading}</p>;
    }
    if (state.phase === "unavailable") {
      return <p className="px-4 py-4 text-[12px] text-foreground-500">{MILESTONE_TEXT.unavailable}</p>;
    }
    if (state.phase === "error") {
      return (
        <div className="flex flex-wrap items-center gap-2 px-4 py-4 text-[12px]" role="alert">
          <span className="text-rose-700">{MILESTONE_TEXT.loadFailed} {state.message}</span>
          <button type="button" className="btn-outline py-1 text-[12px]" onClick={reload}>
            {MILESTONE_TEXT.retry}
          </button>
        </div>
      );
    }
    if (state.milestones.length === 0) {
      return (
        <div className="px-4 py-4 text-[12px] text-foreground-500">
          <p>{MILESTONE_TEXT.empty}</p>
          <p className="mt-0.5">{pm ? MILESTONE_TEXT.emptyHintPm : MILESTONE_TEXT.emptyHintViewer}</p>
        </div>
      );
    }
    return (
      <table className="w-full text-left text-[13px]">
        <thead>
          <tr>
            <th className="th">{MILESTONE_TEXT.columnName}</th>
            <th className="th">{MILESTONE_TEXT.columnTargetDate}</th>
            <th className="th">{MILESTONE_TEXT.columnDday}</th>
            <th className="th">{MILESTONE_TEXT.columnTasks}</th>
            {pm && <th className="th text-right">{MILESTONE_TEXT.columnActions}</th>}
          </tr>
        </thead>
        <tbody>
          {state.milestones.map((milestone) => (
            <tr key={milestone.id} className="border-t border-background-200">
              <td className="td">
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="font-medium text-foreground-950">{milestone.name}</span>
                  {milestone.source === "aiDraft" && <Badge className="border-violet-200 bg-violet-50 text-violet-700">{MILESTONE_TEXT.aiSource}</Badge>}
                </div>
              </td>
              <td className="td whitespace-nowrap text-[12px] tabular-nums">{milestone.targetDate || "-"}</td>
              <td className="td whitespace-nowrap">
                <div className="flex items-center gap-1">
                  <Badge className={DDAY_CLASS[milestoneTone(milestone)]}>{dDayLabel(milestone.dDay)}</Badge>
                  {milestone.delayed && (
                    <Badge className="border-rose-300 bg-rose-100 text-rose-800">
                      <i className="ri-alarm-warning-line" aria-hidden="true" />
                      <span title={MILESTONE_TEXT.delayedTitle}>{MILESTONE_TEXT.delayed}</span>
                      <span className="sr-only">{MILESTONE_TEXT.delayedTitle}</span>
                    </Badge>
                  )}
                </div>
              </td>
              <td className="td text-[12px]">{taskSummaryLabel(milestone)}</td>
              {pm && (
                <td className="td">
                  <div className="flex justify-end gap-0.5">
                    {[
                      { key: "edit", label: MILESTONE_TEXT.edit, icon: "ri-pencil-line", onClick: () => setTarget({ kind: "edit", milestone }) },
                      { key: "tasks", label: MILESTONE_TEXT.editTasks, icon: "ri-links-line", onClick: () => setTarget({ kind: "tasks", milestone }) },
                      { key: "delete", label: MILESTONE_TEXT.delete, icon: "ri-delete-bin-line", onClick: () => removeMilestone(milestone) },
                    ].map((b) => (
                      <button
                        key={b.key}
                        type="button"
                        className="btn-ghost px-1.5 py-1 text-[12px]"
                        title={`${b.label}: ${milestone.name}`}
                        aria-label={`${b.label}: ${milestone.name}`}
                        onClick={b.onClick}
                        disabled={busy}
                      >
                        <i className={b.icon} aria-hidden="true" />
                      </button>
                    ))}
                  </div>
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    );
  };

  return (
    <section className="card overflow-x-auto" aria-label={MILESTONE_TEXT.title}>
      <div className="flex items-center justify-between border-b border-background-200 px-4 py-2.5">
        <h3 className="text-[13px] font-semibold text-foreground-950">{MILESTONE_TEXT.title}</h3>
        {pm && state.phase === "ready" && (
          <button type="button" className="btn-outline py-1 text-[12px]" disabled={busy} onClick={() => setTarget({ kind: "create" })}>
            <i className="ri-add-line" /> {MILESTONE_TEXT.add}
          </button>
        )}
      </div>
      {!pm && state.phase === "ready" && <p className="px-4 pt-2 text-[11.5px] text-foreground-500">{MILESTONE_TEXT.viewerNote}</p>}
      {notice && (
        <p
          role={notice.tone === "error" ? "alert" : "status"}
          className={`mx-4 mt-2 rounded-md px-3 py-2 text-[12px] ${notice.tone === "error" ? "bg-rose-50 text-rose-700" : "bg-emerald-50 text-emerald-700"}`}
        >
          {notice.text}
        </p>
      )}
      {body()}
      {target && <MilestoneDialog target={target} tree={tree} submitting={busy} error={dialogError} onClose={closeDialog} onSubmit={submit} />}
    </section>
  );
}
