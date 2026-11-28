import { useCallback, useEffect, useMemo, useState } from "react";
import EmptyState from "@/components/ui/EmptyState";
import { fetchAdminLabels, type AdminLabel, type MissingLanguage } from "@/features/admin/api/adminLabelApi";
import LabelFormDialog, { type LabelFormMode } from "@/features/admin/components/LabelFormDialog";
import LabelHistoryDialog from "@/features/admin/components/LabelHistoryDialog";
import { useCursorList } from "@/features/admin/hooks/useCursorList";
import { ADMIN_LABEL_TEXT, ADMIN_TEXT } from "@/features/admin/i18n/ko";
import { formatDateTime } from "@/features/admin/utils/adminFormat";
import { BUTTON_TEXT } from "@/shared/i18n/catalog/button";
import { useI18n } from "@/shared/i18n/i18nContext";
import { formatLabel } from "@/shared/i18n/store";

const SEARCH_DELAY_MS = 300;

type Notice = { text: string; canApply: boolean } | null;

/** 번역 누락은 색만으로 구분하지 않고 글자로 표시한다. 문구는 텍스트로만 출력한다(HTML로 해석하지 않음). */
const TranslationCell = function ({ text, lang }: { text: string | null; lang: string }) {
  if (text === null) {
    return (
      <span className="inline-flex items-center gap-1 rounded border border-amber-200 bg-amber-50 px-1.5 text-xs text-amber-800">
        <i className="ri-error-warning-line" aria-hidden="true" />
        {ADMIN_LABEL_TEXT.missing}
      </span>
    );
  }
  return (
    <span lang={lang} className="break-words text-xs text-foreground-800">
      {text}
    </span>
  );
};

