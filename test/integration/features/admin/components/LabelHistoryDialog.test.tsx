// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, screen, waitFor } from "@testing-library/react";
import LabelHistoryDialog from "@/features/admin/components/LabelHistoryDialog";
import type { AdminLabel } from "@/features/admin/api/adminLabelApi";
import { renderApp } from "@test/support/appHarness";

const ok = (response: unknown) =>
  new Response(JSON.stringify({ success: true, response, error: null }), { status: 200 });

const fail = (status: number, message: string) =>
  new Response(JSON.stringify({ success: false, response: null, error: { message, status } }), { status });

const sampleLabel: AdminLabel = {
  id: 3,
  labelKey: "button.save",
  textKo: "저장",
  textEn: "Save",
  textZhTw: null,
  version: 2,
  updatedAt: "2026-11-28T11:25:00Z",
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
        element: <LabelHistoryDialog label={sampleLabel} onClose={() => {}} />,
      },
    ],
  });

describe("LabelHistoryDialog", () => {
  it("등록·수정 이력을 언어 라벨과 함께 표시하고 더 보기로 다음 페이지를 불러온다", async () => {
    fetchMock
      .mockResolvedValueOnce(
        ok({
          items: [
            {
              id: 55,
              action: "I18N_LABEL_CHANGED",
              actorUserId: 1,
              actorName: "시스템 관리자",
              details: { labelKey: "button.save", lang: "en", text: { before: "Save", after: "Save Page" } },
              ipAddress: "127.0.0.1",
              occurredAt: "2026-11-28T11:25:00Z",
            },
          ],
          nextCursor: "djE6NTU",
          hasNext: true,
        }),
      )
      .mockResolvedValueOnce(
        ok({
          items: [
            {
              id: 54,
              action: "I18N_LABEL_CREATED",
              actorUserId: 2,
              actorName: null,
              details: { labelKey: "button.save", textKo: "저장", textEn: "Save", textZhTw: null },
              ipAddress: null,
              occurredAt: "2026-11-28T11:20:00Z",
            },
          ],
          nextCursor: null,
          hasNext: false,
        }),
      );

    renderDialog();

    expect(await screen.findByText("문구 수정")).toBeTruthy();
    expect(screen.getByText("영어")).toBeTruthy();
    expect(screen.getByText(/Save Page/)).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "더 보기" }));

    expect(await screen.findByText("라벨 등록")).toBeTruthy();
    expect(screen.getByText("사용자 #2")).toBeTruthy();
    expect(screen.getByText(/번역 누락/)).toBeTruthy();
    await waitFor(() => {
      expect(screen.queryByRole("button", { name: "더 보기" })).toBeNull();
    });
    expect(String(fetchMock.mock.calls[1]?.[0])).toContain("cursor=djE6NTU");
  });

  it("이력이 없으면 빈 상태 문구를 표시한다", async () => {
    fetchMock.mockResolvedValueOnce(ok({ items: [], nextCursor: null, hasNext: false }));
    renderDialog();
    expect(await screen.findByText("변경 이력이 없습니다")).toBeTruthy();
  });

  it("404 오류 시 오류 안내와 다시 시도 버튼을 표시한다", async () => {
    fetchMock.mockResolvedValueOnce(fail(404, "라벨을 찾을 수 없습니다"));
    renderDialog();
    expect(await screen.findByText("변경 이력을 불러오지 못했습니다")).toBeTruthy();
    expect(screen.getByText("라벨을 찾을 수 없습니다")).toBeTruthy();
    expect(screen.getByRole("button", { name: "다시 시도" })).toBeTruthy();
  });
});
