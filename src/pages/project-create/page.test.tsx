// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, screen, waitFor, within } from "@testing-library/react";
import { useParams } from "react-router-dom";
import ProjectCreatePage from "@/pages/project-create/page";
import ProjectsPage from "@/pages/projects/page";
import { useDemoStore } from "@/stores/DemoStore";
import { PROJECT_CREATE_TEXT, PROJECT_DIRECTORY_TEXT, PROJECT_FEATURE_LABEL } from "@/features/project/i18n/ko";
import { BUTTON_TEXT } from "@/shared/i18n/catalog/button";
import { formatLabel } from "@/shared/i18n/store";
import { jsonFail, jsonOk, renderApp, stubFetch } from "@/test/appHarness";
import { creationOptionsDto } from "@/test/projectFixtures";

/** 실제 BE 응답 형식(기본 시드) */
const CREATION_OPTIONS = creationOptionsDto();

const createdDetail = (name: string) => ({
  id: 77,
  code: "PRT-2026-001",
  name,
  status: "PLANNED",
  template: "IT_PROJECT",
  methodology: "WATERFALL",
  visibility: "COMPANY",
  departments: [],
  pms: [{ id: 5, name: "홍길동" }],
  startDate: null,
  endDate: null,
  createdAt: "2026-11-26T00:00:00Z",
  departmentType: "SW",
  createdBy: 5,
  actors: ["PM", "BUSINESS_OWNER", "DEVELOPER", "QA"],
  features: ["WBS", "KANBAN", "DELIVERABLE"],
  progress: 0,
  updatedAt: "2026-11-26T00:00:00Z",
  version: 0,
});

/** 데모 생성 뒤 이동한 프로젝트 화면 자리. 저장소에 생긴 프로젝트 이름을 보여 준다. */
const CreatedDemoProject = () => {
  const { projectId } = useParams();
  const { projects } = useDemoStore();
  const project = projects.find((p) => p.id === projectId);
  return <p>데모 프로젝트 생성됨: {project?.name}</p>;
};

