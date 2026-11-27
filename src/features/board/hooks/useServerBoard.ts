import { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "@/features/auth/authContext";
import { fetchBoard, type BoardColumn } from "@/features/board/api/boardApi";
import { interpretBoardFailure } from "@/features/board/utils/boardRules";
import { fetchAllProjectMembers, type ServerProjectMember } from "@/features/project/api/projectApi";
import type { WbsViewer } from "@/features/wbs/utils/wbsRules";

export type ServerBoardState =
  | { phase: "loading" }
  | { phase: "unavailable" }
  | { phase: "error"; message: string }
  | { phase: "ready"; columns: BoardColumn[]; members: ServerProjectMember[] };

/**
 * api 모드 칸반: 보드와 멤버(담당자 필터·내 역할)를 함께 받는다.
 * - 보드 404: 칸반 기능이 꺼졌거나 볼 수 없는 프로젝트(FEATURE_DISABLED·PROJECT_NOT_FOUND)
 * - 다시 받는 동안에는 이전 보드를 그대로 보인다(깜빡임 방지). 실패하면 오류로 바꾼다
 */
export const useServerBoard = function (projectId: number, assigneeUserId: number | null) {
  const { account } = useAuth();
  const [state, setState] = useState<ServerBoardState>({ phase: "loading" });
  const controllerRef = useRef<AbortController | null>(null);

  const reload = useCallback(() => {
    controllerRef.current?.abort();
    const controller = new AbortController();
    controllerRef.current = controller;
    const { signal } = controller;
    setState((prev) => (prev.phase === "ready" ? prev : { phase: "loading" }));

    Promise.all([fetchBoard({ projectId, assigneeUserId, signal }), fetchAllProjectMembers({ projectId, signal })]).then(
      ([boardResult, membersResult]) => {
        if (signal.aborted) return;
        if (boardResult.ok === false) {
          const { failure } = boardResult;
          if (failure.kind === "http" && failure.status === 404) setState({ phase: "unavailable" });
          else setState({ phase: "error", message: interpretBoardFailure("load", failure).message });
          return;
        }
        if (membersResult.ok === false) {
          setState({ phase: "error", message: interpretBoardFailure("load", membersResult.failure).message });
          return;
        }
        setState({ phase: "ready", columns: boardResult.data, members: membersResult.data });
      },
    );
  }, [projectId, assigneeUserId]);

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
