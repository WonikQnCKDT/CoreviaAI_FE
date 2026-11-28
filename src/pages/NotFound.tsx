import { Link, useLocation } from "react-router-dom";
import { COMMON_UI_TEXT } from "@/shared/i18n/catalog/common";

export default function NotFound() {
  const location = useLocation();

  return (
    <div className="card flex flex-col items-center justify-center px-6 py-16 text-center">
      <span className="flex h-12 w-12 items-center justify-center rounded-full bg-background-100 text-foreground-400">
        <i className="ri-compass-3-line text-xl" />
      </span>
      <h2 className="mt-3 text-[16px] font-semibold text-foreground-950">{COMMON_UI_TEXT.notFoundTitle}</h2>
      <p className="mt-1 text-[12px] text-foreground-600">
        {COMMON_UI_TEXT.notFoundPathPrefix}{" "}
        <span className="font-mono text-foreground-800">{location.pathname}</span> {COMMON_UI_TEXT.notFoundPathSuffix}
      </p>
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <Link to="/" className="btn-primary">
          {COMMON_UI_TEXT.goToMyWork}
        </Link>
        <Link to="/projects" className="btn-outline">
          {COMMON_UI_TEXT.goToProjects}
        </Link>
      </div>
      <p className="mt-4 text-[10.5px] text-foreground-400">{COMMON_UI_TEXT.demoPrototypeFooter}</p>
    </div>
  );
}