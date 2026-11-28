import { describe, expect, it } from "vitest";
import type { ApiFailure } from "@/shared/api/client";
import type { CreationOptions, ProjectActor } from "@/features/project/api/projectApi";
import { PROJECT_CREATE_TEXT } from "@/features/project/i18n/ko";
import { AUTH_TEXT } from "@/features/auth/i18n/ko";
import {
  actorsInUse,
  addMember,
  applyTemplate,
  changeMemberRole,
  changeMethodology,
  featureChoices,
  hasPhases,
  initialForm,
  interpretCreateFailure,
  memberRoleOptions,
  plannedPhases,
  removeMember,
  requiredBlockers,
  selectableFeatures,
  SERVER_DIRECTORY,
  setGateApprover,
  toCreateInput,
  toggleActor,
  toggleDepartment,
  validateCreateForm,
  type CreateMember,
} from "@/features/project/utils/serverCreate";

/** 생성 선택지(서버 응답을 바꾼 화면 모델). 서버 형식 자체는 projectApi.test.ts가 실제 BE 응답으로 검증한다 */
const options = (overrides: Partial<CreationOptions> = {}): CreationOptions => ({
  templates: [
    {
      value: "itProject",
      defaultMethodology: "waterfall",
      defaultActors: ["pm", "biz", "dev", "qa"],
      defaultFeatures: ["wbs", "kanban", "deliverable", "git"],
      defaultPhases: ["분석", "설계", "개발", "테스트", "이행"],
    },
    { value: "empty", defaultMethodology: "none", defaultActors: ["pm"], defaultFeatures: ["kanban", "board"], defaultPhases: [] },
  ],
  methodologies: [
    { value: "none", enabled: true },
    { value: "waterfall", enabled: true },
    { value: "agile", enabled: false },
  ],
  departmentTypes: [
    {
      value: "sw",
      enabled: true,
      actors: [
        { value: "pm", enabled: true, required: true },
        { value: "biz", enabled: true, required: false },
        { value: "dev", enabled: true, required: false },
        { value: "qa", enabled: false, required: false },
      ],
    },
    { value: "manufacturing", enabled: false, actors: [] },
  ],
  // BE FeatureOptionResponse(value, enabled, requiresPhases)를 화면 모델로 바꾼 값
  features: [
    { value: "wbs", enabled: true, requiresPhases: false },
    { value: "kanban", enabled: true, requiresPhases: false },
    { value: "board", enabled: true, requiresPhases: false },
    { value: "deliverable", enabled: true, requiresPhases: true },
    { value: "git", enabled: false, requiresPhases: false },
  ],
  ...overrides,
});

describe("멤버·설정 화면 초대 안내 (SCRUM-106 연결 전)", () => {
  it("생성 화면과 달리 멤버·설정의 초대는 아직 연결하지 않아 이유를 준다", () => {
    expect(SERVER_DIRECTORY.users.available).toBe(false);
    expect(SERVER_DIRECTORY.users.reason()).toContain("사용자 검색 API");
  });
});

describe("initialForm·applyTemplate", () => {
  it("첫 템플릿 기본값을 서버가 허용하는 범위로 줄여 쓴다 (비활성 액터 QA·비활성 기능 GIT 제외)", () => {
    const form = initialForm(options(), "PRT-2026-001");
    expect(form).toMatchObject({
      code: "PRT-2026-001",
      template: "itProject",
      methodology: "waterfall",
      actors: ["pm", "biz", "dev"],
      features: ["wbs", "kanban", "deliverable"],
      startDate: "",
      endDate: "",
    });
  });

  it("빈 템플릿으로 바꾸면 단계 없음과 그 기본 기능이 된다", () => {
    const form = applyTemplate(initialForm(options(), "X1"), "empty", options());
    expect(form).toMatchObject({ template: "empty", methodology: "none", actors: ["pm"], features: ["kanban", "board"] });
  });

  it("템플릿 기본 운영 방식이 비활성이면 첫 활성 운영 방식을 쓴다", () => {
    const opts = options({ methodologies: [{ value: "none", enabled: true }, { value: "waterfall", enabled: false }] });
    expect(initialForm(opts, "X1").methodology).toBe("none");
  });

  it("운영 방식을 단계 없음으로 바꾸면 단계가 필요한 기능(산출물)을 선택 해제한다", () => {
    const form = changeMethodology(initialForm(options(), "X1"), "none", options());
    expect(form.features).toEqual(["wbs", "kanban"]);
  });

  it("단계 없음 → 폭포수로 되돌려도 해제한 기능을 임의로 다시 켜지 않는다", () => {
    const none = changeMethodology(initialForm(options(), "X1"), "none", options());
    expect(changeMethodology(none, "waterfall", options()).features).toEqual(["wbs", "kanban"]);
  });

  it("단계가 없는 템플릿 기본값에 단계가 필요한 기능이 있으면 자동 체크하지 않는다", () => {
    const opts = options({
      templates: [{ value: "empty", defaultMethodology: "none", defaultActors: ["pm"], defaultFeatures: ["wbs", "deliverable"], defaultPhases: [] }],
    });
    expect(initialForm(opts, "X1").features).toEqual(["wbs"]);
  });
});

