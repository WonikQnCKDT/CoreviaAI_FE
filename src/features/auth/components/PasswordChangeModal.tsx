import { useEffect, useRef, useState, type FormEvent } from "react";
import Modal from "@/components/ui/Modal";
import { useAuth } from "@/features/auth/authContext";
import { AUTH_TEXT } from "@/features/auth/i18n/ko";
import { PASSWORD_MAX_LENGTH, PASSWORD_POLICY_TEXT, passwordRequirements } from "@/features/auth/utils/password";

interface PasswordChangeModalProps {
  open: boolean;
  onClose: () => void;
  /** 비밀번호 변경 강제 상태. 닫을 수 없고, 로그아웃만 할 수 있다. */
  forced?: boolean;
}

type FieldKey = "current" | "next" | "confirm";
type FieldErrors = Partial<Record<FieldKey, string>>;
type SubmitState = { phase: "idle" } | { phase: "submitting" } | { phase: "failed"; message: string };

const CURRENT_PASSWORD_MAX_LENGTH = 128;

const FIELD_META: { key: FieldKey; label: string; autoComplete: string; placeholder: string; maxLength: number }[] = [
  {
    key: "current",
    label: "현재 비밀번호",
    autoComplete: "current-password",
    placeholder: "현재(또는 임시) 비밀번호 입력",
    maxLength: CURRENT_PASSWORD_MAX_LENGTH,
  },
  { key: "next", label: "새 비밀번호", autoComplete: "new-password", placeholder: "새 비밀번호 입력", maxLength: PASSWORD_MAX_LENGTH },
  {
    key: "confirm",
    label: "새 비밀번호 확인",
    autoComplete: "new-password",
    placeholder: "새 비밀번호 다시 입력",
    maxLength: PASSWORD_MAX_LENGTH,
  },
];

const EMPTY_VALUES: Record<FieldKey, string> = { current: "", next: "", confirm: "" };
const HIDDEN: Record<FieldKey, boolean> = { current: false, next: false, confirm: false };

