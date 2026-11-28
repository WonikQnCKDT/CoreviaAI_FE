// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import MemberHistoryList from "@/features/project/components/members/MemberHistoryList";
import { PROJECT_MEMBER_TEXT } from "@/features/project/i18n/member";
import { jsonFail, jsonOk } from "@/test/appHarness";

/** 실제 BE MemberHistoryResponse 형식 */
const history = (id: number) => ({
  id,
  userId: 11,
  userName: "이개발",
  changeType: "INVITED",
  beforeActor: null,
  afterActor: "DEVELOPER",
  changedBy: 5,
  changedByName: "홍길동",
  occurredAt: "2026-11-28T01:00:00Z",
});

interface PendingCall {
  url: URL;
  signal: AbortSignal | null | undefined;
  resolve: (response: Response) => void;
}

/** 응답을 테스트가 직접 내보내는 fetch. 요청마다 받은 취소 신호를 기록한다. */
const deferredFetch = function () {
  const calls: PendingCall[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(
      (...[input, init]: Parameters<typeof fetch>) =>
        new Promise<Response>((resolve) => {
          calls.push({ url: new URL(String(input), "http://localhost"), signal: init?.signal, resolve });
        }),
    ),
  );
  return calls;
};

const page = (items: unknown[], nextCursor: string | null) => jsonOk({ items, nextCursor, hasNext: nextCursor !== null });

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("MemberHistoryList 요청 제어", () => {
  it("오류 화면에서 다시 시도하면 응답이 올 때까지 로딩 상태를 보여 준다", async () => {
    const calls = deferredFetch();
    render(<MemberHistoryList projectId={77} refreshKey={0} />);
    await vi.waitFor(() => expect(calls).toHaveLength(1));
    calls[0].resolve(jsonFail(500, "서버 오류"));
    fireEvent.click(await screen.findByRole("button", { name: PROJECT_MEMBER_TEXT.retry }));

    expect(await screen.findByText(PROJECT_MEMBER_TEXT.historyLoading)).toBeTruthy();
    expect(screen.queryByRole("button", { name: PROJECT_MEMBER_TEXT.retry })).toBeNull();
    await vi.waitFor(() => expect(calls).toHaveLength(2));
    calls[1].resolve(page([], null));
    expect(await screen.findByText(PROJECT_MEMBER_TEXT.historyEmpty)).toBeTruthy();
  });

  it("'더 보기' 중에 화면을 떠나면 그 요청을 취소한다", async () => {
    const calls = deferredFetch();
    const view = render(<MemberHistoryList projectId={77} refreshKey={0} />);
    await vi.waitFor(() => expect(calls).toHaveLength(1));
    calls[0].resolve(page([history(30)], "c1"));
    fireEvent.click(await screen.findByRole("button", { name: PROJECT_MEMBER_TEXT.loadMore }));
    await vi.waitFor(() => expect(calls).toHaveLength(2));
    expect(calls[1].url.searchParams.get("cursor")).toBe("c1");

    view.unmount();
    expect(calls[1].signal?.aborted).toBe(true);
  });

  it("처음부터 다시 받으면 진행 중인 '더 보기'를 버린다", async () => {
    const calls = deferredFetch();
    const view = render(<MemberHistoryList projectId={77} refreshKey={0} />);
    await vi.waitFor(() => expect(calls).toHaveLength(1));
    calls[0].resolve(page([history(30)], "c1"));
    fireEvent.click(await screen.findByRole("button", { name: PROJECT_MEMBER_TEXT.loadMore }));
    await vi.waitFor(() => expect(calls).toHaveLength(2));

    view.rerender(<MemberHistoryList projectId={77} refreshKey={1} />);
    await vi.waitFor(() => expect(calls).toHaveLength(3));
    expect(calls[1].signal?.aborted).toBe(true);
    expect(calls[2].url.searchParams.get("cursor")).toBeNull();

    view.unmount();
    expect(calls[2].signal?.aborted).toBe(true);
  });

  it("다시 받기가 진행 중일 때 '더 보기'를 눌러도, 화면을 떠나면 두 요청이 모두 취소된다", async () => {
    const calls = deferredFetch();
    const view = render(<MemberHistoryList projectId={77} refreshKey={0} />);
    await vi.waitFor(() => expect(calls).toHaveLength(1));
    calls[0].resolve(page([history(30)], "c1"));
    await screen.findByRole("button", { name: PROJECT_MEMBER_TEXT.loadMore });

    view.rerender(<MemberHistoryList projectId={77} refreshKey={1} />);
    await vi.waitFor(() => expect(calls).toHaveLength(2));
    fireEvent.click(screen.getByRole("button", { name: PROJECT_MEMBER_TEXT.loadMore }));
    await vi.waitFor(() => expect(calls).toHaveLength(3));
    expect(calls[2].url.searchParams.get("cursor")).toBe("c1");

    view.unmount();
    expect(calls[1].signal?.aborted).toBe(true);
    expect(calls[2].signal?.aborted).toBe(true);
  });
});
