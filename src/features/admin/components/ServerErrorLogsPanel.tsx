import { useCallback, useMemo, useState, type FormEvent } from "react";
import EmptyState from "@/components/ui/EmptyState";
import {
  fetchErrorLogs,
  MAX_API_PATH_LENGTH,
  MAX_ERROR_TYPE_LENGTH,
  type ErrorLog,
  type ErrorLogQuery,
} from "@/features/admin/api/adminErrorLogApi";
import ErrorLogDetailDialog from "@/features/admin/components/ErrorLogDetailDialog";
import { useCursorList } from "@/features/admin/hooks/useCursorList";
import { useUserNames } from "@/features/admin/hooks/useUserNames";
import { ADMIN_ERROR_LOG_TEXT, ADMIN_TEXT } from "@/features/admin/i18n/ko";
import { formatDateTime } from "@/features/admin/utils/adminFormat";
import { shortTypeName, toErrorLogQuery, type ErrorLogFilterInput } from "@/features/admin/utils/errorLogRules";
import { BUTTON_TEXT } from "@/shared/i18n/catalog/button";
import { formatLabel } from "@/shared/i18n/store";

const EMPTY_FILTER: ErrorLogFilterInput = { fromDate: "", toDate: "", errorType: "", apiPath: "" };
/** 빈 조건으로 조회했을 때와 같은 모양이어야 같은 조건 재조회를 알아본다. */
const EMPTY_QUERY: ErrorLogQuery = { from: null, to: null, errorType: "", apiPath: "" };

