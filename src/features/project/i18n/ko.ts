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
  featuresHint: "템플릿 기본 기능이 체크됩니다. 만들기 전에 하나씩 바꿀 수 있고, 산출물·게이트처럼 단계가 필요한 기능은 단계가 있는 운영 방식(폭포수)에서만 고를 수 있습니다.",
  featureUnavailable: "준비 중",
  featureNeedsPhases: "단계 필요",
  pmSection: "PM",
  pmSelf: "{name} (나) — 만든 사람이 첫 PM이 됩니다.",
  actorInUse: "멤버 역할로 쓰는 액터는 해제할 수 없습니다. 그 멤버의 역할을 바꾸거나 제외해 주세요.",
  departmentsSection: "주관 부서 (선택)",
  departmentsHint: "여러 부서를 고를 수 있고(최대 20개), 비워 두고 만든 뒤 지정할 수도 있습니다.",
  departmentsFilter: "부서 이름으로 거르기",
  departmentsLoading: "부서 목록을 불러오는 중입니다",
  departmentsFailed: "부서 목록을 불러오지 못했습니다. 주관 부서 없이 만들거나 다시 시도해 주세요.",
  departmentsEmpty: "고를 수 있는 활성 부서가 없습니다.",
  departmentsNoMatch: "이름이 맞는 부서가 없습니다.",
  departmentsSelected: "{count}개 선택 (최대 20개)",
  departmentsLimit: "주관 부서는 최대 20개까지 지정할 수 있습니다.",
  removeDepartment: "{name} 주관 부서 해제",
  membersSection: "멤버 초대 (선택)",
  membersHint: "이름으로 찾아 추가합니다. 역할은 위에서 지정한 액터 중 PM을 뺀 것에서 고릅니다. 비워 두고 만든 뒤 초대할 수도 있습니다.",
  membersSearch: "초대할 사용자 찾기",
  membersNeedActor: "PM 외 액터를 하나 이상 지정해야 멤버를 초대할 수 있습니다.",
  membersLimit: "생성 시 초대할 수 있는 멤버는 최대 100명입니다.",
  membersEmpty: "아직 초대한 멤버가 없습니다.",
  memberRole: "{name} 역할",
  removeMember: "{name} 멤버 제외",
  memberRoleInvalid: "지정하지 않은 액터를 역할로 가진 멤버가 있습니다. 역할을 다시 골라 주세요.",
  approverSection: "게이트 승인자 (선택)",
  approverLabel: "게이트 승인자",
  approverHint: "초대한 멤버 중 PM이 아닌 한 명을 고르거나 지정하지 않을 수 있습니다.",
  approverNone: "지정 안 함",
  approverNoPhases: "단계가 없는 운영 방식이라 게이트 승인자를 지정하지 않습니다.",
  approverNoMembers: "멤버를 초대하면 그중에서 승인자를 고를 수 있습니다.",
  approverNotMember: "게이트 승인자는 초대한 멤버 중에서만 지정할 수 있습니다.",
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
 * 멤버·설정 화면의 멤버 초대 안내(SCRUM-106에서 사용자 검색 컴포넌트로 연결하기 전까지).
 */
export const PROJECT_DIRECTORY_TEXT = defineLabels("project.directory", {
  usersUnavailable: "초대할 사용자를 찾는 사용자 검색 API가 아직 없어 멤버 초대를 할 수 없습니다. 서버에 일반 사용자용 사용자 검색 API가 생기면 초대할 수 있습니다.",
});

/** 초대할 사용자 이름 검색(UserSearchPicker). {keyword}·{count}는 FE가 값을 넣는 자리 */
export const USER_SEARCH_TEXT = defineLabels("project.userSearch", {
  placeholder: "이름으로 찾기 (2자 이상)",
  tooShort: "이름을 2자 이상 입력하면 찾습니다.",
  loading: "찾는 중입니다",
  empty: "'{keyword}'(으)로 초대할 수 있는 사용자를 찾지 못했습니다.",
  failed: "사용자를 찾지 못했습니다.",
  resultCount: "{count}명을 찾았습니다.",
  limitNote: "최대 20명까지 보여 줍니다. 이름을 더 입력해 좁혀 주세요.",
  noDepartment: "부서 없음",
});

/** api 모드 멤버·설정 화면 문구 */
export const PROJECT_SETTINGS_TEXT = defineLabels("project.settings", {
  inviteTitle: "멤버 초대",
  inviteDisabled: "초대 기능 사용 불가",
  pmOnlyInvite: "멤버 초대는 프로젝트 PM만 할 수 있습니다.",
  approverNotConnected: "게이트 승인자 변경은 서버 API가 아직 없어 이 화면에서 바꿀 수 없습니다(FR-PRJ-05).",
  serverMembers: "서버 멤버 목록 기준",
});
