import { defineLabels } from "@/shared/i18n/defineLabels";

/** 공통 UI 컴포넌트·레이아웃·오류 화면 문구 (FR-ADM-06) */
export const COMMON_UI_TEXT = defineLabels("common.ui", {
  brandLogo: "CoreviaAI 로고",
  infoTipLabel: "설명 보기",
  unassigned: "미지정",
  riskScore: "리스크 점수: {score}점",
  riskScoreUnknown: "리스크 점수 정보 없음",
  comingSoonBadge: "준비 중",
  comingSoonNotice:
    "이 화면은 아직 구현되지 않았습니다. 실제 동작 없이 완료 메시지를 표시하지 않으며, 다음 단계에서 데이터와 함께 제공될 예정입니다.",
  noAccessTitle: "이 화면에 접근할 권한이 없습니다",
  noAccessDescription:
    "현재 계정에는 이 화면을 볼 수 있는 권한이 없습니다. 필요한 경우 프로젝트 PM 또는 시스템 관리자에게 권한을 요청해 주세요.",
  requiredRolePrefix: "필요한 권한",
  goToMyWork: "내 업무로 이동",
  goToProjects: "프로젝트 목록",
  goToProjectsBack: "프로젝트 목록으로",
  demoPermissionNote: "데모 UI 권한 시뮬레이션입니다. 실제 서버 접근 제어가 아닙니다.",
  notFoundTitle: "페이지를 찾을 수 없습니다",
  notFoundPathPrefix: "요청한 경로",
  notFoundPathSuffix: "가 존재하지 않습니다.",
  demoPrototypeFooter: "CoreviaAI 데모 프로토타입",
  countUnit: "건",
  personUnit: "명",
  itemUnit: "개",
  scoreUnit: "{score}점",
});

/** 상단 바(TopBar) 문구 */
export const TOPBAR_TEXT = defineLabels("layout.topbar", {
  progress: "진척률",
  currentStage: "현재 단계 {stage}",
  demoSessionNote: "데모 세션입니다. 실제 인증·세션 관리는 연결되어 있지 않습니다.",
  unsavedTitle: "저장하지 않은 내용이 있습니다",
  unsavedDescription: "이 화면에서 나가면 작성 중인 내용은 저장되지 않습니다.",
  unsavedBody: "저장하지 않은 입력이 있을 때만 이 확인을 표시합니다. 입력을 마무리하려면 계속 작성하기를 선택해 주세요.",
});