const PasswordChangeModal = function ({ open, onClose, forced = false }: PasswordChangeModalProps) {
  const { changePassword, signOut } = useAuth();
  const [values, setValues] = useState<Record<FieldKey, string>>(EMPTY_VALUES);
  const [visible, setVisible] = useState<Record<FieldKey, boolean>>(HIDDEN);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [submit, setSubmit] = useState<SubmitState>({ phase: "idle" });
  const controllerRef = useRef<AbortController | null>(null);

  const submitting = submit.phase === "submitting";

  // 창을 닫으면 입력값을 바로 지운다. 비밀번호는 어디에도 남기지 않는다.
  useEffect(() => {
    if (open) return;
    controllerRef.current?.abort();
    setValues(EMPTY_VALUES);
    setVisible(HIDDEN);
    setErrors({});
    setSubmit({ phase: "idle" });
  }, [open]);

  useEffect(() => () => controllerRef.current?.abort(), []);

  const requirements = passwordRequirements(values.next);

  const validate = (): FieldErrors => {
    const { current, next, confirm } = values;
    const found: FieldErrors = {};
    if (!current) found.current = "현재 비밀번호를 입력해 주세요.";
    if (!next) {
      found.next = "새 비밀번호를 입력해 주세요.";
    } else if (next === current) {
      found.next = AUTH_TEXT.sameAsCurrent;
    } else if (requirements.some(({ met }) => !met)) {
      found.next = "비밀번호 규칙을 모두 충족해야 합니다.";
    }
    if (!confirm) {
      found.confirm = "새 비밀번호 확인을 입력해 주세요.";
    } else if (next !== confirm) {
      found.confirm = "새 비밀번호와 일치하지 않습니다.";
    }
    return found;
  };

  const updateField = (key: FieldKey, value: string) => {
    setValues((prev) => ({ ...prev, [key]: value }));
    setErrors((prev) => ({ ...prev, [key]: undefined }));
    if (submit.phase === "failed") setSubmit({ phase: "idle" });
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (submitting) return;
    const found = validate();
    setErrors(found);
    if (Object.keys(found).length > 0) return;

    controllerRef.current?.abort();
    const controller = new AbortController();
    controllerRef.current = controller;
    setSubmit({ phase: "submitting" });

    const outcome = await changePassword({
      currentPassword: values.current,
      newPassword: values.next,
      signal: controller.signal,
    });
    if (controller.signal.aborted) return;

    switch (outcome.kind) {
      case "success":
        // 서버가 세션을 끝냈다. 화면은 로그인 화면으로 이동하고, 안내는 로그인 화면에서 보여준다.
        setValues(EMPTY_VALUES);
        setSubmit({ phase: "idle" });
        onClose();
        return;
      case "rejected": {
        const { field, message } = outcome;
        if (field === "form") {
          setSubmit({ phase: "failed", message });
        } else {
          setErrors({ [field]: message });
          setSubmit({ phase: "idle" });
        }
        return;
      }
      case "failed":
        setSubmit({ phase: "failed", message: outcome.message });
        return;
      default:
        setSubmit({ phase: "idle" });
    }
  };

  const handleClose = () => {
    if (submitting || forced) return;
    onClose();
  };

  return (
    <Modal
      open={open}
      title={forced ? AUTH_TEXT.forcedChangeTitle : "비밀번호 변경"}
      description={forced ? AUTH_TEXT.forcedChangeDescription : `비밀번호는 ${PASSWORD_POLICY_TEXT}여야 합니다.`}
      onClose={handleClose}
      dismissible={!forced}
      footer={
        <>
          {forced ? (
            <button type="button" className="btn-outline whitespace-nowrap" onClick={() => signOut()} disabled={submitting}>
              로그아웃
            </button>
          ) : (
            <button type="button" className="btn-outline whitespace-nowrap" onClick={handleClose} disabled={submitting}>
              취소
            </button>
          )}
          <button type="submit" form="password-change-form" className="btn-primary whitespace-nowrap" disabled={submitting}>
            {submitting ? (
              <>
                <i className="ri-loader-4-line animate-spin motion-reduce:animate-none" aria-hidden="true" />
                변경 중
              </>
            ) : (
              "변경"
            )}
          </button>
        </>
      }
    >
      <form id="password-change-form" className="space-y-3.5" onSubmit={handleSubmit} noValidate aria-busy={submitting}>
        {FIELD_META.map(({ key, label, autoComplete, placeholder, maxLength }) => {
          const isVisible = visible[key];
          const error = errors[key];
          const describedBy = [key === "next" ? "pw-next-hint" : "", error ? `pw-${key}-error` : ""].filter(Boolean).join(" ");
          return (
            <div key={key}>
              <label htmlFor={`pw-${key}`} className="mb-1.5 block text-[12px] font-medium text-foreground-800">
                {label}
              </label>
              <div className="relative">
                <input
                  id={`pw-${key}`}
                  name={key}
                  type={isVisible ? "text" : "password"}
                  autoComplete={autoComplete}
                  maxLength={maxLength}
                  className={`field pr-10 text-[13px] ${error ? "border-rose-300" : ""}`}
                  placeholder={placeholder}
                  value={values[key]}
                  onChange={(event) => updateField(key, event.target.value)}
                  aria-invalid={Boolean(error)}
                  aria-describedby={describedBy || undefined}
                  disabled={submitting}
                />
                <button
                  type="button"
                  onClick={() => setVisible((prev) => ({ ...prev, [key]: !prev[key] }))}
                  aria-label={isVisible ? `${label} 숨기기` : `${label} 표시`}
                  title={isVisible ? "숨기기" : "표시"}
                  className="absolute right-1.5 top-1/2 flex h-7 w-7 -translate-y-1/2 cursor-pointer items-center justify-center rounded text-foreground-500 hover:bg-background-200 hover:text-foreground-800"
                >
                  <i className={isVisible ? "ri-eye-off-line" : "ri-eye-line"} aria-hidden="true" />
                </button>
              </div>

              {key === "next" && (
                <ul id="pw-next-hint" className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1" aria-label="비밀번호 규칙">
                  {requirements.map(({ key: ruleKey, label: ruleLabel, met }) => (
                    <li
                      key={ruleKey}
                      className={`flex items-center gap-1 text-[11px] ${met ? "text-primary-700" : "text-foreground-500"}`}
                    >
                      <i className={met ? "ri-checkbox-circle-fill" : "ri-checkbox-blank-circle-line"} aria-hidden="true" />
                      {ruleLabel}
                      <span className="sr-only">{met ? "충족" : "미충족"}</span>
                    </li>
                  ))}
                </ul>
              )}

              {error && (
                <p id={`pw-${key}-error`} role="alert" className="mt-1 flex items-center gap-1 text-[11px] text-rose-600">
                  <i className="ri-error-warning-line" aria-hidden="true" /> {error}
                </p>
              )}
            </div>
          );
        })}

        {submit.phase === "failed" && (
          <div role="alert" className="flex items-start justify-between gap-2 rounded-md border border-rose-200 bg-rose-50 px-2.5 py-2">
            <p className="text-[12px] leading-5 text-rose-700">{submit.message}</p>
            <button type="submit" className="shrink-0 text-[12px] font-medium text-rose-700 underline underline-offset-2">
              {AUTH_TEXT.retry}
            </button>
          </div>
        )}

        <p className="rounded-md border border-background-200 bg-background-100 px-2.5 py-2 text-[11px] leading-4 text-foreground-600">
          비밀번호 규칙: {PASSWORD_POLICY_TEXT}. 대문자는 필수가 아닙니다. 변경하면 모든 기기에서 로그아웃되며 새 비밀번호로
          다시 로그인해야 합니다.
        </p>
      </form>
    </Modal>
  );
};

export default PasswordChangeModal;
