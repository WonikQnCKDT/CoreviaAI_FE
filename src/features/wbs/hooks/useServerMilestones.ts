import { useCallback, useEffect, useRef, useState } from "react";
import { fetchMilestones, type Milestone } from "@/features/wbs/api/milestoneApi";
import { interpretMilestoneFailure } from "@/features/wbs/utils/milestoneRules";

export type ServerMilestoneState =
  | { phase: "loading" }
  | { phase: "unavailable" }
  | { phase: "error"; message: string }
  | { phase: "ready"; milestones: Milestone[] };

/** 서버 목록과 같은 순서(목표일 순, 같으면 ID 순). targetDate는 YYYY-MM-DD라 문자열 비교로 충분하다 */
const byTargetDate = (a: Milestone, b: Milestone) => (a.targetDate === b.targetDate ? a.id - b.id : a.targetDate < b.targetDate ? -1 : 1);

/**
 * api 모드 마일스톤 목록. reload는 이전 요청을 취소하고 다시 받는다.
 * 변경 API는 바뀐 마일스톤 한 건을 주므로 upsert·remove로 목록에 반영한다(가짜 성공 없음: 성공 응답만 반영).
 */
export const useServerMilestones = function (projectId: number) {
  const [state, setState] = useState<ServerMilestoneState>({ phase: "loading" });
  const controllerRef = useRef<AbortController | null>(null);

  const reload = useCallback(() => {
    controllerRef.current?.abort();
    const controller = new AbortController();
    controllerRef.current = controller;
    const { signal } = controller;
    setState((prev) => (prev.phase === "ready" ? prev : { phase: "loading" }));

    void fetchMilestones({ projectId, signal }).then((result) => {
      if (signal.aborted) return;
      if (result.ok === true) {
        setState({ phase: "ready", milestones: result.data });
        return;
      }
      const { failure } = result;
      if (failure.kind === "http" && failure.status === 404) setState({ phase: "unavailable" });
      else setState({ phase: "error", message: interpretMilestoneFailure("load", failure).message });
    });
  }, [projectId]);

  useEffect(() => () => controllerRef.current?.abort(), []);

  const upsert = useCallback((milestone: Milestone) => {
    setState((prev) =>
      prev.phase === "ready"
        ? { phase: "ready", milestones: [...prev.milestones.filter((m) => m.id !== milestone.id), milestone].sort(byTargetDate) }
        : prev,
    );
  }, []);

  const remove = useCallback((milestoneId: number) => {
    setState((prev) => (prev.phase === "ready" ? { phase: "ready", milestones: prev.milestones.filter((m) => m.id !== milestoneId) } : prev));
  }, []);

  return { state, reload, upsert, remove };
};
