// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, screen, waitFor, within } from "@testing-library/react";
import ServerCalendarTab from "@/features/mywork/components/ServerCalendarTab";
import ServerJournalTab from "@/features/mywork/components/ServerJournalTab";
import { SCHEDULE_TEXT, WORKLOG_TEXT } from "@/features/mywork/i18n/ko";
import { kstDayStart } from "@/features/mywork/utils/scheduleRules";
import { resetCodeCache } from "@/shared/codes/codeStore";
import { jsonFail, jsonOk, renderApp, stubFetch } from "@test/support/appHarness";

const TODAY = "2026-12-01";

const event = (overrides: Record<string, unknown> = {}) => ({
  id: 1, title: "주간 회의", startAt: "2026-12-01T01:00:00Z", endAt: "2026-12-01T02:00:00Z", allDay: false, memo: "회의실 A", createdAt: "", updatedAt: "", ...overrides,
});
const calendarTask = (overrides: Record<string, unknown> = {}) => ({
  id: 7, source: "TASK", title: "API 설계", startAt: kstDayStart("2026-12-01"), endAt: kstDayStart("2026-12-04"), allDay: true,
  projectId: 77, taskStatus: "IN_PROGRESS", progress: 40, spentMinutes: 90, ...overrides,
});
const eventsPage = (items: unknown[]) => ({ items, page: 0, size: 100, hasNext: false });

const renderTab = (element: React.ReactNode) => renderApp({ mode: "api", route: "/", routes: [{ path: "/", element }] });

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
});

afterEach(() => {
  cleanup();
  resetCodeCache();
  vi.unstubAllGlobals();
});

describe("api 모드 내 일정", () => {
  it("개인 일정과 담당 업무를 한국 날짜에 놓고, 선택한 날의 목록을 보여 준다", async () => {
    const { calls } = stubFetch({
      "GET /api/me/events": () => jsonOk(eventsPage([event()])),
      "GET /api/me/calendar": () => jsonOk({ items: [calendarTask()], hasNext: false }),
    });
    renderTab(<ServerCalendarTab today={TODAY} />);
    const day = await screen.findByRole("region", { name: "2026-12-01 일정" });
    expect(within(day).getByText("10:00 주간 회의")).toBeTruthy();
    expect(within(day).getByText("회의실 A")).toBeTruthy();
    expect(within(day).getByRole("link", { name: `${SCHEDULE_TEXT.openProject}: API 설계` }).getAttribute("href")).toBe("/projects/77/kanban");
    // 그 달 범위로 조회(한국 12-01 00:00 ~ 01-01 00:00)
    const eventsCall = calls.find((c) => c.path.startsWith("/api/me/events"));
    expect(new URL(eventsCall!.path, "http://x").searchParams.get("from")).toBe("2026-11-30T15:00:00.000Z");
    // 업무는 종료일(12-03)까지, 12-04에는 없다
    fireEvent.click(screen.getByRole("button", { name: "2026-12-03 선택" }));
    expect(within(screen.getByRole("region", { name: "2026-12-03 일정" })).getByText("API 설계")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "2026-12-04 선택" }));
    expect(within(screen.getByRole("region", { name: "2026-12-04 일정" })).getByText(SCHEDULE_TEXT.dayEmpty)).toBeTruthy();
  });

  it("일정을 추가하면 한국 시각을 UTC로 보내고 성공 뒤 다시 받는다", async () => {
    let eventCalls = 0;
    const { calls } = stubFetch({
      "GET /api/me/events": () => {
        eventCalls += 1;
        return jsonOk(eventsPage(eventCalls > 1 ? [event({ id: 2, title: "새 일정", memo: null })] : []));
      },
      "GET /api/me/calendar": () => jsonOk({ items: [], hasNext: false }),
      "POST /api/me/events": () => jsonOk(event({ id: 2, title: "새 일정" })),
    });
    renderTab(<ServerCalendarTab today={TODAY} />);
    await screen.findByRole("region", { name: "2026-12-01 일정" });
    fireEvent.click(screen.getByRole("button", { name: new RegExp(SCHEDULE_TEXT.add) }));
    const dialog = screen.getByRole("dialog");
    fireEvent.change(within(dialog).getByRole("textbox", { name: SCHEDULE_TEXT.titleLabel }), { target: { value: "새 일정" } });
    fireEvent.click(within(dialog).getByRole("button", { name: SCHEDULE_TEXT.save }));
    expect(await screen.findByText("'새 일정' 일정을 추가했습니다.")).toBeTruthy();
    expect(calls.find((c) => c.method === "POST")?.body).toEqual({ title: "새 일정", startAt: "2026-12-01T00:00:00.000Z", endAt: "2026-12-01T01:00:00.000Z", allDay: false, memo: null });
    await waitFor(() => expect(eventCalls).toBe(2));
  });

  it("수정이 404면 안내하고 다시 받으며, 수정 폼에 삭제는 보류라고 알린다", async () => {
    let eventCalls = 0;
    stubFetch({
      "GET /api/me/events": () => {
        eventCalls += 1;
        return jsonOk(eventsPage([event()]));
      },
      "GET /api/me/calendar": () => jsonOk({ items: [], hasNext: false }),
      "PATCH /api/me/events/1": () => jsonFail(404, "일정을 찾을 수 없습니다"),
    });
    renderTab(<ServerCalendarTab today={TODAY} />);
    fireEvent.click(await screen.findByRole("button", { name: `${SCHEDULE_TEXT.edit}: 주간 회의` }));
    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByText(SCHEDULE_TEXT.noDelete)).toBeTruthy();
    fireEvent.click(within(dialog).getByRole("button", { name: SCHEDULE_TEXT.save }));
    expect(await screen.findByText(SCHEDULE_TEXT.notFound)).toBeTruthy();
    await waitFor(() => expect(eventCalls).toBe(2));
  });

  it("다음 달로 가면 그 달 범위로 다시 묻는다", async () => {
    const { calls } = stubFetch({
      "GET /api/me/events": () => jsonOk(eventsPage([])),
      "GET /api/me/calendar": () => jsonOk({ items: [], hasNext: false }),
    });
    renderTab(<ServerCalendarTab today={TODAY} />);
    await screen.findByRole("region", { name: "2026-12-01 일정" });
    fireEvent.click(screen.getByRole("button", { name: SCHEDULE_TEXT.nextMonth }));
    await waitFor(() => expect(calls.some((c) => new URL(c.path, "http://x").searchParams.get("from") === "2026-12-31T15:00:00.000Z")).toBe(true));
  });
});

