import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { fetchAllAdminDepartments, type AdminDepartment } from "@/features/admin/api/adminApi";
import { adminErrorMessage } from "@/features/admin/utils/adminFormat";

export type DepartmentsState =
  | { phase: "loading" }
  | { phase: "error"; message: string }
  | { phase: "ready"; items: AdminDepartment[] };

export interface DepartmentNode {
  department: AdminDepartment;
  depth: number;
  /** 화면에 보일 전체 경로. 예: "DX본부 › 개발팀" */
  path: string;
}

/** 부모 → 자식 순으로 펼친 트리. 부모를 못 찾는 부서(데이터 이상)는 최상위로 붙인다. */
export const flattenDepartments = function (items: AdminDepartment[]): DepartmentNode[] {
  const ids = new Set(items.map(({ id }) => id));
  const children = new Map<number | null, AdminDepartment[]>();
  items.forEach((item) => {
    const key = item.parentId !== null && ids.has(item.parentId) ? item.parentId : null;
    children.set(key, [...(children.get(key) ?? []), item]);
  });
  const result: DepartmentNode[] = [];
  const visited = new Set<number>();
  const walk = (parentId: number | null, depth: number, prefix: string) => {
    (children.get(parentId) ?? [])
      .slice()
      .sort((a, b) => a.name.localeCompare(b.name))
      .forEach((department) => {
        if (visited.has(department.id)) return;
        visited.add(department.id);
        const path = prefix ? `${prefix} › ${department.name}` : department.name;
        result.push({ department, depth, path });
        walk(department.id, depth + 1, path);
      });
  };
  walk(null, 0, "");
  return result;
};

/** 부서와 그 아래 모든 하위 부서 id. 상위 부서 이동 시 자기 자신·하위로는 옮길 수 없다. */
export const descendantIds = function (items: AdminDepartment[], rootId: number): Set<number> {
  const found = new Set<number>([rootId]);
  let grew = true;
  while (grew) {
    grew = false;
    items.forEach(({ id, parentId }) => {
      if (parentId !== null && found.has(parentId) && !found.has(id)) {
        found.add(id);
        grew = true;
      }
    });
  }
  return found;
};

/**
 * 상위 부서로 고를 수 있는 부서.
 * 활성 부서만 새로 고를 수 있고, 수정할 때는 자기 자신과 하위 부서를 뺀다.
 * 수정 중인 부서의 지금 상위와 폼에서 고른 상위는 비활성이어도 남긴다. select 값이 선택지에 없으면
 * 화면에는 '최상위'로 보이는데 실제로는 그 부서 ID가 전송되기 때문이다(예: 저장 중 상위가 비활성화된 경우).
 */
export const selectableParents = function ({
  tree,
  items,
  editing,
  selectedId,
}: {
  tree: DepartmentNode[];
  items: AdminDepartment[];
  editing: AdminDepartment | null;
  selectedId: number | null;
}): DepartmentNode[] {
  const blocked = editing ? descendantIds(items, editing.id) : new Set<number>();
  const kept = new Set([editing?.parentId, selectedId].filter((id): id is number => id !== null && id !== undefined));
  return tree.filter(({ department: { id, status } }) => !blocked.has(id) && (status === "active" || kept.has(id)));
};

export const useDepartments = function () {
  const [state, setState] = useState<DepartmentsState>({ phase: "loading" });
  const controllerRef = useRef<AbortController | null>(null);

  const reload = useCallback(() => {
    controllerRef.current?.abort();
    const controller = new AbortController();
    controllerRef.current = controller;
    setState({ phase: "loading" });
    fetchAllAdminDepartments({ signal: controller.signal }).then((result) => {
      if (controller.signal.aborted) return;
      if (result.ok === false) {
        setState({ phase: "error", message: adminErrorMessage(result.failure) });
        return;
      }
      setState({ phase: "ready", items: result.data });
    });
  }, []);

  useEffect(() => {
    reload();
    return () => controllerRef.current?.abort();
  }, [reload]);

  /** 변경 API가 돌려준 부서로 목록을 갱신한다 (없으면 추가). */
  const upsert = useCallback((next: AdminDepartment) => {
    setState((prev) => {
      if (prev.phase !== "ready") return prev;
      const exists = prev.items.some(({ id }) => id === next.id);
      return { phase: "ready", items: exists ? prev.items.map((item) => (item.id === next.id ? next : item)) : [...prev.items, next] };
    });
  }, []);

  const items = useMemo(() => (state.phase === "ready" ? state.items : []), [state]);
  const tree = useMemo(() => flattenDepartments(items), [items]);

  return { state, items, tree, reload, upsert };
};
