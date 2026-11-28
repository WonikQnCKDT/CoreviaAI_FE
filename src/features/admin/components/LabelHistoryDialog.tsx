import { useCallback } from "react";
import Modal from "@/components/ui/Modal";
import { fetchLabelHistories, type AdminLabel, type LabelHistoryDetail } from "@/features/admin/api/adminLabelApi";
import { useCursorList } from "@/features/admin/hooks/useCursorList";
import {
  ADMIN_ERROR_LOG_TEXT,
  ADMIN_LABEL_TEXT,
  ADMIN_TEXT,
  HISTORY_ACTION_TEXT,
} from "@/features/admin/i18n/ko";
import { formatDateTime } from "@/features/admin/utils/adminFormat";
import { formatLabel } from "@/shared/i18n/store";

interface LabelHistoryDialogProps {
  label: AdminLabel | null;
  onClose: () => void;
}

const LANGUAGE_LABEL: Record<string, string> = {
  get ko() {
    return ADMIN_LABEL_TEXT.textKo;
  },
  get en() {
    return ADMIN_LABEL_TEXT.textEn;
  },
  get "zh-TW"() {
    return ADMIN_LABEL_TEXT.textZhTw;
  },
};

const formatActor = (actorName: string | null, actorUserId: number | null) => {
  if (actorName) return actorName;
  if (actorUserId !== null) return formatLabel(ADMIN_ERROR_LOG_TEXT.userIdFallback, { id: actorUserId });
  return ADMIN_TEXT.actorUnknown;
};

const formatTextValue = (value: string | null) => value ?? ADMIN_LABEL_TEXT.missing;

const renderDetail = (detail: LabelHistoryDetail | null) => {
  if (!detail) return null;
  if (detail.kind === "changed") {
    return (
      <p className="mt-1.5 break-words text-xs leading-5 text-foreground-700">
        <span className="text-foreground-500">{LANGUAGE_LABEL[detail.lang] ?? detail.lang}</span>{" "}
        {formatTextValue(detail.before)}
        <span className="mx-1 text-foreground-400" aria-label={ADMIN_TEXT.historyArrowAria}>
          →
        </span>
        {formatTextValue(detail.after)}
      </p>
    );
  }
  const rows: Array<{ key: string; label: string; value: string | null }> = [
    { key: "ko", label: ADMIN_LABEL_TEXT.textKo, value: detail.textKo },
    { key: "en", label: ADMIN_LABEL_TEXT.textEn, value: detail.textEn },
    { key: "zh-TW", label: ADMIN_LABEL_TEXT.textZhTw, value: detail.textZhTw },
  ];
  return (
    <ul className="mt-1.5 space-y-0.5">
      {rows.map(({ key, label, value }) => (
        <li key={key} className="break-words text-xs leading-5 text-foreground-700">
          <span className="text-foreground-500">{label}</span> {formatTextValue(value)}
        </li>
      ))}
    </ul>
  );
};

const LabelHistoryList = function ({ label }: { label: AdminLabel }) {
  const { id: labelId } = label;
  const fetchPage = useCallback(
    ({ cursor, signal }: { cursor: string | null; signal: AbortSignal }) => fetchLabelHistories({ labelId, cursor, signal }),
    [labelId],
  );
  const { state, reload, loadMore } = useCursorList({
    queryKey: String(labelId),
    fetchPage,
  });

  if (state.phase === "loading") {
    return (
      <p role="status" className="py-8 text-center text-sm text-foreground-500">
        {ADMIN_TEXT.loading}
      </p>
    );
  }
  if (state.phase === "error") {
    return (
      <div role="alert" className="py-8 text-center">
        <p className="text-sm font-medium text-foreground-900">{ADMIN_TEXT.loadHistoryFailed}</p>
        <p className="mt-1 text-xs text-foreground-600">{state.message}</p>
        <button type="button" className="btn-outline mt-3" onClick={reload}>
          {ADMIN_TEXT.retry}
        </button>
      </div>
    );
  }
  const { items, hasNext, more } = state;
  if (items.length === 0) {
    return <p className="py-8 text-center text-sm text-foreground-500">{ADMIN_TEXT.emptyHistory}</p>;
  }

  return (
    <div>
      <ol className="divide-y divide-background-200">
        {items.map(({ id, action, actorUserId, actorName, detail, ipAddress, occurredAt }) => (
          <li key={id} className="py-3">
            <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
              <p className="text-sm font-medium text-foreground-950">{HISTORY_ACTION_TEXT[action] ?? action}</p>
              <time dateTime={occurredAt} className="text-xs tabular-nums text-foreground-500">
                {formatDateTime({ iso: occurredAt })}
              </time>
            </div>
            <p className="mt-0.5 text-xs text-foreground-500">
              {formatActor(actorName, actorUserId)}
              {ipAddress && (
                <>
                  {" · "}
                  <span className="font-mono">{ipAddress}</span>
                </>
              )}
            </p>
            {renderDetail(detail)}
          </li>
        ))}
      </ol>
      {hasNext && (
        <div className="pt-2 text-center">
          <button type="button" className="btn-outline" onClick={loadMore} disabled={more.phase === "loading"}>
            {more.phase === "loading" ? ADMIN_TEXT.loadingMore : more.phase === "error" ? ADMIN_TEXT.retry : ADMIN_TEXT.loadMore}
          </button>
          {more.phase === "error" && (
            <p role="alert" className="mt-1 text-xs text-rose-600">
              {more.message}
            </p>
          )}
        </div>
      )}
    </div>
  );
};

const LabelHistoryDialog = function ({ label, onClose }: LabelHistoryDialogProps) {
  return (
    <Modal
      open={Boolean(label)}
      title={`${ADMIN_TEXT.history}${label ? ` · ${label.labelKey}` : ""}`}
      description={ADMIN_LABEL_TEXT.historyDescription}
      onClose={onClose}
      width="max-w-xl"
    >
      {label && <LabelHistoryList label={label} />}
    </Modal>
  );
};

export default LabelHistoryDialog;
