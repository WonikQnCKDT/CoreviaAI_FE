import { defineLabels } from "@/shared/i18n/defineLabels";
import { RECORD_STATUS_LABEL, SYSTEM_ROLE_LABEL } from "@/shared/i18n/catalog/status";

/**
 * 시스템 관리 화면 문구. 값은 한국어 기본 문구이고, 화면은 라벨 키(admin.*)로 다국어 문구를 읽는다(02-4, FR-ADM-06).
 * 객체에서 값을 읽을 때마다 현재 언어로 바뀌므로 모듈 상단에서 값을 미리 꺼내 두지 않는다.
 */
export const ADMIN_TEXT = defineLabels("admin", {
  // 공통
  loading: "불러오는 중입니다",
  loadMore: "더 보기",
  loadingMore: "더 불러오는 중",
  retry: "다시 시도",
  cancel: "취소",
  save: "저장",
  saving: "저장 중",
  close: "닫기",
  none: "없음",
  serverAppliedNote: "변경 사항은 서버에 바로 반영되고 감사 로그에 기록됩니다.",

  // 사용자
  usersTitle: "사용자",
  usersDescription: "계정·부서·직무·시스템 역할을 관리합니다. 사용자는 삭제하지 않고 비활성화합니다.",
  addUser: "사용자 추가",
  searchPlaceholder: "아이디 또는 이름 검색",
  allDepartments: "부서 전체",
  allRoles: "시스템 역할 전체",
  allStatuses: "상태 전체",
  emptyUsers: "조건에 맞는 사용자가 없습니다",
  emptyUsersHint: "검색어나 필터를 바꿔 다시 시도해 주세요.",
  resetFilters: "필터 초기화",
  loadUsersFailed: "사용자 목록을 불러오지 못했습니다",
  neverLoggedIn: "로그인 기록 없음",
  self: "나",
  ownAccountLocked: "본인 계정의 역할과 상태는 바꿀 수 없습니다.",
  roleChangeConfirmTitle: "시스템 역할 변경",
  roleChangeConfirmBody: "역할을 바꾸면 대상 사용자의 모든 세션이 즉시 종료되어 다시 로그인해야 합니다.",
  deactivateConfirmTitle: "계정 비활성화",
  deactivateConfirmBody: "비활성화하면 대상 사용자의 모든 세션이 즉시 종료되고 이후 로그인할 수 없습니다.",
  activateConfirmTitle: "계정 활성화",
  activateConfirmBody: "활성화하면 다시 로그인할 수 있습니다.",
  createdThenReset: "계정을 만들었습니다. 비밀번호가 없어 아직 로그인할 수 없으니 이어서 임시 비밀번호를 발급해 주세요.",
  editUser: "사용자 정보 수정",
  history: "변경 이력",
  emptyHistory: "변경 이력이 없습니다",
  loadHistoryFailed: "변경 이력을 불러오지 못했습니다",

  // 사용자 입력 검증
  loginIdRequired: "아이디를 입력해 주세요.",
  loginIdFormat: "아이디는 50자 이하의 영문·숫자·마침표(.)·밑줄(_)·하이픈(-)만 쓸 수 있습니다.",
  nameRequired: "이름을 입력해 주세요.",
  nameTooLong: "이름은 50자 이하로 입력해 주세요.",
  departmentRequired: "시스템 관리자가 아니면 부서를 선택해야 합니다.",
  jobTitleTooLong: "직무는 50자 이하로 입력해 주세요.",

  // 부서
  departmentsTitle: "부서",
  departmentsDescription: "부서를 트리로 관리합니다. 부서는 삭제하지 않고 비활성화합니다.",
  addDepartment: "부서 추가",
  addChildDepartment: "하위 부서 추가",
  editDepartment: "부서 수정",
  topLevel: "최상위",
  emptyDepartments: "등록된 부서가 없습니다",
  emptyDepartmentsHint: "첫 부서를 추가해 조직을 구성해 주세요.",
  loadDepartmentsFailed: "부서 목록을 불러오지 못했습니다",
  departmentNameRequired: "부서 이름을 입력해 주세요.",
  departmentNameTooLong: "부서 이름은 50자 이하로 입력해 주세요.",
  showInactive: "비활성 부서 보기",
});

/** 변경 성공 안내. {name}·{role}·{status}는 FE가 값을 넣는 자리 */
export const ADMIN_NOTICE_TEXT = defineLabels("admin.notice", {
  userSaved: "{name} 사용자 정보를 저장했습니다.",
  userRoleChanged: "{name} 사용자의 역할을 {role}(으)로 바꿨습니다. 대상 사용자는 다시 로그인해야 합니다.",
  userStatusChanged: "{name} 계정을 {status} 상태로 바꿨습니다.",
  departmentStatusChanged: "{name} 부서를 {status} 상태로 바꿨습니다.",
  departmentCreated: "{name} 부서를 추가했습니다.",
  departmentSaved: "{name} 부서를 저장했습니다.",
  codeSortOrderChanged: "{code} 코드의 정렬 순서를 {sortOrder}(으)로 바꿨습니다.",
});

