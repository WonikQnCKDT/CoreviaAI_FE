import { defineLabels } from "@/shared/i18n/defineLabels";

/** 시스템 관리 › PM 재지정 문구 (FR-PRJ-04, 요구사항 명세서 3.1 예외). {code}·{name} 등은 FE가 값을 넣는 자리 */
export const ADMIN_PM_TEXT = defineLabels("admin.pmReassign", {
  title: "PM 재지정",
  description:
    "활성 PM이 한 명도 남지 않은 프로젝트(퇴사·비활성화 등)에만 새 PM을 지정합니다. 남아 있던 비활성 PM은 멤버에서 제외되고, 처리 내용은 프로젝트 멤버 이력과 감사 로그에 남습니다.",
  privacyNote: "시스템 관리자는 프로젝트 데이터를 볼 수 없어 프로젝트 코드로만 지정합니다. 활성 PM이 있는 프로젝트는 PM이 직접 PM을 추가·해제합니다.",
  code: "프로젝트 코드",
  codePlaceholder: "예) PRT-2026-001",
  codeRequired: "프로젝트 코드를 입력해 주세요.",
  codeFormat: "프로젝트 코드는 영문·숫자로 시작하는 영문·숫자·하이픈(-) 2~20자입니다.",
  user: "새 PM",
  userSearch: "새 PM 이름 또는 아이디 검색",
  userSearchHint: "활성 일반 사용자만 PM으로 지정할 수 있습니다.",
  userRequired: "새 PM으로 지정할 사용자를 선택해 주세요.",
  userLoading: "사용자를 찾는 중입니다",
  userEmpty: "조건에 맞는 활성 일반 사용자가 없습니다",
  userFailed: "사용자 목록을 불러오지 못했습니다",
  selected: "선택됨: {name}",
  clearSelection: "선택 해제",
  submit: "PM 재지정",
  confirmTitle: "PM을 재지정하시겠습니까?",
  confirmBody: "{code} 프로젝트의 PM으로 {name}을(를) 지정합니다.",
  confirmNote: "활성 PM이 남아 있는 프로젝트이거나 코드가 없으면 서버가 거부합니다. 남아 있던 비활성 PM은 멤버에서 제외됩니다.",
  done: "{code} 프로젝트의 PM을 재지정했습니다. 현재 PM: {names}",
  notAllowed: "재지정할 수 없습니다. 활성 PM이 남아 있는 프로젝트이거나 없는 프로젝트 코드입니다. 코드를 확인하고, 활성 PM이 있으면 그 PM이 직접 PM을 추가·해제하도록 안내해 주세요.",
});
