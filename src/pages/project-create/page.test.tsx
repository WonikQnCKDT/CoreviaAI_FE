// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, screen, waitFor, within } from "@testing-library/react";
import { useParams } from "react-router-dom";
import ProjectCreatePage from "@/pages/project-create/page";
import ProjectsPage from "@/pages/projects/page";
import { useDemoStore } from "@/stores/DemoStore";
import { PROJECT_CREATE_TEXT, PROJECT_FEATURE_LABEL } from "@/features/project/i18n/ko";
import { BUTTON_TEXT } from "@/shared/i18n/catalog/button";
import { formatLabel } from "@/shared/i18n/store";
import { jsonFail, jsonOk, renderApp, stubFetch } from "@/test/appHarness";
import { creationOptionsDto, departmentDto, userSearchDto } from "@/test/projectFixtures";
import { resetCodeCache } from "@/shared/codes/codeStore";

/** 실제 BE 응답 형식(기본 시드) */
const CREATION_OPTIONS = creationOptionsDto();
const DEPARTMENTS = [departmentDto(1, "본부"), departmentDto(2, "개발팀", 1), departmentDto(3, "구매팀", 1)];
const RISK_LEVEL_CODES = {
  groupCode: "RISK_LEVEL",
  labelKey: "codeGroup.RISK_LEVEL",
  codes: [
    { code: "NORMAL", labelKey: "code.RISK_LEVEL.NORMAL", sortOrder: 1 },
    { code: "CAUTION", labelKey: "code.RISK_LEVEL.CAUTION", sortOrder: 2 },
    { code: "DANGER", labelKey: "code.RISK_LEVEL.DANGER", sortOrder: 3 },
  ],
};

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

const goStep = (name: string) => fireEvent.click(screen.getByRole("button", { name: new RegExp(name) }));

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
  // jsdom에는 스크롤 API가 없다. 데모·서버 단계형 화면은 단계가 바뀔 때 맨 위로 스크롤한다.
  if (!Element.prototype.scrollTo) Element.prototype.scrollTo = () => undefined;
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  resetCodeCache();
});

