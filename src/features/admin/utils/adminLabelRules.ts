import type { ApiFailure } from "@/shared/api/client";
import type { LabelTexts } from "@/features/admin/api/adminLabelApi";
import { ADMIN_LABEL_TEXT } from "@/features/admin/i18n/ko";
import { adminErrorMessage, failureStatus } from "@/features/admin/utils/adminFormat";

/** BE와 같은 규칙 (I18nLabel.LABEL_KEY_PATTERN·MAX_TEXT_LENGTH·TEXT_PATTERN). 서버도 검사하지만 보내기 전에 막는다. */
export const LABEL_KEY_PATTERN = /^(?=.{1,100}$)[A-Za-z][A-Za-z0-9_-]*(\.[A-Za-z0-9_-]+)*$/;
export const MAX_LABEL_KEY_LENGTH = 100;
export const MAX_LABEL_TEXT_LENGTH = 500;
// eslint-disable-next-line no-control-regex -- BE TEXT_PATTERN(Java \p{Cntrl} = U+0000~U+001F, U+007F)과 같게 검사한다
const CONTROL_CHARACTER = /[\u0000-\u001f\u007f]/;

export type LabelField = "labelKey" | "textKo" | "textEn" | "textZhTw";
export type LabelErrors = Partial<Record<LabelField, string>>;

const checkText = function (text: string, { required }: { required: boolean }): string | undefined {
  const value = text.trim();
  if (!value) return required ? ADMIN_LABEL_TEXT.textKoRequired : undefined;
  if (value.length > MAX_LABEL_TEXT_LENGTH) return ADMIN_LABEL_TEXT.textTooLong;
  if (CONTROL_CHARACTER.test(value)) return ADMIN_LABEL_TEXT.textControlCharacter;
  return undefined;
};

/** 등록이면 라벨 키도 검사한다. 수정이면 키는 고정이라 검사하지 않는다. */
export const validateLabel = function ({
  labelKey,
  texts,
  creating,
}: {
  labelKey: string;
  texts: LabelTexts;
  creating: boolean;
}): LabelErrors {
  const errors: LabelErrors = {};
  if (creating) {
    const key = labelKey.trim();
    if (!key) errors.labelKey = ADMIN_LABEL_TEXT.keyRequired;
    else if (!LABEL_KEY_PATTERN.test(key)) errors.labelKey = ADMIN_LABEL_TEXT.keyFormat;
  }
  const ko = checkText(texts.textKo, { required: true });
  const en = checkText(texts.textEn, { required: false });
  const zh = checkText(texts.textZhTw, { required: false });
  if (ko) errors.textKo = ko;
  if (en) errors.textEn = en;
  if (zh) errors.textZhTw = zh;
  return errors;
};

export interface LabelFailureView {
  message: string;
  field: LabelField | null;
  /** 화면 값이 낡아 목록을 다시 받아야 하는지 */
  stale: boolean;
}

/**
 * 오류 본문에는 code가 없어(공통 규약 6절) API별 status로 상황을 정한다.
 * 등록: 409는 DUPLICATE_LABEL_KEY뿐이라 키 칸에 붙인다.
 * 수정: 409는 CONCURRENT_MODIFICATION, 404는 LABEL_NOT_FOUND라 최신 목록을 다시 받는다.
 */
export const interpretLabelFailure = function (failure: ApiFailure, { creating }: { creating: boolean }): LabelFailureView {
  const status = failureStatus(failure);
  if (creating) {
    const message = adminErrorMessage(failure);
    return { message, field: status === 409 ? "labelKey" : null, stale: false };
  }
  const message = adminErrorMessage(failure, { byStatus: { 409: ADMIN_LABEL_TEXT.concurrentModification } });
  return { message, field: null, stale: status === 409 || status === 404 };
};