const API_ROUTES = [
  { path: "/projects/new", element: <ProjectCreatePage /> },
  { path: "/projects", element: <ProjectsPage /> },
];

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
  // jsdom에는 스크롤 API가 없다. 데모 화면은 단계가 바뀔 때 맨 위로 스크롤한다.
  if (!Element.prototype.scrollTo) Element.prototype.scrollTo = () => undefined;
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("api 모드 프로젝트 생성", () => {
  it("서버 선택지로 폼을 채우고, 고를 수 없는 선택 항목(부서·멤버·승인자)은 이유와 함께 비활성으로 둔다", async () => {
    stubFetch({ "GET /api/projects/creation-options": () => jsonOk(CREATION_OPTIONS) });
    renderApp({ mode: "api", route: "/projects/new", routes: API_ROUTES });

    // 서버가 준 첫 템플릿(id 오름차순, 빈 템플릿)의 기본값
    expect(await screen.findByLabelText(PROJECT_CREATE_TEXT.template)).toHaveProperty("value", "empty");
    expect(screen.getByLabelText(PROJECT_CREATE_TEXT.methodology)).toHaveProperty("value", "none");
    expect(screen.getByText(formatLabel(PROJECT_CREATE_TEXT.pmSelf, { name: "홍길동" }))).toBeTruthy();
    expect(screen.getByText(new RegExp(PROJECT_DIRECTORY_TEXT.departmentsUnavailable.slice(0, 20)))).toBeTruthy();
    expect(screen.getByText(new RegExp(PROJECT_DIRECTORY_TEXT.usersUnavailable.slice(0, 20)))).toBeTruthy();
    expect(screen.getByText(new RegExp(PROJECT_DIRECTORY_TEXT.approverUnavailable.slice(0, 20)))).toBeTruthy();
    // 데모 샘플 사용자(박지훈 등)는 api 모드 화면에 나오지 않는다.
    expect(screen.queryByText("박지훈")).toBeNull();
  });

  it("서버가 성공을 돌려준 뒤에만 목록으로 가서 성공 안내를 띄우고 서버 목록을 다시 받는다", async () => {
    const { calls, unexpected } = stubFetch({
      "GET /api/projects/creation-options": () => jsonOk(CREATION_OPTIONS),
      "POST /api/projects": ({ body }) => jsonOk(createdDetail((body as { name: string }).name)),
      "GET /api/projects": () => jsonOk({ items: [createdDetail("구매 발주 시스템")], nextCursor: null, hasNext: false }),
    });
    renderApp({ mode: "api", route: "/projects/new", routes: API_ROUTES });

    fireEvent.change(await screen.findByLabelText(PROJECT_CREATE_TEXT.name), { target: { value: "구매 발주 시스템" } });
    fireEvent.click(screen.getByRole("button", { name: new RegExp(PROJECT_CREATE_TEXT.submit) }));

    expect(await screen.findByText(formatLabel(PROJECT_CREATE_TEXT.created, { name: "구매 발주 시스템" }))).toBeTruthy();
    const post = calls.find(({ method, path }) => method === "POST" && path === "/api/projects");
    expect(post?.body).toMatchObject({
      name: "구매 발주 시스템",
      code: "PRT-2026-001",
      departmentIds: [],
      members: [],
      gateApproverUserId: null,
      template: "EMPTY",
      methodology: "NONE",
      phases: [],
      // 회귀(SCRUM-98): 템플릿 기본 기능이 빠지지 않고 간다
      features: ["KANBAN", "BOARD", "MEETING", "ISSUE", "FILE"],
    });
    // 샘플 ID(u1·u2 같은 문자열)가 본문 어디에도 없다.
    expect(JSON.stringify(post?.body)).not.toMatch(/"u\d+"/);
    await waitFor(() => expect(calls.some(({ method, path }) => method === "GET" && path.startsWith("/api/projects?"))).toBe(true));
    expect(await screen.findAllByText("구매 발주 시스템")).not.toHaveLength(0);
    expect(unexpected).toEqual([]);
  });

  it("회귀(SCRUM-98): 실제 서버 선택지로 기능 체크박스가 나오고, 템플릿 기본 기능 자동 체크·단계 필요 기능·비활성 기능을 구분한다", async () => {
    const { calls } = stubFetch({
      "GET /api/projects/creation-options": () => jsonOk(CREATION_OPTIONS),
      "POST /api/projects": ({ body }) => jsonOk(createdDetail((body as { name: string }).name)),
      "GET /api/projects": () => jsonOk({ items: [], nextCursor: null, hasNext: false }),
    });
    renderApp({ mode: "api", route: "/projects/new", routes: API_ROUTES });

    const checkbox = (name: string) => screen.getByRole("checkbox", { name: new RegExp(`^${name}`) });
    await screen.findByLabelText(PROJECT_CREATE_TEXT.template);
    // 빈 템플릿(단계 없음): 기본 기능 체크, 산출물은 단계 필요로 비활성, Git은 준비 중으로 비활성, WBS는 고를 수 있다
    expect(checkbox(PROJECT_FEATURE_LABEL.kanban)).toHaveProperty("checked", true);
    expect(checkbox(PROJECT_FEATURE_LABEL.wbs)).toMatchObject({ checked: false, disabled: false });
    expect(checkbox(PROJECT_FEATURE_LABEL.deliverable)).toMatchObject({ checked: false, disabled: true });
    expect(checkbox(PROJECT_FEATURE_LABEL.git)).toMatchObject({ checked: false, disabled: true });

    // IT 템플릿(폭포수·5단계): 산출물 포함 기본 기능이 자동 체크된다
    fireEvent.change(screen.getByLabelText(PROJECT_CREATE_TEXT.template), { target: { value: "itProject" } });
    expect(checkbox(PROJECT_FEATURE_LABEL.wbs)).toHaveProperty("checked", true);
    expect(checkbox(PROJECT_FEATURE_LABEL.deliverable)).toMatchObject({ checked: true, disabled: false });
    // 생성 전에 개별로 바꿀 수 있다
    fireEvent.click(checkbox(PROJECT_FEATURE_LABEL.board));
    expect(checkbox(PROJECT_FEATURE_LABEL.board)).toHaveProperty("checked", false);

    // 단계 없음으로 바꾸면 산출물은 선택 해제·비활성
    fireEvent.change(screen.getByLabelText(PROJECT_CREATE_TEXT.methodology), { target: { value: "none" } });
    expect(checkbox(PROJECT_FEATURE_LABEL.deliverable)).toMatchObject({ checked: false, disabled: true });

    fireEvent.change(screen.getByLabelText(PROJECT_CREATE_TEXT.name), { target: { value: "기능 확인" } });
    fireEvent.click(screen.getByRole("button", { name: new RegExp(PROJECT_CREATE_TEXT.submit) }));
    await screen.findByText(formatLabel(PROJECT_CREATE_TEXT.created, { name: "기능 확인" }));
    const post = calls.find(({ method, path }) => method === "POST" && path === "/api/projects");
    expect(post?.body).toMatchObject({
      template: "IT_PROJECT",
      methodology: "NONE",
      phases: [],
      features: ["WBS", "KANBAN", "MEETING", "ISSUE", "FILE"],
    });
  });

  it("코드 중복(409)이면 코드 칸에 오류를 보이고 화면에 남는다(성공 안내 없음)", async () => {
    stubFetch({
      "GET /api/projects/creation-options": () => jsonOk(CREATION_OPTIONS),
      "POST /api/projects": () => jsonFail(409, "이미 사용 중인 프로젝트 코드입니다"),
    });
    renderApp({ mode: "api", route: "/projects/new", routes: API_ROUTES });

    fireEvent.change(await screen.findByLabelText(PROJECT_CREATE_TEXT.name), { target: { value: "중복 코드" } });
    fireEvent.click(screen.getByRole("button", { name: new RegExp(PROJECT_CREATE_TEXT.submit) }));

    expect(await screen.findByText("이미 사용 중인 프로젝트 코드입니다")).toBeTruthy();
    expect(screen.getByLabelText(PROJECT_CREATE_TEXT.code).getAttribute("aria-invalid")).toBe("true");
    expect(screen.queryByText(new RegExp("프로젝트를 만들었습니다"))).toBeNull();
  });

  it("네트워크 실패면 오류를 보이고 다시 제출할 수 있다", async () => {
    let attempt = 0;
    stubFetch({
      "GET /api/projects/creation-options": () => jsonOk(CREATION_OPTIONS),
      "POST /api/projects": () => {
        attempt += 1;
        if (attempt === 1) throw new TypeError("Failed to fetch");
        return jsonOk(createdDetail("다시 시도"));
      },
      "GET /api/projects": () => jsonOk({ items: [], nextCursor: null, hasNext: false }),
    });
    renderApp({ mode: "api", route: "/projects/new", routes: API_ROUTES });

    fireEvent.change(await screen.findByLabelText(PROJECT_CREATE_TEXT.name), { target: { value: "다시 시도" } });
    const submit = screen.getByRole("button", { name: new RegExp(PROJECT_CREATE_TEXT.submit) });
    fireEvent.click(submit);
    expect(await screen.findByText(/서버에 연결하지 못했습니다/)).toBeTruthy();
    expect(submit).toHaveProperty("disabled", false);

    fireEvent.click(submit);
    expect(await screen.findByText(formatLabel(PROJECT_CREATE_TEXT.created, { name: "다시 시도" }))).toBeTruthy();
  });

  it("Esc로 닫으면 요청 없이 목록으로 돌아간다", async () => {
    const { calls } = stubFetch({
      "GET /api/projects/creation-options": () => jsonOk(CREATION_OPTIONS),
      "GET /api/projects": () => jsonOk({ items: [], nextCursor: null, hasNext: false }),
    });
    renderApp({ mode: "api", route: "/projects/new", routes: API_ROUTES });

    await screen.findByLabelText(PROJECT_CREATE_TEXT.name);
    fireEvent.keyDown(document, { key: "Escape" });
    await waitFor(() => expect(screen.queryByLabelText(PROJECT_CREATE_TEXT.name)).toBeNull());
    expect(calls.some(({ method }) => method === "POST")).toBe(false);
  });

  it("필수 입력이 비면 요청을 보내지 않는다", async () => {
    const { calls } = stubFetch({ "GET /api/projects/creation-options": () => jsonOk(CREATION_OPTIONS) });
    renderApp({ mode: "api", route: "/projects/new", routes: API_ROUTES });

    await screen.findByLabelText(PROJECT_CREATE_TEXT.name);
    fireEvent.click(screen.getByRole("button", { name: new RegExp(PROJECT_CREATE_TEXT.submit) }));
    expect(await screen.findByText(PROJECT_CREATE_TEXT.nameRequired)).toBeTruthy();
    expect(calls.some(({ method }) => method === "POST")).toBe(false);
  });

  it("생성 선택지(필수)를 받지 못하면 제출을 막고 재시도로 다시 받는다", async () => {
    let attempt = 0;
    stubFetch({
      "GET /api/projects/creation-options": () => {
        attempt += 1;
        return attempt === 1 ? jsonFail(500, "서버에서 오류가 발생했습니다") : jsonOk(CREATION_OPTIONS);
      },
    });
    renderApp({ mode: "api", route: "/projects/new", routes: API_ROUTES });

    const alert = await screen.findByRole("alert");
    expect(within(alert).getByText(PROJECT_CREATE_TEXT.optionsFailed)).toBeTruthy();
    expect(within(alert).getByText("서버에서 오류가 발생했습니다")).toBeTruthy();
    expect(screen.getByRole("button", { name: new RegExp(PROJECT_CREATE_TEXT.submit) })).toHaveProperty("disabled", true);

    fireEvent.click(within(alert).getByRole("button", { name: BUTTON_TEXT.retry }));
    expect(await screen.findByLabelText(PROJECT_CREATE_TEXT.template)).toBeTruthy();
    expect(screen.getByRole("button", { name: new RegExp(PROJECT_CREATE_TEXT.submit) })).toHaveProperty("disabled", false);
  });

  it("필수 항목을 고를 수 없으면(SW 부서 유형 비활성) 어떤 항목인지 알리고 제출을 막는다", async () => {
    stubFetch({
      "GET /api/projects/creation-options": () =>
        jsonOk({ ...CREATION_OPTIONS, departmentTypes: [{ value: "SW", enabled: false, actors: [] }] }),
    });
    renderApp({ mode: "api", route: "/projects/new", routes: API_ROUTES });

    expect(await screen.findByText(PROJECT_CREATE_TEXT.blockedTitle)).toBeTruthy();
    expect(screen.getByText(PROJECT_CREATE_TEXT.noDepartmentType)).toBeTruthy();
    expect(screen.getByRole("button", { name: new RegExp(PROJECT_CREATE_TEXT.submit) })).toHaveProperty("disabled", true);
  });

  it("코드 중복 확인: 사용 가능·사용 중·조회 실패를 구분해 보여 준다", async () => {
    let answer: () => Response = () => jsonOk({ code: "PRT-2026-001", available: true });
    stubFetch({
      "GET /api/projects/creation-options": () => jsonOk(CREATION_OPTIONS),
      "GET /api/projects/code-availability": () => answer(),
    });
    renderApp({ mode: "api", route: "/projects/new", routes: API_ROUTES });

    const check = await screen.findByRole("button", { name: PROJECT_CREATE_TEXT.checkCode });
    fireEvent.click(check);
    expect(await screen.findByText(formatLabel(PROJECT_CREATE_TEXT.codeAvailable, { code: "PRT-2026-001" }))).toBeTruthy();

    answer = () => jsonOk({ code: "PRT-2026-001", available: false });
    fireEvent.click(check);
    expect(await screen.findByText(formatLabel(PROJECT_CREATE_TEXT.codeTaken, { code: "PRT-2026-001" }))).toBeTruthy();

    answer = () => jsonFail(403, "프로젝트는 활성 일반 사용자만 생성할 수 있습니다");
    fireEvent.click(check);
    expect(await screen.findByText("프로젝트는 활성 일반 사용자만 생성할 수 있습니다")).toBeTruthy();
  });
});

