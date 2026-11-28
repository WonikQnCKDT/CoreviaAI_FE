import { useCallback } from "react";
import Modal from "@/components/ui/Modal";
import { fetchCodeHistories, type AdminCode } from "@/features/admin/api/adminCodeApi";
import { useCursorList } from "@/features/admin/hooks/useCursorList";
import {
  ADMIN_CODE_TEXT,
  ADMIN_ERROR_LOG_TEXT,
  ADMIN_TEXT,
  HISTORY_ACTION_TEXT,
} from "@/features/admin/i18n/ko";
import { formatDateTime } from "@/features/admin/utils/adminFormat";
import { formatLabel } from "@/shared/i18n/store";

export interface CodeHistoryTarget {
  groupCode: string;
  code: AdminCode;
}

interface CodeHistoryDialogProps {
  target: CodeHistoryTarget | null;
  onClose: () => void;
}

const formatActor = (actorName: string | null, actorUserId: number | null) => {
  if (actorName) return actorName;
  if (actorUserId !== null) return formatLabel(ADMIN_ERROR_LOG_TEXT.userIdFallback, { id: actorUserId });
  return ADMIN_TEXT.actorUnknown;
};

const CodeHistoryList = function ({ target }: { target: CodeHistoryTarget }) {
  const { groupCode, code } = target;
  const codeValue = code.code;
  const fetchPage = useCallback(
    ({ cursor, signal }: { cursor: string | null; signal: AbortSignal }) =>
      fetchCodeHistories({ groupCode, code: codeValue, cursor, signal }),
    [groupCode, codeValue],
  );
  const { state, reload, loadMore } = useCursorList({
    queryKey: `${groupCode}:${codeValue}`,
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
        {items.map(({ id, action, actorUserId, actorName, sortOrder, ipAddress, occurredAt }) => (
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
            {sortOrder && (
              <p className="mt-1.5 text-xs leading-5 text-foreground-700">
                <span className="text-foreground-500">{ADMIN_CODE_TEXT.colSortOrder}</span>{" "}
                <span className="tabular-nums">{sortOrder.before ?? ADMIN_TEXT.none}</span>
                <span className="mx-1 text-foreground-400" aria-label={ADMIN_TEXT.historyArrowAria}>
                  →
                </span>
                <span className="tabular-nums">{sortOrder.after ?? ADMIN_TEXT.none}</span>
              </p>
            )}
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

const CodeHistoryDialog = function ({ target, onClose }: CodeHistoryDialogProps) {
  return (
    <Modal
      open={Boolean(target)}
      title={`${ADMIN_TEXT.history}${target ? ` · ${target.groupCode} / ${target.code.code}` : ""}`}
      description={ADMIN_CODE_TEXT.historyDescription}
      onClose={onClose}
      width="max-w-xl"
    >
      {target && <CodeHistoryList target={target} />}
    </Modal>
  );
};

export default CodeHistoryDialog;
