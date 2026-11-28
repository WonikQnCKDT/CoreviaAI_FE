import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import ServerErrorLogsPanel from "@/features/admin/components/ServerErrorLogsPanel";
import { ADMIN_ERROR_LOG_TEXT } from "@/features/admin/i18n/ko";
import { jsonOk, stubFetch } from "@test/support/appHarness";

const logSummary = (overrides: Record<string, unknown> = {}) => ({
  id: 501,
  occurredAt: "2026-11-25T05:10:00Z",
  httpMethod: "POST",
  apiPath: "/api/projects",
  userId: null,
  errorType: "java.lang.IllegalStateException",
  message: "예상치 못한 서버 상태",
  ...overrides,
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("ServerErrorLogsPanel 에러 로그 조회 (FR-ADM-09, SCRUM-170)", () => {
  it("기간·예외 유형·API 경로로 필터 조회하고 표시 시간대 자정 경계를 UTC로 전송한다", async () => {
    const { calls, unexpected } = stubFetch({
      "GET /api/admin/error-logs": () => jsonOk({ items: [logSummary()], nextCursor: null, hasNext: false }),
    });

    render(<ServerErrorLogsPanel />);
    expect(await screen.findByText("/api/projects")).toBeTruthy();

    fireEvent.change(screen.getByLabelText(ADMIN_ERROR_LOG_TEXT.fromDate), { target: { value: "2026-11-25" } });
    fireEvent.change(screen.getByLabelText(ADMIN_ERROR_LOG_TEXT.toDate), { target: { value: "2026-11-25" } });
    fireEvent.change(screen.getByLabelText(ADMIN_ERROR_LOG_TEXT.errorType), { target: { value: "IllegalStateException" } });
    fireEvent.change(screen.getByLabelText(ADMIN_ERROR_LOG_TEXT.apiPath), { target: { value: "/api/projects" } });
    fireEvent.click(screen.getByRole("button", { name: ADMIN_ERROR_LOG_TEXT.search }));

    await waitFor(() => expect(calls.length).toBeGreaterThanOrEqual(2));
    const filteredUrl = new URL(calls[calls.length - 1].path, "http://localhost");
    expect(filteredUrl.searchParams.get("from")).toBe(new Date(2026, 10, 25).toISOString());
    expect(filteredUrl.searchParams.get("to")).toBe(new Date(2026, 10, 26).toISOString());
    expect(filteredUrl.searchParams.get("errorType")).toBe("IllegalStateException");
    expect(filteredUrl.searchParams.get("apiPath")).toBe("/api/projects");
    expect(unexpected).toEqual([]);
  });

  it("시작일이 종료일보다 늦으면 요청을 보내지 않고 오류를 표시한다", async () => {
    const { calls } = stubFetch({
      "GET /api/admin/error-logs": () => jsonOk({ items: [], nextCursor: null, hasNext: false }),
    });

    render(<ServerErrorLogsPanel />);
    await waitFor(() => expect(calls.length).toBe(1));

    fireEvent.change(screen.getByLabelText(ADMIN_ERROR_LOG_TEXT.fromDate), { target: { value: "2026-11-26" } });
    fireEvent.change(screen.getByLabelText(ADMIN_ERROR_LOG_TEXT.toDate), { target: { value: "2026-11-25" } });
    fireEvent.click(screen.getByRole("button", { name: ADMIN_ERROR_LOG_TEXT.search }));

    expect(await screen.findByRole("alert")).toBeTruthy();
    expect(calls.length).toBe(1);
  });

  it("상세 버튼을 누르면 GET /api/admin/error-logs/{id}로 스택 트레이스를 조회한다", async () => {
    const { unexpected } = stubFetch({
      "GET /api/admin/error-logs": () => jsonOk({ items: [logSummary()], nextCursor: null, hasNext: false }),
      "GET /api/admin/error-logs/501": () =>
        jsonOk({
          ...logSummary(),
          stackTrace: "java.lang.IllegalStateException: broken\n\tat org.wonik.corevia.Service.run(Service.java:42)",
        }),
    });

    render(<ServerErrorLogsPanel />);
    fireEvent.click(await screen.findByRole("button", { name: `#501 ${ADMIN_ERROR_LOG_TEXT.openDetail}` }));

    const dialog = await screen.findByRole("dialog");
    expect(await within(dialog).findByText(/org\.wonik\.corevia\.Service\.run/)).toBeTruthy();
    expect(unexpected).toEqual([]);
  });
});
