// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, screen, waitFor, within } from "@testing-library/react";
import ServerCalendarTab from "@/features/mywork/components/ServerCalendarTab";
import ServerJournalTab from "@/features/mywork/components/ServerJournalTab";
import { SCHEDULE_TEXT, WORKLOG_TEXT } from "@/features/mywork/i18n/ko";
import { kstDayStart } from "@/features/mywork/utils/scheduleRules";
import { resetCodeCache } from "@/shared/codes/codeStore";
import ServerMyWorkPage from "@/features/mywork/components/ServerMyWorkPage";
import { serverProjectColorKey } from "@/features/project/utils/serverProject";
import { MYWORK_TAB_TEXT } from "@/shared/i18n/catalog/menu";
import { projectColor } from "@/utils/ui";
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

describe("내 일정 월·주·일 보기, 프로젝트 색상, 노트 연결 (SCRUM-120)", () => {
  const projectsPage = (items: { id: number; name: string }[]) => ({
    items: items.map(({ id, name }) => ({
      id, code: `PRJ-${id}`, name, status: "IN_PROGRESS", template: "IT_PROJECT", methodology: "WATERFALL", visibility: "COMPANY",
      departments: [], pms: [], startDate: null, endDate: null, createdAt: "2026-11-01T00:00:00Z",
    })),
    nextCursor: null,
    hasNext: false,
  });
  const baseHandlers = (overrides: Record<string, Parameters<typeof stubFetch>[0][string]> = {}) => ({
    "GET /api/me/events": () => jsonOk(eventsPage([event()])),
    "GET /api/me/calendar": () => jsonOk({ items: [calendarTask(), calendarTask({ id: 8, title: "화면 설계", projectId: 78 })], hasNext: false }),
    "GET /api/me/worklogs": () => jsonOk([{ logDate: "2026-12-01", content: "" }]),
    "GET /api/projects": () => jsonOk(projectsPage([{ id: 77, name: "구매 발주" }, { id: 78, name: "인사 개편" }])),
    ...overrides,
  });
  const queryOf = (calls: { path: string }[], path: string) =>
    calls.filter((c) => c.path.startsWith(`${path}?`)).map((c) => new URL(c.path, "http://x").searchParams);

  it("주 보기: 월요일부터 7일을 그 범위로 묻고, 다음 주로 가면 7일 뒤를 묻는다", async () => {
    const { calls } = stubFetch(baseHandlers());
    renderTab(<ServerCalendarTab today={TODAY} />);
    await screen.findByRole("region", { name: "2026-12-01 일정" });
    fireEvent.click(within(screen.getByRole("group", { name: SCHEDULE_TEXT.viewLabel })).getByRole("button", { name: SCHEDULE_TEXT.viewWeek }));
    // 2026-12-01(화)의 주 = 11-30(월) ~ 12-06(일)
    expect(await screen.findByText("2026-11-30 ~ 2026-12-06")).toBeTruthy();
    await waitFor(() => expect(queryOf(calls, "/api/me/events").some((q) => q.get("from") === kstDayStart("2026-11-30") && q.get("to") === kstDayStart("2026-12-07"))).toBe(true));
    expect(queryOf(calls, "/api/me/worklogs").some((q) => q.get("from") === "2026-11-30" && q.get("to") === "2026-12-06")).toBe(true);
    expect(screen.getByRole("button", { name: "2026-12-06 선택" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "2026-12-07 선택" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: SCHEDULE_TEXT.nextWeek }));
    expect(await screen.findByText("2026-12-07 ~ 2026-12-13")).toBeTruthy();
  });

  it("일 보기: 그날 하루만 묻고 격자 없이 그날 목록을 보이며, 다음 날로 넘어간다", async () => {
    const { calls } = stubFetch(baseHandlers());
    renderTab(<ServerCalendarTab today={TODAY} />);
    await screen.findByRole("region", { name: "2026-12-01 일정" });
    fireEvent.click(screen.getByRole("button", { name: SCHEDULE_TEXT.viewDay }));
    await waitFor(() => expect(queryOf(calls, "/api/me/calendar").some((q) => q.get("from") === kstDayStart("2026-12-01") && q.get("to") === kstDayStart("2026-12-02"))).toBe(true));
    expect(screen.queryByRole("button", { name: "2026-12-02 선택" })).toBeNull();
    expect(within(screen.getByRole("region", { name: "2026-12-01 일정" })).getByText("10:00 주간 회의")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: SCHEDULE_TEXT.nextDay }));
    expect(await screen.findByRole("region", { name: "2026-12-02 일정" })).toBeTruthy();
  });

  it("담당 업무는 프로젝트마다 다른 색으로 그리고, 범례에 프로젝트 이름을 보인다", async () => {
    stubFetch(baseHandlers());
    renderTab(<ServerCalendarTab today={TODAY} />);
    const legend = await screen.findByRole("list", { name: SCHEDULE_TEXT.legend });
    await waitFor(() => expect(within(legend).getByText("구매 발주")).toBeTruthy());
    expect(within(legend).getByText("인사 개편")).toBeTruthy();
    expect(within(legend).getByText(SCHEDULE_TEXT.personal)).toBeTruthy();
    const cell = screen.getByRole("button", { name: /^2026-12-01 선택/ });
    const chip = (text: string) => within(cell).getByText(text).className;
    expect(chip("API 설계")).toContain(projectColor(serverProjectColorKey(77)).chip);
    expect(chip("화면 설계")).toContain(projectColor(serverProjectColorKey(78)).chip);
    expect(chip("API 설계")).not.toBe(chip("화면 설계"));
    // 개인 일정은 프로젝트 색이 아니다
    expect(chip("10:00 주간 회의")).not.toContain(projectColor(serverProjectColorKey(77)).chip);
    // 선택한 날 목록의 배지도 프로젝트 이름
    expect(within(screen.getByRole("region", { name: "2026-12-01 일정" })).getAllByText("구매 발주").length).toBeGreaterThan(0);
  });

  it("프로젝트 목록을 받지 못하면 범례는 번호로 보이고 일정은 그대로 보인다", async () => {
    stubFetch(baseHandlers({ "GET /api/projects": () => jsonFail(500, "서버 오류") }));
    renderTab(<ServerCalendarTab today={TODAY} />);
    const legend = await screen.findByRole("list", { name: SCHEDULE_TEXT.legend });
    expect(within(legend).getByText("프로젝트 #77")).toBeTruthy();
    expect(within(screen.getByRole("region", { name: "2026-12-01 일정" })).getByText("API 설계")).toBeTruthy();
  });

  it("노트를 쓴 날은 칸에 표시하고, 그날을 고르면 '업무 노트 열기', 없는 날은 '업무 노트 쓰기'로 그날 노트로 보낸다", async () => {
    stubFetch(baseHandlers());
    const onOpenNote = vi.fn();
    renderTab(<ServerCalendarTab today={TODAY} onOpenNote={onOpenNote} />);
    const day = await screen.findByRole("region", { name: "2026-12-01 일정" });
    // 노트 여부는 버튼 이름에 들어가 화면 낭독기도 읽는다
    expect(screen.getByRole("button", { name: `2026-12-01 선택 · ${SCHEDULE_TEXT.noteBadge}` })).toBeTruthy();
    expect(screen.getByRole("button", { name: "2026-12-02 선택" })).toBeTruthy();
    expect(within(day).getByText(SCHEDULE_TEXT.noteExists)).toBeTruthy();
    fireEvent.click(within(day).getByRole("button", { name: new RegExp(SCHEDULE_TEXT.openNote) }));
    expect(onOpenNote).toHaveBeenLastCalledWith("2026-12-01");
    fireEvent.click(screen.getByRole("button", { name: "2026-12-02 선택" }));
    const next = screen.getByRole("region", { name: "2026-12-02 일정" });
    expect(within(next).getByText(SCHEDULE_TEXT.noteNone)).toBeTruthy();
    fireEvent.click(within(next).getByRole("button", { name: new RegExp(SCHEDULE_TEXT.writeNote) }));
    expect(onOpenNote).toHaveBeenLastCalledWith("2026-12-02");
  });

  it("노트 기록일을 받지 못해도(500) 일정은 보이고 노트 표시만 빠졌다고 안내한다", async () => {
    stubFetch(baseHandlers({ "GET /api/me/worklogs": () => jsonFail(500, "서버 오류") }));
    renderTab(<ServerCalendarTab today={TODAY} onOpenNote={vi.fn()} />);
    expect(await screen.findByText(SCHEDULE_TEXT.notesUnavailable)).toBeTruthy();
    expect(within(screen.getByRole("region", { name: "2026-12-01 일정" })).getByText("API 설계")).toBeTruthy();
    expect(screen.getByRole("button", { name: "2026-12-01 선택" })).toBeTruthy();
  });

  it("업무일지에서 '캘린더에서 이 날 보기'는 그 날짜를 넘기고, 저장하지 않은 노트가 있으면 확인 후 취소하면 머문다", async () => {
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(false);
    stubFetch({
      "GET /api/me/worklogs/2026-12-03": () => jsonOk({ logDate: "2026-12-03", content: "", createdAt: "", updatedAt: "" }),
      "GET /api/me/worklogs/2026-12-03/tasks": () => jsonOk({ items: [], hasNext: false }),
      "GET /api/me/calendar": () => jsonOk({ items: [], hasNext: false }),
      "GET /api/me/worklogs": () => jsonOk([]),
    });
    const onOpenCalendar = vi.fn();
    renderTab(<ServerJournalTab today={TODAY} initialDate="2026-12-03" onOpenCalendar={onOpenCalendar} />);
    const note = await screen.findByRole("textbox", { name: "2026-12-03 업무 노트" });
    fireEvent.click(screen.getByRole("button", { name: new RegExp(WORKLOG_TEXT.openCalendar) }));
    expect(onOpenCalendar).toHaveBeenLastCalledWith("2026-12-03");
    fireEvent.change(note, { target: { value: "작성 중" } });
    fireEvent.click(screen.getByRole("button", { name: new RegExp(WORKLOG_TEXT.openCalendar) }));
    expect(confirm).toHaveBeenCalled();
    expect(onOpenCalendar).toHaveBeenCalledTimes(1);
    confirm.mockRestore();
  });

  it("내 업무 화면: 캘린더에서 노트로, 노트에서 다시 캘린더로 같은 날짜를 들고 오간다", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-12-01T03:00:00Z"));
    try {
      stubFetch({
        ...baseHandlers(),
        "GET /api/me/todos": () => jsonOk({ items: [], nextCursor: null, hasNext: false }),
        "GET /api/me/worklogs/2026-12-02": () => jsonOk({ logDate: "2026-12-02", content: "둘째 날", createdAt: "", updatedAt: "" }),
        "GET /api/me/worklogs/2026-12-02/tasks": () => jsonOk({ items: [], hasNext: false }),
      });
      renderTab(<ServerMyWorkPage />);
      fireEvent.click(screen.getByRole("tab", { name: new RegExp(MYWORK_TAB_TEXT.calendar) }));
      await screen.findByRole("region", { name: "2026-12-01 일정" });
      fireEvent.click(screen.getByRole("button", { name: "2026-12-02 선택" }));
      fireEvent.click(within(screen.getByRole("region", { name: "2026-12-02 일정" })).getByRole("button", { name: new RegExp(SCHEDULE_TEXT.writeNote) }));
      expect(((await screen.findByRole("textbox", { name: "2026-12-02 업무 노트" })) as HTMLTextAreaElement).value).toBe("둘째 날");
      fireEvent.click(screen.getByRole("button", { name: new RegExp(WORKLOG_TEXT.openCalendar) }));
      expect(await screen.findByRole("region", { name: "2026-12-02 일정" })).toBeTruthy();
    } finally {
      vi.useRealTimers();
    }
  });
});
