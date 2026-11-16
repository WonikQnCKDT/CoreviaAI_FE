import { useEffect, useRef, useState } from "react";
import Modal from "@/components/ui/Modal";
import { useDemoStore } from "@/stores/DemoStore";
import { PASSWORD_POLICY_TEXT, passwordRequirements } from "@/features/auth/utils/password";

interface PasswordChangeModalProps {
  open: boolean;
  onClose: () => void;
}

type FieldKey = "current" | "next" | "confirm";
type FieldErrors = Partial<Record<FieldKey, string>>;

const FIELD_META: { key: FieldKey; label: string; autoComplete: string; placeholder: string }[] = [
  { key: "current", label: "현재 비밀번호", autoComplete: "current-password", placeholder: "현재 비밀번호 입력" },
  { key: "next", label: "새 비밀번호", autoComplete: "new-password", placeholder: "새 비밀번호 입력" },
  { key: "confirm", label: "새 비밀번호 확인", autoComplete: "new-password", placeholder: "새 비밀번호 다시 입력" },
];

export default function PasswordChangeModal({ open, onClose }: PasswordChangeModalProps) {
  const { requestPasswordChange } = useDemoStore();
  const [values, setValues] = useState<Record<FieldKey, string>>({ current: "", next: "", confirm: "" });
  const [visible, setVisible] = useState<Record<FieldKey, boolean>>({ current: false, next: false, confirm: false });
  const [errors, setErrors] = useState<FieldErrors>({});
  const [status, setStatus] = useState<{ tone: "error" | "info"; text: string } | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    if (open) return;
    setValues({ current: "", next: "", confirm: "" });
    setVisible({ current: false, next: false, confirm: false });
    setErrors({});
    setStatus(null);
    setSubmitting(false);
    if (timerRef.current) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, [open]);

  useEffect(
    () => () => {
      if (timerRef.current) window.clearTimeout(timerRef.current);
    },
    [],
  );

  const requirements = passwordRequirements(values.next);

  const validate = (): FieldErrors => {
    const next: FieldErrors = {};
    if (!values.current) next.current = "현재 비밀번호를 입력해 주세요.";
    if (!values.next) {
      next.next = "새 비밀번호를 입력해 주세요.";
    } else if (values.next === values.current) {
      next.next = "현재 비밀번호와 다른 비밀번호를 입력해 주세요.";
    } else if (requirements.some((item) => !item.met)) {
      next.next = "비밀번호 정책 조건을 모두 충족해야 합니다.";
    }
    if (!values.confirm) {
      next.confirm = "새 비밀번호 확인을 입력해 주세요.";
    } else if (values.next !== values.confirm) {
      next.confirm = "새 비밀번호와 일치하지 않습니다.";
    }
    return next;
  };

  const updateField = (key: FieldKey, value: string) => {
    setValues((prev) => ({ ...prev, [key]: value }));
    setErrors((prev) => ({ ...prev, [key]: undefined }));
    setStatus(null);
  };

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (submitting) return;
    const nextErrors = validate();
    setErrors(nextErrors);
    setStatus(null);
    if (Object.keys(nextErrors).length > 0) return;

    setSubmitting(true);
    // 실제 인증 API 연동 시 이 자리에서 서버 요청을 보내고 성공 응답을 받은 경우에만 완료를 표시합니다.
    timerRef.current = window.setTimeout(() => {
      const result = requestPasswordChange(values.current, values.next);
      timerRef.current = null;
      setSubmitting(false);
      if (!result.ok) {
        setStatus({ tone: "error", text: result.message });
        return;
      }
      setStatus({ tone: "info", text: result.message });
      setValues({ current: "", next: "", confirm: "" });
    }, 600);
  };

  const handleClose = () => {
    if (submitting) return;
    onClose();
  };

  return (
    <Modal
      open={open}
      title="비밀번호 변경"
      description={`비밀번호는 ${PASSWORD_POLICY_TEXT}이어야 합니다.`}
      onClose={handleClose}
      footer={
        <>
          <button type="button" className="btn-outline whitespace-nowrap" onClick={handleClose} disabled={submitting}>
            취소
          </button>
          <button type="submit" form="password-change-form" className="btn-primary whitespace-nowrap" disabled={submitting}>
            {submitting ? (
              <>
                <i className="ri-loader-4-line animate-spin" aria-hidden="true" />
                확인 중
              </>
            ) : (
              "변경"
            )}
          </button>
        </>
      }
    >
      <form id="password-change-form" className="space-y-3.5" onSubmit={handleSubmit} noValidate>
        {FIELD_META.map((field) => {
          const isVisible = visible[field.key];
          const error = errors[field.key];
          return (
            <div key={field.key}>
              <label htmlFor={`pw-${field.key}`} className="mb-1.5 block text-[12px] font-medium text-foreground-800">
                {field.label}
              </label>
              <div className="relative">
                <input
                  id={`pw-${field.key}`}
                  name={field.key}
                  type={isVisible ? "text" : "password"}
                  autoComplete={field.autoComplete}
                  className={`field pr-10 text-[13px] ${error ? "border-rose-300" : ""}`}
                  placeholder={field.placeholder}
                  value={values[field.key]}
                  onChange={(event) => updateField(field.key, event.target.value)}
                  aria-invalid={Boolean(error)}
                  aria-describedby={`pw-${field.key}-hint`}
                />
                <button
                  type="button"
                  onClick={() => setVisible((prev) => ({ ...prev, [field.key]: !prev[field.key] }))}
                  aria-label={isVisible ? `${field.label} 숨기기` : `${field.label} 표시`}
                  title={isVisible ? "숨기기" : "표시"}
                  className="absolute right-1.5 top-1/2 flex h-7 w-7 -translate-y-1/2 cursor-pointer items-center justify-center rounded text-foreground-500 hover:bg-background-200 hover:text-foreground-800"
                >
                  <i className={isVisible ? "ri-eye-off-line" : "ri-eye-line"} aria-hidden="true" />
                </button>
              </div>

              {field.key === "next" && (
                <ul id="pw-next-hint" className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1">
                  {requirements.map((item) => (
                    <li
                      key={item.key}
                      className={`flex items-center gap-1 text-[10.5px] ${item.met ? "text-primary-600" : "text-foreground-500"}`}
                    >
                      <i className={item.met ? "ri-checkbox-circle-fill" : "ri-checkbox-blank-circle-line"} aria-hidden="true" />
                      {item.label}
                    </li>
                  ))}
                </ul>
              )}

              {field.key === "confirm" && !error && values.confirm.length > 0 && (
                <p id="pw-confirm-hint" className="mt-1 flex items-center gap-1 text-[11px] text-primary-600">
                  <i className="ri-check-line" aria-hidden="true" /> 새 비밀번호와 일치합니다.
                </p>
              )}

              {error && (
                <p id={`pw-${field.key}-error`} role="alert" className="mt-1 flex items-center gap-1 text-[11px] text-rose-600">
                  <i className="ri-error-warning-line" aria-hidden="true" /> {error}
                </p>
              )}
            </div>
          );
        })}

        {status && (
          <p
            role="status"
            className={`rounded-md border px-2.5 py-2 text-[11.5px] leading-5 ${
              status.tone === "error"
                ? "border-amber-200 bg-amber-50 text-amber-800"
                : "border-primary-200 bg-primary-50 text-primary-700"
            }`}
          >
            {status.text}
          </p>
        )}

        <p className="rounded-md border border-background-200 bg-background-100 px-2.5 py-2 text-[10.5px] leading-4 text-foreground-600">
          비밀번호 정책: {PASSWORD_POLICY_TEXT}. 숫자와 대문자는 필수 조건이 아닙니다. 입력한 비밀번호는 브라우저 저장소나
          로그에 남기지 않습니다.
        </p>
      </form>
    </Modal>
  );
}