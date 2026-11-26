import { useEffect, useRef, useState, type FormEvent } from "react";
import Modal from "@/components/ui/Modal";
import { createAdminLabel, updateAdminLabel, type AdminLabel, type LabelTexts } from "@/features/admin/api/adminLabelApi";
import { ADMIN_LABEL_TEXT, ADMIN_TEXT } from "@/features/admin/i18n/ko";
import {
  interpretLabelFailure,
  MAX_LABEL_KEY_LENGTH,
  MAX_LABEL_TEXT_LENGTH,
  validateLabel,
  type LabelErrors,
  type LabelField,
} from "@/features/admin/utils/adminLabelRules";
import { BUTTON_TEXT } from "@/shared/i18n/catalog/button";

export type LabelFormMode = { kind: "create" } | { kind: "edit"; label: AdminLabel };

type SubmitState = { phase: "idle" } | { phase: "submitting" } | { phase: "failed"; message: string };

const EMPTY_TEXTS: LabelTexts = { textKo: "", textEn: "", textZhTw: "" };

const textsOf = (mode: LabelFormMode | null): LabelTexts =>
  mode?.kind === "edit"
    ? { textKo: mode.label.textKo, textEn: mode.label.textEn ?? "", textZhTw: mode.label.textZhTw ?? "" }
    : EMPTY_TEXTS;

interface LabelFormDialogProps {
  mode: LabelFormMode | null;
  onClose: () => void;
  onSaved: (args: { label: AdminLabel; created: boolean }) => void;
  /** 동시 수정(409)·없는 라벨(404)처럼 목록이 낡았을 때 */
  onStale: () => void;
}

const TEXT_FIELDS: { field: Exclude<LabelField, "labelKey">; label: () => string; lang: string }[] = [
  { field: "textKo", label: () => ADMIN_LABEL_TEXT.textKo, lang: "ko" },
  { field: "textEn", label: () => ADMIN_LABEL_TEXT.textEn, lang: "en" },
  { field: "textZhTw", label: () => ADMIN_LABEL_TEXT.textZhTw, lang: "zh-TW" },
];

/** 라벨 등록·문구 수정. 문구는 글자 그대로 다루며 HTML로 해석하지 않는다. */
const LabelFormDialog = function ({ mode, onClose, onSaved, onStale }: LabelFormDialogProps) {
  const [labelKey, setLabelKey] = useState("");
  const [texts, setTexts] = useState<LabelTexts>(EMPTY_TEXTS);
  const [errors, setErrors] = useState<LabelErrors>({});
  const [submit, setSubmit] = useState<SubmitState>({ phase: "idle" });
  const controllerRef = useRef<AbortController | null>(null);
  const creating = mode?.kind === "create";
  const submitting = submit.phase === "submitting";

  useEffect(() => {
    controllerRef.current?.abort();
    setLabelKey(mode?.kind === "edit" ? mode.label.labelKey : "");
    setTexts(textsOf(mode));
    setErrors({});
    setSubmit({ phase: "idle" });
  }, [mode]);

  useEffect(() => () => controllerRef.current?.abort(), []);

  const clearError = (field: LabelField) => {
    if (errors[field]) setErrors((prev) => ({ ...prev, [field]: undefined }));
    if (submit.phase === "failed") setSubmit({ phase: "idle" });
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!mode || submitting) return;
    const found = validateLabel({ labelKey, texts, creating });
    setErrors(found);
    if (Object.keys(found).length > 0) return;

    controllerRef.current?.abort();
    const controller = new AbortController();
    controllerRef.current = controller;
    setSubmit({ phase: "submitting" });
    const result =
      mode.kind === "create"
        ? await createAdminLabel({ labelKey, texts, signal: controller.signal })
        : await updateAdminLabel({ labelId: mode.label.id, texts, version: mode.label.version, signal: controller.signal });
    if (controller.signal.aborted) return;
    if (result.ok === true) {
      setSubmit({ phase: "idle" });
      onSaved({ label: result.data, created: mode.kind === "create" });
      return;
    }
    const { message, field, stale } = interpretLabelFailure(result.failure, { creating: mode.kind === "create" });
    if (stale) onStale();
    if (field) {
      setErrors({ [field]: message });
      setSubmit({ phase: "idle" });
      return;
    }
    setSubmit({ phase: "failed", message });
  };

  const fieldClass = (field: LabelField) => `field text-sm ${errors[field] ? "border-rose-300" : ""}`;
  const errorText = (field: LabelField) =>
    errors[field] ? (
      <p id={`label-${field}-error`} role="alert" className="mt-1 text-xs text-rose-600">
        {errors[field]}
      </p>
    ) : null;

  return (
    <Modal
      open={Boolean(mode)}
      title={creating ? ADMIN_LABEL_TEXT.add : ADMIN_LABEL_TEXT.edit}
      description={ADMIN_LABEL_TEXT.emptyMeansMissing}
      onClose={() => {
        if (!submitting) onClose();
      }}
      footer={
        <>
          <button type="button" className="btn-outline" onClick={onClose} disabled={submitting}>
            {BUTTON_TEXT.cancel}
          </button>
          <button type="submit" form="admin-label-form" className="btn-primary" disabled={submitting}>
            {submitting ? (
              <>
                <i className="ri-loader-4-line animate-spin motion-reduce:animate-none" aria-hidden="true" />
                {ADMIN_TEXT.saving}
              </>
            ) : creating ? (
              BUTTON_TEXT.register
            ) : (
              BUTTON_TEXT.save
            )}
          </button>
        </>
      }
    >
      <form id="admin-label-form" className="space-y-3" onSubmit={handleSubmit} noValidate aria-busy={submitting}>
        <div>
          <label htmlFor="label-labelKey" className="mb-1 block text-xs font-medium text-foreground-800">
            {ADMIN_LABEL_TEXT.key}
          </label>
          <input
            id="label-labelKey"
            className={`${fieldClass("labelKey")} font-mono`}
            value={labelKey}
            maxLength={MAX_LABEL_KEY_LENGTH}
            autoComplete="off"
            spellCheck={false}
            disabled={!creating || submitting}
            onChange={(event) => {
              setLabelKey(event.target.value);
              clearError("labelKey");
            }}
            aria-invalid={Boolean(errors.labelKey)}
            aria-describedby={errors.labelKey ? "label-labelKey-error" : creating ? undefined : "label-labelKey-fixed"}
          />
          {errorText("labelKey")}
          {!creating && (
            <p id="label-labelKey-fixed" className="mt-1 text-xs text-foreground-500">
              {ADMIN_LABEL_TEXT.keyFixed}
            </p>
          )}
        </div>
        {TEXT_FIELDS.map(({ field, label, lang }) => (
          <div key={field}>
            <label htmlFor={`label-${field}`} className="mb-1 block text-xs font-medium text-foreground-800">
              {label()}
            </label>
            <input
              id={`label-${field}`}
              lang={lang}
              className={fieldClass(field)}
              value={texts[field]}
              maxLength={MAX_LABEL_TEXT_LENGTH}
              disabled={submitting}
              onChange={(event) => {
                const value = event.target.value;
                setTexts((prev) => ({ ...prev, [field]: value }));
                clearError(field);
              }}
              aria-invalid={Boolean(errors[field])}
              aria-describedby={errors[field] ? `label-${field}-error` : undefined}
            />
            {errorText(field)}
          </div>
        ))}
        {submit.phase === "failed" && (
          <p role="alert" className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-xs leading-5 text-rose-700">
            {submit.message}
          </p>
        )}
      </form>
    </Modal>
  );
};

export default LabelFormDialog;
