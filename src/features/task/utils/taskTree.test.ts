import { describe, expect, it } from "vitest";
import type { Task } from "@/types";
import { displayProjectProgress, projectProgress } from "@/features/task/utils/taskTree";

const task = (overrides: Partial<Task>): Task => ({
  id: "t1",
  projectId: "p1",
  parentId: null,
  level: 2,
  stage: "analysis",
  name: "업무",
  type: "task",
  assigneeId: null,
  startDate: "2026-12-01",
  endDate: "2026-12-05",
  estimate: 1,
  progress: 0,
  status: "todo",
  priority: "normal",
  description: "",
  doneCondition: "",
  predecessors: [],
  order: 1,
  ...overrides,
});

// 데모 프로젝트 p1: 공수 3인일 100% + 1인일 0% → 75%
const demoTasks = [task({ id: "a", estimate: 3, progress: 100 }), task({ id: "b", estimate: 1, progress: 0 })];

describe("displayProjectProgress (PR #2 P2)", () => {
  it("서버 프로젝트는 서버 값을 쓴다(데모 업무가 있어도 계산값을 쓰지 않는다)", () => {
    expect(displayProjectProgress(demoTasks, { id: "p1", serverId: 77, serverProgress: 70 })).toBe(70);
  });

  it("서버 값 0은 0으로 보인다('모름'이 아니다)", () => {
    expect(displayProjectProgress([], { id: "77", serverId: 77, serverProgress: 0 })).toBe(0);
  });

  it("서버 프로젝트인데 아직 상세를 받지 않았으면 null('-' 표시). 데모 계산 0%로 대신하지 않는다", () => {
    expect(displayProjectProgress([], { id: "77", serverId: 77 })).toBeNull();
    expect(projectProgress([], "77")).toBe(0);
  });

  it("데모 프로젝트는 지금처럼 데모 업무로 계산한다", () => {
    expect(displayProjectProgress(demoTasks, { id: "p1" })).toBe(75);
  });
});
