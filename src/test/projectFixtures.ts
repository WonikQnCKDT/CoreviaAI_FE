/**
 * 실제 BE 응답 형식의 프로젝트 테스트 데이터(테스트 전용).
 * BE record(CreationOptionsResponse·TemplateOptionResponse·FeatureOptionResponse 등)와 기본 시드(ProjectTemplate·ProjectFeature·
 * Methodology·DepartmentType·ProjectActor enum, project_templates 시드 — 템플릿은 id 오름차순이라 EMPTY가 먼저)를 그대로 옮겼다. 목 데이터와 실제 계약이 어긋나 생긴 결함(SCRUM-98)을 막기 위해
 * 서버 형식 목 데이터는 여기서만 만든다.
 */

/** GET /api/projects/creation-options 응답(response) — 기본 시드 그대로 */
export const creationOptionsDto = () => ({
  templates: [
    {
      value: "EMPTY",
      name: "빈 템플릿",
      defaultMethodology: "NONE",
      defaultDepartmentType: null,
      defaultPhases: [],
      defaultActors: ["PM"],
      defaultFeatures: ["KANBAN", "BOARD", "MEETING", "ISSUE", "FILE"],
      requiredDeliverables: [],
    },
    {
      value: "IT_PROJECT",
      name: "IT 프로젝트 템플릿",
      defaultMethodology: "WATERFALL",
      defaultDepartmentType: "SW",
      defaultPhases: ["분석", "설계", "개발", "테스트", "이행"],
      defaultActors: ["PM", "BUSINESS_OWNER", "DEVELOPER", "QA"],
      defaultFeatures: ["WBS", "KANBAN", "BOARD", "MEETING", "DELIVERABLE", "ISSUE", "FILE"],
      requiredDeliverables: [],
    },
  ],
  methodologies: [
    { value: "NONE", enabled: true },
    { value: "WATERFALL", enabled: true },
    { value: "AGILE", enabled: false },
  ],
  departmentTypes: [
    {
      value: "SW",
      enabled: true,
      actors: [
        { value: "PM", enabled: true, required: true },
        { value: "BUSINESS_OWNER", enabled: true, required: false },
        { value: "DEVELOPER", enabled: true, required: false },
        { value: "QA", enabled: true, required: false },
      ],
    },
    {
      value: "MANUFACTURING",
      enabled: false,
      actors: [
        { value: "PM", enabled: false, required: true },
        { value: "DEPT_STAFF", enabled: false, required: false },
        { value: "CUSTOMER_LIAISON", enabled: false, required: false },
      ],
    },
  ],
  features: [
    { value: "WBS", enabled: true, requiresPhases: false },
    { value: "KANBAN", enabled: true, requiresPhases: false },
    { value: "BOARD", enabled: true, requiresPhases: false },
    { value: "MEETING", enabled: true, requiresPhases: false },
    { value: "DELIVERABLE", enabled: true, requiresPhases: true },
    { value: "ISSUE", enabled: true, requiresPhases: false },
    { value: "FILE", enabled: true, requiresPhases: false },
    { value: "GIT", enabled: false, requiresPhases: false },
  ],
});

/** GET /api/departments 응답 항목(BE DepartmentResponse: id, parentId, name) */
export const departmentDto = (id: number, name: string, parentId: number | null = null) => ({ id, parentId, name });

/** GET /api/users/search 응답 항목(BE UserSearchResponse: id, name, departmentName, jobTitle — 이 4개뿐) */
export const userSearchDto = (id: number, name: string, departmentName: string | null = "개발팀", jobTitle: string | null = null) => ({
  id,
  name,
  departmentName,
  jobTitle,
});