/** api 모드 다국어 라벨 관리(02-4). 검색·번역 누락 필터·등록·문구 수정 */
const ServerLabelsPanel = function () {
  const { reloadLabels } = useI18n();
  const [keywordInput, setKeywordInput] = useState("");
  const [keyword, setKeyword] = useState("");
  const [missing, setMissing] = useState<"" | MissingLanguage>("");
  const [formMode, setFormMode] = useState<LabelFormMode | null>(null);
  const [historyLabel, setHistoryLabel] = useState<AdminLabel | null>(null);
  const [notice, setNotice] = useState<Notice>(null);
  const [applying, setApplying] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => setKeyword(keywordInput.trim()), SEARCH_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, [keywordInput]);

  const query = useMemo(() => ({ keyword, missing: missing || null }), [keyword, missing]);
  const fetchPage = useCallback(
    ({ cursor, signal }: { cursor: string | null; signal: AbortSignal }) => fetchAdminLabels({ ...query, cursor, signal }),
    [query],
  );
  const { state, reload, loadMore, replaceItem, prependItem } = useCursorList<AdminLabel>({
    queryKey: JSON.stringify(query),
    fetchPage,
  });

  const filtered = Boolean(keyword || missing);

  const handleSaved = ({ label, created }: { label: AdminLabel; created: boolean }) => {
    setFormMode(null);
    if (created) prependItem(label);
    else replaceItem((item) => item.id === label.id, label);
    setNotice({
      text: formatLabel(created ? ADMIN_LABEL_TEXT.created : ADMIN_LABEL_TEXT.saved, { key: label.labelKey }),
      canApply: true,
    });
  };

  // 지금 화면에 다시 적용하면 화면 전체가 새 문구로 다시 그려진다(이 안내도 사라진다).
  const applyNow = async () => {
    setApplying(true);
    await reloadLabels();
    setApplying(false);
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
          <p className="text-sm font-medium text-foreground-900">{ADMIN_LABEL_TEXT.loadFailed}</p>
          <p className="mt-1 text-xs text-foreground-600">{state.message}</p>
          <button type="button" className="btn-outline mt-3" onClick={reload}>
            {BUTTON_TEXT.retry}
          </button>
        </div>
      );
    }
    const { items, hasNext, more } = state;
    if (items.length === 0) {
      return (
        <EmptyState
          icon="ri-translate-2"
          title={ADMIN_LABEL_TEXT.empty}
          description={filtered ? ADMIN_LABEL_TEXT.emptyHint : undefined}
          action={
            filtered ? (
              <button
                type="button"
                className="btn-outline"
                onClick={() => {
                  setKeywordInput("");
                  setKeyword("");
                  setMissing("");
                }}
              >
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
                <th className="th w-64">{ADMIN_LABEL_TEXT.key}</th>
                <th className="th">{ADMIN_LABEL_TEXT.textKo}</th>
                <th className="th">{ADMIN_LABEL_TEXT.textEn}</th>
                <th className="th">{ADMIN_LABEL_TEXT.textZhTw}</th>
                <th className="th w-32">{ADMIN_LABEL_TEXT.updatedAt}</th>
                <th className="th w-36">
                  <span className="sr-only">{ADMIN_TEXT.colManage}</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {items.map((label) => (
                <tr key={label.id} className="border-b border-background-200 align-top last:border-0">
                  <td className="td break-all font-mono text-xs text-foreground-950">{label.labelKey}</td>
                  <td className="td">
                    <span lang="ko" className="break-words text-xs text-foreground-800">
                      {label.textKo}
                    </span>
                  </td>
                  <td className="td">
                    <TranslationCell text={label.textEn} lang="en" />
                  </td>
                  <td className="td">
                    <TranslationCell text={label.textZhTw} lang="zh-TW" />
                  </td>
                  <td className="td text-xs tabular-nums text-foreground-600">
                    <time dateTime={label.updatedAt}>{formatDateTime({ iso: label.updatedAt })}</time>
                  </td>
                  <td className="td">
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        className="btn-ghost min-h-8 px-2 py-1 text-xs"
                        aria-label={`${label.labelKey} ${ADMIN_LABEL_TEXT.edit}`}
                        onClick={() => setFormMode({ kind: "edit", label })}
                      >
                        {BUTTON_TEXT.edit}
                      </button>
                      <button
                        type="button"
                        className="btn-ghost min-h-8 px-2 py-1 text-xs"
                        aria-label={formatLabel(ADMIN_LABEL_TEXT.historyButtonAria, { key: label.labelKey })}
                        onClick={() => setHistoryLabel(label)}
                      >
                        {ADMIN_TEXT.history}
                      </button>
                    </div>
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

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold text-foreground-950">{ADMIN_LABEL_TEXT.title}</h3>
          <p className="mt-0.5 text-xs text-foreground-500">{ADMIN_LABEL_TEXT.description}</p>
        </div>
        <button type="button" className="btn-primary" onClick={() => setFormMode({ kind: "create" })}>
          <i className="ri-add-line" aria-hidden="true" /> {ADMIN_LABEL_TEXT.add}
        </button>
      </div>

      {notice && (
        <div
          role="status"
          className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-background-300 bg-background-50 px-3.5 py-2.5 text-xs leading-5 text-foreground-700"
        >
          <span>{notice.text}</span>
          <span className="flex shrink-0 items-center gap-3">
            {notice.canApply && (
              <button type="button" className="font-medium underline underline-offset-2" onClick={applyNow} disabled={applying}>
                {applying ? ADMIN_TEXT.loading : ADMIN_LABEL_TEXT.applyNow}
              </button>
            )}
            <button type="button" className="underline underline-offset-2" onClick={() => setNotice(null)}>
              {BUTTON_TEXT.close}
            </button>
          </span>
        </div>
      )}

      <section className="card overflow-hidden" aria-label={ADMIN_LABEL_TEXT.title}>
        <div className="flex flex-wrap items-center gap-2 border-b border-background-200 px-4 py-3">
          <div className="relative min-w-[220px] flex-1">
            <i className="ri-search-line absolute left-3 top-1/2 -translate-y-1/2 text-sm text-foreground-400" aria-hidden="true" />
            <input
              type="search"
              aria-label={ADMIN_LABEL_TEXT.searchPlaceholder}
              className="field pl-8 text-sm"
              placeholder={ADMIN_LABEL_TEXT.searchPlaceholder}
              maxLength={100}
              value={keywordInput}
              onChange={(event) => setKeywordInput(event.target.value)}
            />
          </div>
          <select
            aria-label={ADMIN_LABEL_TEXT.missingFilter}
            className="field w-auto min-w-[170px] text-sm"
            value={missing}
            onChange={(event) => setMissing(event.target.value as "" | MissingLanguage)}
          >
            <option value="">{ADMIN_LABEL_TEXT.missingAll}</option>
            <option value="en">{ADMIN_LABEL_TEXT.missingEn}</option>
            <option value="zh-TW">{ADMIN_LABEL_TEXT.missingZhTw}</option>
          </select>
        </div>
        {renderBody()}
        <div className="border-t border-background-200 bg-background-100 px-4 py-2.5 text-xs leading-5 text-foreground-500">
          {ADMIN_LABEL_TEXT.textOnlyNote}
        </div>
      </section>

      <LabelFormDialog mode={formMode} onClose={() => setFormMode(null)} onSaved={handleSaved} onStale={reload} />
      <LabelHistoryDialog label={historyLabel} onClose={() => setHistoryLabel(null)} />
    </div>
  );
};

export default ServerLabelsPanel;
