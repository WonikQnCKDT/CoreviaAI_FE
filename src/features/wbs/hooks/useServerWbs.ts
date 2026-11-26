import { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "@/features/auth/authContext";
import { fetchAllProjectMembers, fetchProjectPhases, type ServerProjectMember, type ServerProjectPhase } from "@/features/project/api/projectApi";
import { fetchWbsTree, type WbsItem } from "@/features/wbs/api/wbsApi";
import { interpretWbsFailure, type WbsViewer } from "@/features/wbs/utils/wbsRules";
import type { ApiFailure } from "@/shared/api/client";

export type ServerWbsState =
  | { phase: "loading" }
  | { phase: "unavailable" }
  | { phase: "error"; message: string }
  | { phase: "ready"; tree: WbsItem[]; phases: ServerProjectPhase[]; members: ServerProjectMember[] };

const isNotFound = (failure: ApiFailure) => failure.kind === "http" && failure.status === 404;

/**
 * api 모드 WBS: 트리·단계·멤버를 함께 받는다.
 * - 트리 404: WBS 기능이 꺼졌거나 볼 수 없는 프로젝트(PROJECT_NOT_FOUND·FEATURE_DISABLED)
 * - 단계 404: 단계 없는 프로젝트로 보고 빈 목록
 * - 멤버: 담당자 선택지와 내 역할 판단에 필요해서 실패하면 오류
 * 변경 API는 바뀐 뒤 트리 전체를 주므로 replaceTree로 그대로 바꾼다(브라우저에서 트리를 따로 고치지 않는다).
 */
export const useServerWbs = function (projectId: number) {
  const { account } = useAuth();
  const [state, setState] = useState<ServerWbsState>({ phase: "loading" });
  const controllerRef = useRef<AbortController | null>(null);

  const reload = useCallback(() => {
    controllerRef.current?.abort();
    const controller = new AbortController();
    controllerRef.current = controller;
    const { signal } = controller;
    setState((prev) => (prev.phase === "ready" ? prev : { phase: "loading" }));

    Promise.all([
      fetchWbsTree({ projectId, signal }),
      fetchProjectPhases({ projectId, signal }),
      fetchAllProjectMembers({ projectId, signal }),
    ]).then(([treeResult, phasesResult, membersResult]) => {
      if (signal.aborted) return;
      if (treeResult.ok === false) {
        if (isNotFound(treeResult.failure)) setState({ phase: "unavailable" });
        else setState({ phase: "error", message: interpretWbsFailure("load", treeResult.failure).message });
        return;
      }
      if (phasesResult.ok === false && !isNotFound(phasesResult.failure)) {
        setState({ phase: "error", message: interpretWbsFailure("load", phasesResult.failure).message });
        return;
      }
      if (membersResult.ok === false) {
        setState({ phase: "error", message: interpretWbsFailure("load", membersResult.failure).message });
        return;
      }
      setState({
        phase: "ready",
        tree: treeResult.data,
        phases: phasesResult.ok === true ? phasesResult.data : [],
        members: membersResult.data,
      });
    });
  }, [projectId]);

  useEffect(() => {
    reload();
    return () => controllerRef.current?.abort();
  }, [reload]);

  const replaceTree = useCallback((tree: WbsItem[]) => {
    setState((prev) => (prev.phase === "ready" ? { ...prev, tree } : prev));
  }, []);

  const userId = account?.userId ?? null;
  const viewer: WbsViewer = {
    userId,
    actor: state.phase === "ready" ? (state.members.find((m) => m.userId === userId)?.actor ?? null) : null,
  };

  return { state, reload, replaceTree, viewer };
};
