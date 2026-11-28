import { defineLabels } from "@/shared/i18n/defineLabels";

/**
 * api 모드 멤버·역할 관리 문구 (03. 프로젝트 API, FR-PRJ-04). {name}·{count} 등은 FE가 값을 넣는 자리.
 * 객체에서 값을 읽을 때마다 현재 언어로 바뀌므로 모듈 상단에서 값을 미리 꺼내 두지 않는다.
 */
export const PROJECT_MEMBER_TEXT = defineLabels("project.member", {
  title: "현재 멤버 ({count}명)",
  pmCount: "PM {count}명",
  loading: "멤버를 불러오는 중입니다",
  loadFailed: "멤버 목록을 불러오지 못했습니다",
  retry: "다시 시도",
  empty: "아직 멤버가 없습니다",
  readOnly: "읽기 전용 · 역할 변경과 제외는 PM만 할 수 있습니다",
  me: "나",
  assignedTasks: "담당 업무 {count}건",
  roleSelect: "{name}의 역할",
  remove: "제외",
  removeAria: "{name}을(를) 멤버에서 제외",
  approver: "승인자",
  approverHint: "게이트 승인자는 PM이 될 수 없고 멤버에서 제외할 수 없습니다. 승인자를 먼저 변경해 주세요.",
  lastPmHint: "마지막 PM이라 역할을 바꾸거나 제외할 수 없습니다. 다른 멤버를 먼저 PM으로 추가해 주세요.",
  pmGuide:
    "PM 추가·해제는 아래 멤버 목록에서 역할을 PM으로 바꾸거나 PM에서 다른 역할로 바꿔 합니다. PM은 1명 이상 남아야 합니다. 활성 PM이 모두 없어진 프로젝트는 시스템 관리자가 PM을 재지정합니다.",
  pmGuideReadOnly: "PM 추가·해제는 현재 PM만 할 수 있습니다. 활성 PM이 모두 없어진 프로젝트는 시스템 관리자가 PM을 재지정합니다.",

  // 확인 창
  confirmRoleTitle: "역할을 변경하시겠습니까?",
  confirmPmAddTitle: "PM으로 추가하시겠습니까?",
  confirmPmReleaseTitle: "PM을 해제하시겠습니까?",
  confirmRoleBody: "{name}의 역할을 {before}에서 {after}(으)로 바꿉니다.",
  pmAddNote: "PM이 되면 멤버·단계·업무를 편집할 수 있습니다. 게이트 승인자로 지정된 멤버는 PM이 될 수 없습니다.",
  pmReleaseSelfNote: "본인의 PM을 해제하면 이 프로젝트의 PM 권한이 바로 사라집니다.",
  confirmRemoveTitle: "멤버에서 제외하시겠습니까?",
  confirmRemoveBody: "{name}을(를) 프로젝트 멤버에서 제외합니다. 제외한 기록은 변경 이력에 남습니다.",
  confirmChange: "변경",
  confirmRemove: "제외",
  cancel: "취소",
  submitting: "처리 중",

  // 결과
  roleChanged: "{name}의 역할을 {after}(으)로 바꿨습니다.",
  removed: "{name}을(를) 멤버에서 제외했습니다.",
  lastPm: "프로젝트에는 PM이 1명 이상 있어야 해서 마지막 PM은 해제하거나 제외할 수 없습니다. 다른 멤버를 먼저 PM으로 추가해 주세요.",
  pmTargetRejected: "이 멤버는 PM으로 지정할 수 없습니다. 게이트 승인자이거나 비활성 계정인지 확인해 주세요.",
  roleRejected: "선택한 역할로 바꿀 수 없습니다. 프로젝트에 지정한 액터인지 확인해 주세요.",
  pmOnly: "PM 권한이 없어 처리하지 못했습니다. 다른 PM이 먼저 역할을 바꿨을 수 있어 목록을 다시 불러왔습니다.",
  memberGone: "이미 제외되었거나 없는 멤버입니다. 목록을 다시 불러왔습니다.",
  hasTasks: "담당 중인 업무가 있어 제외할 수 없습니다. 아래 업무를 다른 멤버에게 먼저 재배정해 주세요.",
  removeConflict: "마지막 PM이거나 게이트 승인자라 제외할 수 없습니다. 다른 PM을 먼저 추가하거나 승인자를 먼저 변경해 주세요.",

  // 초대
  inviteHint: "이름으로 찾아 추가하고 각자 역할을 고른 뒤 한 번에 초대합니다. 역할은 프로젝트에 지정한 액터 중 PM을 뺀 것에서 고릅니다. PM은 초대한 뒤 역할 변경으로 추가합니다.",
  inviteSearch: "초대할 사용자 찾기",
  inviteEmpty: "아직 고른 사용자가 없습니다.",
  inviteRole: "{name} 초대 역할",
  inviteRemove: "{name}을(를) 초대 목록에서 빼기",
  inviteSubmit: "{count}명 초대",
  inviting: "초대 중",
  invited: "{count}명을 초대했습니다.",
  inviteNeedActor: "PM 외 액터가 지정되어 있지 않아 초대할 수 없습니다.",
  inviteLimit: "한 번에 최대 {max}명까지 초대할 수 있습니다.",
  alreadyMember: "이미 프로젝트 멤버인 사용자가 있어 아무도 초대하지 않았습니다. 멤버 목록을 다시 불러왔으니 확인 후 다시 시도해 주세요.",
  inviteRejected: "초대할 수 없는 사용자이거나 고를 수 없는 역할이 있어 아무도 초대하지 않았습니다.",

  // 이력
  historyTitle: "멤버·역할 변경 이력",
  historyDescription: "초대·역할 변경·PM 추가·해제·재지정·제외를 최신순으로 보여 줍니다.",
  historyLoading: "변경 이력을 불러오는 중입니다",
  historyFailed: "변경 이력을 불러오지 못했습니다",
  historyEmpty: "아직 멤버 변경 이력이 없습니다",
  historyBy: "처리: {name}",
  loadMore: "더 보기",
  loadingMore: "더 불러오는 중",
  unknownName: "(이름 없음)",
  noActor: "없음",
});

/** 화면 역할 라벨(status.projectRole)에 없는 액터 이름 (제조 부서 유형 등) */
export const MEMBER_EXTRA_ACTOR_LABEL = defineLabels("project.member.actor", {
  deptStaff: "부서 담당자",
  customerLiaison: "고객 담당자",
});

/** 멤버 이력 변경 유형 (BE MemberChangeType) */
export const MEMBER_CHANGE_LABEL: Record<string, string> = defineLabels("project.member.change", {
  invited: "초대",
  roleChanged: "역할 변경",
  removed: "제외",
  pmAdded: "PM 추가",
  pmReleased: "PM 해제",
  pmReassigned: "PM 재지정(관리자)",
  pmDelegated: "PM 위임(이전 기록)",
});
