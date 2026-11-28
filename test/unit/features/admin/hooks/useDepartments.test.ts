import { describe, expect, it } from "vitest";
import type { AdminDepartment } from "@/features/admin/api/adminApi";
import { descendantIds, flattenDepartments, selectableParents } from "@/features/admin/hooks/useDepartments";

const dept = (id: number, name: string, parentId: number | null, status: AdminDepartment["status"] = "active"): AdminDepartment => ({
  id,
  parentId,
  name,
  status,
  activeMemberCount: 0,
});

// 본부(1) › 개발팀(2) › 백엔드파트(3), 본부 › 기획팀(4), 경영지원(5, 비활성) › 총무(6, 비활성)
const items = [
  dept(1, "본부", null),
  dept(2, "개발팀", 1),
  dept(3, "백엔드파트", 2),
  dept(4, "기획팀", 1),
  dept(5, "경영지원", null, "inactive"),
  dept(6, "총무", 5, "inactive"),
];

const ids = (nodes: { department: AdminDepartment }[]) => nodes.map(({ department }) => department.id);

describe("flattenDepartments", () => {
  it("부모 다음에 자식을 이름순으로 펼치고 깊이·경로를 붙인다", () => {
    const tree = flattenDepartments(items);
    expect(tree.map(({ department, depth, path }) => [department.id, depth, path])).toEqual([
      [5, 0, "경영지원"],
      [6, 1, "경영지원 › 총무"],
      [1, 0, "본부"],
      [2, 1, "본부 › 개발팀"],
      [3, 2, "본부 › 개발팀 › 백엔드파트"],
      [4, 1, "본부 › 기획팀"],
    ]);
  });

  it("빈 목록이면 빈 트리다", () => {
    expect(flattenDepartments([])).toEqual([]);
  });

  it("부모를 못 찾는 부서는 최상위로 붙인다", () => {
    expect(flattenDepartments([dept(9, "고아", 404)]).map(({ depth }) => depth)).toEqual([0]);
  });

  it("순환 데이터에서도 무한 반복하지 않는다 (BE가 순환 이동을 막으므로 최상위가 없는 묶음은 표시하지 않는다)", () => {
    const cyclic = [dept(1, "A", 2), dept(2, "B", 1)];
    expect(flattenDepartments(cyclic)).toEqual([]);
  });
});

describe("descendantIds", () => {
  it("자기 자신과 모든 하위 부서를 찾는다", () => {
    expect([...descendantIds(items, 1)].sort()).toEqual([1, 2, 3, 4]);
  });

  it("마지막 단계 부서는 자기 자신만이다", () => {
    expect([...descendantIds(items, 3)]).toEqual([3]);
  });
});

describe("selectableParents", () => {
  const tree = flattenDepartments(items);

  it("추가할 때는 활성 부서만 고를 수 있다", () => {
    expect(ids(selectableParents({ tree, items, editing: null, selectedId: null }))).toEqual([1, 2, 3, 4]);
  });

  it("수정할 때는 자기 자신과 하위 부서를 뺀다", () => {
    expect(ids(selectableParents({ tree, items, editing: items[1], selectedId: 1 }))).toEqual([1, 4]);
  });

  it("지금 상위 부서가 비활성이어도 선택지에 남긴다 (빠지면 '최상위'로 잘못 보인다)", () => {
    expect(ids(selectableParents({ tree, items, editing: items[5], selectedId: 5 }))).toEqual([5, 1, 2, 3, 4]);
  });

  it("저장 중 상위가 비활성이 되어 실패해도 고른 상위를 선택지에 남긴다", () => {
    const stale = items.map((item) => (item.id === 4 ? { ...item, status: "inactive" as const } : item));
    const staleTree = flattenDepartments(stale);
    expect(ids(selectableParents({ tree: staleTree, items: stale, editing: null, selectedId: 4 }))).toEqual([1, 2, 3, 4]);
  });

  it("고른 값이어도 자기 자신·하위 부서는 넣지 않는다", () => {
    expect(ids(selectableParents({ tree, items, editing: items[0], selectedId: 2 }))).toEqual([]);
  });

  it("최상위 부서를 수정할 때는 비활성 부서를 넣지 않는다", () => {
    expect(ids(selectableParents({ tree, items, editing: items[0], selectedId: null }))).toEqual([]);
  });
});