describe("api 모드 프로젝트 생성 (6단계 위자드)", () => {
  it("명세 순서 6단계(기본 정보→템플릿·운영 방식→액터→기능 구성→멤버→게이트 승인자)로 나뉘고 서버 조회와 연결된다", async () => {
    stubFetch({ "GET /api/projects/creation-options": () => jsonOk(CREATION_OPTIONS), "GET /api/departments": () => jsonOk(DEPARTMENTS) });
    renderApp({ mode: "api", route: "/projects/new", routes: API_ROUTES });

    // 1단계: 기본 정보 + 주관 부서
    expect(await screen.findByRole("checkbox", { name: "본부 > 개발팀" })).toBeTruthy();
    expect(screen.queryByLabelText(PROJECT_CREATE_TEXT.template)).toBeNull();

    // 2단계: 템플릿·운영 방식 (서버가 준 첫 템플릿: 빈 템플릿)
    goStep("템플릿·운영 방식");
    expect(screen.getByLabelText(PROJECT_CREATE_TEXT.template)).toHaveProperty("value", "empty");
    expect(screen.getByLabelText(PROJECT_CREATE_TEXT.methodology)).toHaveProperty("value", "none");

    // 5단계: 멤버
    goStep("멤버");
    expect(screen.getByText(formatLabel(PROJECT_CREATE_TEXT.pmSelf, { name: "홍길동" }))).toBeTruthy();
    expect(screen.getByRole("combobox", { name: PROJECT_CREATE_TEXT.membersSearch })).toBeTruthy();
    // 데모 샘플 사용자(박지훈 등)는 api 모드 화면에 나오지 않는다.
    expect(screen.queryByText("박지훈")).toBeNull();

    // 6단계: 게이트 승인자 (빈 템플릿은 단계가 없어 승인자를 지정하지 않는다)
    goStep("게이트 승인자");
    expect(screen.getByText(PROJECT_CREATE_TEXT.approverNoPhases)).toBeTruthy();
  });

  it("서버가 성공을 돌려준 뒤에만 목록으로 가서 성공 안내를 띄우고 서버 목록을 다시 받는다", async () => {
    const { calls, unexpected } = stubFetch({
      "GET /api/projects/creation-options": () => jsonOk(CREATION_OPTIONS),
      "GET /api/departments": () => jsonOk(DEPARTMENTS),
      "POST /api/projects": ({ body }) => jsonOk(createdDetail((body as { name: string }).name)),
      "GET /api/projects": () => jsonOk({ items: [createdDetail("구매 발주 시스템")], nextCursor: null, hasNext: false }),
      // 목록 응답에는 진척률이 없어 목록 화면이 상세를 불러 채운다
      "GET /api/projects/77": () => jsonOk(createdDetail("구매 발주 시스템")),
      "GET /api/codes/RISK_LEVEL": () => jsonOk(RISK_LEVEL_CODES),
    });
    renderApp({ mode: "api", route: "/projects/new", routes: API_ROUTES });

    fireEvent.change(await screen.findByLabelText(PROJECT_CREATE_TEXT.name), { target: { value: "구매 발주 시스템" } });
    goStep("게이트 승인자");
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
      "GET /api/departments": () => jsonOk(DEPARTMENTS),
      "POST /api/projects": ({ body }) => jsonOk(createdDetail((body as { name: string }).name)),
      "GET /api/projects": () => jsonOk({ items: [], nextCursor: null, hasNext: false }),
    });
    renderApp({ mode: "api", route: "/projects/new", routes: API_ROUTES });

    const checkbox = (name: string) => screen.getByRole("checkbox", { name: new RegExp(`^${name}`) });
    fireEvent.change(await screen.findByLabelText(PROJECT_CREATE_TEXT.name), { target: { value: "기능 확인" } });

    // 4단계(기능 구성) — 빈 템플릿(단계 없음): 기본 기능 체크, 산출물은 단계 필요로 비활성, Git은 준비 중으로 비활성
    goStep("기능 구성");
    expect(checkbox(PROJECT_FEATURE_LABEL.kanban)).toHaveProperty("checked", true);
    expect(checkbox(PROJECT_FEATURE_LABEL.wbs)).toMatchObject({ checked: false, disabled: false });
    expect(checkbox(PROJECT_FEATURE_LABEL.deliverable)).toMatchObject({ checked: false, disabled: true });
    expect(checkbox(PROJECT_FEATURE_LABEL.git)).toMatchObject({ checked: false, disabled: true });

    // 2단계에서 IT 템플릿(폭포수·5단계)으로 변경 → 4단계에서 산출물 포함 기본 기능 자동 체크
    goStep("템플릿·운영 방식");
    fireEvent.change(screen.getByLabelText(PROJECT_CREATE_TEXT.template), { target: { value: "itProject" } });
    goStep("기능 구성");
    expect(checkbox(PROJECT_FEATURE_LABEL.wbs)).toHaveProperty("checked", true);
    expect(checkbox(PROJECT_FEATURE_LABEL.deliverable)).toMatchObject({ checked: true, disabled: false });
    // 생성 전에 개별로 바꿀 수 있다
    fireEvent.click(checkbox(PROJECT_FEATURE_LABEL.board));
    expect(checkbox(PROJECT_FEATURE_LABEL.board)).toHaveProperty("checked", false);

    // 2단계에서 단계 없음으로 바꾸면 4단계에서 산출물은 선택 해제·비활성
    goStep("템플릿·운영 방식");
    fireEvent.change(screen.getByLabelText(PROJECT_CREATE_TEXT.methodology), { target: { value: "none" } });
    goStep("기능 구성");
    expect(checkbox(PROJECT_FEATURE_LABEL.deliverable)).toMatchObject({ checked: false, disabled: true });

    goStep("게이트 승인자");
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

  it("주관 부서·멤버·게이트 승인자를 단계별로 골라 BE 형식으로 보낸다(역할은 지정 액터 중 PM 제외, 승인자는 단계 있을 때 멤버 중)", async () => {
    const { calls, unexpected } = stubFetch({
      "GET /api/projects/creation-options": () => jsonOk(CREATION_OPTIONS),
      "GET /api/departments": () => jsonOk(DEPARTMENTS),
      "GET /api/users/search": () => jsonOk([userSearchDto(11, "김철수", "개발팀", "백엔드"), userSearchDto(12, "김철민", null)]),
      "POST /api/projects": ({ body }) => jsonOk(createdDetail((body as { name: string }).name)),
      "GET /api/projects": () => jsonOk({ items: [], nextCursor: null, hasNext: false }),
      "GET /api/codes/RISK_LEVEL": () => jsonOk(RISK_LEVEL_CODES),
    });
    renderApp({ mode: "api", route: "/projects/new", routes: API_ROUTES });

    // 1단계: 기본 정보 + 주관 부서
    fireEvent.change(await screen.findByLabelText(PROJECT_CREATE_TEXT.name), { target: { value: "연결 확인" } });
    fireEvent.click(await screen.findByRole("checkbox", { name: "본부 > 개발팀" }));
    fireEvent.click(screen.getByRole("checkbox", { name: "본부" }));

    // 2단계: IT 템플릿 선택
    fireEvent.click(screen.getByRole("button", { name: /다음/ }));
    fireEvent.change(screen.getByLabelText(PROJECT_CREATE_TEXT.template), { target: { value: "itProject" } });

    // 3단계: 액터 — QA 해제
    fireEvent.click(screen.getByRole("button", { name: /다음/ }));
    fireEvent.click(screen.getByRole("checkbox", { name: "QA" }));

    // 4단계 → 5단계: 멤버 검색 및 초대
    fireEvent.click(screen.getByRole("button", { name: /다음/ }));
    fireEvent.click(screen.getByRole("button", { name: /다음/ }));
    const search = screen.getByRole("combobox", { name: PROJECT_CREATE_TEXT.membersSearch });
    fireEvent.focus(search);
    fireEvent.change(search, { target: { value: "김철" } });
    fireEvent.click(await screen.findByRole("option", { name: /김철수/ }));

    const role = screen.getByRole("combobox", { name: formatLabel(PROJECT_CREATE_TEXT.memberRole, { name: "김철수" }) });
    expect(within(role).getAllByRole("option").map((option) => option.textContent)).toEqual(["현업 담당자", "개발자"]);
    fireEvent.change(role, { target: { value: "dev" } });

    // 3단계로 돌아가 확인: 멤버 역할로 쓰는 액터는 해제할 수 없고, PM도 해제할 수 없다
    goStep("액터");
    expect(screen.getByRole("checkbox", { name: "개발자" })).toMatchObject({ checked: true, disabled: true });
    expect(screen.getByRole("checkbox", { name: "PM" })).toMatchObject({ checked: true, disabled: true });

    // 6단계: 게이트 승인자 (초대 멤버 중에서만)
    goStep("게이트 승인자");
    const approver = screen.getByLabelText(PROJECT_CREATE_TEXT.approverLabel);
    expect(within(approver).getAllByRole("option").map((option) => option.textContent)).toEqual([PROJECT_CREATE_TEXT.approverNone, "김철수"]);
    fireEvent.change(approver, { target: { value: "11" } });

    // 2단계에서 단계 없음으로 바꾸면 6단계에서 승인자 지정 불가·해제, 폭포수로 되돌리면 다시 고른다
    goStep("템플릿·운영 방식");
    fireEvent.change(screen.getByLabelText(PROJECT_CREATE_TEXT.methodology), { target: { value: "none" } });
    goStep("게이트 승인자");
    expect(screen.queryByLabelText(PROJECT_CREATE_TEXT.approverLabel)).toBeNull();
    expect(screen.getByText(PROJECT_CREATE_TEXT.approverNoPhases)).toBeTruthy();

    goStep("템플릿·운영 방식");
    fireEvent.change(screen.getByLabelText(PROJECT_CREATE_TEXT.methodology), { target: { value: "waterfall" } });
    goStep("게이트 승인자");
    expect(screen.getByLabelText(PROJECT_CREATE_TEXT.approverLabel)).toHaveProperty("value", "");
    fireEvent.change(screen.getByLabelText(PROJECT_CREATE_TEXT.approverLabel), { target: { value: "11" } });

    fireEvent.click(screen.getByRole("button", { name: new RegExp(PROJECT_CREATE_TEXT.submit) }));
    await screen.findByText(formatLabel(PROJECT_CREATE_TEXT.created, { name: "연결 확인" }));

    const post = calls.find(({ method, path }) => method === "POST" && path === "/api/projects");
    expect(post?.body).toMatchObject({
      departmentIds: [2, 1],
      actors: ["PM", "BUSINESS_OWNER", "DEVELOPER"],
      members: [{ userId: 11, actor: "DEVELOPER" }],
      gateApproverUserId: 11,
      phases: ["분석", "설계", "개발", "테스트", "이행"],
    });
    expect(calls.find(({ path }) => path.startsWith("/api/users/search"))?.path).toBe("/api/users/search?keyword=%EA%B9%80%EC%B2%A0&size=20");
    expect(unexpected).toEqual([]);
  });

  it("멤버를 제외하면 승인자도 해제되고, PM 외 액터가 없으면 멤버 검색을 막는다", async () => {
    stubFetch({
      "GET /api/projects/creation-options": () => jsonOk(CREATION_OPTIONS),
      "GET /api/departments": () => jsonOk([]),
      "GET /api/users/search": () => jsonOk([userSearchDto(11, "김철수")]),
    });
    renderApp({ mode: "api", route: "/projects/new", routes: API_ROUTES });

    expect(await screen.findByText(PROJECT_CREATE_TEXT.departmentsEmpty)).toBeTruthy();

    // 빈 템플릿은 PM만 지정 → 5단계 멤버 검색 불가
    goStep("멤버");
    const search = screen.getByRole("combobox", { name: PROJECT_CREATE_TEXT.membersSearch });
    expect(search).toHaveProperty("disabled", true);
    expect(screen.getByText(PROJECT_CREATE_TEXT.membersNeedActor)).toBeTruthy();

    goStep("템플릿·운영 방식");
    fireEvent.change(screen.getByLabelText(PROJECT_CREATE_TEXT.template), { target: { value: "itProject" } });
    goStep("멤버");
    const enabledSearch = screen.getByRole("combobox", { name: PROJECT_CREATE_TEXT.membersSearch });
    fireEvent.focus(enabledSearch);
    fireEvent.change(enabledSearch, { target: { value: "김철" } });
    fireEvent.click(await screen.findByRole("option", { name: /김철수/ }));

    goStep("게이트 승인자");
    fireEvent.change(screen.getByLabelText(PROJECT_CREATE_TEXT.approverLabel), { target: { value: "11" } });

    goStep("멤버");
    fireEvent.click(screen.getByRole("button", { name: formatLabel(PROJECT_CREATE_TEXT.removeMember, { name: "김철수" }) }));
    expect(screen.getByText(PROJECT_CREATE_TEXT.membersEmpty)).toBeTruthy();

    goStep("게이트 승인자");
    expect(screen.queryByLabelText(PROJECT_CREATE_TEXT.approverLabel)).toBeNull();
    expect(screen.getByText(PROJECT_CREATE_TEXT.approverNoMembers)).toBeTruthy();
  });

  it("서버가 승인자·멤버 규칙으로 거부(400)하면 해당 단계로 자동 이동해 서버 메시지를 붙인다", async () => {
    stubFetch({
      "GET /api/projects/creation-options": () => jsonOk(CREATION_OPTIONS),
      "GET /api/departments": () => jsonOk(DEPARTMENTS),
      "POST /api/projects": () => jsonFail(400, "프로젝트에 지정하지 않은 액터는 멤버 역할로 선택할 수 없습니다"),
    });
    renderApp({ mode: "api", route: "/projects/new", routes: API_ROUTES });

    fireEvent.change(await screen.findByLabelText(PROJECT_CREATE_TEXT.name), { target: { value: "거부 확인" } });
    goStep("게이트 승인자");
    fireEvent.click(screen.getByRole("button", { name: new RegExp(PROJECT_CREATE_TEXT.submit) }));
    const message = await screen.findByText("프로젝트에 지정하지 않은 액터는 멤버 역할로 선택할 수 없습니다");
    expect(message.id).toBe("server-create-members-error");
  });

  it("부서 목록을 받지 못해도(선택 항목) 다시 시도할 수 있고 부서 없이 만들 수 있다", async () => {
    let attempt = 0;
    const { calls } = stubFetch({
      "GET /api/projects/creation-options": () => jsonOk(CREATION_OPTIONS),
      "GET /api/departments": () => {
        attempt += 1;
        return attempt === 1 ? jsonFail(500, "서버에서 오류가 발생했습니다") : jsonOk(DEPARTMENTS);
      },
      "POST /api/projects": ({ body }) => jsonOk(createdDetail((body as { name: string }).name)),
      "GET /api/projects": () => jsonOk({ items: [], nextCursor: null, hasNext: false }),
    });
    renderApp({ mode: "api", route: "/projects/new", routes: API_ROUTES });

    expect(await screen.findByText(new RegExp(PROJECT_CREATE_TEXT.departmentsFailed))).toBeTruthy();
    expect(screen.getByRole("button", { name: /다음/ })).toHaveProperty("disabled", false);
    fireEvent.click(screen.getByRole("button", { name: BUTTON_TEXT.retry }));
    expect(await screen.findByRole("checkbox", { name: "본부 > 구매팀" })).toBeTruthy();

    fireEvent.change(screen.getByLabelText(PROJECT_CREATE_TEXT.name), { target: { value: "부서 없음" } });
    goStep("게이트 승인자");
    fireEvent.click(screen.getByRole("button", { name: new RegExp(PROJECT_CREATE_TEXT.submit) }));
    await screen.findByText(formatLabel(PROJECT_CREATE_TEXT.created, { name: "부서 없음" }));
    expect(calls.find(({ method, path }) => method === "POST" && path === "/api/projects")?.body).toMatchObject({ departmentIds: [], members: [] });
  });

  it("코드 중복(409)이면 1단계(기본 정보)로 자동 이동해 코드 칸에 오류를 보이고 화면에 남는다", async () => {
    stubFetch({
      "GET /api/projects/creation-options": () => jsonOk(CREATION_OPTIONS),
      "GET /api/departments": () => jsonOk(DEPARTMENTS),
      "POST /api/projects": () => jsonFail(409, "이미 사용 중인 프로젝트 코드입니다"),
    });
    renderApp({ mode: "api", route: "/projects/new", routes: API_ROUTES });

    fireEvent.change(await screen.findByLabelText(PROJECT_CREATE_TEXT.name), { target: { value: "중복 코드" } });
    goStep("게이트 승인자");
    fireEvent.click(screen.getByRole("button", { name: new RegExp(PROJECT_CREATE_TEXT.submit) }));

    expect(await screen.findByText("이미 사용 중인 프로젝트 코드입니다")).toBeTruthy();
    expect(screen.getByLabelText(PROJECT_CREATE_TEXT.code).getAttribute("aria-invalid")).toBe("true");
    expect(screen.queryByText(new RegExp("프로젝트를 만들었습니다"))).toBeNull();
  });

  it("네트워크 실패면 오류를 보이고 다시 제출할 수 있다", async () => {
    let attempt = 0;
    stubFetch({
      "GET /api/projects/creation-options": () => jsonOk(CREATION_OPTIONS),
      "GET /api/departments": () => jsonOk(DEPARTMENTS),
      "POST /api/projects": () => {
        attempt += 1;
        if (attempt === 1) throw new TypeError("Failed to fetch");
        return jsonOk(createdDetail("다시 시도"));
      },
      "GET /api/projects": () => jsonOk({ items: [], nextCursor: null, hasNext: false }),
    });
    renderApp({ mode: "api", route: "/projects/new", routes: API_ROUTES });

    fireEvent.change(await screen.findByLabelText(PROJECT_CREATE_TEXT.name), { target: { value: "다시 시도" } });
    goStep("게이트 승인자");
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
      "GET /api/departments": () => jsonOk(DEPARTMENTS),
      "GET /api/projects": () => jsonOk({ items: [], nextCursor: null, hasNext: false }),
    });
    renderApp({ mode: "api", route: "/projects/new", routes: API_ROUTES });

    await screen.findByLabelText(PROJECT_CREATE_TEXT.name);
    fireEvent.keyDown(document, { key: "Escape" });
    await waitFor(() => expect(screen.queryByLabelText(PROJECT_CREATE_TEXT.name)).toBeNull());
    expect(calls.some(({ method }) => method === "POST")).toBe(false);
  });

  it("1단계 필수 입력이 비면 다음 단계로 넘어가지 않고, 마지막 단계 제출 시에도 1단계로 돌려보낸다", async () => {
    const { calls } = stubFetch({ "GET /api/projects/creation-options": () => jsonOk(CREATION_OPTIONS), "GET /api/departments": () => jsonOk(DEPARTMENTS) });
    renderApp({ mode: "api", route: "/projects/new", routes: API_ROUTES });

    await screen.findByLabelText(PROJECT_CREATE_TEXT.name);
    fireEvent.click(screen.getByRole("button", { name: /다음/ }));
    expect(await screen.findByText(PROJECT_CREATE_TEXT.nameRequired)).toBeTruthy();

    goStep("게이트 승인자");
    fireEvent.click(screen.getByRole("button", { name: new RegExp(PROJECT_CREATE_TEXT.submit) }));
    expect(await screen.findByLabelText(PROJECT_CREATE_TEXT.name)).toBeTruthy();
    expect(calls.some(({ method }) => method === "POST")).toBe(false);
  });

  it("생성 선택지(필수)를 받지 못하면 진행을 막고 재시도로 다시 받는다", async () => {
    let attempt = 0;
    stubFetch({
      "GET /api/projects/creation-options": () => {
        attempt += 1;
        return attempt === 1 ? jsonFail(500, "서버에서 오류가 발생했습니다") : jsonOk(CREATION_OPTIONS);
      },
      "GET /api/departments": () => jsonOk(DEPARTMENTS),
    });
    renderApp({ mode: "api", route: "/projects/new", routes: API_ROUTES });

    const alert = await screen.findByRole("alert");
    expect(within(alert).getByText(PROJECT_CREATE_TEXT.optionsFailed)).toBeTruthy();
    expect(within(alert).getByText("서버에서 오류가 발생했습니다")).toBeTruthy();
    expect(screen.getByRole("button", { name: /다음/ })).toHaveProperty("disabled", true);

    fireEvent.click(within(alert).getByRole("button", { name: BUTTON_TEXT.retry }));
    expect(await screen.findByLabelText(PROJECT_CREATE_TEXT.name)).toBeTruthy();
    expect(screen.getByRole("button", { name: /다음/ })).toHaveProperty("disabled", false);
  });

  it("필수 항목을 고를 수 없으면(SW 부서 유형 비활성) 어떤 항목인지 알리고 진행을 막는다", async () => {
    stubFetch({
      "GET /api/projects/creation-options": () =>
        jsonOk({ ...CREATION_OPTIONS, departmentTypes: [{ value: "SW", enabled: false, actors: [] }] }),
      "GET /api/departments": () => jsonOk(DEPARTMENTS),
    });
    renderApp({ mode: "api", route: "/projects/new", routes: API_ROUTES });

    expect(await screen.findByText(PROJECT_CREATE_TEXT.blockedTitle)).toBeTruthy();
    expect(screen.getByText(PROJECT_CREATE_TEXT.noDepartmentType)).toBeTruthy();
    expect(screen.getByRole("button", { name: /다음/ })).toHaveProperty("disabled", true);
  });

  it("코드 중복 확인: 사용 가능·사용 중·조회 실패를 구분해 보여 준다", async () => {
    let answer: () => Response = () => jsonOk({ code: "PRT-2026-001", available: true });
    stubFetch({
      "GET /api/projects/creation-options": () => jsonOk(CREATION_OPTIONS),
      "GET /api/departments": () => jsonOk(DEPARTMENTS),
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