describe("단계 유무와 기능 선택 (BE ProjectFeature.selectableFor와 같은 규칙)", () => {
  it("폭포수 + 기본 단계가 있는 템플릿이면 단계 있음, 단계 없음 운영 방식이면 템플릿과 무관하게 단계 없음", () => {
    expect(plannedPhases({ template: "itProject", methodology: "waterfall" }, options())).toEqual(["분석", "설계", "개발", "테스트", "이행"]);
    expect(hasPhases({ template: "itProject", methodology: "waterfall" }, options())).toBe(true);
    expect(plannedPhases({ template: "itProject", methodology: "none" }, options())).toEqual([]);
    // 기본 단계가 없는 템플릿이면 폭포수여도 단계가 없다(서버는 단계 목록으로만 판정한다)
    expect(hasPhases({ template: "empty", methodology: "waterfall" }, options())).toBe(false);
    expect(hasPhases({ template: null, methodology: "waterfall" }, options())).toBe(false);
    expect(hasPhases({ template: "itProject", methodology: null }, options())).toBe(false);
  });

  it("단계가 없으면 requiresPhases 기능(산출물)은 고를 수 없고 WBS 등은 고를 수 있으며, enabled=false(Git)는 늘 비활성", () => {
    expect(featureChoices(options(), false)).toEqual([
      { value: "wbs", block: null },
      { value: "kanban", block: null },
      { value: "board", block: null },
      { value: "deliverable", block: "needsPhases" },
      { value: "git", block: "disabled" },
    ]);
    expect(selectableFeatures(options(), false)).toEqual(["wbs", "kanban", "board"]);
    expect(selectableFeatures(options(), true)).toEqual(["wbs", "kanban", "board", "deliverable"]);
  });

  it("서버가 기능을 하나도 주지 않으면 고를 기능이 없다(빈 기능 구성은 허용)", () => {
    expect(selectableFeatures(options({ features: [] }), true)).toEqual([]);
  });

  it("회귀: 기본 템플릿으로 시작하면 기능 체크가 0개가 되지 않는다", () => {
    expect(initialForm(options(), "X1").features.length).toBeGreaterThan(0);
  });
});

describe("requiredBlockers — 고를 수 없는 필수 항목", () => {
  it("모두 고를 수 있으면 막지 않는다", () => {
    expect(requiredBlockers(options())).toEqual([]);
  });

  it("템플릿·활성 운영 방식이 없으면 어떤 항목인지 알려 준다", () => {
    expect(requiredBlockers(options({ templates: [], methodologies: [{ value: "agile", enabled: false }] }))).toEqual([
      PROJECT_CREATE_TEXT.noTemplate,
      PROJECT_CREATE_TEXT.noMethodology,
    ]);
  });

  it("SW 부서 유형이 비활성이면 막는다", () => {
    const opts = options({ departmentTypes: [{ value: "sw", enabled: false, actors: [] }] });
    expect(requiredBlockers(opts)).toEqual([PROJECT_CREATE_TEXT.noDepartmentType]);
  });

  it("필수 PM 액터를 고를 수 없으면 막는다", () => {
    const opts = options({ departmentTypes: [{ value: "sw", enabled: true, actors: [{ value: "dev", enabled: true, required: false }] }] });
    expect(requiredBlockers(opts)).toEqual([PROJECT_CREATE_TEXT.noPmActor]);
  });
});

const member = (userId: number, actor: ProjectActor = "dev"): CreateMember => ({
  userId,
  name: `사용자${userId}`,
  departmentName: "개발팀",
  jobTitle: null,
  actor,
});
const user = (userId: number) => ({ userId, name: `사용자${userId}`, departmentName: null, jobTitle: null });

