import { useCallback, useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { Health } from "@/types";
import { HEALTH_CLASS, HEALTH_LABEL } from "@/utils/ui";
import { COMMON_UI_TEXT } from "@/shared/i18n/catalog/common";
import { formatLabel } from "@/shared/i18n/store";

type Placement = "top" | "bottom";

interface RiskScoreBadgeProps {
  score?: number | null;
  health: Health;
  label?: string;
  className?: string;
}

const TOOLTIP_WIDTH = 172;

export default function RiskScoreBadge({ score, health, label, className = "" }: RiskScoreBadgeProps) {
  const tooltipId = useId();
  const anchorRef = useRef<HTMLSpanElement | null>(null);
  const [open, setOpen] = useState(false);
  const [coords, setCoords] = useState<{ top: number; left: number; placement: Placement }>({
    top: 0,
    left: 0,
    placement: "top",
  });

  const hasScore = typeof score === "number" && Number.isFinite(score);
  const tooltipText = hasScore
    ? formatLabel(COMMON_UI_TEXT.riskScore, { score: Math.round(score as number) })
    : COMMON_UI_TEXT.riskScoreUnknown;

  const place = useCallback(() => {
    const el = anchorRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const half = TOOLTIP_WIDTH / 2;
    const left = Math.min(Math.max(8 + half, rect.left + rect.width / 2), window.innerWidth - 8 - half);
    const placement: Placement = rect.top >= 60 ? "top" : "bottom";
    setCoords({
      top: placement === "top" ? rect.top - 6 : rect.bottom + 6,
      left,
      placement,
    });
  }, []);

  useEffect(() => {
    if (!open) return undefined;
    place();
    const close = () => setOpen(false);
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    const onPointerDown = (event: MouseEvent | TouchEvent) => {
      const el = anchorRef.current;
      if (el && event.target instanceof Node && el.contains(event.target)) return;
      setOpen(false);
    };
    window.addEventListener("scroll", close, true);
    window.addEventListener("resize", close);
    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("touchstart", onPointerDown);
    return () => {
      window.removeEventListener("scroll", close, true);
      window.removeEventListener("resize", close);
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("touchstart", onPointerDown);
    };
  }, [open, place]);

  return (
    <>
      <span ref={anchorRef} className="inline-flex">
        <span
          className={`inline-flex cursor-help items-center gap-1 whitespace-nowrap rounded-md border px-1.5 py-[2px] text-[11px] font-medium leading-5 outline-none focus-visible:ring-2 focus-visible:ring-primary-300 ${HEALTH_CLASS[health]} ${className}`}
          tabIndex={0}
          aria-describedby={open ? tooltipId : undefined}
          onMouseEnter={() => setOpen(true)}
          onMouseLeave={() => setOpen(false)}
          onFocus={() => setOpen(true)}
          onBlur={() => setOpen(false)}
          onClick={(event) => {
            event.stopPropagation();
            setOpen(true);
          }}
          onKeyDown={(event) => {
            if (event.key === "Enter" || event.key === " ") {
              event.preventDefault();
              event.stopPropagation();
              setOpen(true);
            }
          }}
        >
          {label || HEALTH_LABEL[health]}
        </span>
      </span>
      {open &&
        typeof document !== "undefined" &&
        createPortal(
          <span
            id={tooltipId}
            role="tooltip"
            style={{
              position: "fixed",
              top: coords.top,
              left: coords.left,
              transform: coords.placement === "top" ? "translate(-50%, -100%)" : "translate(-50%, 0)",
              width: TOOLTIP_WIDTH,
            }}
            className="pointer-events-none z-[90] rounded-md border border-background-300 bg-background-50 px-2 py-1 text-center text-[11px] font-medium leading-4 text-foreground-900 shadow-lg"
          >
            {tooltipText}
          </span>,
          document.body,
        )}
    </>
  );
}