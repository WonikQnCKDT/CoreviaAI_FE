/**
 * 시스템 관리(사용자·부서) 화면 문구 (ko).
 * 공통 localization 구조가 생기기 전까지 이 기능의 새 문구를 여기에 모은다.
 */
export const ADMIN_TEXT = {
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
  usersDescription: "계정·시스템 역할·프로젝트 생성 권한을 관리합니다. 사용자는 삭제하지 않고 비활성화합니다.",
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
  projectCreationUserOnly: "프로젝트 생성 권한은 일반 사용자에게만 줄 수 있습니다.",
  roleChangeConfirmTitle: "시스템 역할 변경",
  roleChangeConfirmBody: "역할을 바꾸면 대상 사용자의 모든 세션이 즉시 종료되어 다시 로그인해야 합니다.",
  roleChangeProjectRevoke: "일반 사용자가 아닌 역할이 되면 프로젝트 생성 권한이 자동으로 회수됩니다.",
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
} as const;

/** 서버 오류 코드 → 문구. 코드가 없거나 모르는 코드면 서버 메시지나 공통 문구를 쓴다. */
export const ADMIN_ERROR_TEXT: Record<string, string> = {
  NOT_FOUND: "시스템 관리자만 사용할 수 있는 기능입니다.",
  PASSWORD_CHANGE_REQUIRED: "비밀번호를 먼저 변경해야 합니다.",
  USER_NOT_FOUND: "사용자를 찾을 수 없습니다. 목록을 새로 불러와 주세요.",
  DEPARTMENT_NOT_FOUND: "부서를 찾을 수 없습니다. 목록을 새로 불러와 주세요.",
  DEPARTMENT_REQUIRED: "시스템 관리자가 아니면 부서가 있어야 합니다. 부서를 먼저 지정해 주세요.",
  DEPARTMENT_INACTIVE: "비활성 부서에는 사용자를 배치할 수 없습니다.",
  PROJECT_CREATION_NOT_ALLOWED: "프로젝트 생성 권한은 일반 사용자에게만 줄 수 있습니다.",
  DUPLICATE_LOGIN_ID: "이미 사용 중인 아이디입니다.",
  CANNOT_CHANGE_OWN_ACCOUNT: "본인 계정의 역할과 상태는 바꿀 수 없습니다.",
  LAST_SYSTEM_ADMIN: "마지막 시스템 관리자는 강등하거나 비활성화할 수 없습니다.",
  CONCURRENT_MODIFICATION: "다른 관리자가 먼저 변경했습니다. 최신 내용을 불러왔으니 확인 후 다시 시도해 주세요.",
  EXTERNAL_SERVICE_UNAVAILABLE: "변경은 저장됐지만 대상 사용자의 세션을 끊지 못했습니다. 다시 시도하면 세션 종료를 다시 요청합니다.",
  INVALID_CURSOR: "목록 위치가 만료되었습니다. 처음부터 다시 불러와 주세요.",
  INVALID_DEPARTMENT_PARENT: "상위 부서로 지정할 수 없는 부서입니다. 비활성 부서나 자기 자신·하위 부서는 선택할 수 없습니다.",
  DUPLICATE_DEPARTMENT_NAME: "같은 상위 부서 안에 이미 같은 이름의 부서가 있습니다.",
  DEPARTMENT_IN_USE: "활성 사용자나 활성 하위 부서가 있어 비활성화할 수 없습니다.",
};

export const SYSTEM_ROLE_TEXT = {
  admin: "시스템 관리자",
  exec: "경영진",
  user: "일반 사용자",
} as const;

export const STATUS_TEXT = {
  active: "활성",
  inactive: "비활성",
} as const;

export const HISTORY_ACTION_TEXT: Record<string, string> = {
  USER_CREATED: "계정 생성",
  USER_PROFILE_CHANGED: "정보 수정",
  USER_ROLE_CHANGED: "시스템 역할 변경",
  USER_ACTIVATED: "활성화",
  USER_DEACTIVATED: "비활성화",
  PROJECT_CREATION_GRANTED: "프로젝트 생성 권한 부여",
  PROJECT_CREATION_REVOKED: "프로젝트 생성 권한 회수",
  PASSWORD_RESET: "비밀번호 초기화",
};

export const HISTORY_FIELD_TEXT: Record<string, string> = {
  name: "이름",
  departmentId: "부서",
  departmentName: "부서",
  jobTitle: "직무",
  systemRole: "시스템 역할",
  status: "상태",
  canCreateProject: "프로젝트 생성 권한",
  loginId: "아이디",
};
