import { Fragment, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Badge, StatusBadge } from "@/components/ui/Badge";
import EmptyState from "@/components/ui/EmptyState";
import ProgressBar from "@/components/ui/ProgressBar";
import WorkPlanTabs from "@/features/task/components/WorkPlanTabs";
import {
  createWbsTask,
  deleteWbsTask,
  moveWbsTask,
  updateTaskProgress,
  updateWbsTask,
  type WbsItem,
  type WbsTaskFields,
} from "@/features/wbs/api/wbsApi";
import ServerTaskDetailDialog from "@/features/board/components/ServerTaskDetailDialog";
import WbsProgressDialog from "@/features/wbs/components/WbsProgressDialog";
import WbsReparentDialog from "@/features/wbs/components/WbsReparentDialog";
import WbsTaskFormDialog, { type WbsFormTarget } from "@/features/wbs/components/WbsTaskFormDialog";
import { useServerWbs } from "@/features/wbs/hooks/useServerWbs";
import { WBS_TEXT } from "@/features/wbs/i18n/ko";
import {
  canAddSubtask,
  canEditItem,
  canEditProgress,
  canManageWbs,
  canReparent,
  deriveDisplayStatus,
  interpretWbsFailure,
  moveTarget,
  reparentCandidates,
  viewerNote,
  type ReparentOption,
  type WbsAction,
} from "@/features/wbs/utils/wbsRules";
import type { ApiResult } from "@/shared/api/client";
import { formatLabel } from "@/shared/i18n/store";
import type { Project } from "@/types";

type Notice = { tone: "success" | "error"; text: string } | null;

const period = (item: WbsItem) => (item.startDate && item.endDate ? `${item.startDate} ~ ${item.endDate}` : "-");
const effortText = (item: WbsItem) =>
  item.estimatedEffort === null ? WBS_TEXT.noEffort : formatLabel(WBS_TEXT.personDays, { value: item.estimatedEffort });

/**
 * api 모드 WBS(FR-WBS-01). 화면에 보이는 트리는 언제나 서버가 준 트리다.
 * 변경이 성공하면 응답의 트리 전체로 바꾸고, 실패하면 아무것도 바꾸지 않는다(가짜 성공 없음).
 * 버튼 노출은 역할에 따른 안내일 뿐이고 최종 판정은 서버가 한다.
 */
