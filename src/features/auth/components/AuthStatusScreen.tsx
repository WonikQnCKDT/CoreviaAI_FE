import { AUTH_TEXT } from "@/features/auth/i18n/ko";

type AuthStatusScreenProps =
  | { kind: "checking" }
  | { kind: "unreachable"; onRetry: () => void; onGoToLogin: () => void };

/** 새로고침 직후 로그인 상태 확인 중 / 서버 연결 실패 화면 */
const AuthStatusScreen = function (props: AuthStatusScreenProps) {
  if (props.kind === "checking") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background-100 px-4">
        <p role="status" aria-live="polite" className="flex items-center gap-2 text-sm text-foreground-600">
          <i className="ri-loader-4-line animate-spin motion-reduce:animate-none" aria-hidden="true" />
          {AUTH_TEXT.checkingSession}
        </p>
      </div>
    );
  }

  const { onRetry, onGoToLogin } = props;
  return (
    <div className="flex min-h-screen items-center justify-center bg-background-100 px-4">
      <section role="alert" className="card w-full max-w-sm p-6 text-center">
        <h1 className="text-base font-semibold text-foreground-950">{AUTH_TEXT.unreachableTitle}</h1>
        <p className="mt-2 text-sm leading-6 text-foreground-600">{AUTH_TEXT.unreachableBody}</p>
        <div className="mt-5 flex flex-wrap justify-center gap-2">
          <button type="button" className="btn-outline" onClick={onGoToLogin}>
            {AUTH_TEXT.goToLogin}
          </button>
          <button type="button" className="btn-primary" onClick={onRetry}>
            {AUTH_TEXT.retry}
          </button>
        </div>
      </section>
    </div>
  );
};

export default AuthStatusScreen;