describe("데모 모드 프로젝트 생성 (기존 시연 유지)", () => {
  it("샘플 부서·사용자로 단계형 생성과 멤버 초대를 그대로 하고, 서버로 요청을 보내지 않는다", async () => {
    const { fetchMock } = stubFetch({});
    renderApp({
      mode: "demo",
      route: "/projects/new",
      routes: [
        { path: "/projects/new", element: <ProjectCreatePage /> },
        { path: "/projects/:projectId", element: <CreatedDemoProject /> },
      ],
    });

    fireEvent.change(screen.getByPlaceholderText("예) 사내 업무포털 고도화"), { target: { value: "데모 시연 프로젝트" } });
    fireEvent.click(screen.getByRole("button", { name: new RegExp(BUTTON_TEXT.nextStep) }));
    fireEvent.click(await screen.findByRole("button", { name: BUTTON_TEXT.yes }));
    // 2단계(운영 방식) → 3단계(액터) → 4단계(멤버)
    fireEvent.click(screen.getByRole("button", { name: new RegExp(BUTTON_TEXT.nextStep) }));
    fireEvent.click(screen.getByRole("button", { name: new RegExp(BUTTON_TEXT.nextStep) }));
    // 샘플 사용자 목록에서 멤버를 초대한다.
    fireEvent.click(await screen.findByText("박지훈"));
    fireEvent.click(screen.getByRole("button", { name: new RegExp(BUTTON_TEXT.nextStep) }));
    fireEvent.click(await screen.findByRole("button", { name: new RegExp(BUTTON_TEXT.createProject) }));

    expect(await screen.findByText("데모 프로젝트 생성됨: 데모 시연 프로젝트")).toBeTruthy();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
