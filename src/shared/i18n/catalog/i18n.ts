import { defineLabels } from "@/shared/i18n/defineLabels";

/** 표시 언어 선택 문구. 언어 이름은 그 언어로 쓰는 관례라 라벨로 바꾸지 않는다(LANGUAGE_NAME). */
export const LANGUAGE_TEXT = defineLabels("i18n.language", {
  label: "표시 언어",
  changing: "언어를 바꾸는 중",
  changeFailed: "언어를 바꾸지 못했습니다. 잠시 후 다시 시도해 주세요.",
  savedButNotApplied: "언어 설정은 저장했지만 문구를 불러오지 못했습니다. 새로고침하면 적용됩니다.",
});

export const LANGUAGE_NAME = {
  ko: "한국어",
  en: "English",
  "zh-TW": "繁體中文",
} as const;
