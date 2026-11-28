import type { NotificationType } from "@/types";
import { defineLabels } from "@/shared/i18n/defineLabels";

/** 알림 유형 */
export const NOTIFICATION_TYPE_LABEL: Record<NotificationType, string> = defineLabels("notification.type", {
  assign: "배정",
  mention: "멘션",
  status: "상태",
  due: "마감",
  deliverable: "검수",
  missing: "누락",
  risk: "리스크",
});

/** 알림 영역·안내 문구. {count}·{type}은 FE가 값을 넣는 자리 */
export const NOTIFICATION_TEXT = defineLabels("notification", {
  unreadNotice: "확인하지 않은 알림 {count}건이 있습니다",
  title: "알림",
  unreadCount: "읽지 않음 {count}건",
  loading: "알림을 불러오는 중입니다.",
  loadFailed: "알림을 불러오지 못했습니다.",
  empty: "알림이 없습니다.",
  emptyHint: "업무 배정·검수 요청이 생기면 이곳에 표시됩니다.",
  evidence: "근거 · {text}",
  typeSuffix: "{type} 알림",
  demoFooter: "데모 알림 · 예약 실행·실시간 발송 미연결",
  offline: "네트워크 연결이 끊겼습니다. 일시적인 통신 오류는 로그아웃 사유가 아니며, 연결이 복구되면 자동으로 다시 확인합니다.",
  meetingSavedToKb: "회의록을 지식 허브에 저장했습니다. 원본 링크가 유지됩니다.",
});
