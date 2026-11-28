import { defineLabels } from "@/shared/i18n/defineLabels";

/**
 * 서버 알림 본문(messageKey). 키는 BE가 주는 값 그대로다(12. 알림 API: notification.assigned 등).
 * {taskName}·{status}·{endDate}는 서버 messageParams 값이 들어가는 자리
 */
export const SERVER_NOTIFICATION_MESSAGE = defineLabels("notification", {
  assigned: "'{taskName}' 업무가 배정되었습니다.",
  statusChanged: "'{taskName}' 업무 상태가 '{status}'(으)로 바뀌었습니다.",
  dueSoon: "'{taskName}' 업무가 내일({endDate}) 마감입니다.",
});

/** api 모드 알림 영역 문구 */
export const SERVER_NOTIFICATION_TEXT = defineLabels("notification.server", {
  unavailable: "알림 서버가 아직 준비되지 않았습니다. 서버에 알림 기능이 반영된 뒤 화면을 새로 고치면 표시됩니다.",
  more: "더 보기",
  live: "실시간 연결됨",
  polling: "1분마다 새로 확인합니다",
  readFailed: "읽음 처리를 하지 못했습니다. 잠시 후 다시 시도해 주세요.",
  fallbackAssigned: "업무가 배정되었습니다.",
  fallbackMentioned: "회원님을 멘션했습니다.",
  fallbackStatusChanged: "업무 상태가 바뀌었습니다.",
  fallbackDueSoon: "내일 마감인 업무가 있습니다.",
  fallbackApprovalRequested: "승인 요청이 있습니다.",
  fallbackMissingTask: "누락이 의심되는 업무가 있습니다.",
  fallbackRiskUp: "프로젝트 위험 등급이 올라갔습니다.",
  fallbackProjectInactive: "프로젝트가 비활성 상태입니다.",
  noMarkAll: "모두 읽음은 서버 API가 없어 항목을 눌러 하나씩 읽음 처리합니다.",
});