describe("주관 부서·멤버·게이트 승인자", () => {
  const base = () => initialForm(options(), "X1");

  it("주관 부서는 0~20개, 다시 누르면 해제, 21번째는 추가하지 않는다", () => {
    let form = toggleDepartment(base(), 3);
    expect(form.departmentIds).toEqual([3]);
    expect(toggleDepartment(form, 3).departmentIds).toEqual([]);
    form = { ...form, departmentIds: Array.from({ length: 20 }, (_, i) => i + 1) };
    expect(toggleDepartment(form, 99).departmentIds).toHaveLength(20);
    expect(toggleDepartment(form, 20).departmentIds).toHaveLength(19);
  });

  it("멤버 역할 선택지는 지정한 액터 중 PM을 뺀 것이고, 지정하지 않은 액터(QA 비활성·미지정)는 없다", () => {
    expect(memberRoleOptions(base(), options())).toEqual(["biz", "dev"]);
    expect(memberRoleOptions({ actors: ["pm", "dev"] }, options())).toEqual(["dev"]);
    expect(memberRoleOptions({ actors: ["pm"] }, options())).toEqual([]);
  });

  it("멤버는 첫 역할로 추가하고, 같은 사람·역할 없음·100명 초과는 추가하지 않는다", () => {
    const form = addMember(base(), user(11), options());
    expect(form.members).toEqual([{ ...user(11), actor: "biz" }]);
    expect(addMember(form, user(11), options()).members).toHaveLength(1);
    expect(addMember({ ...base(), actors: ["pm"] }, user(11), options()).members).toEqual([]);
    const full = { ...base(), members: Array.from({ length: 100 }, (_, i) => member(i + 1)) };
    expect(addMember(full, user(500), options()).members).toHaveLength(100);
  });

  it("멤버 역할은 지정한 액터 중에서만 바꾼다(PM·미지정 액터 불가)", () => {
    const form = addMember(base(), user(11), options());
    expect(changeMemberRole(form, 11, "dev", options()).members[0].actor).toBe("dev");
    expect(changeMemberRole(form, 11, "pm", options()).members[0].actor).toBe("biz");
    expect(changeMemberRole(form, 11, "qa", options()).members[0].actor).toBe("biz");
  });

  it("PM은 해제할 수 없고, 멤버 역할로 쓰는 액터는 해제를 막으며, 안 쓰는 액터는 해제·재지정된다", () => {
    const form = addMember(base(), user(11), options()); // biz 역할
    expect(toggleActor(form, "pm")).toBe(form);
    expect(toggleActor(form, "biz")).toBe(form);
    expect(actorsInUse(form)).toEqual(new Set(["biz"]));
    expect(toggleActor(form, "dev").actors).toEqual(["pm", "biz"]);
    expect(toggleActor(toggleActor(form, "dev"), "dev").actors).toEqual(["pm", "biz", "dev"]);
  });

  it("템플릿을 바꿔도 멤버가 쓰는 액터는 남긴다", () => {
    const form = changeMemberRole(addMember(base(), user(11), options()), 11, "dev", options());
    expect(applyTemplate(form, "empty", options()).actors).toEqual(["pm", "dev"]);
  });

  it("게이트 승인자는 단계가 있을 때 초대 멤버 중에서만, null이면 지정 안 함", () => {
    const form = addMember(base(), user(11), options());
    expect(setGateApprover(form, 11, options()).gateApproverUserId).toBe(11);
    expect(setGateApprover(form, 99, options()).gateApproverUserId).toBeNull();
    expect(setGateApprover({ ...form, gateApproverUserId: 11 }, null, options()).gateApproverUserId).toBeNull();
    expect(setGateApprover({ ...form, methodology: "none" }, 11, options()).gateApproverUserId).toBeNull();
  });

  it("단계가 없어지면(운영 방식·템플릿 변경) 승인자를 지우고, 승인자를 멤버에서 빼도 지운다", () => {
    const form = setGateApprover(addMember(base(), user(11), options()), 11, options());
    expect(changeMethodology(form, "none", options()).gateApproverUserId).toBeNull();
    expect(changeMethodology(form, "waterfall", options()).gateApproverUserId).toBe(11);
    expect(applyTemplate(form, "empty", options()).gateApproverUserId).toBeNull();
    expect(removeMember(form, 11)).toMatchObject({ members: [], gateApproverUserId: null });
    expect(removeMember(form, 99).gateApproverUserId).toBe(11);
  });
});