export default function ServerWbsView({ project }: { project: Project & { serverId: number } }) {
  const projectId = project.serverId;
  const { state, reload, replaceTree, viewer } = useServerWbs(projectId);
  const [formTarget, setFormTarget] = useState<WbsFormTarget | null>(null);
  const [progressTarget, setProgressTarget] = useState<WbsItem | null>(null);
  const [reparentTarget, setReparentTarget] = useState<WbsItem | null>(null);
  const [dialogError, setDialogError] = useState("");
  const [detailTaskId, setDetailTaskId] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<Notice>(null);
  const busyRef = useRef(false);

  if (state.phase === "loading") {
    return <p className="py-10 text-center text-[13px] text-foreground-500" role="status">{WBS_TEXT.loading}</p>;
  }
  if (state.phase === "unavailable") {
    return <EmptyState icon="ri-node-tree" title={WBS_TEXT.unavailable} />;
  }
  if (state.phase === "error") {
    return (
      <EmptyState
        tone="danger"
        icon="ri-error-warning-line"
        title={WBS_TEXT.loadFailed}
        description={state.message}
        action={
          <button type="button" className="btn-outline" onClick={reload}>
            {WBS_TEXT.retry}
          </button>
        }
      />
    );
  }

  const { tree, phases, members } = state;
  const pm = canManageWbs(viewer);
  const note = viewerNote(viewer);
  const groups = [
    ...phases.map((phase) => ({ key: String(phase.id), phaseId: phase.id as number | null, name: phase.name })),
    // 단계 없는 프로젝트이거나 단계가 사라진 작업
    ...(tree.some((t) => t.phaseId === null || !phases.some((p) => p.id === t.phaseId))
      ? [{ key: "none", phaseId: null as number | null, name: WBS_TEXT.noPhase }]
      : []),
  ];
  const tasksOf = (phaseId: number | null) =>
    tree.filter((t) => (phaseId === null ? t.phaseId === null || !phases.some((p) => p.id === t.phaseId) : t.phaseId === phaseId));

  const closeDialogs = () => {
    setFormTarget(null);
    setProgressTarget(null);
    setReparentTarget(null);
    setDialogError("");
  };

  /** 변경 요청 하나를 보내고 결과를 반영한다. 동시에 두 요청을 보내지 않는다 */
  const run = async function <T>(
    action: WbsAction,
    request: () => Promise<ApiResult<T>>,
    onSuccess: (data: T) => string,
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
    const view = interpretWbsFailure(action, result.failure);
    if (view.reload) reload();
    if (inDialog && !view.reload) setDialogError(view.message);
    else {
      setNotice({ tone: "error", text: view.message });
      if (inDialog) closeDialogs();
    }
    return false;
  };

  const submitForm = async ({ phaseId, fields }: { phaseId: number | null; fields: WbsTaskFields }) => {
    if (!formTarget) return;
    const target = formTarget;
    const ok =
      target.kind === "edit"
        ? await run(
            "update",
            () => updateWbsTask({ projectId, taskId: target.item.id, phaseId: target.item.parentTaskId === null ? phaseId : target.item.phaseId, fields, version: target.item.version }),
            (change) => {
              replaceTree(change.tasks);
              return formatLabel(WBS_TEXT.updated, { name: fields.name });
            },
            { inDialog: true },
          )
        : await run(
            "create",
            () =>
              createWbsTask({
                projectId,
                parentTaskId: target.kind === "createSubtask" ? target.parent.id : null,
                phaseId: target.kind === "createTask" ? phaseId : null,
                fields,
              }),
            (change) => {
              replaceTree(change.tasks);
              return formatLabel(WBS_TEXT.created, { name: fields.name });
            },
            { inDialog: true },
          );
    if (ok) closeDialogs();
  };

  const submitProgress = async (progress: number) => {
    if (!progressTarget) return;
    const item = progressTarget;
    const ok = await run(
      "progress",
      () => updateTaskProgress({ projectId, taskId: item.id, progress, version: item.version }),
      () => {
        // 상위 작업·단계 진척률이 함께 바뀌므로 트리를 다시 받는다
        reload();
        return formatLabel(WBS_TEXT.progressSaved, { value: progress });
      },
      { inDialog: true },
    );
    if (ok) closeDialogs();
  };

  const remove = (item: WbsItem) => {
    if (!window.confirm(formatLabel(WBS_TEXT.confirmDelete, { name: item.name }))) return;
    void run(
      "delete",
      () => deleteWbsTask({ projectId, taskId: item.id }),
      (change) => {
        replaceTree(change.tasks);
        return formatLabel(WBS_TEXT.deleted, { name: item.name });
      },
      { inDialog: false },
    );
  };

  const move = (item: WbsItem, direction: "up" | "down") => {
    const target = moveTarget(tree, item, direction);
    if (!target) return;
    void run(
      "move",
      () => moveWbsTask({ projectId, taskId: item.id, parentTaskId: target.parentTaskId, index: target.index, version: item.version }),
      (change) => {
        replaceTree(change.tasks);
        return WBS_TEXT.moved;
      },
      { inDialog: false },
    );
  };

  const submitReparent = async (option: ReparentOption) => {
    if (!reparentTarget) return;
    const item = reparentTarget;
    const ok = await run(
      "move",
      () => moveWbsTask({ projectId, taskId: item.id, parentTaskId: option.parentTaskId, index: option.index, version: item.version }),
      (change) => {
        replaceTree(change.tasks);
        return WBS_TEXT.moved;
      },
      { inDialog: true },
    );
    if (ok) closeDialogs();
  };

  const actions = (item: WbsItem) => {
    const buttons: { key: string; label: string; icon: string; onClick: () => void; disabled?: boolean }[] = [];
    if (canAddSubtask(viewer, item)) {
      buttons.push({ key: "sub", label: WBS_TEXT.addSubtask, icon: "ri-add-line", onClick: () => setFormTarget({ kind: "createSubtask", parent: item }) });
    }
    if (canEditItem(viewer, item)) {
      buttons.push({ key: "edit", label: WBS_TEXT.edit, icon: "ri-pencil-line", onClick: () => setFormTarget({ kind: "edit", item }) });
    }
    if (canEditProgress(viewer, item)) {
      buttons.push({ key: "progress", label: WBS_TEXT.editProgress, icon: "ri-percent-line", onClick: () => setProgressTarget(item) });
    }
    if (pm) {
      buttons.push(
        { key: "reparent", label: "상위 작업 변경", icon: "ri-node-tree", onClick: () => setReparentTarget(item), disabled: !canReparent(tree, item) },
        { key: "up", label: WBS_TEXT.moveUp, icon: "ri-arrow-up-s-line", onClick: () => move(item, "up"), disabled: moveTarget(tree, item, "up") === null },
        { key: "down", label: WBS_TEXT.moveDown, icon: "ri-arrow-down-s-line", onClick: () => move(item, "down"), disabled: moveTarget(tree, item, "down") === null },
        { key: "delete", label: WBS_TEXT.delete, icon: "ri-delete-bin-line", onClick: () => remove(item) },
      );
    }
    return (
      <div className="flex justify-end gap-0.5">
        {buttons.map((b) => (
          <button
            key={b.key}
            type="button"
            className="btn-ghost px-1.5 py-1 text-[12px]"
            title={`${b.label}: ${item.name}`}
            aria-label={`${b.label}: ${item.name}`}
            onClick={b.onClick}
            disabled={busy || b.disabled}
          >
            <i className={b.icon} aria-hidden="true" />
          </button>
        ))}
      </div>
    );
  };

  const row = (item: WbsItem, depth: 0 | 1) => (
    <tr key={item.id} className="border-t border-background-200">
      <td className="td">
        <div className={`flex items-center gap-1.5 ${depth === 1 ? "pl-6" : ""}`}>
          {depth === 1 && <i className="ri-corner-down-right-line text-foreground-400" aria-hidden="true" />}
          <button
            type="button"
            className={`text-left hover:underline ${depth === 0 ? "font-medium text-foreground-950" : "text-foreground-800"}`}
            aria-label={`${WBS_TEXT.openDetail}: ${item.name}`}
            onClick={() => setDetailTaskId(item.id)}
          >
            {item.name}
          </button>
          {item.source === "aiDraft" && <Badge className="border-violet-200 bg-violet-50 text-violet-700">{WBS_TEXT.aiSource}</Badge>}
        </div>
      </td>
      <td className="td text-[12px]">{item.assignee ? item.assignee.name || String(item.assignee.id) : WBS_TEXT.unassigned}</td>
      <td className="td whitespace-nowrap text-[12px] tabular-nums" title={item.scheduleDerived ? WBS_TEXT.derivedSchedule : undefined}>
        {period(item)}
        {item.scheduleDerived && <span className="ml-1 text-[10.5px] text-foreground-500">({WBS_TEXT.derivedSchedule})</span>}
      </td>
      <td className="td text-[12px]">{effortText(item)}</td>
      <td className="td min-w-[110px]" title={item.subtasks.length > 0 ? WBS_TEXT.derivedProgress : undefined}>
        <ProgressBar value={item.progress} showLabel />
      </td>
      <td className="td" title={item.subtasks.length > 0 ? "하위 작업 상태 기준 자동 계산" : undefined}>
        <StatusBadge status={deriveDisplayStatus(item)} />
      </td>
      <td className="td">{actions(item)}</td>
    </tr>
  );

  return (
    <div className="space-y-2.5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <WorkPlanTabs projectId={project.id} active="wbs" />
        {pm && (
          <Link to={`/projects/${project.id}/wbs/draft`} className="btn-outline py-1.5 text-[12px]">
            <i className="ri-sparkling-2-line" /> {WBS_TEXT.aiDraftLink}
          </Link>
        )}
      </div>

      {note && <p className="rounded-md bg-background-100 px-3 py-2 text-[12px] text-foreground-600">{note}</p>}
      <p className="text-[11.5px] text-foreground-500">{WBS_TEXT.milestoneNote}</p>
      {notice && (
        <p
          role={notice.tone === "error" ? "alert" : "status"}
          className={`rounded-md px-3 py-2 text-[12px] ${notice.tone === "error" ? "bg-rose-50 text-rose-700" : "bg-emerald-50 text-emerald-700"}`}
        >
          {notice.text}
        </p>
      )}

      {tree.length === 0 && <p className="text-[12px] text-foreground-600">{pm ? WBS_TEXT.emptyHintPm : WBS_TEXT.emptyHintViewer}</p>}

      {(groups.length > 0 ? groups : [{ key: "none", phaseId: null, name: WBS_TEXT.noPhase }]).map((group) => {
        const tasks = tasksOf(group.phaseId);
        return (
          <section key={group.key} className="card overflow-x-auto" aria-label={group.name}>
            <div className="flex items-center justify-between border-b border-background-200 px-4 py-2.5">
              <h3 className="text-[13px] font-semibold text-foreground-950">{group.name}</h3>
              {pm && (group.phaseId !== null || phases.length === 0) && (
                <button
                  type="button"
                  className="btn-outline py-1 text-[12px]"
                  disabled={busy}
                  onClick={() => setFormTarget({ kind: "createTask", phaseId: group.phaseId })}
                >
                  <i className="ri-add-line" /> {WBS_TEXT.addTask}
                </button>
              )}
            </div>
            {tasks.length === 0 ? (
              <p className="px-4 py-4 text-[12px] text-foreground-500">{WBS_TEXT.empty}</p>
            ) : (
              <table className="w-full text-left text-[13px]">
                <thead>
                  <tr>
                    <th className="th">{WBS_TEXT.columnName}</th>
                    <th className="th">{WBS_TEXT.columnAssignee}</th>
                    <th className="th">{WBS_TEXT.columnPeriod}</th>
                    <th className="th">{WBS_TEXT.columnEffort}</th>
                    <th className="th">{WBS_TEXT.progress}</th>
                    <th className="th">{WBS_TEXT.columnStatus}</th>
                    <th className="th text-right">{WBS_TEXT.columnActions}</th>
                  </tr>
                </thead>
                <tbody>
                  {tasks.map((task) => (
                    <Fragment key={task.id}>
                      {row(task, 0)}
                      {task.subtasks.map((sub) => row(sub, 1))}
                    </Fragment>
                  ))}
                </tbody>
              </table>
            )}
          </section>
        );
      })}

      {formTarget && (
        <WbsTaskFormDialog
          target={formTarget}
          phases={phases}
          members={members}
          viewer={viewer}
          submitting={busy}
          error={dialogError}
          onClose={closeDialogs}
          onSubmit={submitForm}
        />
      )}
      {detailTaskId !== null && (
        <ServerTaskDetailDialog projectId={projectId} taskId={detailTaskId} viewer={viewer} members={members} onClose={() => setDetailTaskId(null)} onChanged={reload} />
      )}
      {progressTarget && (
        <WbsProgressDialog item={progressTarget} submitting={busy} error={dialogError} onClose={closeDialogs} onSubmit={submitProgress} />
      )}
      {reparentTarget && (
        <WbsReparentDialog
          item={reparentTarget}
          options={reparentCandidates(tree, reparentTarget)}
          phases={phases}
          submitting={busy}
          error={dialogError}
          onClose={closeDialogs}
          onSubmit={submitReparent}
        />
      )}
    </div>
  );
}
