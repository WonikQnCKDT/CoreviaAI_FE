import { useCallback, useEffect, useRef, useState } from "react";
import Modal from "@/components/ui/Modal";
import { fetchErrorLog, type ErrorLogDetail } from "@/features/admin/api/adminErrorLogApi";
import { ADMIN_ERROR_LOG_TEXT, ADMIN_TEXT } from "@/features/admin/i18n/ko";
import { formatDateTime } from "@/features/admin/utils/adminFormat";
import { interpretDetailFailure } from "@/features/admin/utils/errorLogRules";
import { BUTTON_TEXT } from "@/shared/i18n/catalog/button";

type DetailState =
  | { phase: "loading" }
  | { phase: "error"; message: string; retryable: boolean }
  | { phase: "ready"; detail: ErrorLogDetail };

interface ErrorLogDetailDialogProps {
  errorLogId: number | null;
  userLabel: (userId: number | null) => string;
  onClose: () => void;
}

/** 에러 로그 상세. 메시지·스택 트레이스는 서버가 마스킹한 값을 글자 그대로(텍스트로만) 보여 준다. */
const ErrorLogDetailDialog = function ({ errorLogId, userLabel, onClose }: ErrorLogDetailDialogProps) {
  const [state, setState] = useState<DetailState>({ phase: "loading" });
  const controllerRef = useRef<AbortController | null>(null);

  const load = useCallback(() => {
    controllerRef.current?.abort();
    if (errorLogId === null) return;
    const controller = new AbortController();
    controllerRef.current = controller;
    setState({ phase: "loading" });
    fetchErrorLog({ errorLogId, signal: controller.signal }).then((result) => {
      if (controller.signal.aborted) return;
      if (result.ok === true) setState({ phase: "ready", detail: result.data });
      else setState({ phase: "error", ...interpretDetailFailure(result.failure) });
    });
  }, [errorLogId]);

  useEffect(() => {
    load();
    return () => controllerRef.current?.abort();
  }, [load]);

  const renderBody = () => {
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
          <p className="text-sm text-foreground-800">{state.message}</p>
          {state.retryable && (
            <button type="button" className="btn-outline mt-3" onClick={load}>
              {BUTTON_TEXT.retry}
            </button>
          )}
        </div>
      );
    }
    const { detail } = state;
    const rows: [string, string][] = [
      [ADMIN_ERROR_LOG_TEXT.occurredAt, formatDateTime({ iso: detail.occurredAt })],
      [ADMIN_ERROR_LOG_TEXT.request, [detail.httpMethod, detail.apiPath].filter(Boolean).join(" ") || ADMIN_TEXT.none],
      [ADMIN_ERROR_LOG_TEXT.user, userLabel(detail.userId)],
      [ADMIN_ERROR_LOG_TEXT.errorType, detail.errorType],
      [ADMIN_ERROR_LOG_TEXT.message, detail.message ?? ADMIN_ERROR_LOG_TEXT.noMessage],
    ];
    return (
      <div className="space-y-3">
        <dl className="grid grid-cols-[7rem_minmax(0,1fr)] gap-x-3 gap-y-1.5 text-xs">
          {rows.map(([term, value]) => (
            <div key={term} className="contents">
              <dt className="text-foreground-500">{term}</dt>
              <dd className="break-all font-mono text-foreground-900">{value}</dd>
            </div>
          ))}
        </dl>
        <section aria-label={ADMIN_ERROR_LOG_TEXT.stackTrace}>
          <h4 className="mb-1 text-xs font-medium text-foreground-700">{ADMIN_ERROR_LOG_TEXT.stackTrace}</h4>
          {detail.stackTrace ? (
            <pre
              tabIndex={0}
              className="max-h-[50vh] overflow-auto whitespace-pre rounded-md border border-background-300 bg-background-100 p-3 font-mono text-[11px] leading-5 text-foreground-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary-500"
            >
              {detail.stackTrace}
            </pre>
          ) : (
            <p className="text-xs text-foreground-500">{ADMIN_ERROR_LOG_TEXT.noStackTrace}</p>
          )}
        </section>
        <p className="text-xs leading-5 text-foreground-500">{ADMIN_ERROR_LOG_TEXT.maskedNote}</p>
      </div>
    );
  };

  return (
    <Modal
      open={errorLogId !== null}
      title={ADMIN_ERROR_LOG_TEXT.detailTitle}
      width="max-w-3xl"
      onClose={onClose}
      footer={
        <button type="button" className="btn-outline" onClick={onClose}>
          {BUTTON_TEXT.close}
        </button>
      }
    >
      {renderBody()}
    </Modal>
  );
};

export default ErrorLogDetailDialog;