describe("validateCreateForm", () => {
  const valid = () => ({ ...initialForm(options(), "PRT-2026-001"), name: "구매 발주" });

  it("이름·코드가 있으면 통과하고 기간·주관 부서·멤버는 비워도 된다", () => {
    expect(validateCreateForm(valid(), options())).toEqual({});
  });

  it.each([
    [{ name: "  " }, "name", PROJECT_CREATE_TEXT.nameRequired],
    [{ name: "가".repeat(101) }, "name", PROJECT_CREATE_TEXT.nameTooLong],
    [{ code: "" }, "code", PROJECT_CREATE_TEXT.codeRequired],
    [{ code: "-AB" }, "code", PROJECT_CREATE_TEXT.codeFormat],
    [{ code: "A" }, "code", PROJECT_CREATE_TEXT.codeFormat],
    [{ code: "A".repeat(21) }, "code", PROJECT_CREATE_TEXT.codeFormat],
    [{ code: "AB 12" }, "code", PROJECT_CREATE_TEXT.codeFormat],
    [{ startDate: "2026-12-02", endDate: "2026-12-01" }, "period", PROJECT_CREATE_TEXT.periodInvalid],
    [{ actors: ["dev" as const] }, "actors", PROJECT_CREATE_TEXT.actorsRequired],
    [{ departmentIds: Array.from({ length: 21 }, (_, i) => i + 1) }, "departments", PROJECT_CREATE_TEXT.departmentsLimit],
    [{ members: [member(11, "qa")] }, "members", PROJECT_CREATE_TEXT.memberRoleInvalid],
    [{ members: [member(11, "pm")] }, "members", PROJECT_CREATE_TEXT.memberRoleInvalid],
    [{ members: Array.from({ length: 101 }, (_, i) => member(i + 1)) }, "members", PROJECT_CREATE_TEXT.membersLimit],
    [{ gateApproverUserId: 99 }, "approver", PROJECT_CREATE_TEXT.approverNotMember],
    [{ methodology: "none" as const, members: [member(11)], gateApproverUserId: 11 }, "approver", PROJECT_CREATE_TEXT.approverNoPhases],
  ])("%j → %s 오류", (patch, field, message) => {
    expect(validateCreateForm({ ...valid(), ...patch }, options())).toEqual({ [field]: message });
  });

  it("코드 경계값 2자·20자, 같은 날 시작·종료는 허용한다", () => {
    expect(validateCreateForm({ ...valid(), code: "A1" }, options())).toEqual({});
    expect(validateCreateForm({ ...valid(), code: `A${"1".repeat(19)}` }, options())).toEqual({});
    expect(validateCreateForm({ ...valid(), startDate: "2026-12-01", endDate: "2026-12-01" }, options())).toEqual({});
  });
});

describe("toCreateInput", () => {
  it("부서·멤버·승인자는 항상 비워 샘플 ID를 서버로 보내지 않는다", () => {
    const input = toCreateInput({ ...initialForm(options(), "PRT-2026-001"), name: "구매 발주", startDate: "2026-12-01" }, options());
    expect(input).toEqual({
      name: "구매 발주",
      code: "PRT-2026-001",
      startDate: "2026-12-01",
      endDate: null,
      departmentIds: [],
      visibility: "company",
      template: "itProject",
      methodology: "waterfall",
      departmentType: "sw",
      actors: ["pm", "biz", "dev"],
      features: ["wbs", "kanban", "deliverable"],
      members: [],
      gateApproverUserId: null,
      phases: ["분석", "설계", "개발", "테스트", "이행"],
    });
  });

  it("단계 없음 운영 방식이면 phases를 빈 배열로 보내 서버가 템플릿 단계를 넣지 않게 하고, 단계가 필요한 기능은 빼고 보낸다", () => {
    const form = { ...initialForm(options(), "X1"), name: "a", methodology: "none" as const, features: ["wbs" as const, "deliverable" as const] };
    expect(toCreateInput(form, options())).toMatchObject({ methodology: "none", phases: [], features: ["wbs"] });
  });

  it("기능을 모두 해제해도 빈 기능 구성으로 만들 수 있다", () => {
    expect(toCreateInput({ ...initialForm(options(), "X1"), name: "a", features: [] }, options())?.features).toEqual([]);
  });

  it("주관 부서·멤버(userId·actor만)·승인자를 BE CreateProjectRequest 형식으로 담는다", () => {
    const form = setGateApprover(addMember({ ...initialForm(options(), "X1"), name: "a", departmentIds: [3, 4] }, user(11), options()), 11, options());
    expect(toCreateInput(form, options())).toMatchObject({
      departmentIds: [3, 4],
      members: [{ userId: 11, actor: "biz" }],
      gateApproverUserId: 11,
    });
  });

  it("단계가 없거나 승인자가 멤버가 아니면 승인자를 보내지 않는다", () => {
    const form = { ...addMember({ ...initialForm(options(), "X1"), name: "a" }, user(11), options()), gateApproverUserId: 11 };
    expect(toCreateInput({ ...form, methodology: "none" }, options())?.gateApproverUserId).toBeNull();
    expect(toCreateInput({ ...form, gateApproverUserId: 99 }, options())?.gateApproverUserId).toBeNull();
  });

  it("템플릿·운영 방식을 고르지 못했으면 요청을 만들지 않는다", () => {
    const opts = options({ templates: [], methodologies: [] });
    expect(toCreateInput({ ...initialForm(opts, "X1"), name: "a" }, opts)).toBeNull();
  });
});

