import { useOutletContext } from "react-router-dom";

/** 프로젝트 상세 레이아웃이 하위 화면에 넘기는 값 */
export interface ProjectOutletContext {
  /** api 모드: 서버 상세·단계·멤버를 다시 받아 화면 프로젝트(PM 표시·권한)를 맞춘다 */
  reloadServer: () => void;
}

const NOOP = () => undefined;

/** 레이아웃 밖(화면 단독 테스트 등)에서는 아무것도 하지 않는 함수를 준다. */
export const useProjectServerReload = function (): () => void {
  const context = useOutletContext<ProjectOutletContext | undefined>();
  return context?.reloadServer ?? NOOP;
};
