import { useEffect, useRef, useState, type FormEvent } from "react";
import Modal from "@/components/ui/Modal";
import { useAuth } from "@/features/auth/authContext";
import { AUTH_TEXT } from "@/features/auth/i18n/ko";
/** 초기화 대상. 서버 사용자 ID를 알면 바로 요청하고, 모르면 입력받는다. */
export interface ResetTarget {
  name: string;
  serverUserId?: number;
}

interface PasswordResetDialogProps<T extends ResetTarget> {
  target: T | null;
  onClose: () => void;
  /** 데모 모드에서 기존 데모 초기화(감사 로그 기록)를 실행한다. */
  onDemoReset?: (target: T) => void;
  /** 발급까지 끝났을 때 (예: 사용자 추가 직후 흐름 안내) */
  description?: string;
}

type ResetState =
  | { phase: "confirm" }
  | { phase: "submitting" }
  | { phase: "issued"; temporaryPassword: string }
  | { phase: "failed"; message: string };

type CopyState = "idle" | "copied" | "failed";

/**
 * 관리자 비밀번호 초기화.
 * - 임시 비밀번호는 응답에서 1회만 받으므로 이 창에서만 보여주고, 닫으면 바로 지운다. 어디에도 저장하지 않는다.
 * - 멱등이 아니라 누를 때마다 새 임시 비밀번호가 발급되므로, 발급 후에는 다시 요청 버튼을 숨긴다.
 */
const PasswordResetDialog = function <T extends ResetTarget>({
  target,
  onClose,
  onDemoReset,
  description,
}: PasswordResetDialogProps<T>) {
  const { mode, resetPassword } = useAuth();
  const isApi = mode === "api";
  const knownServerId = Boolean(target?.serverUserId);
  const [serverUserId, setServerUserId] = useState("");
  const [state, setState] = useState<ResetState>({ phase: "confirm" });
  const [copy, setCopy] = useState<CopyState>("idle");
  const controllerRef = useRef<AbortController | null>(null);

  // 대상이 바뀌거나 창이 닫히면 임시 비밀번호를 포함한 모든 상태를 지운다.
  useEffect(() => {
    controllerRef.current?.abort();
    setServerUserId(target?.serverUserId ? String(target.serverUserId) : "");
    setState({ phase: "confirm" });
    setCopy("idle");
  }, [target]);

  useEffect(() => () => controllerRef.current?.abort(), []);

  const submitting = state.phase === "submitting";
  const issued = state.phase === "issued";

  const handleClose = () => {
    if (submitting) return;
    onClose();
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!target || submitting || issued) return;

    if (!isApi) {
      onDemoReset?.(target);
      onClose();
      return;
    }

    const userId = Number(serverUserId);
    if (!/^\d+$/.test(serverUserId.trim()) || userId < 1) {
      setState({ phase: "failed", message: AUTH_TEXT.resetUserIdInvalid });
      return;
    }

    controllerRef.current?.abort();
    const controller = new AbortController();
    controllerRef.current = controller;
    setState({ phase: "submitting" });
    const outcome = await resetPassword({ userId, signal: controller.signal });
    if (controller.signal.aborted) return;

    if (outcome.kind === "success") {
      setState({ phase: "issued", temporaryPassword: outcome.temporaryPassword });
      return;
    }
    if (outcome.kind === "failed") {
      setState({ phase: "failed", message: outcome.message });
      return;
    }
    setState({ phase: "confirm" });
  };

  const copyPassword = async () => {
    if (state.phase !== "issued") return;
    try {
      await navigator.clipboard.writeText(state.temporaryPassword);
      setCopy("copied");
    } catch {
      setCopy("failed");
    }
  };

  return (
    <Modal
      open={Boolean(target)}
      title="비밀번호 초기화"
      description={
        description ??
        (isApi
          ? "임시 비밀번호를 발급하고 계정 잠금을 해제합니다. 대상 사용자는 다음 로그인 후 비밀번호를 변경해야 합니다."
          : AUTH_TEXT.resetDemoOnly)
      }
      onClose={handleClose}
      footer={
        issued ? (
          <button type="button" className="btn-primary" onClick={onClose}>
            확인했습니다
          </button>
        ) : (
          <>
            <button type="button" className="btn-outline" onClick={handleClose} disabled={submitting}>
              취소
            </button>
            <button type="submit" form="password-reset-form" className="btn-primary" disabled={submitting}>
              {submitting ? (
                <>
                  <i className="ri-loader-4-line animate-spin motion-reduce:animate-none" aria-hidden="true" />
                  초기화 중
                </>
              ) : state.phase === "failed" ? (
                AUTH_TEXT.retry
              ) : (
                "초기화"
              )}
            </button>
          </>
        )
      }
    >
      {issued ? (
        <div className="space-y-3">
          <p className="text-[13px] leading-6 text-foreground-700">
            <span className="font-medium text-foreground-950">{target?.name}</span> 사용자의 임시 비밀번호입니다. 이 창을
            닫으면 다시 볼 수 없으니 지금 대상 사용자에게 안전하게 전달해 주세요.
          </p>
          <div className="flex items-center gap-2 rounded-lg border border-background-300 bg-background-100 px-3 py-2.5">
            <code className="min-w-0 flex-1 select-all break-all font-mono text-[15px] tracking-wide text-foreground-950">
              {state.temporaryPassword}
            </code>
            <button type="button" className="btn-outline shrink-0" onClick={copyPassword}>
              <i className="ri-file-copy-line" aria-hidden="true" />
              복사
            </button>
          </div>
          <p role="status" aria-live="polite" className="text-[12px] text-foreground-600">
            {copy === "copied" && "클립보드에 복사했습니다."}
            {copy === "failed" && "복사하지 못했습니다. 직접 선택해 복사해 주세요."}
          </p>
        </div>
      ) : (
        <form id="password-reset-form" className="space-y-3" onSubmit={handleSubmit} noValidate aria-busy={submitting}>
          <p className="text-[13px] leading-6 text-foreground-700">
            <span className="font-medium text-foreground-950">{target?.name}</span> 사용자의 비밀번호를 초기화합니다. 기존
            세션은 모두 종료됩니다.
          </p>
          {isApi && !knownServerId && (
            <div>
              <label htmlFor="reset-server-user-id" className="mb-1.5 block text-[12px] font-medium text-foreground-800">
                서버 사용자 ID
              </label>
              <input
                id="reset-server-user-id"
                inputMode="numeric"
                className="field text-[13px]"
                value={serverUserId}
                onChange={(event) => {
                  setServerUserId(event.target.value);
                  if (state.phase === "failed") setState({ phase: "confirm" });
                }}
                disabled={submitting}
                aria-describedby="reset-server-user-id-hint"
              />
              <p id="reset-server-user-id-hint" className="mt-1 text-[11px] leading-4 text-foreground-500">
                사용자 목록 API가 연결되기 전까지는 인증 서버의 사용자 ID를 직접 입력합니다. 이 브라우저에서 서버로
                로그인한 적이 있는 사용자는 자동으로 채워집니다.
              </p>
            </div>
          )}
          {state.phase === "failed" && (
            <p role="alert" className="rounded-md border border-rose-200 bg-rose-50 px-2.5 py-2 text-[12px] leading-5 text-rose-700">
              {state.message}
            </p>
          )}
        </form>
      )}
    </Modal>
  );
};

export default PasswordResetDialog;
