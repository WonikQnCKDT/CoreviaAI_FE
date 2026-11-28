// @vitest-environment jsdom
import { useEffect, useState, type ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, screen, waitFor, within } from "@testing-library/react";
import ProjectSettingsPage from "@/pages/project-detail/settings";
import { useDemoStore } from "@/stores/DemoStore";
import { PROJECT_SETTINGS_TEXT } from "@/features/project/i18n/ko";
import { PROJECT_MEMBER_TEXT } from "@/features/project/i18n/member";
import { BUTTON_TEXT } from "@/shared/i18n/catalog/button";
import { formatLabel } from "@/shared/i18n/store";
import { jsonFail, jsonOk, renderApp, stubFetch } from "@/test/appHarness";
import { userSearchDto } from "@/test/projectFixtures";
import type { ServerProjectDetail } from "@/features/project/api/projectApi";

/** 실제 BE DTO 형식(ProjectMemberResponse) — actor는 서버 enum 값이다 */
type MemberDto = { userId: number; name: string; actor: "PM" | "DEVELOPER" | "QA" | "BUSINESS_OWNER"; assignedTaskCount: number };

const ME = 5; // fakeAuth("api")의 account.userId

const serverDetail = (pmIds: number[]): ServerProjectDetail => ({
  id: 77,
  code: "PRT-2026-001",
  name: "서버 프로젝트",
  status: "planned",
  template: "itProject",
  methodology: "waterfall",
  visibility: "company",
  departments: [],
  pms: pmIds.map((id) => ({ id, name: id === ME ? "홍길동" : `PM${id}` })),
  startDate: null,
  endDate: null,
  createdAt: "2026-11-26T00:00:00Z",
  departmentType: "sw",
  createdBy: pmIds[0] ?? ME,
  actors: ["pm", "dev", "qa"],
  features: ["wbs"],
  progress: 0,
  version: 0,
});

const ACTOR_FROM_DTO = { PM: "pm", DEVELOPER: "dev", QA: "qa", BUSINESS_OWNER: "biz" } as const;

