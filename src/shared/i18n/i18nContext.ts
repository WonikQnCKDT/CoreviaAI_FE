import { createContext, useContext } from "react";
import { DEFAULT_LANGUAGE, type Language } from "@/shared/i18n/language";

export type ChangeLanguageOutcome = { ok: true } | { ok: false; message: string };

export interface I18nContextValue {
  /** 지금 화면에 적용한 언어 */
  language: Language;
  /** 서버 라벨을 쓸 수 있는지. 데모 모드에서는 false이고 한국어 기본 문구만 쓴다. */
  canChangeLanguage: boolean;
  /** 로그인했으면 본인 설정으로 저장하고, 로그인 전이면 이 브라우저에만 적용한다. */
  changeLanguage: (language: Language) => Promise<ChangeLanguageOutcome>;
  /** 관리자가 문구를 고친 뒤 지금 화면에 다시 받아 적용한다. */
  reloadLabels: () => Promise<void>;
}

export const I18nContext = createContext<I18nContextValue>({
  language: DEFAULT_LANGUAGE,
  canChangeLanguage: false,
  changeLanguage: async () => ({ ok: false, message: "" }),
  reloadLabels: async () => undefined,
});

export const useI18n = function () {
  return useContext(I18nContext);
};
