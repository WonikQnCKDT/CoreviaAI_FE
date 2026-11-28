import { describe, expect, it } from "vitest";
import type { ApiFailure } from "@/shared/api/client";
import type { CreationOptions } from "@/features/project/api/projectApi";
import { PROJECT_CREATE_TEXT } from "@/features/project/i18n/ko";
import { AUTH_TEXT } from "@/features/auth/i18n/ko";
import {
  applyTemplate,
  changeMethodology,
  initialForm,
  interpretCreateFailure,
  requiredBlockers,
  SERVER_DIRECTORY,
  toCreateInput,
  validateCreateForm,
} from "@/features/project/utils/serverCreate";

/** 03 v9 생성 선택지(서버 응답을 바꾼 화면 모델) */
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
  features: [
    { value: "wbs", enabled: true, methodologies: ["none", "waterfall"] },
    { value: "kanban", enabled: true, methodologies: ["none", "waterfall"] },
    { value: "board", enabled: true, methodologies: ["none", "waterfall"] },
    { value: "deliverable", enabled: true, methodologies: ["waterfall"] },
    { value: "git", enabled: false, methodologies: [] },
  ],
  ...overrides,
});

describe("서버 조회 API 가용성", () => {
  it("일반 사용자용 부서·사용자 조회 API가 없어 고를 수 없고, 이유를 준다", () => {
    expect(SERVER_DIRECTORY.departments.available).toBe(false);
    expect(SERVER_DIRECTORY.users.available).toBe(false);
    expect(SERVER_DIRECTORY.departments.reason()).toContain("부서 조회 API");
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

  it("운영 방식을 단계 없음으로 바꾸면 폭포수 전용 기능(산출물)을 뺀다", () => {
    const form = changeMethodology(initialForm(options(), "X1"), "none", options());
    expect(form.features).toEqual(["wbs", "kanban"]);
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

describe("validateCreateForm", () => {
  const valid = () => ({ ...initialForm(options(), "PRT-2026-001"), name: "구매 발주" });

  it("이름·코드가 있으면 통과하고 기간은 비워도 된다", () => {
    expect(validateCreateForm(valid())).toEqual({});
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
  ])("%j → %s 오류", (patch, field, message) => {
    expect(validateCreateForm({ ...valid(), ...patch })).toEqual({ [field]: message });
  });

  it("코드 경계값 2자·20자, 같은 날 시작·종료는 허용한다", () => {
    expect(validateCreateForm({ ...valid(), code: "A1" })).toEqual({});
    expect(validateCreateForm({ ...valid(), code: `A${"1".repeat(19)}` })).toEqual({});
    expect(validateCreateForm({ ...valid(), startDate: "2026-12-01", endDate: "2026-12-01" })).toEqual({});
  });
});

describe("toCreateInput", () => {
  it("부서·멤버·승인자는 항상 비워 샘플 ID를 서버로 보내지 않는다", () => {
    const input = toCreateInput({ ...initialForm(options(), "PRT-2026-001"), name: "구매 발주", startDate: "2026-12-01" });
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
    });
  });

  it("템플릿·운영 방식을 고르지 못했으면 요청을 만들지 않는다", () => {
    expect(toCreateInput({ ...initialForm(options({ templates: [], methodologies: [] }), "X1"), name: "a" })).toBeNull();
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

  it("400은 서버 검증 메시지, 메시지가 없으면 공통 문구", () => {
    expect(interpretCreateFailure(http(400, "주관 부서로 지정할 수 없는 부서입니다"))).toEqual({ message: "주관 부서로 지정할 수 없는 부서입니다", field: null });
    expect(interpretCreateFailure(http(500))).toEqual({ message: AUTH_TEXT.unknown, field: null });
  });

  it("네트워크·시간 초과를 구분한다", () => {
    expect(interpretCreateFailure({ kind: "network" }).message).toBe(AUTH_TEXT.network);
    expect(interpretCreateFailure({ kind: "timeout" }).message).toBe(AUTH_TEXT.timeout);
  });
});
