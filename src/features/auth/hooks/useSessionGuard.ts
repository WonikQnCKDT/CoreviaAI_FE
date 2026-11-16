import { useCallback, useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useDemoStore } from "@/stores/DemoStore";
import { useAuth } from "@/features/auth/authContext";
import {
  clearSessionActivity,
  isOffline,
  isSessionExpired,
  markSessionExpiredNotice,
  saveReturnTo,
  touchSession,
} from "@/features/auth/utils/session";

const CHECK_INTERVAL_MS = 20 * 1000;

/**
 * 로그인 상태에서 세션 만료를 감지합니다.
 * - 만료가 감지되면 안내를 1회 기록하고 로그인 화면으로 이동합니다.
 * - 일시적인 네트워크 끊김은 로그아웃 사유로 보지 않고 상태만 알려줍니다.
 */
export function useSessionGuard(): { offline: boolean } {
  const { signedIn, currentUserId } = useDemoStore();
  // api 모드에서는 서버 로그아웃(멱등)까지 호출한다. 무활동 만료의 최종 판단은 서버가 한다.
  const { signOut: logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const expiringRef = useRef(false);
  const locationRef = useRef(`${location.pathname}${location.search}`);
  const [offline, setOffline] = useState<boolean>(isOffline);

  locationRef.current = `${location.pathname}${location.search}`;

  const expireSession = useCallback(() => {
    if (expiringRef.current) return;
    expiringRef.current = true;
    saveReturnTo(locationRef.current);
    markSessionExpiredNotice();
    clearSessionActivity();
    logout();
    navigate("/login", { replace: true });
  }, [logout, navigate]);

  // 진입·계정 전환 시에는 만료 여부를 먼저 확인한 뒤에 활동 시각을 갱신합니다.
  useEffect(() => {
    if (!signedIn) {
      expiringRef.current = false;
      return;
    }
    if (isSessionExpired(currentUserId)) {
      expireSession();
      return;
    }
    touchSession(currentUserId);
  }, [signedIn, currentUserId, expireSession]);

  // 화면 이동 시 활동 시각을 갱신합니다. 만료된 세션은 갱신하지 않습니다.
  useEffect(() => {
    if (!signedIn || expiringRef.current) return;
    if (isSessionExpired(currentUserId)) return;
    touchSession(currentUserId);
  }, [signedIn, currentUserId, location.pathname, location.search]);

  useEffect(() => {
    if (!signedIn) return undefined;

    const checkExpiry = () => {
      if (expiringRef.current) return;
      if (isOffline()) return;
      if (isSessionExpired(currentUserId)) expireSession();
    };

    const handleActivity = () => {
      if (expiringRef.current) return;
      touchSession(currentUserId);
    };
    const handleVisibility = () => {
      if (document.visibilityState !== "visible") return;
      checkExpiry();
      handleActivity();
    };
    const handleOffline = () => setOffline(true);
    const handleOnline = () => {
      setOffline(false);
      checkExpiry();
      handleActivity();
    };

    checkExpiry();
    const interval = window.setInterval(checkExpiry, CHECK_INTERVAL_MS);
    window.addEventListener("pointerdown", handleActivity);
    window.addEventListener("keydown", handleActivity);
    window.addEventListener("offline", handleOffline);
    window.addEventListener("online", handleOnline);
    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      window.clearInterval(interval);
      window.removeEventListener("pointerdown", handleActivity);
      window.removeEventListener("keydown", handleActivity);
      window.removeEventListener("offline", handleOffline);
      window.removeEventListener("online", handleOnline);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [signedIn, currentUserId, expireSession]);

  return { offline };
}