describe("api 모드 업무일지", () => {
  const dayHandlers = (overrides: Record<string, Parameters<typeof stubFetch>[0][string]> = {}) => ({
    "GET /api/me/worklogs/2026-12-01": () => jsonOk({ logDate: TODAY, content: "# 오늘\n<script>x</script>", createdAt: "", updatedAt: "" }),
    "GET /api/me/worklogs/2026-12-01/tasks": () => jsonOk({ items: [], hasNext: false }),
    "GET /api/me/calendar": () => jsonOk({ items: [calendarTask()], hasNext: false }),
    "GET /api/me/worklogs": () => jsonOk([{ logDate: "2026-11-28", content: "" }]),
    ...overrides,
  });

  it("노트는 입력칸의 텍스트로 보여 주고(HTML로 그리지 않음), 저장하면 PUT으로 보낸다", async () => {
    const { calls } = stubFetch({
      ...dayHandlers(),
      "PUT /api/me/worklogs/2026-12-01": ({ body }) => jsonOk({ logDate: TODAY, content: (body as { content: string }).content, createdAt: "", updatedAt: "" }),
    });
    const { container } = renderTab(<ServerJournalTab today={TODAY} />);
    const note = (await screen.findByRole("textbox", { name: "2026-12-01 업무 노트" })) as HTMLTextAreaElement;
    expect(note.value).toBe("# 오늘\n<script>x</script>");
    expect(container.querySelector("script")).toBeNull();
    expect(screen.getByRole("button", { name: WORKLOG_TEXT.saveNote })).toHaveProperty("disabled", true);
    fireEvent.change(note, { target: { value: "# 오늘\n- 설계 검토" } });
    expect(screen.getByText(WORKLOG_TEXT.unsaved)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: WORKLOG_TEXT.saveNote }));
    expect(await screen.findByText("2026-12-01 업무 노트를 저장했습니다.")).toBeTruthy();
    expect(calls.find((c) => c.method === "PUT")?.body).toEqual({ content: "# 오늘\n- 설계 검토" });
    expect(JSON.stringify({ ...localStorage, ...sessionStorage })).not.toContain("설계 검토");
  });

  it("저장하지 않은 노트가 있으면 날짜를 바꾸기 전에 확인하고, 취소하면 그대로 둔다", async () => {
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(false);
    stubFetch(dayHandlers());
    renderTab(<ServerJournalTab today={TODAY} />);
    const note = await screen.findByRole("textbox", { name: "2026-12-01 업무 노트" });
    fireEvent.change(note, { target: { value: "작성 중" } });
    fireEvent.click(screen.getByRole("button", { name: WORKLOG_TEXT.prevDay }));
    expect(confirm).toHaveBeenCalledWith(WORKLOG_TEXT.confirmLeave);
    expect(((screen.getByRole("textbox", { name: "2026-12-01 업무 노트" })) as HTMLTextAreaElement).value).toBe("작성 중");
    confirm.mockRestore();
  });

  it("업무 기록: 저장 직전에 업무 version을 받아 보내고, 완료를 고르면 진척률 100으로 맞춘다", async () => {
    const { calls } = stubFetch({
      ...dayHandlers(),
      "GET /api/projects/77/tasks/7": () => jsonOk({ id: 7, projectId: 77, name: "API 설계", taskType: "TASK", priority: "MEDIUM", status: "IN_PROGRESS", version: 5 }),
      "PUT /api/me/worklogs/2026-12-01/tasks/7": () => jsonOk({ id: 3, taskId: 7, userId: 5, logDate: TODAY, content: null, progress: 100, spentMinutes: 45, completed: true, version: 1 }),
    });
    renderTab(<ServerJournalTab today={TODAY} />);
    fireEvent.change(await screen.findByRole("textbox", { name: `${WORKLOG_TEXT.spentMinutes}: API 설계` }), { target: { value: "45" } });
    fireEvent.click(screen.getByRole("checkbox", { name: `${WORKLOG_TEXT.completed}: API 설계` }));
    expect((screen.getByRole("textbox", { name: `${WORKLOG_TEXT.progress}: API 설계` }) as HTMLInputElement).value).toBe("100");
    fireEvent.click(screen.getByRole("button", { name: `${WORKLOG_TEXT.saveTask}: API 설계` }));
    expect(await screen.findByText("'API 설계' 기록을 저장했습니다.")).toBeTruthy();
    expect(calls.find((c) => c.method === "PUT" && c.path.endsWith("/tasks/7"))?.body).toEqual({
      projectId: 77, content: null, progress: 100, spentMinutes: 45, completed: true, taskVersion: 5, version: 0,
    });
  });

  it("담당이 바뀌어 403이면 안내하고 그날을 다시 받는다", async () => {
    let dayCalls = 0;
    stubFetch({
      ...dayHandlers({
        "GET /api/me/calendar": () => {
          dayCalls += 1;
          return jsonOk({ items: [calendarTask()], hasNext: false });
        },
      }),
      "GET /api/projects/77/tasks/7": () => jsonOk({ id: 7, version: 5 }),
      "PUT /api/me/worklogs/2026-12-01/tasks/7": () => jsonFail(403, "본인이 담당한 작업만 수정하거나 하위작업을 추가할 수 있습니다"),
    });
    renderTab(<ServerJournalTab today={TODAY} />);
    fireEvent.click(await screen.findByRole("button", { name: `${WORKLOG_TEXT.saveTask}: API 설계` }));
    expect(await screen.findByText(WORKLOG_TEXT.notAssignee)).toBeTruthy();
    await waitFor(() => expect(dayCalls).toBe(2));
  });

  it("잘못된 소요 시간은 서버에 보내지 않고, 이미 완료된 업무는 완료 해제를 막는다", async () => {
    const { calls } = stubFetch(dayHandlers({ "GET /api/me/calendar": () => jsonOk({ items: [calendarTask({ taskStatus: "DONE", progress: 100 })], hasNext: false }) }));
    renderTab(<ServerJournalTab today={TODAY} />);
    expect(await screen.findByRole("checkbox", { name: `${WORKLOG_TEXT.completed}: API 설계` })).toHaveProperty("disabled", true);
    fireEvent.change(screen.getByRole("textbox", { name: `${WORKLOG_TEXT.spentMinutes}: API 설계` }), { target: { value: "1441" } });
    fireEvent.click(screen.getByRole("button", { name: `${WORKLOG_TEXT.saveTask}: API 설계` }));
    expect(await screen.findByText(WORKLOG_TEXT.minutesInvalid)).toBeTruthy();
    expect(calls.some((c) => c.method === "PUT")).toBe(false);
  });

  it("기록이 없는 날(404)은 빈 노트, 최근 기록한 날을 누르면 그날로 간다", async () => {
    const { calls } = stubFetch({
      ...dayHandlers({ "GET /api/me/worklogs/2026-12-01": () => jsonFail(404, "업무일지를 찾을 수 없습니다") }),
      "GET /api/me/worklogs/2026-11-28": () => jsonOk({ logDate: "2026-11-28", content: "지난 기록", createdAt: "", updatedAt: "" }),
      "GET /api/me/worklogs/2026-11-28/tasks": () => jsonOk({ items: [], hasNext: false }),
    });
    renderTab(<ServerJournalTab today={TODAY} />);
    expect(((await screen.findByRole("textbox", { name: "2026-12-01 업무 노트" })) as HTMLTextAreaElement).value).toBe("");
    fireEvent.click(await screen.findByRole("button", { name: "2026-11-28" }));
    expect(((await screen.findByRole("textbox", { name: "2026-11-28 업무 노트" })) as HTMLTextAreaElement).value).toBe("지난 기록");
    expect(calls.some((c) => c.path === "/api/me/worklogs?from=2026-11-01&to=2026-12-01")).toBe(true);
  });
});
