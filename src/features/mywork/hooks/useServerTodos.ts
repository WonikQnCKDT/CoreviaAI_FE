import { useCallback, useEffect, useRef, useState } from "react";
import { fetchAllTodos, type TodoItem } from "@/features/mywork/api/todoApi";
import { interpretTodoFailure } from "@/features/mywork/utils/todoRules";

export type ServerTodoState =
  | { phase: "loading" }
  | { phase: "error"; message: string }
  | { phase: "ready"; active: TodoItem[]; done: TodoItem[]; truncated: boolean };

/** 업무 배정 표시 인수 기준(1분 이내 반영)을 맞추기 위한 재조회 간격 */
export const TODO_REFRESH_MS = 60_000;

/**
 * 내 TODO: 미완료 통합 목록(개인 + 배정 업무)과 완료한 개인 할 일을 함께 받는다.
 * - 1분마다, 그리고 화면으로 돌아올 때(창 포커스·탭 가시성 복귀) 다시 받는다. 다시 받는 동안에는 이전 목록을 보인다
 * - 탭이 비가시 상태면 주기 재조회를 건너뛰고, 진행 중인 요청이 있으면 중복 배경 요청을 보내지 않는다
 * - 자동 재조회가 실패하면 이전 목록을 유지한다(처음 조회 실패만 오류 화면)
 */
export const useServerTodos = function () {
  const [state, setState] = useState<ServerTodoState>({ phase: "loading" });
  const controllerRef = useRef<AbortController | null>(null);
  const inFlightRef = useRef(false);

  const reload = useCallback(({ background = false }: { background?: boolean } = {}) => {
    if (background && inFlightRef.current) return;
    controllerRef.current?.abort();
    const controller = new AbortController();
    controllerRef.current = controller;
    inFlightRef.current = true;
    const { signal } = controller;
    Promise.all([fetchAllTodos({ done: false, signal }), fetchAllTodos({ done: true, signal })])
      .then(([activeResult, doneResult]) => {
        if (signal.aborted) return;
        const failed = activeResult.ok === false ? activeResult : doneResult.ok === false ? doneResult : null;
        if (failed) {
          const message = interpretTodoFailure("load", failed.failure).message;
          setState((prev) => (background && prev.phase === "ready" ? prev : { phase: "error", message }));
          return;
        }
        if (activeResult.ok !== true || doneResult.ok !== true) return;
        setState({
          phase: "ready",
          active: activeResult.data.items,
          done: doneResult.data.items,
          truncated: activeResult.data.truncated || doneResult.data.truncated,
        });
      })
      .finally(() => {
        if (controllerRef.current === controller) inFlightRef.current = false;
      });
  }, []);

  useEffect(() => {
    reload();
    const timer = window.setInterval(() => {
      if (document.visibilityState === "hidden") return;
      reload({ background: true });
    }, TODO_REFRESH_MS);
    const onFocus = () => reload({ background: true });
    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") reload({ background: true });
    };
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisibilityChange);
      controllerRef.current?.abort();
      inFlightRef.current = false;
    };
  }, [reload]);

  return { state, reload };
};
