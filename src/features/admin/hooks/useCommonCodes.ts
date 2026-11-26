import { useCallback, useEffect, useRef, useState } from "react";
import type { ApiFailure, ApiResult } from "@/shared/api/client";
import { fetchCodeGroups, fetchGroupCodes, type AdminCode, type CodeGroup } from "@/features/admin/api/adminCodeApi";
import { interpretCodeFailure, sortCodes } from "@/features/admin/utils/adminCodeRules";

export type ListState<T> =
  | { phase: "idle" }
  | { phase: "loading" }
  | { phase: "error"; message: string }
  | { phase: "ready"; items: T[] };

/**
 * 페이지 없는 목록 하나를 받는다. key가 바뀌면 진행 중인 요청을 취소하고 다시 받는다.
 * key가 null이면 받지 않고 idle로 둔다(그룹을 아직 고르지 않은 경우).
 */
const useList = function <T>({
  key,
  load,
  onFailure,
}: {
  key: string | null;
  load: (args: { key: string; signal: AbortSignal }) => Promise<ApiResult<T[]>>;
  onFailure?: (failure: ApiFailure) => void;
}) {
  const [state, setState] = useState<ListState<T>>({ phase: key === null ? "idle" : "loading" });
  const controllerRef = useRef<AbortController | null>(null);
  const loadRef = useRef(load);
  const failureRef = useRef(onFailure);
  loadRef.current = load;
  failureRef.current = onFailure;

  const reload = useCallback(() => {
    controllerRef.current?.abort();
    if (key === null) {
      setState({ phase: "idle" });
      return;
    }
    const controller = new AbortController();
    controllerRef.current = controller;
    setState({ phase: "loading" });
    loadRef.current({ key, signal: controller.signal }).then((result) => {
      if (controller.signal.aborted) return;
      if (result.ok === false) {
        setState({ phase: "error", message: interpretCodeFailure(result.failure).message });
        failureRef.current?.(result.failure);
        return;
      }
      setState({ phase: "ready", items: result.data });
    });
  }, [key]);

  useEffect(() => {
    reload();
    return () => controllerRef.current?.abort();
  }, [reload]);

  /** 변경 API가 돌려준 값으로 목록을 고친다. */
  const update = useCallback((transform: (items: T[]) => T[]) => {
    setState((prev) => (prev.phase === "ready" ? { phase: "ready", items: transform(prev.items) } : prev));
  }, []);

  return { state, reload, update };
};

const GROUPS_KEY = "code-groups";

export const useCodeGroups = function () {
  return useList<CodeGroup>({ key: GROUPS_KEY, load: ({ signal }) => fetchCodeGroups({ signal }) });
};

/** 그룹의 코드 전체. 그룹이 사라졌으면(404) onGroupMissing으로 그룹 목록을 다시 받게 한다. */
export const useGroupCodes = function ({ groupCode, onGroupMissing }: { groupCode: string | null; onGroupMissing: () => void }) {
  const { state, reload, update } = useList<AdminCode>({
    key: groupCode,
    load: async ({ key, signal }) => {
      const result = await fetchGroupCodes({ groupCode: key, signal });
      return result.ok === true ? { ok: true, data: sortCodes(result.data) } : result;
    },
    onFailure: (failure) => {
      if (interpretCodeFailure(failure).stale) onGroupMissing();
    },
  });

  /** 저장한 코드를 바꿔 넣고 서버와 같은 순서로 다시 정렬한다. */
  const replace = useCallback(
    (next: AdminCode) => update((items) => sortCodes(items.map((item) => (item.id === next.id ? next : item)))),
    [update],
  );

  return { state, reload, replace };
};
