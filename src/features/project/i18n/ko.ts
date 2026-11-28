import { defineLabels } from "@/shared/i18n/defineLabels";

/** api 모드 프로젝트 생성 화면 문구 (03. 프로젝트 API, FR-PRJ-01). {name}·{code} 등은 FE가 값을 넣는 자리 */
export const PROJECT_CREATE_TEXT = defineLabels("project.create", {
  title: "새 프로젝트",
  description: "입력한 내용으로 서버에 프로젝트를 만듭니다. 만든 사람이 첫 PM이 됩니다.",
  loadingOptions: "생성 선택지를 불러오는 중입니다",
  optionsFailed: "생성 선택지(템플릿·운영 방식·액터·기능)를 불러오지 못했습니다. 필수 항목이라 이 정보 없이는 만들 수 없습니다.",
  basicSection: "기본 정보",
  name: "프로젝트명",
  namePlaceholder: "예) 사내 업무포털 고도화",
  code: "프로젝트 코드",
  codeHint: "영문·숫자로 시작하는 영문·숫자·하이픈 2~20자. 대문자로 저장됩니다.",
  checkCode: "중복 확인",
  checkingCode: "확인 중",
  codeAvailable: "{code}는 사용할 수 있습니다. 최종 판정은 만들 때 한 번 더 합니다.",
  codeTaken: "{code}는 이미 사용 중입니다.",
  codeTakenGeneric: "이미 사용 중인 프로젝트 코드입니다.",
  startDate: "시작일 (선택)",
  endDate: "종료일 (선택)",
  periodHint: "기간은 비워 두고 만든 뒤 입력할 수 있습니다.",
  visibility: "공개 범위",
  structureSection: "템플릿·운영 방식",
  template: "템플릿",
  methodology: "운영 방식",
  actorsSection: "액터",
  actorsHint: "PM은 필수 액터라 해제할 수 없습니다.",
  featuresSection: "기능 구성",
  featuresHint: "선택한 운영 방식에서 쓸 수 있는 기능만 고를 수 있습니다.",
  pmSection: "PM",
  pmSelf: "{name} (나) — 만든 사람이 첫 PM이 됩니다.",
  departmentsSection: "주관 부서 (선택)",
  membersSection: "멤버 초대 (선택)",
  approverSection: "게이트 승인자 (선택)",
  omittedNote: "선택 항목이라 비운 채로 만들 수 있습니다.",
  submit: "프로젝트 만들기",
  submitting: "만드는 중",
  cancel: "취소",
  blockedTitle: "다음 필수 항목을 선택할 수 없어 만들 수 없습니다",
  nameRequired: "프로젝트명을 입력해 주세요.",
  nameTooLong: "프로젝트명은 100자 이하로 입력해 주세요.",
  codeRequired: "프로젝트 코드를 입력해 주세요.",
  codeFormat: "프로젝트 코드는 영문·숫자로 시작하는 영문·숫자·하이픈(-) 2~20자로 입력해 주세요.",
  periodInvalid: "시작일은 종료일보다 늦을 수 없습니다.",
  actorsRequired: "PM 액터는 반드시 포함되어야 합니다.",
  noTemplate: "템플릿 — 서버가 고를 수 있는 템플릿을 주지 않았습니다.",
  noMethodology: "운영 방식 — 고를 수 있는(활성) 운영 방식이 없습니다.",
  noDepartmentType: "부서 유형 — SW 부서 유형이 활성 상태가 아닙니다.",
  noPmActor: "액터 — 필수 PM 액터를 고를 수 없습니다.",
  created: "{name} 프로젝트를 만들었습니다.",
  openCreated: "프로젝트 열기",
  forbidden: "이 계정은 프로젝트를 만들 수 없습니다. 활성 일반 사용자만 만들 수 있습니다.",
});

/** 템플릿 이름 */
export const PROJECT_TEMPLATE_LABEL = defineLabels("project.template", {
  empty: "빈 템플릿",
  itProject: "IT 프로젝트 템플릿",
});

/** 기능 모듈 이름 */
export const PROJECT_FEATURE_LABEL = defineLabels("project.feature", {
  wbs: "WBS·간트",
  kanban: "칸반",
  board: "게시판",
  meeting: "회의록",
  deliverable: "산출물·게이트",
  issue: "이슈",
  file: "파일",
  git: "Git 연동",
});

/**
 * 서버에 조회 API가 없어 쓸 수 없는 항목의 이유.
 * 03 v9 기준 USER가 부를 수 있는 부서 목록·사용자 검색 API가 없다(/api/admin/** 는 시스템 관리자 전용).
 */
export const PROJECT_DIRECTORY_TEXT = defineLabels("project.directory", {
  departmentsUnavailable: "주관 부서를 고를 수 있는 부서 조회 API가 아직 없어 부서 없이 만듭니다. 서버에 일반 사용자용 부서 목록 API가 생기면 선택할 수 있습니다.",
  usersUnavailable: "초대할 사용자를 찾는 사용자 검색 API가 아직 없어 멤버 초대를 할 수 없습니다. 서버에 일반 사용자용 사용자 검색 API가 생기면 초대할 수 있습니다.",
  approverUnavailable: "게이트 승인자는 초대한 멤버 중에서 고르므로, 멤버 초대를 할 수 없는 지금은 지정할 수 없습니다.",
});

/** api 모드 멤버·설정 화면 문구 */
export const PROJECT_SETTINGS_TEXT = defineLabels("project.settings", {
  inviteTitle: "멤버 초대",
  inviteDisabled: "초대 기능 사용 불가",
  pmOnlyInvite: "멤버 초대는 프로젝트 PM만 할 수 있습니다.",
  approverNotConnected: "게이트 승인자 변경은 서버 API가 아직 없어 이 화면에서 바꿀 수 없습니다(FR-PRJ-05).",
  serverMembers: "서버 멤버 목록 기준",
});
