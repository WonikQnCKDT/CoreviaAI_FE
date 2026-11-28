// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, screen, waitFor } from "@testing-library/react";
import CodeHistoryDialog from "@/features/admin/components/CodeHistoryDialog";
import type { AdminCode } from "@/features/admin/api/adminCodeApi";
import { renderApp } from "@/test/appHarness";

const ok = (response: unknown) =>
  new Response(JSON.stringify({ success: true, response, error: null }), { status: 200 });

const fail = (status: number, message: string) =>
  new Response(JSON.stringify({ success: false, response: null, error: { message, status } }), { status });

const sampleCode: AdminCode = {
  id: 1,
  code: "NORMAL",
  labelKey: "code.RISK_LEVEL.NORMAL",
  sortOrder: 1,
  active: true,
  updatedAt: "2026-11-28T11:20:00Z",
};

const fetchMock = vi.fn<typeof fetch>();

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const renderDialog = () =>
  renderApp({
    mode: "api",
    route: "/admin",
    routes: [
      {
        path: "/admin",
        element: <CodeHistoryDialog target={{ groupCode: "RISK_LEVEL", code: sampleCode }} onClose={() => {}} />,
      },
    ],
  });

describe("CodeHistoryDialog", () => {
  it("코드 변경 이력을 렌더링하고 더 보기로 다음 페이지를 이어 받는다", async () => {
    fetchMock
      .mockResolvedValueOnce(
        ok({
          items: [
            {
              id: 42,
              action: "CODE_CHANGED",
              actorUserId: 1,
              actorName: "시스템 관리자",
              details: { groupCode: "RISK_LEVEL", code: "NORMAL", sortOrder: { before: 1, after: 3 } },
              ipAddress: "127.0.0.1",
              occurredAt: "2026-11-28T11:20:00Z",
            },
          ],
          nextCursor: "djE6NDI",
          hasNext: true,
        }),
      )
      .mockResolvedValueOnce(
        ok({
          items: [
            {
              id: 41,
              action: "CODE_CHANGED",
              actorUserId: null,
              actorName: null,
              details: { groupCode: "RISK_LEVEL", code: "NORMAL", sortOrder: { before: 0, after: 1 } },
              ipAddress: null,
              occurredAt: "2026-11-27T09:00:00Z",
            },
          ],
          nextCursor: null,
          hasNext: false,
        }),
      );

    renderDialog();

    expect(await screen.findByText("정렬 순서 변경")).toBeTruthy();
    expect(screen.getByText(/시스템 관리자/)).toBeTruthy();
    expect(screen.getByText("127.0.0.1")).toBeTruthy();
    expect(screen.getByText("3")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "더 보기" }));

    expect(await screen.findByText("알 수 없는 사용자")).toBeTruthy();
    await waitFor(() => {
      expect(screen.queryByRole("button", { name: "더 보기" })).toBeNull();
    });
    expect(String(fetchMock.mock.calls[1]?.[0])).toContain("cursor=djE6NDI");
  });

  it("이력이 없으면 빈 상태 문구를 표시한다", async () => {
    fetchMock.mockResolvedValueOnce(ok({ items: [], nextCursor: null, hasNext: false }));
    renderDialog();
    expect(await screen.findByText("변경 이력이 없습니다")).toBeTruthy();
  });

  it("404 오류 시 오류 안내와 다시 시도 버튼을 표시하고 재시도로 복구한다", async () => {
    fetchMock
      .mockResolvedValueOnce(fail(404, "코드를 찾을 수 없습니다"))
      .mockResolvedValueOnce(ok({ items: [], nextCursor: null, hasNext: false }));

    renderDialog();

    expect(await screen.findByText("변경 이력을 불러오지 못했습니다")).toBeTruthy();
    expect(screen.getByText("코드를 찾을 수 없습니다")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "다시 시도" }));
    expect(await screen.findByText("변경 이력이 없습니다")).toBeTruthy();
  });
});
