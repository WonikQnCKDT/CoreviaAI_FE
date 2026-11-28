import { useCallback, useEffect, useId, useRef, useState } from "react";
import { Badge } from "@/components/ui/Badge";
import { fetchMemberHistories, type MemberHistory } from "@/features/project/api/projectApi";
import { PROJECT_MEMBER_TEXT } from "@/features/project/i18n/member";
import { actorLabel, changeTypeLabel, formatOccurredAt } from "@/features/project/utils/memberRules";
import { memberLoadFailureMessage } from "@/features/project/utils/memberFailure";
import { formatLabel } from "@/shared/i18n/store";

/** 한 번에 받는 이력 수 (BE 기본값과 같다) */
export const HISTORY_PAGE_SIZE = 20;

type MoreState = { phase: "idle" } | { phase: "loading" } | { phase: "error"; message: string };

type HistoryState =
  | { phase: "loading" }
  | { phase: "error"; message: string }
  | { phase: "ready"; items: MemberHistory[]; nextCursor: string | null; hasNext: boolean; more: MoreState };

const PM_CHANGES = new Set(["pmAdded", "pmReleased", "pmReassigned", "pmDelegated"]);

interface MemberHistoryListProps {
  projectId: number;
  /** 값이 바뀌면 처음부터 다시 받는다(멤버 변경 직후) */
  refreshKey: number;
}

/**
 * 멤버·역할 변경 이력 (GET .../members/histories, id 내림차순 = 최신순, 커서 '더 보기').
 * '더 보기'가 실패해도 이미 받은 이력은 그대로 둔다.
 */
const MemberHistoryList = function ({ projectId, refreshKey }: MemberHistoryListProps) {
  const [state, setState] = useState<HistoryState>({ phase: "loading" });
  const controllerRef = useRef<AbortController | null>(null);
  const stateRef = useRef(state);
  const titleId = useId();
  stateRef.current = state;

  const reload = useCallback(() => {
    controllerRef.current?.abort();
    const controller = new AbortController();
    controllerRef.current = controller;
    fetchMemberHistories({ projectId, size: HISTORY_PAGE_SIZE, signal: controller.signal }).then((result) => {
      if (controller.signal.aborted) return;
      if (result.ok === false) {
        setState({ phase: "error", message: memberLoadFailureMessage(result.failure, PROJECT_MEMBER_TEXT.historyFailed) });
        return;
      }
      const { items, nextCursor, hasNext } = result.data;
      setState({ phase: "ready", items, nextCursor, hasNext, more: { phase: "idle" } });
    });
  }, [projectId]);

  useEffect(() => {
    reload();
    return () => controllerRef.current?.abort();
  }, [reload, refreshKey]);

  const loadMore = () => {
    const current = stateRef.current;
    if (current.phase !== "ready" || !current.hasNext || !current.nextCursor || current.more.phase === "loading") return;
    const controller = new AbortController();
    controllerRef.current = controller;
    setState({ ...current, more: { phase: "loading" } });
    fetchMemberHistories({ projectId, cursor: current.nextCursor, size: HISTORY_PAGE_SIZE, signal: controller.signal }).then((result) => {
      if (controller.signal.aborted) return;
      setState((prev) => {
        if (prev.phase !== "ready") return prev;
        if (result.ok === false) {
          return { ...prev, more: { phase: "error", message: memberLoadFailureMessage(result.failure, PROJECT_MEMBER_TEXT.historyFailed) } };
        }
        // 같은 이력이 두 번 오지 않게 id로 거른다(목록 사이에 새 이력이 생겨도 커서는 id 기준이라 겹치지 않지만 한 번 더 막는다).
        const seen = new Set(prev.items.map(({ id }) => id));
        const { items, nextCursor, hasNext } = result.data;
        return {
          phase: "ready",
          items: [...prev.items, ...items.filter(({ id }) => !seen.has(id))],
          nextCursor,
          hasNext,
          more: { phase: "idle" },
        };
      });
    });
  };

  return (
    <section className="card overflow-hidden" aria-labelledby={titleId}>
      <div className="border-b border-background-200 px-4 py-3">
        <h4 id={titleId} className="text-[13px] font-semibold text-foreground-950">
          {PROJECT_MEMBER_TEXT.historyTitle}
        </h4>
        <p className="mt-0.5 text-[10.5px] text-foreground-500">{PROJECT_MEMBER_TEXT.historyDescription}</p>
      </div>

      {state.phase === "loading" && (
        <p role="status" className="px-4 py-6 text-center text-[12px] text-foreground-500">
          {PROJECT_MEMBER_TEXT.historyLoading}
        </p>
      )}

      {state.phase === "error" && (
        <div role="alert" className="px-4 py-6 text-center">
          <p className="text-[12px] text-foreground-800">{PROJECT_MEMBER_TEXT.historyFailed}</p>
          {state.message !== PROJECT_MEMBER_TEXT.historyFailed && <p className="mt-1 text-[11px] text-foreground-600">{state.message}</p>}
          <button type="button" className="btn-outline mt-3" onClick={reload}>
            {PROJECT_MEMBER_TEXT.retry}
          </button>
        </div>
      )}

      {state.phase === "ready" && state.items.length === 0 && (
        <p className="px-4 py-6 text-center text-[12px] text-foreground-500">{PROJECT_MEMBER_TEXT.historyEmpty}</p>
      )}

      {state.phase === "ready" && state.items.length > 0 && (
        <>
          <ol className="divide-y divide-background-200">
            {state.items.map((history) => (
              <li key={history.id} className="flex flex-wrap items-center gap-x-2 gap-y-1 px-4 py-2 text-[11.5px]">
                <Badge
                  className={
                    PM_CHANGES.has(history.changeType)
                      ? "border-primary-200 bg-primary-50 text-primary-700"
                      : "border-background-300 bg-background-100 text-foreground-700"
                  }
                >
                  {changeTypeLabel(history.changeType)}
                </Badge>
                <span className="font-medium text-foreground-900">{history.userName || PROJECT_MEMBER_TEXT.unknownName}</span>
                <span className="text-foreground-600">
                  {actorLabel(history.beforeActor)} <span aria-hidden="true">→</span> {actorLabel(history.afterActor)}
                </span>
                <span className="text-foreground-500">
                  {formatLabel(PROJECT_MEMBER_TEXT.historyBy, { name: history.changedByName || PROJECT_MEMBER_TEXT.unknownName })}
                </span>
                <time className="ml-auto text-[10.5px] text-foreground-500" dateTime={history.occurredAt}>
                  {formatOccurredAt({ iso: history.occurredAt })}
                </time>
              </li>
            ))}
          </ol>
          {state.more.phase === "error" && (
            <p role="alert" className="px-4 pt-2 text-[11px] text-rose-700">
              {state.more.message}
            </p>
          )}
          {state.hasNext && (
            <div className="px-4 py-3 text-center">
              <button type="button" className="btn-outline" onClick={loadMore} disabled={state.more.phase === "loading"}>
                {state.more.phase === "loading" ? PROJECT_MEMBER_TEXT.loadingMore : PROJECT_MEMBER_TEXT.loadMore}
              </button>
            </div>
          )}
        </>
      )}
    </section>
  );
};

export default MemberHistoryList;
