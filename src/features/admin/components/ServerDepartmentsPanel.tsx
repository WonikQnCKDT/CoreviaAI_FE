import { useRef, useState } from "react";
import EmptyState from "@/components/ui/EmptyState";
import { changeAdminDepartmentStatus, type AdminDepartment } from "@/features/admin/api/adminApi";
import { useDepartments } from "@/features/admin/hooks/useDepartments";
import ConfirmDialog, { type ConfirmPhase } from "@/features/admin/components/ConfirmDialog";
import DepartmentFormDialog, { type DepartmentFormMode } from "@/features/admin/components/DepartmentFormDialog";
import { ADMIN_TEXT, STATUS_TEXT } from "@/features/admin/i18n/ko";
import { formatCount } from "@/features/admin/utils/adminFormat";
import { interpretDepartmentStatusFailure } from "@/features/admin/utils/adminDepartmentFailure";

/** 변경 성공 안내. 실패는 확인 창·입력 창 안에서 보여 준다. */
type Notice = { text: string } | null;

/** api 모드 부서 관리. 모든 페이지를 받아 트리로 보여준다. */
const ServerDepartmentsPanel = function () {
  const { state, items, tree, reload, upsert } = useDepartments();
  const [showInactive, setShowInactive] = useState(true);
  const [formMode, setFormMode] = useState<DepartmentFormMode | null>(null);
  const [statusTarget, setStatusTarget] = useState<AdminDepartment | null>(null);
  const [confirmState, setConfirmState] = useState<ConfirmPhase>({ phase: "idle" });
  const [notice, setNotice] = useState<Notice>(null);
  const controllerRef = useRef<AbortController | null>(null);

  const parentInactive = (department: AdminDepartment) =>
    department.parentId !== null && items.some(({ id, status }) => id === department.parentId && status === "inactive");

  const visible = tree.filter(({ department }) => showInactive || department.status === "active");

  const confirmStatus = async () => {
    if (!statusTarget || confirmState.phase === "submitting") return;
    controllerRef.current?.abort();
    const controller = new AbortController();
    controllerRef.current = controller;
    setConfirmState({ phase: "submitting" });
    const next = statusTarget.status === "active" ? "inactive" : "active";
    const result = await changeAdminDepartmentStatus({ departmentId: statusTarget.id, status: next, signal: controller.signal });
    if (controller.signal.aborted) return;
    if (result.ok === true) {
      upsert(result.data);
      setStatusTarget(null);
      setConfirmState({ phase: "idle" });
      setNotice({ text: `${result.data.name} 부서를 ${STATUS_TEXT[result.data.status]} 상태로 바꿨습니다.` });
      return;
    }
    const { message, stale } = interpretDepartmentStatusFailure(result.failure);
    if (stale) reload();
    setConfirmState({ phase: "failed", message });
  };

  const renderBody = () => {
    if (state.phase === "loading") {
      return (
        <p role="status" className="px-4 py-12 text-center text-sm text-foreground-500">
          {ADMIN_TEXT.loading}
        </p>
      );
    }
    if (state.phase === "error") {
      return (
        <div role="alert" className="px-4 py-12 text-center">
          <p className="text-sm font-medium text-foreground-900">{ADMIN_TEXT.loadDepartmentsFailed}</p>
          <p className="mt-1 text-xs text-foreground-600">{state.message}</p>
          <button type="button" className="btn-outline mt-3" onClick={reload}>
            {ADMIN_TEXT.retry}
          </button>
        </div>
      );
    }
    if (visible.length === 0) {
      return (
        <EmptyState
          icon="ri-organization-chart"
          title={ADMIN_TEXT.emptyDepartments}
          description={ADMIN_TEXT.emptyDepartmentsHint}
          action={
            <button type="button" className="btn-primary" onClick={() => setFormMode({ kind: "create", parentId: null })}>
              {ADMIN_TEXT.addDepartment}
            </button>
          }
        />
      );
    }
    return (
      <div className="overflow-x-auto">
        <table className="w-full min-w-[760px] border-collapse">
          <thead>
            <tr>
              <th className="th">부서</th>
              <th className="th w-28 text-right">활성 인원</th>
              <th className="th w-20">상태</th>
              <th className="th w-64">관리</th>
            </tr>
          </thead>
          <tbody>
            {visible.map(({ department, depth }) => {
              const { id, name, status, activeMemberCount } = department;
              const active = status === "active";
              return (
                <tr key={id} className="border-b border-background-200 last:border-0">
                  <td className="td">
                    {/* 들여쓰기 깊이는 트리 단계 수에 비례한다. 단계마다 1rem */}
                    <span className="flex items-center gap-1.5" style={{ paddingLeft: `${depth}rem` }}>
                      {depth > 0 && (
                        <i className="ri-corner-down-right-line text-foreground-300" aria-hidden="true" />
                      )}
                      <span className={`text-sm ${active ? "font-medium text-foreground-950" : "text-foreground-500"}`}>{name}</span>
                      <span className="sr-only">{depth > 0 ? `${depth}단계 하위 부서` : "최상위 부서"}</span>
                    </span>
                  </td>
                  <td className="td text-right text-xs tabular-nums text-foreground-700">
                    {formatCount({ value: activeMemberCount })}명
                  </td>
                  <td className="td">
                    <span className="inline-flex items-center gap-1.5 text-xs text-foreground-700">
                      <span
                        className={`h-1.5 w-1.5 rounded-full ${active ? "bg-emerald-500" : "border border-foreground-400"}`}
                        aria-hidden="true"
                      />
                      {STATUS_TEXT[status]}
                    </span>
                  </td>
                  <td className="td">
                    <div className="flex flex-wrap items-center gap-1">
                      <button
                        type="button"
                        className="btn-ghost px-2 py-1 text-xs"
                        disabled={!active}
                        title={active ? undefined : "비활성 부서에는 하위 부서를 만들 수 없습니다."}
                        onClick={() => setFormMode({ kind: "create", parentId: id })}
                      >
                        {ADMIN_TEXT.addChildDepartment}
                      </button>
                      <button type="button" className="btn-ghost px-2 py-1 text-xs" onClick={() => setFormMode({ kind: "edit", department })}>
                        수정
                      </button>
                      <button
                        type="button"
                        className="btn-outline px-2 py-1 text-xs"
                        disabled={!active && parentInactive(department)}
                        title={!active && parentInactive(department) ? "상위 부서를 먼저 활성화해야 합니다." : undefined}
                        onClick={() => {
                          setStatusTarget(department);
                          setConfirmState({ phase: "idle" });
                        }}
                      >
                        {active ? "비활성화" : "활성화"}
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    );
  };

  const deactivating = statusTarget?.status === "active";

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold text-foreground-950">{ADMIN_TEXT.departmentsTitle}</h3>
          <p className="mt-0.5 text-xs text-foreground-500">{ADMIN_TEXT.departmentsDescription}</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <label className="flex min-h-11 cursor-pointer items-center gap-2 text-sm text-foreground-700">
            <input
              type="checkbox"
              className="h-4 w-4 cursor-pointer accent-primary-600"
              checked={showInactive}
              onChange={(event) => setShowInactive(event.target.checked)}
            />
            {ADMIN_TEXT.showInactive}
          </label>
          <button type="button" className="btn-primary" onClick={() => setFormMode({ kind: "create", parentId: null })}>
            <i className="ri-add-line" aria-hidden="true" /> {ADMIN_TEXT.addDepartment}
          </button>
        </div>
      </div>

      {notice && (
        <div
          role="status"
          className="flex items-start justify-between gap-2 rounded-lg border border-background-300 bg-background-50 px-3.5 py-2.5 text-xs leading-5 text-foreground-700"
        >
          <span>{notice.text}</span>
          <button type="button" className="shrink-0 underline underline-offset-2" onClick={() => setNotice(null)}>
            {ADMIN_TEXT.close}
          </button>
        </div>
      )}

      <section className="card overflow-hidden" aria-label="부서 목록">
        {renderBody()}
        <div className="border-t border-background-200 bg-background-100 px-4 py-2.5 text-xs leading-5 text-foreground-500">
          {ADMIN_TEXT.serverAppliedNote} 활성 인원은 그 부서에 직접 소속된 사람만 셉니다.
        </div>
      </section>

      <DepartmentFormDialog
        mode={formMode}
        departments={items}
        tree={tree}
        onClose={() => setFormMode(null)}
        onSaved={({ department, created }) => {
          setFormMode(null);
          upsert(department);
          setNotice({ text: `${department.name} 부서를 ${created ? "추가" : "저장"}했습니다.` });
        }}
        onStale={reload}
      />

      <ConfirmDialog
        open={Boolean(statusTarget)}
        title={deactivating ? "부서 비활성화" : "부서 활성화"}
        confirmLabel={deactivating ? "비활성화" : "활성화"}
        tone={deactivating ? "danger" : "default"}
        state={confirmState}
        onConfirm={confirmStatus}
        onClose={() => {
          controllerRef.current?.abort();
          setStatusTarget(null);
        }}
      >
        <p>
          <strong className="font-medium text-foreground-950">{statusTarget?.name}</strong> 부서를{" "}
          {deactivating ? "비활성화" : "활성화"}합니다.
        </p>
        {deactivating && (
          <p>비활성 부서에는 사용자를 새로 배치하거나 하위 부서를 만들 수 없습니다. 활성 사용자나 활성 하위 부서가 있으면 비활성화할 수 없습니다.</p>
        )}
      </ConfirmDialog>
    </div>
  );
};

export default ServerDepartmentsPanel;
