import { Fragment, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useAuth } from "@/features/auth/authContext";
import { LANGUAGE_TEXT } from "@/shared/i18n/catalog/i18n";
import { I18nContext, type ChangeLanguageOutcome, type I18nContextValue } from "@/shared/i18n/i18nContext";
import { fetchMyLabels, fetchMyLanguage, fetchPublicLabels, updateMyLanguage, type LabelBundle } from "@/shared/i18n/labelApi";
import { readStoredLanguage, storeLanguage, type Language } from "@/shared/i18n/language";
import { applyLabels, currentLanguage, isCurrentBundle } from "@/shared/i18n/store";
import type { ApiFailure } from "@/shared/api/client";

/** 어디서 라벨을 받을지. 데모 모드·로그인 확인 중에는 받지 않고 한국어 기본 문구를 쓴다. */
type Source = "me" | "public" | null;

/** 서버가 준 메시지가 있으면 쓰고, 없으면 공통 실패 문구를 쓴다. */
const failureMessage = (failure: ApiFailure) =>
  (failure.kind === "http" && failure.message) || LANGUAGE_TEXT.changeFailed;

/**
 * 라벨 묶음을 받아 적용하고, 묶음이 바뀌면 아래 화면 전체를 다시 마운트한다.
 * 화면 곳곳의 문구는 렌더링할 때 translate()로 읽으므로, 다시 그리기만 하면 전 화면 문구가 바뀐다(인수 기준: 재배포 없이 전 화면 변경).
 * 로그인·데모 저장소 상태는 이 Provider 위에 있어 다시 마운트해도 유지된다.
 */
const I18nProvider = function ({ children }: { children: ReactNode }) {
  const { mode, status, mustChangePassword } = useAuth();
  const [language, setLanguage] = useState<Language>(currentLanguage());
  const [revision, setRevision] = useState(0);
  const controllerRef = useRef<AbortController | null>(null);

  // 비밀번호 변경이 강제된 세션은 /api/me/** 를 쓸 수 없어 공개 묶음을 쓴다(공통 규약 3절).
  const source: Source =
    mode !== "api" || status === "checking" ? null : status === "signedIn" && !mustChangePassword ? "me" : "public";

  const apply = useCallback((bundle: LabelBundle) => {
    storeLanguage(bundle.language);
    document.documentElement.lang = bundle.language;
    const unchanged = isCurrentBundle(bundle);
    applyLabels(bundle);
    setLanguage(bundle.language);
    if (!unchanged) setRevision((value) => value + 1);
  }, []);

  /** 묶음을 받아 적용한다. 적용했으면 true, 받지 못했거나 더 새 요청에 밀렸으면 false */
  const load = useCallback(
    async ({ language: requested }: { language?: Language | null } = {}): Promise<boolean> => {
      if (!source) return false;
      controllerRef.current?.abort();
      const controller = new AbortController();
      controllerRef.current = controller;
      const result =
        source === "me"
          ? await fetchMyLabels({ signal: controller.signal })
          : await fetchPublicLabels({ language: requested ?? readStoredLanguage(), signal: controller.signal });
      if (controller.signal.aborted) return false;
      // 실패하면 지금 문구(처음에는 한국어 기본 문구)를 그대로 쓴다.
      if (result.ok === false) return false;
      apply(result.data);
      return true;
    },
    [source, apply],
  );

  useEffect(() => {
    load();
    return () => controllerRef.current?.abort();
  }, [load]);

  const changeLanguage = useCallback(
    async (next: Language): Promise<ChangeLanguageOutcome> => {
      if (!source) return { ok: false, message: LANGUAGE_TEXT.changeFailed };
      if (source === "public") {
        const applied = await load({ language: next });
        return applied ? { ok: true } : { ok: false, message: LANGUAGE_TEXT.changeFailed };
      }
      // 본인 설정 저장. version은 사용자 정보 수정과 함께 오르므로, 어긋나면(409) 최신 값으로 한 번만 다시 보낸다.
      for (let attempt = 0; attempt < 2; attempt += 1) {
        const current = await fetchMyLanguage();
        if (current.ok === false) return { ok: false, message: failureMessage(current.failure) };
        const saved = await updateMyLanguage({ language: next, version: current.data.version });
        if (saved.ok === true) {
          // 설정은 저장됐지만 묶음을 못 받았으면 알린다(다음 화면 진입·로그인 때 적용됨).
          return (await load()) ? { ok: true } : { ok: false, message: LANGUAGE_TEXT.savedButNotApplied };
        }
        const conflict = saved.failure.kind === "http" && saved.failure.status === 409;
        if (!conflict || attempt === 1) {
          return { ok: false, message: failureMessage(saved.failure) };
        }
      }
      return { ok: false, message: LANGUAGE_TEXT.changeFailed };
    },
    [source, load],
  );

  const value = useMemo<I18nContextValue>(
    () => ({ language, canChangeLanguage: source !== null, changeLanguage, reloadLabels: async () => {
        await load();
      } }),
    [language, source, changeLanguage, load],
  );

  return (
    <I18nContext.Provider value={value}>
      <Fragment key={revision}>{children}</Fragment>
    </I18nContext.Provider>
  );
};

export default I18nProvider;
