// @vitest-environment jsdom
import { useEffect, useState, type ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, screen, waitFor, within } from "@testing-library/react";
import MeetingsPage from "@/pages/project-detail/meetings";
import { useDemoStore } from "@/stores/DemoStore";
import { MEETING_FORM_TEXT, MEETING_TEXT } from "@/features/meeting/i18n/ko";
import { jsonFail, jsonOk, renderApp, stubFetch } from "@test/support/appHarness";
import type { ServerProjectDetail } from "@/features/project/api/projectApi";

/** 로그인 사용자(fakeAuth api)는 서버 사용자 5 */
const ME = 5;

const detail: ServerProjectDetail = {
  id: 77, code: "PRT-2026-001", name: "서버 프로젝트", status: "planned", template: "itProject", methodology: "waterfall",
  visibility: "company", departments: [], pms: [{ id: 1, name: "김피엠" }], startDate: null, endDate: null,
  createdAt: "2026-11-26T00:00:00Z", departmentType: "sw", createdBy: 1, actors: ["pm", "dev"], features: ["meeting"], progress: 0, version: 0,
};

const SeedServerProject = ({ children }: { children: ReactNode }) => {
  const { syncServerProjectDetail } = useDemoStore();
  const [ready, setReady] = useState(false);
  useEffect(() => {
    syncServerProjectDetail({ detail, phases: [], members: [] });
    setReady(true);
    // 처음 한 번만 넣는다.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return ready ? <>{children}</> : null;
};

const summary = (overrides: Record<string, unknown> = {}) => ({ id: 1, title: "주간 회의", heldAt: "2026-12-01T01:00:00Z", authorUserId: ME, authorName: "홍길동", version: 2, ...overrides });
const meetingDto = (overrides: Record<string, unknown> = {}) => ({
  ...summary(), projectId: 77, content: "<b>굵게</b> 본문", createdAt: "", updatedAt: "",
  attendees: [{ id: 1, userId: 11, name: "이개발", external: false }],
  decisions: [{ id: 1, content: "범위 확정", sortOrder: 1, source: "MANUAL" }],
  actionItems: [{ id: 1, content: "견적 요청", assigneeUserId: 11, assigneeName: "이개발", dueDate: "2026-12-05", status: "OPEN", source: "MANUAL", taskId: null }],
  ...overrides,
});
const members = (myActor: string | null) => ({
  items: [
    ...(myActor ? [{ userId: ME, name: "홍길동", actor: myActor, assignedTaskCount: 0 }] : []),
    { userId: 11, name: "이개발", actor: "DEVELOPER", assignedTaskCount: 0 },
  ],
  nextCursor: null,
  hasNext: false,
});
const handlers = (myActor: string | null, items: unknown[] = [summary()], meeting: unknown = meetingDto()) => ({
  "GET /api/projects/77/meetings": () => jsonOk({ items, nextCursor: null, hasNext: false }),
  "GET /api/projects/77/meetings/1": () => jsonOk(meeting),
  "GET /api/projects/77/members": () => jsonOk(members(myActor)),
});

const ROUTES = [{ path: "/projects/:projectId/collab/meeting", element: <MeetingsPage /> }];
const renderServerWith = (h: Parameters<typeof stubFetch>[0]) => {
  const stub = stubFetch(h);
  const view = renderApp({ mode: "api", route: "/projects/77/collab/meeting", routes: ROUTES, wrap: (tree) => <SeedServerProject>{tree}</SeedServerProject> });
  return { ...stub, ...view };
};

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("api 모드 회의록", () => {
  it("목록과 첫 회의록 상세를 보여 주고, 본문은 텍스트로만 그린다", async () => {
    const { container } = renderServerWith(handlers("DEVELOPER"));
    const article = await screen.findByRole("article", { name: "주간 회의" });
    expect(within(article).getByText("<b>굵게</b> 본문")).toBeTruthy();
    expect(container.querySelector("article b")).toBeNull();
    expect(within(article).getByText("범위 확정")).toBeTruthy();
    expect(within(article).getByText("견적 요청")).toBeTruthy();
  });

  it("검색어로 다시 묻는다", async () => {
    const { calls } = renderServerWith(handlers("DEVELOPER"));
    await screen.findByRole("article", { name: "주간 회의" });
    fireEvent.change(screen.getByRole("textbox", { name: MEETING_TEXT.search }), { target: { value: "견적" } });
    fireEvent.click(screen.getByRole("button", { name: MEETING_TEXT.search }));
    await waitFor(() => expect(calls.some((c) => new URL(c.path, "http://x").searchParams.get("keyword") === "견적")).toBe(true));
  });

  it("작성: 멤버만 참석자로, requestId와 한국 시각→UTC로 보내고 성공 뒤 상세를 보여 준다", async () => {
    const { calls } = renderServerWith({
      ...handlers("DEVELOPER", []),
      "POST /api/projects/77/meetings": () => jsonOk(meetingDto({ id: 2, title: "킥오프" })),
    });
    fireEvent.click(await screen.findByRole("button", { name: new RegExp(MEETING_TEXT.add) }));
    const dialog = screen.getByRole("dialog");
    fireEvent.change(within(dialog).getByRole("textbox", { name: MEETING_FORM_TEXT.title }), { target: { value: "킥오프" } });
    fireEvent.change(dialog.querySelector('input[type="date"]') as HTMLInputElement, { target: { value: "2026-12-02" } });
    fireEvent.click(within(dialog).getByRole("checkbox", { name: "이개발" }));
    fireEvent.change(within(dialog).getByRole("textbox", { name: `${MEETING_FORM_TEXT.decisions} 1` }), { target: { value: "일정 확정" } });
    fireEvent.click(within(dialog).getByRole("button", { name: MEETING_FORM_TEXT.save }));
    expect(await screen.findByText("'킥오프' 회의록을 저장했습니다.")).toBeTruthy();
    const body = calls.find((c) => c.method === "POST")?.body as Record<string, unknown>;
    expect(body).toMatchObject({ title: "킥오프", heldAt: "2026-12-02T01:00:00.000Z", attendees: [{ userId: 11 }], decisions: ["일정 확정"], actionItems: [], content: null });
    expect(typeof body.requestId).toBe("string");
  });

  it("작성자가 수정하면 version과 함께 전체를 보내고, 409면 안내 후 다시 받는다", async () => {
    let detailCalls = 0;
    const { calls } = renderServerWith({
      ...handlers("DEVELOPER"),
      "GET /api/projects/77/meetings/1": () => {
        detailCalls += 1;
        return jsonOk(meetingDto());
      },
      "PATCH /api/projects/77/meetings/1": () => jsonFail(409, "다른 사용자가 먼저 수정했습니다"),
    });
    await screen.findByRole("article", { name: "주간 회의" });
    fireEvent.click(screen.getByRole("button", { name: MEETING_TEXT.edit }));
    const dialog = screen.getByRole("dialog");
    fireEvent.click(within(dialog).getByRole("button", { name: MEETING_FORM_TEXT.save }));
    expect(await screen.findByText(MEETING_TEXT.concurrent)).toBeTruthy();
    expect(calls.find((c) => c.method === "PATCH")?.body).toMatchObject({
      version: 2, title: "주간 회의", attendees: [{ userId: 11 }], decisions: ["범위 확정"], actionItems: [{ content: "견적 요청", assigneeUserId: 11, dueDate: "2026-12-05" }],
    });
    await waitFor(() => expect(detailCalls).toBe(2));
  });

  it("수정할 때 지금은 멤버가 아닌 기존 참석자·담당자도 빠지지 않고 그대로 보낸다", async () => {
    const { calls } = renderServerWith({
      ...handlers("DEVELOPER", [summary()], meetingDto({
        attendees: [{ id: 1, userId: 11, name: "이개발", external: false }, { id: 2, userId: 30, name: "퇴사자", external: false }],
        actionItems: [{ id: 1, content: "정리", assigneeUserId: 30, assigneeName: "퇴사자", dueDate: null, status: "OPEN", source: "MANUAL", taskId: null }],
      })),
      "PATCH /api/projects/77/meetings/1": () => jsonOk(meetingDto({ version: 3 })),
    });
    await screen.findByRole("article", { name: "주간 회의" });
    fireEvent.click(screen.getByRole("button", { name: MEETING_TEXT.edit }));
    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByRole("checkbox", { name: "퇴사자" })).toHaveProperty("checked", true);
    fireEvent.click(within(dialog).getByRole("button", { name: MEETING_FORM_TEXT.save }));
    expect(await screen.findByText("'주간 회의' 회의록을 수정했습니다.")).toBeTruthy();
    expect(calls.find((c) => c.method === "PATCH")?.body).toMatchObject({
      attendees: [{ userId: 11 }, { userId: 30 }],
      actionItems: [{ content: "정리", assigneeUserId: 30, dueDate: null }],
    });
  });

  it("작성자·PM이 아니면 수정·삭제가 없고, 멤버가 아니면 작성도 없다", async () => {
    renderServerWith(handlers(null, [summary({ authorUserId: 11 })], meetingDto({ authorUserId: 11 })));
    await screen.findByRole("article", { name: "주간 회의" });
    expect(screen.queryByRole("button", { name: MEETING_TEXT.edit })).toBeNull();
    expect(screen.queryByRole("button", { name: new RegExp(MEETING_TEXT.add) })).toBeNull();
    expect(screen.getByText(MEETING_TEXT.memberOnly)).toBeTruthy();
  });

  it("PM은 남이 쓴 회의록도 수정·삭제할 수 있다", async () => {
    vi.spyOn(window, "confirm").mockReturnValue(true);
    const { calls } = renderServerWith({
      ...handlers("PM", [summary({ authorUserId: 11 })], meetingDto({ authorUserId: 11 })),
      "DELETE /api/projects/77/meetings/1": () => new Response(null, { status: 204 }),
    });
    await screen.findByRole("article", { name: "주간 회의" });
    fireEvent.click(screen.getByRole("button", { name: MEETING_TEXT.delete }));
    expect(await screen.findByText("'주간 회의' 회의록을 삭제했습니다.")).toBeTruthy();
    expect(calls.some((c) => c.method === "DELETE")).toBe(true);
  });

  it("업무로 전환된 액션아이템이 있으면 수정·삭제를 막고 이유를 보인다", async () => {
    renderServerWith(handlers("DEVELOPER", [summary()], meetingDto({ actionItems: [{ id: 1, content: "견적 요청", assigneeUserId: 11, assigneeName: "이개발", dueDate: null, status: "CONVERTED", source: "MANUAL", taskId: 9 }] })));
    await screen.findByRole("article", { name: "주간 회의" });
    expect(screen.getByText(MEETING_TEXT.protected)).toBeTruthy();
    expect(screen.queryByRole("button", { name: MEETING_TEXT.edit })).toBeNull();
  });

  it("회의록 기능이 꺼졌으면(404) 사용할 수 없다고 안내한다", async () => {
    renderServerWith({ ...handlers("PM"), "GET /api/projects/77/meetings": () => jsonFail(404, "이 프로젝트에서 사용하지 않는 기능입니다") });
    expect(await screen.findByText(MEETING_TEXT.unavailable)).toBeTruthy();
  });
});

describe("데모 모드 회의록 (기존 시연 유지)", () => {
  it("데모 프로젝트는 데모 회의록을 그대로 보여 주고 서버를 부르지 않는다", async () => {
    const { fetchMock } = stubFetch({});
    renderApp({ mode: "demo", route: "/projects/p1/collab/meeting", routes: ROUTES });
    expect(await screen.findByText(/AI 초안 · 데모/)).toBeTruthy();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
