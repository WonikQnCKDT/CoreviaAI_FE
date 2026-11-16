import type { ReactNode } from "react";
import { Link } from "react-router-dom";

interface NoAccessProps {
  title?: string;
  description?: string;
  requiredRole?: string;
  action?: ReactNode;
}

export default function NoAccess({
  title = "이 화면에 접근할 권한이 없습니다",
  description = "현재 계정에는 이 화면을 볼 수 있는 권한이 없습니다. 필요한 경우 프로젝트 PM 또는 시스템 관리자에게 권한을 요청해 주세요.",
  requiredRole,
  action,
}: NoAccessProps) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-background-300 bg-background-50 px-6 py-16 text-center">
      <span className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-rose-50 text-rose-500">
        <i className="ri-shield-keyhole-line text-xl" />
      </span>
      <p className="text-[15px] font-semibold text-foreground-950">{title}</p>
      <p className="mt-1.5 max-w-md text-[12.5px] leading-6 text-foreground-600">{description}</p>
      {requiredRole && (
        <p className="mt-3 rounded-md border border-background-300 bg-background-100 px-3 py-1.5 text-[11.5px] text-foreground-600">
          필요한 권한 · <span className="font-medium text-foreground-800">{requiredRole}</span>
        </p>
      )}
      <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
        {action}
        <Link to="/" className="btn-outline">
          내 업무로 이동
        </Link>
      </div>
      <p className="mt-5 text-[10.5px] leading-4 text-foreground-400">
        데모 UI 권한 시뮬레이션입니다. 실제 서버 접근 제어가 아닙니다.
      </p>
    </div>
  );
}