/** 공통 코드 화면 문구 (02-3) */
export const ADMIN_CODE_TEXT = defineLabels("admin.code", {
  title: "공통 코드",
  description: "상태값을 코드로 관리합니다. 관리자는 그룹 안 표시 순서만 바꿀 수 있습니다.",
  groupsLabel: "코드 그룹",
  loadGroupsFailed: "코드 그룹을 불러오지 못했습니다",
  emptyGroups: "등록된 코드 그룹이 없습니다",
  emptyGroupsHint: "코드 그룹은 서버 마이그레이션으로만 추가됩니다.",
  selectGroup: "왼쪽에서 코드 그룹을 고르세요",
  loadCodesFailed: "코드를 불러오지 못했습니다",
  emptyCodes: "이 그룹에는 코드가 없습니다",
  inUse: "사용",
  notInUse: "사용 안 함",
  sortOrderRequired: "정렬 순서를 입력해 주세요.",
  sortOrderRange: "정렬 순서는 0 이상 9999 이하의 정수로 입력해 주세요.",
  fixedNote:
    "코드 값·라벨 키·사용 여부는 바꿀 수 없습니다(서버 마이그레이션으로만 변경). 표시 텍스트는 다국어 라벨에서 라벨 키로 관리합니다. 정렬 순서를 바꾸면 감사 로그에 기록됩니다.",
  lastWriteWins: "다른 관리자가 같은 코드의 순서를 동시에 바꾸면 나중에 저장한 값이 남습니다.",
  displayText: "표시 문구",
});

/** 다국어 라벨 화면 문구 (02-4) */
export const ADMIN_LABEL_TEXT = defineLabels("admin.label", {
  title: "다국어 라벨",
  description: "화면 문구를 언어별로 관리합니다. 라벨 키는 바꾸거나 지울 수 없고, 문구만 고칩니다.",
  add: "라벨 등록",
  edit: "문구 수정",
  searchPlaceholder: "라벨 키 또는 한국어 문구 검색",
  missingAll: "번역 누락 필터 없음",
  missingEn: "영어 번역 누락",
  missingZhTw: "번체 중국어 번역 누락",
  missingFilter: "번역 누락 필터",
  key: "라벨 키",
  textKo: "한국어",
  textEn: "영어",
  textZhTw: "번체 중국어",
  missing: "번역 누락",
  updatedAt: "수정일",
  empty: "조건에 맞는 라벨이 없습니다",
  emptyHint: "검색어나 누락 필터를 바꿔 보세요.",
  loadFailed: "라벨을 불러오지 못했습니다",
  keyRequired: "라벨 키를 입력해 주세요.",
  keyFormat: "라벨 키는 영문자로 시작하고 점(.)으로 구분한 영문·숫자·밑줄·하이픈 100자 이하로 입력해 주세요.",
  textKoRequired: "한국어 문구를 입력해 주세요.",
  textTooLong: "문구는 500자 이하로 입력해 주세요.",
  textControlCharacter: "문구에는 줄바꿈·탭 같은 제어 문자를 넣을 수 없습니다.",
  keyFixed: "라벨 키는 바꿀 수 없습니다.",
  emptyMeansMissing: "영어·번체 중국어를 비우면 번역 누락으로 저장되고 화면에는 한국어로 표시됩니다.",
  concurrentModification: "다른 관리자가 먼저 수정했습니다. 최신 문구를 불러왔으니 확인 후 다시 저장해 주세요.",
  saved: "{key} 라벨을 저장했습니다. 다른 사용자 화면에는 다음에 문구를 불러올 때 반영됩니다.",
  created: "{key} 라벨을 등록했습니다.",
  applyNow: "지금 화면에 적용",
  textOnlyNote: "문구는 HTML로 해석하지 않고 글자 그대로 표시합니다. 변경 이력은 감사 로그에 남습니다.",
});

/**
 * 서버 메시지 대신 FE가 조치 안내를 붙여 보여 줄 상황 문구.
 * 오류 본문에 code가 없어(API 공통 규약 6절) 상황은 호출한 API와 HTTP status로 정한다(utils/adminUserFailure.ts).
 */
export const ADMIN_ERROR_TEXT = defineLabels("admin.error", {
  /** PATCH /api/admin/users/{userId} 409 CONCURRENT_MODIFICATION */
  concurrentModification: "다른 관리자가 먼저 변경했습니다. 최신 내용을 불러왔으니 확인 후 다시 시도해 주세요.",
  /** 역할·상태 변경 503 EXTERNAL_SERVICE_UNAVAILABLE — DB에는 반영됨 */
  sessionRevokeFailed: "변경은 저장됐지만 대상 사용자의 세션을 끊지 못했습니다. 다시 시도하면 세션 종료를 다시 요청합니다.",
});

/** 시스템 역할·상태 문구는 공통 상태 카탈로그와 같은 키를 쓴다. */
export const SYSTEM_ROLE_TEXT = SYSTEM_ROLE_LABEL;
export const STATUS_TEXT = RECORD_STATUS_LABEL;

export const HISTORY_ACTION_TEXT: Record<string, string> = defineLabels("admin.history.action", {
  USER_CREATED: "계정 생성",
  USER_PROFILE_CHANGED: "정보 수정",
  USER_ROLE_CHANGED: "시스템 역할 변경",
  USER_ACTIVATED: "활성화",
  USER_DEACTIVATED: "비활성화",
  PASSWORD_RESET: "비밀번호 초기화",
  // 프로젝트 생성 권한은 폐지됐지만(FR-PRJ-01, BE V5 마이그레이션) 그 전에 쌓인 감사 로그를 읽을 수 있게 남긴다.
  PROJECT_CREATION_GRANTED: "프로젝트 생성 권한 부여 (폐지된 기능)",
  PROJECT_CREATION_REVOKED: "프로젝트 생성 권한 회수 (폐지된 기능)",
});

export const HISTORY_FIELD_TEXT: Record<string, string> = defineLabels("admin.history.field", {
  name: "이름",
  departmentId: "부서",
  departmentName: "부서",
  jobTitle: "직무",
  systemRole: "시스템 역할",
  status: "상태",
  /** 폐지 전 감사 로그의 details 표시용 */
  canCreateProject: "프로젝트 생성 권한",
  loginId: "아이디",
});
