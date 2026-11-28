// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, renderHook } from "@testing-library/react";
import { TODO_REFRESH_MS, useServerTodos } from "@/features/mywork/hooks/useServerTodos";
import { fetchAllTodos, type TodoItem } from "@/features/mywork/api/todoApi";
import type { ApiResult } from "@/shared/api/client";

vi.mock("@/features/mywork/api/todoApi", () => ({
  fetchAllTodos: vi.fn(),
}));

const mockedFetchAllTodos = vi.mocked(fetchAllTodos);

const todo = (overrides: Partial<TodoItem> = {}): TodoItem => ({
  id: 1,
  source: "task",
  key: "task-1",
  title: "API 설계",
  dueDate: "2026-12-01",
  done: false,
  projectId: 77,
  taskStatus: "progress",
  urgency: 1,
  overdue: false,
  ...overrides,
});

const okList = (items: TodoItem[], truncated = false): ApiResult<{ items: TodoItem[]; truncated: boolean }> => ({
  ok: true,
  data: { items, truncated },
});

const setVisibility = (state: "visible" | "hidden") => {
  Object.defineProperty(document, "visibilityState", { configurable: true, value: state });
};

beforeEach(() => {
  vi.useFakeTimers();
  setVisibility("visible");
  mockedFetchAllTodos.mockReset();
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  setVisibility("visible");
  vi.restoreAllMocks();
});

