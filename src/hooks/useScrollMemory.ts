import { useEffect } from "react";
import { useNavigationType } from "react-router-dom";

const PREFIX = "corevia-scroll:";

/**
 * 뒤로가기(POP)로 돌아왔을 때만 이전 스크롤 위치를 복원합니다.
 * 새로 이동한 화면에서는 항상 상단에서 시작합니다.
 */
export function useScrollMemory(key: string) {
  const navigationType = useNavigationType();

  useEffect(() => {
    const storageKey = `${PREFIX}${key}`;
    let frame = 0;

    if (navigationType === "POP") {
      try {
        const saved = Number(sessionStorage.getItem(storageKey) || "0");
        if (Number.isFinite(saved) && saved > 0) {
          frame = window.requestAnimationFrame(() => {
            window.scrollTo({ top: saved, behavior: "auto" });
          });
        }
        sessionStorage.removeItem(storageKey);
      } catch {
        // 저장된 위치를 읽지 못해도 화면은 정상 표시합니다.
      }
    }

    const save = () => {
      try {
        sessionStorage.setItem(storageKey, String(window.scrollY));
      } catch {
        // 무시
      }
    };

    window.addEventListener("scroll", save, { passive: true });
    return () => {
      save();
      window.removeEventListener("scroll", save);
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, [key, navigationType]);
}