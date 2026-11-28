import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { COMMON_UI_TEXT } from "@/shared/i18n/catalog/common";

interface NoAccessProps {
  title?: string;
  description?: string;
  requiredRole?: string;
  action?: ReactNode;
}

export default function NoAccess({
  title,
  description,
  requiredRole,
  action,
}: NoAccessProps) {
  const resolvedTitle = title ?? COMMON_UI_TEXT.noAccessTitle;
  const resolvedDescription = description ?? COMMON_UI_TEXT.noAccessDescription;
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-background-300 bg-background-50 px-6 py-16 text-center">
      <span className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-rose-50 text-rose-500">
        <i className="ri-shield-keyhole-line text-xl" />
      </span>
      <p className="text-[15px] font-semibold text-foreground-950">{resolvedTitle}</p>
      <p className="mt-1.5 max-w-md text-[12.5px] leading-6 text-foreground-600">{resolvedDescription}</p>
      {requiredRole && (
        <p className="mt-3 rounded-md border border-background-300 bg-background-100 px-3 py-1.5 text-[11.5px] text-foreground-600">
          {COMMON_UI_TEXT.requiredRolePrefix} · <span className="font-medium text-foreground-800">{requiredRole}</span>
        </p>
      )}
      <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
        {action}
        <Link to="/" className="btn-outline">
          {COMMON_UI_TEXT.goToMyWork}
        </Link>
      </div>
      <p className="mt-5 text-[10.5px] leading-4 text-foreground-400">
        {COMMON_UI_TEXT.demoPermissionNote}
      </p>
    </div>
  );
}