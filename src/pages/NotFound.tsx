import { Link, useLocation } from "react-router-dom";

export default function NotFound() {
  const location = useLocation();

  return (
    <div className="card flex flex-col items-center justify-center px-6 py-16 text-center">
      <span className="flex h-12 w-12 items-center justify-center rounded-full bg-background-100 text-foreground-400">
        <i className="ri-compass-3-line text-xl" />
      </span>
      <h2 className="mt-3 text-[16px] font-semibold text-foreground-950">페이지를 찾을 수 없습니다</h2>
      <p className="mt-1 text-[12px] text-foreground-600">
        요청한 경로 <span className="font-mono text-foreground-800">{location.pathname}</span> 가 존재하지 않습니다.
      </p>
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <Link to="/" className="btn-primary">
          내 업무로 이동
        </Link>
        <Link to="/projects" className="btn-outline">
          프로젝트 목록
        </Link>
      </div>
      <p className="mt-4 text-[10.5px] text-foreground-400">CoreviaAI 데모 프로토타입</p>
    </div>
  );
}