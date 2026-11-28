import { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "@/features/auth/authContext";
import { fetchBoard, type BoardColumn } from "@/features/board/api/boardApi";
import { BOARD_TEXT } from "@/features/board/i18n/ko";
import { interpretBoardFailure } from "@/features/board/utils/boardRules";
import {
  fetchAllProjectMembers,
  fetchProjectPhases,
  type ServerProjectMember,
  type ServerProjectPhase,
} from "@/features/project/api/projectApi";
import type { WbsViewer } from "@/features/wbs/utils/wbsRules";
import type { ApiFailure } from "@/shared/api/client";

export type ServerBoardState =
  | { phase: "loading" }
  | { phase: "unavailable" }
  | { phase: "error"; message: string }
  | { phase: "ready"; columns: BoardColumn[]; phases: ServerProjectPhase[]; members: ServerProjectMember[] };

const isNotFound = (failure: ApiFailure): failure is Extract<ApiFailure, { kind: "http" }> =>
  failure.kind === "http" && failure.status === 404;

/**
 * api 모드 칸반: 보드·단계(단계 필터)·멤버(담당자 필터·내 역할)를 함께 받는다.
 * - 보드 404(단계 필터 없음): 칸반 기능이 꺼졌거나 볼 수 없는 프로젝트(FEATURE_DISABLED·PROJECT_NOT_FOUND)
 * - 단계 404: 단계 없는 프로젝트로 보고 빈 목록
 * - 다시 받는 동안에는 이전 보드를 그대로 보인다(깜빡임 방지). 실패하면 오류로 바꾼다
 */
export const useServerBoard = function (projectId: number, assigneeUserId: number | null, phaseId: number | null) {
  const { account } = useAuth();
  const [state, setState] = useState<ServerBoardState>({ phase: "loading" });
  const controllerRef = useRef<AbortController | null>(null);

  const reload = useCallback(() => {
    controllerRef.current?.abort();
    const controller = new AbortController();
    controllerRef.current = controller;
    const { signal } = controller;
    setState((prev) => (prev.phase === "ready" ? prev : { phase: "loading" }));

    Promise.all([
      fetchBoard({ projectId, assigneeUserId, phaseId, signal }),
      fetchProjectPhases({ projectId, signal }),
      fetchAllProjectMembers({ projectId, signal }),
    ]).then(([boardResult, phasesResult, membersResult]) => {
      if (signal.aborted) return;
      if (boardResult.ok === false) {
        const { failure } = boardResult;
        if (isNotFound(failure)) {
          if (phaseId === null) setState({ phase: "unavailable" });
          else setState({ phase: "error", message: failure.message || BOARD_TEXT.notFound });
        } else {
          setState({ phase: "error", message: interpretBoardFailure("load", failure).message });
        }
        return;
      }
      if (phasesResult.ok === false && !isNotFound(phasesResult.failure)) {
        setState({ phase: "error", message: interpretBoardFailure("load", phasesResult.failure).message });
        return;
      }
      if (membersResult.ok === false) {
        setState({ phase: "error", message: interpretBoardFailure("load", membersResult.failure).message });
        return;
      }
      setState({
        phase: "ready",
        columns: boardResult.data,
        phases: phasesResult.ok === true ? phasesResult.data : [],
        members: membersResult.data,
      });
    });
  }, [projectId, assigneeUserId, phaseId]);

  useEffect(() => {
    reload();
    return () => controllerRef.current?.abort();
  }, [reload]);

  const userId = account?.userId ?? null;
  const viewer: WbsViewer = {
    userId,
    actor: state.phase === "ready" ? (state.members.find((m) => m.userId === userId)?.actor ?? null) : null,
  };

  return { state, reload, viewer };
};
