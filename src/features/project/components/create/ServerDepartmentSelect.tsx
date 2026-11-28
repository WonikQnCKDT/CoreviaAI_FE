import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { departmentPath, fetchDepartments, type DirectoryDepartment } from "@/features/project/api/directoryApi";
import { lookupFailureMessage, MAX_CREATE_DEPARTMENTS } from "@/features/project/utils/serverCreate";
import { PROJECT_CREATE_TEXT } from "@/features/project/i18n/ko";
import { BUTTON_TEXT } from "@/shared/i18n/catalog/button";
import { formatLabel } from "@/shared/i18n/store";

interface ServerDepartmentSelectProps {
  selectedIds: readonly number[];
  onToggle: (departmentId: number) => void;
  disabled?: boolean;
}

type LoadState = { phase: "loading" } | { phase: "error"; message: string } | { phase: "ready"; departments: DirectoryDepartment[] };

/**
 * 생성 화면 ① 주관 부서 0~20개 선택(GET /api/departments). 선택 항목이라 목록을 받지 못해도 생성은 막지 않는다.
 * 부서는 "상위 > 하위" 경로로 보이고, 이름으로 걸러 고른다. 고른 부서는 위에 칩으로 보여 걸러진 상태에서도 해제할 수 있다.
 */
const ServerDepartmentSelect = function ({ selectedIds, onToggle, disabled = false }: ServerDepartmentSelectProps) {
  const [state, setState] = useState<LoadState>({ phase: "loading" });
  const [filter, setFilter] = useState("");
  const controllerRef = useRef<AbortController | null>(null);

  const load = useCallback(() => {
    controllerRef.current?.abort();
    const controller = new AbortController();
    controllerRef.current = controller;
    setState({ phase: "loading" });
    fetchDepartments({ signal: controller.signal }).then((result) => {
      if (controller.signal.aborted) return;
      if (result.ok === true) setState({ phase: "ready", departments: result.data });
      else setState({ phase: "error", message: lookupFailureMessage(result.failure) });
    });
  }, []);

  useEffect(() => {
    load();
    return () => controllerRef.current?.abort();
  }, [load]);

  const departments = useMemo(() => (state.phase === "ready" ? state.departments : []), [state]);
  const labeled = useMemo(() => {
    const byId = new Map(departments.map((department) => [department.id, department]));
    return departments.map((department) => ({ ...department, path: departmentPath(department, byId) }));
  }, [departments]);
  const keyword = filter.trim().toLowerCase();
  const visible = keyword ? labeled.filter(({ path }) => path.toLowerCase().includes(keyword)) : labeled;
  const selected = labeled.filter(({ id }) => selectedIds.includes(id));
  const atLimit = selectedIds.length >= MAX_CREATE_DEPARTMENTS;

  if (state.phase === "loading") {
    return (
      <p role="status" className="text-[11.5px] text-foreground-500">
        {PROJECT_CREATE_TEXT.departmentsLoading}
      </p>
    );
  }
  if (state.phase === "error") {
    return (
      <div role="alert" className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-[11.5px] text-rose-700">
        <span>
          {PROJECT_CREATE_TEXT.departmentsFailed} {state.message}
        </span>
        <button type="button" className="btn-outline shrink-0" onClick={load} disabled={disabled}>
          {BUTTON_TEXT.retry}
        </button>
      </div>
    );
  }
  if (labeled.length === 0) {
    return <p className="text-[11.5px] text-foreground-500">{PROJECT_CREATE_TEXT.departmentsEmpty}</p>;
  }

  return (
    <div className="space-y-2">
      {selected.length > 0 && (
        <ul className="flex flex-wrap gap-1.5" aria-label={PROJECT_CREATE_TEXT.departmentsSection}>
          {selected.map(({ id, path }) => (
            <li key={id} className="inline-flex items-center gap-1 rounded-full border border-primary-200 bg-primary-50 px-2 py-0.5 text-[11px] font-medium text-primary-800">
              <span>{path}</span>
              <button
                type="button"
                className="flex h-4 w-4 cursor-pointer items-center justify-center rounded-full text-primary-600 hover:bg-primary-200/70"
                aria-label={formatLabel(PROJECT_CREATE_TEXT.removeDepartment, { name: path })}
                disabled={disabled}
                onClick={() => onToggle(id)}
              >
                <i className="ri-close-line text-[11px]" aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>
      )}
      <input
        type="search"
        className="field text-[12.5px]"
        aria-label={PROJECT_CREATE_TEXT.departmentsFilter}
        placeholder={PROJECT_CREATE_TEXT.departmentsFilter}
        value={filter}
        disabled={disabled}
        onChange={(event) => setFilter(event.target.value)}
      />
      <fieldset className="max-h-[180px] overflow-y-auto rounded-lg border border-background-300 px-2 py-1.5">
        <legend className="sr-only">{PROJECT_CREATE_TEXT.departmentsSection}</legend>
        {visible.length === 0 && <p className="px-1 py-2 text-[11.5px] text-foreground-500">{PROJECT_CREATE_TEXT.departmentsNoMatch}</p>}
        {visible.map(({ id, path }) => {
          const checked = selectedIds.includes(id);
          return (
            <label key={id} className="flex min-h-8 cursor-pointer items-center gap-2 px-1 text-[12px]">
              <input
                type="checkbox"
                className="h-4 w-4 accent-primary-600"
                checked={checked}
                disabled={disabled || (!checked && atLimit)}
                onChange={() => onToggle(id)}
              />
              {path}
            </label>
          );
        })}
      </fieldset>
      <p className="text-[11px] text-foreground-500">{formatLabel(PROJECT_CREATE_TEXT.departmentsSelected, { count: String(selectedIds.length) })}</p>
    </div>
  );
};

export default ServerDepartmentSelect;
