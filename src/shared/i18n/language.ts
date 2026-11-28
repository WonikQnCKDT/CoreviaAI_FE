/**
 * 지원 언어 (02-4. 다국어 라벨, FR-ADM-06·NFR-19): ko(기본), en, zh-TW(번체 중국어).
 * 서버로 보내거나 저장하는 언어 값은 반드시 이 목록으로 정규화한 값만 쓴다.
 */
export const LANGUAGES = ["ko", "en", "zh-TW"] as const;

export type Language = (typeof LANGUAGES)[number];

export const DEFAULT_LANGUAGE: Language = "ko";

/** 번체로 보는 태그. 간체(zh, zh-CN)는 지원하지 않는다(공통 규약 7절). */
const TRADITIONAL_CHINESE = new Set(["zh-tw", "zh-hant", "zh-hk", "zh-mo"]);

/** 언어 태그를 지원 언어로 바꾼다. 대소문자·밑줄 무관. 지원하지 않으면 null. */
export const normalizeLanguage = function (value: unknown): Language | null {
  if (typeof value !== "string") return null;
  const tag = value.trim().replace(/_/g, "-").toLowerCase();
  if (tag === "ko") return "ko";
  if (tag === "en") return "en";
  if (TRADITIONAL_CHINESE.has(tag)) return "zh-TW";
  return null;
};

const STORAGE_KEY = "corevia.language";

/** 마지막으로 적용한 언어. 로그인 전 화면(로그인·비밀번호 변경)의 언어를 맞추는 데만 쓴다. */
export const readStoredLanguage = function (): Language | null {
  try {
    return normalizeLanguage(window.localStorage.getItem(STORAGE_KEY));
  } catch {
    // 저장소를 쓸 수 없으면 브라우저 언어(Accept-Language)를 따른다.
    return null;
  }
};

export const storeLanguage = function (language: Language) {
  try {
    window.localStorage.setItem(STORAGE_KEY, language);
  } catch {
    // 저장하지 못해도 이번 화면의 언어 적용에는 영향이 없다.
  }
};
