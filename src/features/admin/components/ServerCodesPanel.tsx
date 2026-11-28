import { useEffect, useRef, useState } from "react";
import EmptyState from "@/components/ui/EmptyState";
import { changeCodeSortOrder, MAX_SORT_ORDER, MIN_SORT_ORDER, type AdminCode } from "@/features/admin/api/adminCodeApi";
import { useCodeGroups, useGroupCodes } from "@/features/admin/hooks/useCommonCodes";
import { ADMIN_CODE_TEXT, ADMIN_NOTICE_TEXT, ADMIN_TEXT } from "@/features/admin/i18n/ko";
import { formatDateTime } from "@/features/admin/utils/adminFormat";
import { interpretCodeFailure, parseSortOrder } from "@/features/admin/utils/adminCodeRules";
import { formatLabel } from "@/shared/i18n/store";
import { translate } from "@/shared/i18n/store";
import { invalidateCodeCache } from "@/shared/codes/codeStore";

type RowMap = Record<string, string>;

/** api 모드 공통 코드 관리(02-3). 그룹을 고르면 코드 전체를 보여 주고, 정렬 순서만 바꾼다. */
const ServerCodesPanel = function () {
  const groups = useCodeGroups();
  const [groupCode, setGroupCode] = useState<string | null>(null);
  const codes = useGroupCodes({ groupCode, onGroupMissing: groups.reload });
  const [drafts, setDrafts] = useState<RowMap>({});
  const [rowErrors, setRowErrors] = useState<RowMap>({});
  const [savingCode, setSavingCode] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const controllerRef = useRef<AbortController | null>(null);

  // 그룹 목록을 받으면 첫 그룹을 고른다. 고른 그룹이 목록에서 사라졌으면 다시 고른다.
  useEffect(() => {
    if (groups.state.phase !== "ready") return;
    const { items } = groups.state;
    if (groupCode !== null && items.some((group) => group.groupCode === groupCode)) return;
    setGroupCode(items[0]?.groupCode ?? null);
  }, [groups.state, groupCode]);

  // 그룹을 바꾸면 입력 중이던 값과 진행 중인 저장을 버린다.
  useEffect(() => {
    controllerRef.current?.abort();
    setDrafts({});
    setRowErrors({});
    setSavingCode(null);
  }, [groupCode]);

  useEffect(() => () => controllerRef.current?.abort(), []);

  const draftOf = (code: AdminCode) => drafts[code.code] ?? String(code.sortOrder);
  const changed = (code: AdminCode) => draftOf(code).trim() !== String(code.sortOrder);

  const setDraft = (code: string, value: string) => {
    setDrafts((prev) => ({ ...prev, [code]: value }));
    setRowErrors((prev) => ({ ...prev, [code]: "" }));
  };

  const save = async (code: AdminCode) => {
    if (!groupCode || savingCode !== null) return;
    const checked = parseSortOrder(draftOf(code));
    if (checked.ok === false) {
      setRowErrors((prev) => ({ ...prev, [code.code]: checked.message }));
      return;
    }
    controllerRef.current?.abort();
    const controller = new AbortController();
    controllerRef.current = controller;
    setSavingCode(code.code);
    setNotice(null);
    const result = await changeCodeSortOrder({ groupCode, code: code.code, sortOrder: checked.value, signal: controller.signal });
    if (controller.signal.aborted) return;
    setSavingCode(null);
    if (result.ok === true) {
      codes.replace(result.data);
      invalidateCodeCache(groupCode);
      setDrafts(({ [code.code]: _saved, ...rest }) => rest);
      setNotice(formatLabel(ADMIN_NOTICE_TEXT.codeSortOrderChanged, { code: code.code, sortOrder: result.data.sortOrder }));
      return;
    }
    const { message, stale } = interpretCodeFailure(result.failure);
    setRowErrors((prev) => ({ ...prev, [code.code]: message }));
    // 코드가 사라졌으면 코드 목록만 다시 받는다. 그룹까지 사라졌으면 그 조회의 404가 그룹 목록을 다시 받게 한다.
    if (stale) codes.reload();
  };

  const renderGroups = () => {
    const { state } = groups;
    if (state.phase === "idle" || state.phase === "loading") {
      return (
        <p role="status" className="px-3 py-6 text-center text-xs text-foreground-500">
          {ADMIN_TEXT.loading}
        </p>
      );
    }
    if (state.phase === "error") {
      return (
        <div role="alert" className="px-3 py-6 text-center">
          <p className="text-xs font-medium text-foreground-900">{ADMIN_CODE_TEXT.loadGroupsFailed}</p>
          <p className="mt-1 text-xs text-foreground-600">{state.message}</p>
          <button type="button" className="btn-outline mt-3" onClick={groups.reload}>
            {ADMIN_TEXT.retry}
          </button>
        </div>
      );
    }
    if (state.items.length === 0) {
      return <EmptyState icon="ri-list-settings-line" title={ADMIN_CODE_TEXT.emptyGroups} description={ADMIN_CODE_TEXT.emptyGroupsHint} />;
    }
    return (
      <ul className="p-1.5">
        {state.items.map(({ id, groupCode: value, labelKey }) => {
          const selected = value === groupCode;
          return (
            <li key={id}>
              <button
                type="button"
                aria-current={selected ? "true" : undefined}
                onClick={() => setGroupCode(value)}
                className={`flex min-h-11 w-full cursor-pointer flex-col items-start justify-center rounded-md px-3 py-1.5 text-left ${
                  selected ? "bg-primary-50 text-primary-800" : "text-foreground-800 hover:bg-background-100"
                }`}
              >
                <span className="font-mono text-xs font-medium">{value}</span>
                <span className="text-xs text-foreground-600">{translate(labelKey, labelKey)}</span>
              </button>
            </li>
          );
        })}
      </ul>
    );
  };

  const renderCodes = () => {
    const { state } = codes;
    if (state.phase === "idle") {
      return <p className="px-4 py-12 text-center text-sm text-foreground-500">{ADMIN_CODE_TEXT.selectGroup}</p>;
    }
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
          <p className="text-sm font-medium text-foreground-900">{ADMIN_CODE_TEXT.loadCodesFailed}</p>
          <p className="mt-1 text-xs text-foreground-600">{state.message}</p>
          <button type="button" className="btn-outline mt-3" onClick={codes.reload}>
            {ADMIN_TEXT.retry}
          </button>
        </div>
      );
    }
    if (state.items.length === 0) {
      return <EmptyState icon="ri-list-check" title={ADMIN_CODE_TEXT.emptyCodes} />;
    }
    return (
      <div className="overflow-x-auto">
        <table className="w-full min-w-[840px] border-collapse">
          <thead>
            <tr>
              <th className="th">코드 값</th>
              <th className="th">라벨 키</th>
              <th className="th">{ADMIN_CODE_TEXT.displayText}</th>
              <th className="th w-24">사용 여부</th>
              <th className="th w-56">정렬 순서</th>
              <th className="th w-36">수정일</th>
            </tr>
          </thead>
          <tbody>
            {state.items.map((code) => {
              const { id, code: value, labelKey, active, updatedAt } = code;
              const saving = savingCode === value;
              const error = rowErrors[value];
              const inputId = `code-sort-${id}`;
              return (
                <tr key={id} className="border-b border-background-200 last:border-0" aria-busy={saving}>
                  <td className="td font-mono text-xs font-medium text-foreground-950">{value}</td>
                  <td className="td font-mono text-xs text-foreground-600">{labelKey}</td>
                  <td className="td text-xs text-foreground-800">{translate(labelKey, "") || <span className="text-foreground-400">{ADMIN_TEXT.none}</span>}</td>
                  <td className="td">
                    <span className="inline-flex items-center gap-1.5 text-xs text-foreground-700">
                      <span
                        className={`h-1.5 w-1.5 rounded-full ${active ? "bg-emerald-500" : "border border-foreground-400"}`}
                        aria-hidden="true"
                      />
                      {active ? ADMIN_CODE_TEXT.inUse : ADMIN_CODE_TEXT.notInUse}
                    </span>
                  </td>
                  <td className="td">
                    <form
                      className="flex items-center gap-1.5"
                      noValidate
                      onSubmit={(event) => {
                        event.preventDefault();
                        save(code);
                      }}
                    >
                      <label htmlFor={inputId} className="sr-only">
                        {value} 정렬 순서
                      </label>
                      <input
                        id={inputId}
                        type="number"
                        inputMode="numeric"
                        min={MIN_SORT_ORDER}
                        max={MAX_SORT_ORDER}
                        step={1}
                        className={`field w-24 text-xs tabular-nums ${error ? "border-rose-300" : ""}`}
                        value={draftOf(code)}
                        disabled={saving}
                        onChange={(event) => setDraft(value, event.target.value)}
                        aria-invalid={Boolean(error)}
                        aria-describedby={error ? `${inputId}-error` : undefined}
                      />
                      <button
                        type="submit"
                        className="btn-outline min-h-8 px-2.5 py-1 text-xs"
                        disabled={saving || savingCode !== null || !changed(code)}
                      >
                        {saving ? ADMIN_TEXT.saving : ADMIN_TEXT.save}
                      </button>
                    </form>
                    {error && (
                      <p id={`${inputId}-error`} role="alert" className="mt-1 text-xs text-rose-600">
                        {error}
                      </p>
                    )}
                  </td>
                  <td className="td text-xs tabular-nums text-foreground-600">
                    <time dateTime={updatedAt}>{formatDateTime({ iso: updatedAt })}</time>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    );
  };

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-sm font-semibold text-foreground-950">{ADMIN_CODE_TEXT.title}</h3>
        <p className="mt-0.5 text-xs text-foreground-500">{ADMIN_CODE_TEXT.description}</p>
      </div>

      {notice && (
        <div
          role="status"
          className="flex items-start justify-between gap-2 rounded-lg border border-background-300 bg-background-50 px-3.5 py-2.5 text-xs leading-5 text-foreground-700"
        >
          <span>{notice}</span>
          <button type="button" className="shrink-0 underline underline-offset-2" onClick={() => setNotice(null)}>
            {ADMIN_TEXT.close}
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[240px_minmax(0,1fr)]">
        <nav className="card overflow-hidden" aria-label={ADMIN_CODE_TEXT.groupsLabel}>
          <p className="border-b border-background-200 px-3 py-2.5 text-xs font-medium text-foreground-700">
            {ADMIN_CODE_TEXT.groupsLabel}
          </p>
          {renderGroups()}
        </nav>
        <section className="card overflow-hidden" aria-label={groupCode ? `${groupCode} 코드 목록` : "코드 목록"}>
          {renderCodes()}
          <div className="border-t border-background-200 bg-background-100 px-4 py-2.5 text-xs leading-5 text-foreground-500">
            {ADMIN_CODE_TEXT.fixedNote} {ADMIN_CODE_TEXT.lastWriteWins}
          </div>
        </section>
      </div>
    </div>
  );
};

export default ServerCodesPanel;