describe("useServerTodos 주기 재조회 및 중복 요청 방지 (SCRUM-111)", () => {
  it("마운트 시 조회하고 TODO_REFRESH_MS(60초)마다 배경 재조회한다", async () => {
    let activeRound = 0;
    mockedFetchAllTodos.mockImplementation(async ({ done }) => {
      if (done) return okList([]);
      activeRound += 1;
      return okList(activeRound === 1 ? [] : [todo({ id: 5, key: "task-5", title: "새 배정 업무" })]);
    });

    const { result } = renderHook(() => useServerTodos());
    await act(async () => {
      await Promise.resolve();
    });
    expect(result.current.state).toEqual({ phase: "ready", active: [], done: [], truncated: false });
    expect(mockedFetchAllTodos).toHaveBeenCalledTimes(2);

    // 59,999ms 시점에는 아직 재조회하지 않는다
    await act(async () => {
      await vi.advanceTimersByTimeAsync(TODO_REFRESH_MS - 1);
    });
    expect(mockedFetchAllTodos).toHaveBeenCalledTimes(2);

    // 60,000ms 도달 시 배경 재조회로 새 배정 업무를 반영한다
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1);
    });
    expect(mockedFetchAllTodos).toHaveBeenCalledTimes(4);
    expect(result.current.state).toMatchObject({
      phase: "ready",
      active: [expect.objectContaining({ title: "새 배정 업무" })],
    });
  });

  it("탭이 비가시 상태면 주기 재조회를 건너뛰고, 가시성 복귀 시 즉시 재조회한다", async () => {
    mockedFetchAllTodos.mockResolvedValue(okList([]));
    renderHook(() => useServerTodos());
    await act(async () => {
      await Promise.resolve();
    });
    expect(mockedFetchAllTodos).toHaveBeenCalledTimes(2);

    setVisibility("hidden");
    await act(async () => {
      await vi.advanceTimersByTimeAsync(TODO_REFRESH_MS * 2);
    });
    expect(mockedFetchAllTodos).toHaveBeenCalledTimes(2);

    setVisibility("visible");
    await act(async () => {
      document.dispatchEvent(new Event("visibilitychange"));
      await Promise.resolve();
    });
    expect(mockedFetchAllTodos).toHaveBeenCalledTimes(4);
  });

  it("진행 중인 요청이 있으면 포커스·가시성 복귀·주기가 겹쳐도 중복 배경 요청을 보내지 않는다", async () => {
    let resolveSlow!: (value: ApiResult<{ items: TodoItem[]; truncated: boolean }>) => void;
    let call = 0;
    mockedFetchAllTodos.mockImplementation(({ done }) => {
      call += 1;
      if (call <= 2) return Promise.resolve(okList([]));
      if (!done && call === 3) {
        return new Promise((resolve) => {
          resolveSlow = resolve;
        });
      }
      return Promise.resolve(okList([]));
    });

    renderHook(() => useServerTodos());
    await act(async () => {
      await Promise.resolve();
    });
    expect(mockedFetchAllTodos).toHaveBeenCalledTimes(2);

    // 창 포커스로 배경 재조회 시작(응답 지연 상태)
    act(() => {
      window.dispatchEvent(new Event("focus"));
    });
    expect(mockedFetchAllTodos).toHaveBeenCalledTimes(4);

    // 응답이 오기 전에 visibilitychange와 주기 타이머가 겹쳐도 중복 요청하지 않는다
    await act(async () => {
      document.dispatchEvent(new Event("visibilitychange"));
      await vi.advanceTimersByTimeAsync(TODO_REFRESH_MS);
    });
    expect(mockedFetchAllTodos).toHaveBeenCalledTimes(4);

    // 지연 응답이 끝나면 다음 포커스에서 다시 요청할 수 있다
    await act(async () => {
      resolveSlow(okList([todo()]));
      await Promise.resolve();
    });
    await act(async () => {
      window.dispatchEvent(new Event("focus"));
      await Promise.resolve();
    });
    expect(mockedFetchAllTodos).toHaveBeenCalledTimes(6);
  });

  it("명시적 reload()는 진행 중인 배경 요청을 취소하고 최신 데이터를 다시 받는다", async () => {
    const signals: AbortSignal[] = [];
    let activeCall = 0;
    mockedFetchAllTodos.mockImplementation(({ done, signal }) => {
      if (signal) signals.push(signal);
      if (done) return Promise.resolve(okList([]));
      activeCall += 1;
      if (activeCall === 1) return Promise.resolve(okList([]));
      if (activeCall === 2) return new Promise(() => {}); // 지연된 배경 요청
      return Promise.resolve(okList([todo({ id: 9, key: "task-9", title: "최신 항목" })]));
    });

    const { result } = renderHook(() => useServerTodos());
    await act(async () => {
      await Promise.resolve();
    });

    // 배경 요청 시작(응답 대기)
    act(() => {
      window.dispatchEvent(new Event("focus"));
    });
    const bgSignal = signals[2];
    expect(bgSignal.aborted).toBe(false);

    // 명시적 reload() 호출 시 배경 요청이 abort되고 새 응답을 반영한다
    await act(async () => {
      result.current.reload();
      await Promise.resolve();
    });
    expect(bgSignal.aborted).toBe(true);
    expect(result.current.state).toMatchObject({
      phase: "ready",
      active: [expect.objectContaining({ title: "최신 항목" })],
    });
  });

  it("배경 재조회가 실패하면 기존 목록을 유지한다", async () => {
    let round = 0;
    mockedFetchAllTodos.mockImplementation(async ({ done }) => {
      if (done) return okList([]);
      round += 1;
      if (round === 1) return okList([todo({ title: "유지될 업무" })]);
      return { ok: false, failure: { kind: "network" } };
    });

    const { result } = renderHook(() => useServerTodos());
    await act(async () => {
      await Promise.resolve();
    });
    expect(result.current.state).toMatchObject({ phase: "ready", active: [expect.objectContaining({ title: "유지될 업무" })] });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(TODO_REFRESH_MS);
    });
    expect(result.current.state).toMatchObject({ phase: "ready", active: [expect.objectContaining({ title: "유지될 업무" })] });
  });

  it("언마운트 시 타이머와 이벤트 리스너를 해제해 추가 요청이 발생하지 않는다", async () => {
    mockedFetchAllTodos.mockResolvedValue(okList([]));
    const { unmount } = renderHook(() => useServerTodos());
    await act(async () => {
      await Promise.resolve();
    });
    expect(mockedFetchAllTodos).toHaveBeenCalledTimes(2);

    unmount();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(TODO_REFRESH_MS * 3);
      window.dispatchEvent(new Event("focus"));
      document.dispatchEvent(new Event("visibilitychange"));
      await Promise.resolve();
    });
    expect(mockedFetchAllTodos).toHaveBeenCalledTimes(2);
  });
});
