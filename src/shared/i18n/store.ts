import { DEFAULT_LANGUAGE, type Language } from "@/shared/i18n/language";

/**
 * 현재 적용 중인 라벨 묶음. 화면 코드는 translate()로 라벨 키의 문구를 읽고, 없으면 한국어 기본값을 쓴다.
 * 묶음이 바뀌면 I18nProvider가 화면을 다시 마운트하므로, 렌더링 중에 읽은 값은 항상 최신이다.
 */
interface LabelState {
  language: Language;
  labels: Readonly<Record<string, string>>;
}

let state: LabelState = { language: DEFAULT_LANGUAGE, labels: {} };

export const currentLanguage = function (): Language {
  return state.language;
};

/** 지금 묶음과 같은 언어·같은 문구인지. 같으면 화면을 다시 그릴 필요가 없다. */
export const isCurrentBundle = function ({ language, labels }: { language: Language; labels: Record<string, string> }) {
  if (language !== state.language) return false;
  const keys = Object.keys(labels);
  if (keys.length !== Object.keys(state.labels).length) return false;
  return keys.every((key) => Object.hasOwn(state.labels, key) && state.labels[key] === labels[key]);
};

/**
 * 라벨 키의 문구. 묶음에 없거나 문자열이 아니면 기본값(한국어)을 돌려준다.
 * 자기 속성만 본다: 'constructor' 같은 키가 프로토타입의 함수를 돌려주지 않게 한다.
 */
export const translate = function (key: string, fallback: string): string {
  const { labels } = state;
  if (!Object.hasOwn(labels, key)) return fallback;
  const text = labels[key];
  return typeof text === "string" && text.length > 0 ? text : fallback;
};

/** 서버 묶음에서 문자열 값만 골라 담는다. 그 밖의 값은 무시한다. */
export const sanitizeLabels = function (raw: unknown): Record<string, string> {
  const result: Record<string, string> = Object.create(null);
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return result;
  Object.entries(raw as Record<string, unknown>).forEach(([key, value]) => {
    if (typeof value === "string") result[key] = value;
  });
  return result;
};

export const applyLabels = function ({ language, labels }: { language: Language; labels: Record<string, string> }) {
  state = { language, labels: Object.freeze({ ...labels }) };
};

/** 테스트에서 기본 상태로 되돌린다. */
export const resetLabels = function () {
  state = { language: DEFAULT_LANGUAGE, labels: {} };
};

/**
 * '{name}' 자리에 값을 넣는다. 문자열 치환만 하며 HTML로 해석하지 않는다.
 * 값을 주지 않은 자리는 그대로 남겨 번역문 누락을 알아볼 수 있게 한다.
 */
export const formatLabel = function (template: string, params: Record<string, string | number>): string {
  return template.replace(/\{([A-Za-z][A-Za-z0-9_]*)\}/g, (whole, name: string) =>
    Object.hasOwn(params, name) ? String(params[name]) : whole,
  );
};
