import { useState } from "react";
import { LANGUAGE_NAME, LANGUAGE_TEXT } from "@/shared/i18n/catalog/i18n";
import { useI18n } from "@/shared/i18n/i18nContext";
import { LANGUAGES, type Language } from "@/shared/i18n/language";

/**
 * 사용자 메뉴 안의 표시 언어 선택(FR-ADM-06·NFR-19). 로그인했으면 본인 설정으로 저장한다(PUT /api/me/language).
 * 서버 라벨을 쓸 수 없는 데모 모드에서는 보여 주지 않는다(한국어 기본 문구만 있음).
 */
const LanguageMenu = function () {
  const { language, canChangeLanguage, changeLanguage } = useI18n();
  const [pending, setPending] = useState<Language | null>(null);
  const [error, setError] = useState("");

  if (!canChangeLanguage) return null;

  const choose = async (next: Language) => {
    if (pending || next === language) return;
    setPending(next);
    setError("");
    const outcome = await changeLanguage(next);
    // 문구가 바뀌면 화면이 다시 그려져 이 메뉴도 새로 만들어진다. 바뀐 문구가 없어 그대로 남는 경우에도 잠금을 푼다.
    setPending(null);
    if (outcome.ok === false) setError(outcome.message);
  };

  return (
    <div className="border-b border-background-200 px-4 py-3" role="group" aria-labelledby="language-menu-label">
      <p id="language-menu-label" className="text-[11px] font-medium text-foreground-600">
        {LANGUAGE_TEXT.label}
      </p>
      <div className="mt-1.5 flex flex-wrap gap-1">
        {LANGUAGES.map((item) => {
          const selected = item === language;
          return (
            <button
              key={item}
              type="button"
              lang={item}
              aria-pressed={selected}
              disabled={pending !== null}
              onClick={() => choose(item)}
              className={`min-h-8 cursor-pointer rounded-md border px-2 text-[11.5px] disabled:cursor-wait ${
                selected
                  ? "border-primary-300 bg-primary-50 font-medium text-primary-700"
                  : "border-background-300 text-foreground-700 hover:bg-background-100"
              }`}
            >
              {selected && <i className="ri-check-line mr-0.5" aria-hidden="true" />}
              {pending === item ? LANGUAGE_TEXT.changing : LANGUAGE_NAME[item]}
            </button>
          );
        })}
      </div>
      {error && (
        <p role="alert" className="mt-1.5 text-[11px] leading-4 text-rose-600">
          {error}
        </p>
      )}
    </div>
  );
};

export default LanguageMenu;
