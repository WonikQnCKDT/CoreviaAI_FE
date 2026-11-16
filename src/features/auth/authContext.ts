import { createContext, useContext } from "react";
import type { AuthAccount } from "@/features/auth/api/authApi";

export type AuthMode = "api" | "demo";

export const AUTH_MODE: AuthMode = import.meta.env.VITE_AUTH_MODE === "api" ? "api" : "demo";

/**
 * 인증 상태
 * - checking: 새로고침 직후 서버에 로그인 상태를 묻는 중
 * - signedOut: 로그인 필요
 * - signedIn: 로그인됨
 * - unreachable: 서버에 연결하지 못해 상태를 알 수 없음 (다시 시도 가능)
 */
export type AuthStatus = "checking" | "signedOut" | "signedIn" | "unreachable";

export type SignInOutcome =
  | { kind: "success"; mustChangePassword: boolean }
  | { kind: "rejected"; field: "account" | "password" | "form"; message: string }
  | { kind: "locked"; message: string }
  | { kind: "failed"; message: string }
  | { kind: "aborted" };

export type ChangePasswordOutcome =
  | { kind: "success" }
  | { kind: "rejected"; field: "current" | "next" | "form"; message: string }
  | { kind: "failed"; message: string }
  | { kind: "aborted" };

export type ResetPasswordOutcome =
  | { kind: "success"; temporaryPassword: string }
  | { kind: "failed"; message: string }
  | { kind: "aborted" };

export interface AuthContextValue {
  mode: AuthMode;
  status: AuthStatus;
  /** api 모드에서 로그인한 서버 계정. 데모 모드나 로그인 전에는 null */
  account: AuthAccount | null;
  /** true면 비밀번호를 바꾸기 전까지 다른 기능을 쓸 수 없다 */
  mustChangePassword: boolean;
  signIn: (input: { loginId: string; password: string; signal?: AbortSignal }) => Promise<SignInOutcome>;
  signOut: () => Promise<void>;
  changePassword: (input: {
    currentPassword: string;
    newPassword: string;
    signal?: AbortSignal;
  }) => Promise<ChangePasswordOutcome>;
  resetPassword: (input: { userId: number; signal?: AbortSignal }) => Promise<ResetPasswordOutcome>;
  /** unreachable 상태에서 로그인 상태를 다시 확인한다 */
  recheck: () => void;
}

export const AuthContext = createContext<AuthContextValue | null>(null);

export const useAuth = function () {
  const value = useContext(AuthContext);
  if (!value) throw new Error("useAuth는 AuthProvider 안에서만 사용할 수 있습니다.");
  return value;
};