/** api 모드 에러 로그 조회(02-5). 기간·예외 유형·경로로 거르고, 행을 고르면 스택 트레이스를 포함한 상세를 연다. */
const ServerErrorLogsPanel = function () {
  const [input, setInput] = useState<ErrorLogFilterInput>(EMPTY_FILTER);
  const [query, setQuery] = useState<ErrorLogQuery>(EMPTY_QUERY);
  const [filterError, setFilterError] = useState("");
  const [detailId, setDetailId] = useState<number | null>(null);

  const fetchPage = useCallback(
    ({ cursor, signal }: { cursor: string | null; signal: AbortSignal }) => fetchErrorLogs({ ...query, cursor, signal }),
    [query],
  );
  const { state, reload, loadMore } = useCursorList<ErrorLog>({ queryKey: JSON.stringify(query), fetchPage });

  const items = useMemo(() => (state.phase === "ready" ? state.items : []), [state]);
  const names = useUserNames(items.map(({ userId }) => userId));
  const userLabel = useCallback(
    (userId: number | null) => {
      if (userId === null) return ADMIN_ERROR_LOG_TEXT.anonymous;
      return names[userId] ?? formatLabel(ADMIN_ERROR_LOG_TEXT.userIdFallback, { id: userId });
    },
    [names],
  );

  const update = (key: keyof ErrorLogFilterInput, value: string) => {
    setInput((prev) => ({ ...prev, [key]: value }));
    if (filterError) setFilterError("");
  };

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const checked = toErrorLogQuery(input);
    if (checked.ok === false) {
      setFilterError(checked.message);
      return;
    }
    // 같은 조건으로 다시 조회하면 목록만 새로 받는다.
    if (JSON.stringify(checked.query) === JSON.stringify(query)) reload();
    else setQuery(checked.query);
  };

  const resetFilters = () => {
    setInput(EMPTY_FILTER);
    setFilterError("");
    setQuery(EMPTY_QUERY);
  };

  const filtered = Boolean(query.from || query.to || query.errorType || query.apiPath);

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
          <p className="text-sm font-medium text-foreground-900">{ADMIN_ERROR_LOG_TEXT.loadFailed}</p>
          <p className="mt-1 text-xs text-foreground-600">{state.message}</p>
          <button type="button" className="btn-outline mt-3" onClick={reload}>
            {BUTTON_TEXT.retry}
          </button>
        </div>
      );
    }
    const { hasNext, more } = state;
    if (items.length === 0) {
      return (
        <EmptyState
          icon="ri-bug-line"
          title={ADMIN_ERROR_LOG_TEXT.empty}
          description={filtered ? ADMIN_ERROR_LOG_TEXT.emptyHint : undefined}
          action={
            filtered ? (
              <button type="button" className="btn-outline" onClick={resetFilters}>
                {BUTTON_TEXT.resetFilters}
              </button>
            ) : undefined
          }
        />
      );
    }
    return (
      <>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[960px] border-collapse">
            <thead>
              <tr>
                <th className="th w-40">{ADMIN_ERROR_LOG_TEXT.occurredAt}</th>
                <th className="th w-64">{ADMIN_ERROR_LOG_TEXT.request}</th>
                <th className="th w-48">{ADMIN_ERROR_LOG_TEXT.errorType}</th>
                <th className="th">{ADMIN_ERROR_LOG_TEXT.message}</th>
                <th className="th w-32">{ADMIN_ERROR_LOG_TEXT.user}</th>
                <th className="th w-24">
                  <span className="sr-only">{ADMIN_ERROR_LOG_TEXT.openDetail}</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {items.map(({ id, occurredAt, httpMethod, apiPath, userId, errorType, message }) => (
                <tr key={id} className="border-b border-background-200 align-top last:border-0">
                  <td className="td text-xs tabular-nums text-foreground-700">
                    <time dateTime={occurredAt}>{formatDateTime({ iso: occurredAt })}</time>
                  </td>
                  <td className="td font-mono text-xs text-foreground-800">
                    {httpMethod && <span className="mr-1 font-semibold">{httpMethod}</span>}
                    <span className="break-all">{apiPath ?? ADMIN_TEXT.none}</span>
                  </td>
                  <td className="td font-mono text-xs text-foreground-800" title={errorType}>
                    {shortTypeName(errorType)}
                  </td>
                  <td className="td text-xs text-foreground-700">
                    <span className="line-clamp-2 break-all font-mono">{message ?? ADMIN_ERROR_LOG_TEXT.noMessage}</span>
                  </td>
                  <td className="td text-xs text-foreground-700">{userLabel(userId)}</td>
                  <td className="td">
                    <button
                      type="button"
                      className="btn-ghost min-h-8 px-2 py-1 text-xs"
                      aria-label={`#${id} ${ADMIN_ERROR_LOG_TEXT.openDetail}`}
                      onClick={() => setDetailId(id)}
                    >
                      {ADMIN_ERROR_LOG_TEXT.openDetail}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {hasNext && (
          <div className="border-t border-background-200 px-4 py-3 text-center">
            <button type="button" className="btn-outline" onClick={loadMore} disabled={more.phase === "loading"}>
              {more.phase === "loading" ? ADMIN_TEXT.loadingMore : more.phase === "error" ? BUTTON_TEXT.retry : ADMIN_TEXT.loadMore}
            </button>
            {more.phase === "error" && (
              <p role="alert" className="mt-1 text-xs text-rose-600">
                {more.message}
              </p>
            )}
          </div>
        )}
      </>
    );
  };

  const field = (key: keyof ErrorLogFilterInput, label: string, props: Record<string, unknown>, hint?: string) => (
    <div className="min-w-0">
      <label htmlFor={`error-log-${key}`} className="mb-1 block text-xs font-medium text-foreground-800">
        {label}
      </label>
      <input
        id={`error-log-${key}`}
        className="field text-sm"
        value={input[key]}
        onChange={(event) => update(key, event.target.value)}
        aria-describedby={hint ? `error-log-${key}-hint` : undefined}
        {...props}
      />
      {hint && (
        <p id={`error-log-${key}-hint`} className="mt-1 text-[11px] text-foreground-500">
          {hint}
        </p>
      )}
    </div>
  );

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-sm font-semibold text-foreground-950">{ADMIN_ERROR_LOG_TEXT.title}</h3>
        <p className="mt-0.5 text-xs text-foreground-500">{ADMIN_ERROR_LOG_TEXT.description}</p>
      </div>

      <form className="card space-y-3 px-4 py-3" onSubmit={submit} noValidate aria-label={ADMIN_ERROR_LOG_TEXT.filterTitle}>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {field("fromDate", ADMIN_ERROR_LOG_TEXT.fromDate, { type: "date" })}
          {field("toDate", ADMIN_ERROR_LOG_TEXT.toDate, { type: "date" })}
          {field(
            "errorType",
            ADMIN_ERROR_LOG_TEXT.errorType,
            { maxLength: MAX_ERROR_TYPE_LENGTH, spellCheck: false, autoComplete: "off", placeholder: "java.lang.IllegalStateException" },
            ADMIN_ERROR_LOG_TEXT.errorTypeHint,
          )}
          {field(
            "apiPath",
            ADMIN_ERROR_LOG_TEXT.apiPath,
            { maxLength: MAX_API_PATH_LENGTH, spellCheck: false, autoComplete: "off", placeholder: "/api/projects" },
            ADMIN_ERROR_LOG_TEXT.apiPathHint,
          )}
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-[11px] text-foreground-500">{ADMIN_ERROR_LOG_TEXT.periodNote}</p>
          <div className="flex items-center gap-2">
            <button type="button" className="btn-outline" onClick={resetFilters}>
              {BUTTON_TEXT.resetFilters}
            </button>
            <button type="submit" className="btn-primary">
              <i className="ri-search-line" aria-hidden="true" /> {ADMIN_ERROR_LOG_TEXT.search}
            </button>
          </div>
        </div>
        {filterError && (
          <p role="alert" className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
            {filterError}
          </p>
        )}
      </form>

      <section className="card overflow-hidden" aria-label={ADMIN_ERROR_LOG_TEXT.title}>
        {renderBody()}
        <div className="border-t border-background-200 bg-background-100 px-4 py-2.5 text-xs leading-5 text-foreground-500">
          {ADMIN_ERROR_LOG_TEXT.maskedNote}
        </div>
      </section>

      <ErrorLogDetailDialog errorLogId={detailId} userLabel={userLabel} onClose={() => setDetailId(null)} />
    </div>
  );
};

export default ServerErrorLogsPanel;