describe("interpretCreateFailure", () => {
  const http = (status: number, message: string | null = null): ApiFailure => ({ kind: "http", status, code: null, message });

  it("409는 코드 중복이라 코드 칸에 붙인다", () => {
    expect(interpretCreateFailure(http(409, "이미 사용 중인 프로젝트 코드입니다"))).toEqual({ message: "이미 사용 중인 프로젝트 코드입니다", field: "code" });
    expect(interpretCreateFailure(http(409))).toEqual({ message: PROJECT_CREATE_TEXT.codeTakenGeneric, field: "code" });
  });

  it("403은 생성 권한 없음 안내", () => {
    expect(interpretCreateFailure(http(403, "x"))).toEqual({ message: PROJECT_CREATE_TEXT.forbidden, field: null });
  });

  it("400 멤버 역할·승인자·주관 부서 거부는 해당 칸에, 그 밖의 400은 칸 없이 서버 메시지", () => {
    expect(interpretCreateFailure(http(400, "주관 부서로 지정할 수 없는 부서입니다"))).toEqual({ message: "주관 부서로 지정할 수 없는 부서입니다", field: "departments" });
    expect(interpretCreateFailure(http(400, "같은 주관 부서를 두 번 지정할 수 없습니다")).field).toBe("departments");
    expect(interpretCreateFailure(http(400, "프로젝트에 지정하지 않은 액터는 멤버 역할로 선택할 수 없습니다")).field).toBe("members");
    expect(interpretCreateFailure(http(400, "프로젝트 멤버로 초대할 수 없는 사용자입니다")).field).toBe("members");
    expect(interpretCreateFailure(http(400, "같은 사용자를 멤버로 두 번 초대할 수 없습니다")).field).toBe("members");
    expect(interpretCreateFailure(http(400, "생성자는 PM으로 자동 등록되어 멤버로 다시 초대할 수 없습니다")).field).toBe("members");
    expect(interpretCreateFailure(http(400, "게이트 승인자는 초대한 멤버 중에서만 지정할 수 있습니다")).field).toBe("approver");
    expect(interpretCreateFailure(http(400, "PM은 게이트 승인자로 지정할 수 없습니다")).field).toBe("approver");
    expect(interpretCreateFailure(http(400, "단계가 없는 운영 방식에서는 게이트 승인자를 지정할 수 없습니다")).field).toBe("approver");
    expect(interpretCreateFailure(http(400, "선택할 수 없는 액터입니다"))).toEqual({ message: "선택할 수 없는 액터입니다", field: null });
  });

  it("메시지가 없으면 공통 문구", () => {
    expect(interpretCreateFailure(http(400))).toEqual({ message: AUTH_TEXT.unknown, field: null });
    expect(interpretCreateFailure(http(500))).toEqual({ message: AUTH_TEXT.unknown, field: null });
  });

  it("네트워크·시간 초과를 구분한다", () => {
    expect(interpretCreateFailure({ kind: "network" }).message).toBe(AUTH_TEXT.network);
    expect(interpretCreateFailure({ kind: "timeout" }).message).toBe(AUTH_TEXT.timeout);
  });
});