/** 서버 프로젝트를 저장소에 넣고, 현재 데모 사용자(u1)를 서버 사용자 ME로 맞춘다. */
const SeedServerProject = ({ children, members }: { children: ReactNode; members: MemberDto[] }) => {
  const { syncServerProjectDetail, updateUser, currentUser } = useDemoStore();
  const [ready, setReady] = useState(false);
  useEffect(() => {
    updateUser(currentUser.id, { serverUserId: ME });
    syncServerProjectDetail({
      detail: serverDetail(members.filter(({ actor }) => actor === "PM").map(({ userId }) => userId)),
      phases: [],
      members: members.map(({ userId, name, actor, assignedTaskCount }) => ({ userId, name, actor: ACTOR_FROM_DTO[actor], assignedTaskCount })),
    });
    setReady(true);
    // 처음 한 번만 넣는다.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return ready ? <>{children}</> : null;
};

const ROUTES = [{ path: "/projects/:projectId/settings", element: <ProjectSettingsPage /> }];

const page = <T,>(items: T[], nextCursor: string | null = null) => ({ items, nextCursor, hasNext: nextCursor !== null });

const PM_ME: MemberDto = { userId: ME, name: "홍길동", actor: "PM", assignedTaskCount: 3 };
const DEV: MemberDto = { userId: 11, name: "이개발", actor: "DEVELOPER", assignedTaskCount: 0 };
const PM_OTHER: MemberDto = { userId: 7, name: "김피엠", actor: "PM", assignedTaskCount: 1 };

const HISTORY = {
  id: 31,
  userId: 11,
  userName: "이개발",
  changeType: "INVITED",
  beforeActor: null,
  afterActor: "DEVELOPER",
  changedBy: ME,
  changedByName: "홍길동",
  occurredAt: "2026-11-27T01:00:00Z",
};

const render = function ({
  members,
  handlers = {},
}: {
  members: MemberDto[];
  handlers?: Parameters<typeof stubFetch>[0];
}) {
  const stub = stubFetch({
    "GET /api/projects/77/members": () => jsonOk(page(members)),
    "GET /api/projects/77/members/histories": () => jsonOk(page([HISTORY])),
    ...handlers,
  });
  renderApp({
    mode: "api",
    route: "/projects/77/settings",
    routes: ROUTES,
    wrap: (tree) => <SeedServerProject members={members}>{tree}</SeedServerProject>,
  });
  return stub;
};

const roleSelect = (name: string) => screen.findByRole("combobox", { name: formatLabel(PROJECT_MEMBER_TEXT.roleSelect, { name }) });
const removeButton = (name: string) => screen.findByRole("button", { name: new RegExp(formatLabel(PROJECT_MEMBER_TEXT.removeAria, { name }).replace(/[()]/g, "\\$&")) });
const dialog = () => screen.findByRole("dialog");

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const SEARCH_RESULT = [userSearchDto(11, "이개발"), userSearchDto(21, "박신입", "품질팀", "선임"), userSearchDto(22, "최현업", null)];

const searchAndPick = async (name: string) => {
  const input = await screen.findByRole("combobox", { name: PROJECT_MEMBER_TEXT.inviteSearch });
  fireEvent.focus(input);
  fireEvent.change(input, { target: { value: "검색어" } });
  fireEvent.click(await screen.findByRole("option", { name: new RegExp(name) }));
};

const inviteButton = (count: number) =>
  screen.getByRole("button", { name: new RegExp(formatLabel(PROJECT_MEMBER_TEXT.inviteSubmit, { count })) });

describe("api 모드 멤버 초대", () => {
  it("PM이 사용자를 찾아 역할을 고르고 초대하면 서버 액터로 보내고 멤버·이력을 다시 받는다", async () => {
    const { calls } = render({
      members: [PM_ME, DEV],
      handlers: {
        "GET /api/users/search": () => jsonOk(SEARCH_RESULT),
        "POST /api/projects/77/members": () =>
          jsonOk([
            { userId: 21, name: "박신입", actor: "QA", assignedTaskCount: 0 },
            { userId: 22, name: "최현업", actor: "DEVELOPER", assignedTaskCount: 0 },
          ]),
      },
    });

    await searchAndPick("박신입");
    // 이미 멤버인 이개발은 검색 결과에서 빠진다
    const input = screen.getByRole("combobox", { name: PROJECT_MEMBER_TEXT.inviteSearch });
    fireEvent.change(input, { target: { value: "검색어2" } });
    await screen.findByRole("option", { name: /최현업/ });
    expect(screen.queryByRole("option", { name: /이개발/ })).toBeNull();
    expect(screen.queryByRole("option", { name: /박신입/ })).toBeNull();
    fireEvent.click(screen.getByRole("option", { name: /최현업/ }));

    const role = screen.getByRole("combobox", { name: formatLabel(PROJECT_MEMBER_TEXT.inviteRole, { name: "박신입" }) }) as HTMLSelectElement;
    // 지정한 액터(PM·개발자·QA) 중 PM을 뺀 것만 고를 수 있다
    expect([...role.options].map((option) => option.value)).toEqual(["dev", "qa"]);
    fireEvent.change(role, { target: { value: "qa" } });
    fireEvent.click(inviteButton(2));

    expect(await screen.findByText(formatLabel(PROJECT_MEMBER_TEXT.invited, { count: 2 }))).toBeTruthy();
    expect(calls.find(({ method }) => method === "POST")?.body).toEqual({
      members: [
        { userId: 21, actor: "QA" },
        { userId: 22, actor: "DEVELOPER" },
      ],
    });
    expect(screen.getByText(PROJECT_MEMBER_TEXT.inviteEmpty)).toBeTruthy();
    await waitFor(() => expect(calls.filter(({ path }) => path.startsWith("/api/projects/77/members?")).length).toBe(2));
    await waitFor(() => expect(calls.filter(({ path }) => path.startsWith("/api/projects/77/members/histories")).length).toBe(2));
  });

  it("고른 사람이 없으면 초대 버튼을 막고, 초대 목록에서 뺄 수 있다", async () => {
    render({ members: [PM_ME, DEV], handlers: { "GET /api/users/search": () => jsonOk(SEARCH_RESULT) } });

    expect(await screen.findByText(PROJECT_MEMBER_TEXT.inviteEmpty)).toBeTruthy();
    expect(inviteButton(0)).toHaveProperty("disabled", true);
    await searchAndPick("박신입");
    fireEvent.click(screen.getByRole("button", { name: formatLabel(PROJECT_MEMBER_TEXT.inviteRemove, { name: "박신입" }) }));
    expect(screen.getByText(PROJECT_MEMBER_TEXT.inviteEmpty)).toBeTruthy();
  });

  it("이미 멤버(409)면 안내하고 고른 목록을 그대로 두며 멤버 목록을 다시 받는다", async () => {
    const { calls } = render({
      members: [PM_ME, DEV],
      handlers: {
        "GET /api/users/search": () => jsonOk(SEARCH_RESULT),
        "POST /api/projects/77/members": () => jsonFail(409, "이미 프로젝트 멤버인 사용자입니다"),
      },
    });

    await searchAndPick("박신입");
    fireEvent.click(inviteButton(1));

    expect(await screen.findByText(PROJECT_MEMBER_TEXT.alreadyMember)).toBeTruthy();
    expect(screen.getByText("박신입")).toBeTruthy();
    await waitFor(() => expect(calls.filter(({ path }) => path.startsWith("/api/projects/77/members?")).length).toBe(2));
  });

  it("초대할 수 없는 사용자(400)면 서버 사유를 보여 준다", async () => {
    render({
      members: [PM_ME, DEV],
      handlers: {
        "GET /api/users/search": () => jsonOk(SEARCH_RESULT),
        "POST /api/projects/77/members": () => jsonFail(400, "프로젝트 멤버로 초대할 수 없는 사용자입니다"),
      },
    });

    await searchAndPick("박신입");
    fireEvent.click(inviteButton(1));

    expect(await screen.findByText("프로젝트 멤버로 초대할 수 없는 사용자입니다")).toBeTruthy();
  });

  it("처리 중에는 다시 눌러도 한 번만 보낸다", async () => {
    let resolve: (response: Response) => void = () => undefined;
    const { calls } = render({
      members: [PM_ME, DEV],
      handlers: {
        "GET /api/users/search": () => jsonOk(SEARCH_RESULT),
        "POST /api/projects/77/members": () => new Promise<Response>((done) => (resolve = done)),
      },
    });

    await searchAndPick("박신입");
    fireEvent.click(inviteButton(1));
    const busy = screen.getByRole("button", { name: new RegExp(PROJECT_MEMBER_TEXT.inviting) });
    expect(busy).toHaveProperty("disabled", true);
    fireEvent.click(busy);
    expect(calls.filter(({ method }) => method === "POST")).toHaveLength(1);

    resolve(jsonOk([{ userId: 21, name: "박신입", actor: "DEVELOPER", assignedTaskCount: 0 }]));
    expect(await screen.findByText(formatLabel(PROJECT_MEMBER_TEXT.invited, { count: 1 }))).toBeTruthy();
    expect(calls.filter(({ method }) => method === "POST")).toHaveLength(1);
  });

  it("PM이 아니면 초대 검색·버튼 없이 PM만 초대할 수 있다는 이유를 보여 준다", async () => {
    const { calls } = render({ members: [PM_OTHER, { ...DEV, userId: ME, name: "홍길동" }] });

    expect(await screen.findByText(PROJECT_SETTINGS_TEXT.pmOnlyInvite)).toBeTruthy();
    expect(screen.queryByRole("combobox", { name: PROJECT_MEMBER_TEXT.inviteSearch })).toBeNull();
    expect(calls.some(({ path }) => path.startsWith("/api/users/search"))).toBe(false);
  });
});

describe("api 모드 멤버 목록·권한 (FR-PRJ-04)", () => {
  it("서버 멤버 목록의 역할·담당 업무 수를 보여 주고, PM에게 역할 변경·제외를 연다", async () => {
    const { calls } = render({ members: [PM_ME, DEV] });

    expect(await screen.findByText(formatLabel(PROJECT_MEMBER_TEXT.title, { count: 2 }))).toBeTruthy();
    expect(screen.getByText(new RegExp(formatLabel(PROJECT_MEMBER_TEXT.assignedTasks, { count: 3 })))).toBeTruthy();
    expect(screen.getByText(new RegExp(formatLabel(PROJECT_MEMBER_TEXT.assignedTasks, { count: 0 })))).toBeTruthy();
    const select = (await roleSelect("이개발")) as HTMLSelectElement;
    // 프로젝트에 지정한 액터(PM·개발자·QA)만 고를 수 있다
    expect([...select.options].map((option) => option.value)).toEqual(["pm", "dev", "qa"]);
    expect(select.disabled).toBe(false);
    expect(calls.some(({ path }) => path.startsWith("/api/projects/77/members?"))).toBe(true);
  });

  it("PM 위임 카드는 서버 기준 안내로 바꾸고 가짜 위임 버튼을 두지 않는다", async () => {
    render({ members: [PM_ME, DEV] });

    expect(await screen.findByText(PROJECT_MEMBER_TEXT.pmGuide)).toBeTruthy();
    expect(screen.getByText(PROJECT_SETTINGS_TEXT.approverNotConnected)).toBeTruthy();
    expect(screen.queryByRole("button", { name: new RegExp(BUTTON_TEXT.delegatePm) })).toBeNull();
  });

  it("PM이 아닌 멤버에게는 읽기 전용으로 보여 준다", async () => {
    render({ members: [PM_OTHER, { ...DEV, userId: ME, name: "홍길동" }] });

    expect(await screen.findByText(new RegExp(PROJECT_MEMBER_TEXT.readOnly))).toBeTruthy();
    expect(screen.getByText(PROJECT_MEMBER_TEXT.pmGuideReadOnly)).toBeTruthy();
    expect(screen.queryByRole("combobox")).toBeNull();
    expect(screen.queryByRole("button", { name: new RegExp(PROJECT_MEMBER_TEXT.remove) })).toBeNull();
  });

  it("PM이 한 명뿐이면 그 PM의 역할 변경·제외를 미리 막고 이유를 보여 준다", async () => {
    render({ members: [PM_ME, DEV] });

    expect(((await roleSelect("홍길동")) as HTMLSelectElement).disabled).toBe(true);
    expect(((await removeButton("홍길동")) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByText(PROJECT_MEMBER_TEXT.lastPmHint)).toBeTruthy();
  });

  it("멤버 목록을 받지 못하면 오류와 다시 시도를 보여 준다", async () => {
    let fail = true;
    render({
      members: [PM_ME, DEV],
      handlers: { "GET /api/projects/77/members": () => (fail ? jsonFail(500, "서버 오류") : jsonOk(page([PM_ME, DEV]))) },
    });

    expect(await screen.findByText(PROJECT_MEMBER_TEXT.loadFailed)).toBeTruthy();
    fail = false;
    fireEvent.click(screen.getAllByRole("button", { name: PROJECT_MEMBER_TEXT.retry })[0]);
    expect(await screen.findByText(formatLabel(PROJECT_MEMBER_TEXT.title, { count: 2 }))).toBeTruthy();
  });
});

describe("api 모드 역할 변경·PM 추가·해제", () => {
  it("멤버를 PM으로 추가하면 확인 후 서버 액터로 보내고, 목록·이력을 다시 맞춘다", async () => {
    const { calls } = render({
      members: [PM_ME, DEV],
      handlers: { "PATCH /api/projects/77/members/11/role": () => jsonOk({ ...DEV, actor: "PM" }) },
    });

    fireEvent.change(await roleSelect("이개발"), { target: { value: "pm" } });
    const confirm = await dialog();
    expect(within(confirm).getByText(PROJECT_MEMBER_TEXT.confirmPmAddTitle)).toBeTruthy();
    fireEvent.click(within(confirm).getByRole("button", { name: PROJECT_MEMBER_TEXT.confirmChange }));

    expect(await screen.findByText(formatLabel(PROJECT_MEMBER_TEXT.roleChanged, { name: "이개발", after: "PM" }))).toBeTruthy();
    expect(calls.find(({ method }) => method === "PATCH")?.body).toEqual({ actor: "PM" });
    expect(screen.getByText(formatLabel(PROJECT_MEMBER_TEXT.pmCount, { count: 2 }))).toBeTruthy();
    await waitFor(() => expect(calls.filter(({ path }) => path.startsWith("/api/projects/77/members/histories")).length).toBe(2));
  });

  it("취소하면 아무 요청도 보내지 않고 원래 역할을 그대로 둔다", async () => {
    const { calls } = render({ members: [PM_ME, DEV] });

    const select = (await roleSelect("이개발")) as HTMLSelectElement;
    fireEvent.change(select, { target: { value: "qa" } });
    fireEvent.click(within(await dialog()).getByRole("button", { name: PROJECT_MEMBER_TEXT.cancel }));

    expect(screen.queryByRole("dialog")).toBeNull();
    expect(select.value).toBe("dev");
    expect(calls.some(({ method }) => method === "PATCH")).toBe(false);
  });

  it("마지막 PM 해제를 서버가 409로 거부하면 안내 문구를 보여 주고 목록을 다시 받는다", async () => {
    // 화면은 PM 2명으로 알고 있지만 그 사이 다른 PM이 해제되어 서버에서는 마지막 PM인 경우
    const { calls } = render({
      members: [PM_ME, PM_OTHER, DEV],
      handlers: {
        "PATCH /api/projects/77/members/7/role": () => jsonFail(409, "프로젝트에는 PM이 1명 이상 있어야 합니다"),
      },
    });

    fireEvent.change(await roleSelect("김피엠"), { target: { value: "dev" } });
    const confirm = await dialog();
    expect(within(confirm).getByText(PROJECT_MEMBER_TEXT.confirmPmReleaseTitle)).toBeTruthy();
    fireEvent.click(within(confirm).getByRole("button", { name: PROJECT_MEMBER_TEXT.confirmChange }));

    expect(await screen.findByText(PROJECT_MEMBER_TEXT.lastPm)).toBeTruthy();
    await waitFor(() => expect(calls.filter(({ path }) => path.startsWith("/api/projects/77/members?")).length).toBe(2));
  });

  it("게이트 승인자를 PM으로 바꾸려다 400이면 서버 사유를 보여 준다", async () => {
    render({
      members: [PM_ME, DEV],
      handlers: {
        "PATCH /api/projects/77/members/11/role": () => jsonFail(400, "게이트 승인자는 PM이 될 수 없습니다. 승인자 지정을 먼저 해제해 주세요"),
      },
    });

    fireEvent.change(await roleSelect("이개발"), { target: { value: "pm" } });
    fireEvent.click(within(await dialog()).getByRole("button", { name: PROJECT_MEMBER_TEXT.confirmChange }));

    expect(await screen.findByText("게이트 승인자는 PM이 될 수 없습니다. 승인자 지정을 먼저 해제해 주세요")).toBeTruthy();
  });
});

describe("api 모드 멤버 제외", () => {
  it("확인 후 제외하면 목록에서 빼고 결과를 알린다", async () => {
    const { calls } = render({
      members: [PM_ME, DEV],
      handlers: { "DELETE /api/projects/77/members/11": () => jsonOk(null) },
    });

    fireEvent.click(await removeButton("이개발"));
    const confirm = await dialog();
    expect(within(confirm).getByText(PROJECT_MEMBER_TEXT.confirmRemoveTitle)).toBeTruthy();
    fireEvent.click(within(confirm).getByRole("button", { name: PROJECT_MEMBER_TEXT.confirmRemove }));

    expect(await screen.findByText(formatLabel(PROJECT_MEMBER_TEXT.removed, { name: "이개발" }))).toBeTruthy();
    expect(screen.getByText(formatLabel(PROJECT_MEMBER_TEXT.title, { count: 1 }))).toBeTruthy();
    expect(calls.filter(({ method }) => method === "DELETE")).toHaveLength(1);
  });

  it("미완료 담당 업무가 있어 409면 재배정할 업무 목록을 보여 준다", async () => {
    render({
      members: [PM_ME, DEV],
      handlers: {
        "DELETE /api/projects/77/members/11": () =>
          jsonFail(409, "담당 중인 업무가 있어 제외할 수 없습니다", [
            { taskId: 101, title: "로그인 화면 구현", status: "IN_PROGRESS" },
            { taskId: 102, title: "API 연동", status: "TODO" },
          ]),
      },
    });

    fireEvent.click(await removeButton("이개발"));
    fireEvent.click(within(await dialog()).getByRole("button", { name: PROJECT_MEMBER_TEXT.confirmRemove }));

    expect(await screen.findByText(PROJECT_MEMBER_TEXT.hasTasks)).toBeTruthy();
    expect(screen.getByText(/로그인 화면 구현/)).toBeTruthy();
    expect(screen.getByText(/API 연동/)).toBeTruthy();
    expect(screen.getByText(formatLabel(PROJECT_MEMBER_TEXT.title, { count: 2 }))).toBeTruthy();
  });
});

describe("api 모드 멤버 변경 이력", () => {
  it("변경 유형·전후 역할·처리자를 보여 주고 '더 보기'로 다음 커서를 받는다", async () => {
    const { calls } = render({
      members: [PM_ME, DEV],
      handlers: {
        "GET /api/projects/77/members/histories": ({ url }) =>
          url.searchParams.get("cursor") === "31"
            ? jsonOk(page([{ ...HISTORY, id: 30, userId: ME, userName: "홍길동", changeType: "PM_REASSIGNED", beforeActor: null, afterActor: "PM", changedByName: "관리자" }]))
            : jsonOk(page([HISTORY], "31")),
      },
    });

    expect(await screen.findByText("초대")).toBeTruthy();
    expect(screen.getByText(formatLabel(PROJECT_MEMBER_TEXT.historyBy, { name: "홍길동" }))).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: PROJECT_MEMBER_TEXT.loadMore }));

    expect(await screen.findByText("PM 재지정(관리자)")).toBeTruthy();
    expect(screen.queryByRole("button", { name: PROJECT_MEMBER_TEXT.loadMore })).toBeNull();
    expect(calls.some(({ path }) => path.includes("histories?cursor=31&size=20"))).toBe(true);
  });

  it("이력이 없으면 빈 상태를 보여 준다", async () => {
    render({ members: [PM_ME], handlers: { "GET /api/projects/77/members/histories": () => jsonOk(page([])) } });

    expect(await screen.findByText(PROJECT_MEMBER_TEXT.historyEmpty)).toBeTruthy();
  });

  it("'더 보기'가 실패해도 받은 이력은 그대로 두고 오류를 보여 준다", async () => {
    render({
      members: [PM_ME, DEV],
      handlers: {
        "GET /api/projects/77/members/histories": ({ url }) =>
          url.searchParams.get("cursor") ? jsonFail(500, "x") : jsonOk(page([HISTORY], "31")),
      },
    });

    fireEvent.click(await screen.findByRole("button", { name: PROJECT_MEMBER_TEXT.loadMore }));

    expect(await screen.findByText(PROJECT_MEMBER_TEXT.historyFailed)).toBeTruthy();
    expect(screen.getByText("초대")).toBeTruthy();
  });
});

describe("데모 모드 멤버·설정 (기존 시연 유지)", () => {
  it("데모 프로젝트는 PM 위임을 그대로 쓰고 서버 멤버 화면·초대를 보이지 않는다", async () => {
    const { fetchMock } = stubFetch({});
    renderApp({ mode: "demo", route: "/projects/p1/settings", routes: ROUTES });

    expect(await screen.findByRole("button", { name: new RegExp(BUTTON_TEXT.delegatePm) })).toBeTruthy();
    expect(screen.queryByRole("combobox", { name: PROJECT_MEMBER_TEXT.inviteSearch })).toBeNull();
    expect(screen.queryByText(PROJECT_MEMBER_TEXT.historyTitle)).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
