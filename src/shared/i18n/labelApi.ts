import { apiRequest, type ApiResult } from "@/shared/api/client";
import { DEFAULT_LANGUAGE, normalizeLanguage, type Language } from "@/shared/i18n/language";
import { sanitizeLabels } from "@/shared/i18n/store";

/** 화면용 라벨·사용자 언어 API (Confluence 02-4. 다국어 라벨). */

interface LabelBundleDto {
  lang: string;
  labels: unknown;
}

interface LanguagePreferenceDto {
  preferredLanguage: string | null;
  effectiveLanguage: string;
  version: number;
}

export interface LabelBundle {
  /** 서버가 실제로 적용한 언어. 요청한 값이 아니라 이 값으로 화면 언어를 맞춘다. */
  language: Language;
  labels: Record<string, string>;
}

export interface LanguagePreference {
  /** 저장된 값. null이면 저장 안 함(한국어로 적용) */
  preferred: Language | null;
  effective: Language;
  version: number;
}

const toBundle = ({ lang, labels }: LabelBundleDto): LabelBundle => ({
  language: normalizeLanguage(lang) ?? DEFAULT_LANGUAGE,
  labels: sanitizeLabels(labels),
});

const toPreference = ({ preferredLanguage, effectiveLanguage, version }: LanguagePreferenceDto): LanguagePreference => ({
  preferred: normalizeLanguage(preferredLanguage),
  effective: normalizeLanguage(effectiveLanguage) ?? DEFAULT_LANGUAGE,
  version: Number(version),
});

const mapResult = function <A, B>(result: ApiResult<A>, transform: (data: A) => B): ApiResult<B> {
  if (result.ok === false) return result;
  if (!result.data || typeof result.data !== "object") return { ok: false, failure: { kind: "http", status: 200, code: null, message: null } };
  return { ok: true, data: transform(result.data) };
};

/**
 * GET /api/i18n/labels — 공개(로그인 불필요). lang이 없으면 브라우저의 Accept-Language → ko 순으로 서버가 정한다.
 * 세션 처리 대상이 아니므로 scope "public"으로 보낸다(401이 와도 로그아웃 처리하지 않음).
 */
export const fetchPublicLabels = async function ({ language, signal }: { language?: Language | null; signal?: AbortSignal } = {}) {
  const lang = normalizeLanguage(language);
  const query = lang ? `?lang=${encodeURIComponent(lang)}` : "";
  const result = await apiRequest<LabelBundleDto>({ path: `/i18n/labels${query}`, signal, scope: "public" });
  return mapResult(result, toBundle);
};

/** GET /api/me/language/labels — 로그인한 사용자가 저장한 언어의 묶음 */
export const fetchMyLabels = async function ({ signal }: { signal?: AbortSignal } = {}) {
  const result = await apiRequest<LabelBundleDto>({ path: "/me/language/labels", signal });
  return mapResult(result, toBundle);
};

/** GET /api/me/language — 저장값·적용 언어·version */
export const fetchMyLanguage = async function ({ signal }: { signal?: AbortSignal } = {}) {
  const result = await apiRequest<LanguagePreferenceDto>({ path: "/me/language", signal });
  return mapResult(result, toPreference);
};

/** PUT /api/me/language — 본인 언어 저장. version이 다르면 409 CONCURRENT_MODIFICATION */
export const updateMyLanguage = async function ({
  language,
  version,
  signal,
}: {
  language: Language;
  version: number;
  signal?: AbortSignal;
}) {
  const result = await apiRequest<LanguagePreferenceDto>({
    method: "PUT",
    path: "/me/language",
    body: { language: normalizeLanguage(language) ?? DEFAULT_LANGUAGE, version },
    signal,
  });
  return mapResult(result, toPreference);
};
