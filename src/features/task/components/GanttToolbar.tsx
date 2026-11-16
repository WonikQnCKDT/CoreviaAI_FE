import { useCallback, useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";

export type GanttViewMode = "day" | "week" | "month";

interface GanttToolbarProps {
  view: GanttViewMode;
  onChangeView: (view: GanttViewMode) => void;
  storageKey: string;
}

interface StoredToolbarState {
  locked: boolean;
  x: number;
  y: number;
}

const VIEW_OPTIONS: { key: GanttViewMode; label: string }[] = [
  { key: "day", label: "일" },
  { key: "week", label: "주" },
  { key: "month", label: "월" },
];

const ESTIMATE_WIDTH = 470;
const ESTIMATE_HEIGHT = 52;
const SAFE_MARGIN = 8;
const TOP_SAFE = 72;

function clampPosition(x: number, y: number, width: number, height: number) {
  const maxX = Math.max(SAFE_MARGIN, window.innerWidth - width - SAFE_MARGIN);
  const maxY = Math.max(TOP_SAFE, window.innerHeight - height - SAFE_MARGIN);
  return {
    x: Math.min(Math.max(x, SAFE_MARGIN), maxX),
    y: Math.min(Math.max(y, TOP_SAFE), maxY),
  };
}

function defaultPosition() {
  const centered = (window.innerWidth - ESTIMATE_WIDTH) / 2;
  return { x: Math.round(Math.max(centered, SAFE_MARGIN)), y: 88 };
}

/**
 * 간트 도구 모음.
 * - 기본값은 상단 고정(잠금) 상태입니다.
 * - 잠금을 해제하면 핸들을 잡고 옮길 수 있고, 위치는 다시 방문해도 복원됩니다.
 * - 드래그는 핸들에서만 동작하므로 일/주/월 버튼 클릭과 충돌하지 않습니다.
 * - 화면 크기가 바뀌면 보이는 영역 안으로 위치를 보정합니다.
 * - 모바일에서는 드래그 대신 상단 고정형 접이식 도구 모음을 사용합니다.
 */
export default function GanttToolbar({ view, onChangeView, storageKey }: GanttToolbarProps) {
  const panelRef = useRef<HTMLDivElement | null>(null);
  const dragRef = useRef<{ dx: number; dy: number } | null>(null);
  const [locked, setLocked] = useState(true);
  const [position, setPosition] = useState(() => ({ x: 0, y: 88 }));
  const [ready, setReady] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [dragging, setDragging] = useState(false);

  const measure = useCallback(() => {
    const rect = panelRef.current?.getBoundingClientRect();
    return {
      width: rect?.width || ESTIMATE_WIDTH,
      height: rect?.height || ESTIMATE_HEIGHT,
    };
  }, []);

  useEffect(() => {
    let stored: Partial<StoredToolbarState> | null = null;
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw) stored = JSON.parse(raw) as Partial<StoredToolbarState>;
    } catch {
      stored = null;
    }
    setLocked(stored?.locked !== false);
    const base = defaultPosition();
    setPosition(
      typeof stored?.x === "number" && typeof stored?.y === "number"
        ? clampPosition(stored.x, stored.y, ESTIMATE_WIDTH, ESTIMATE_HEIGHT)
        : base,
    );
    setReady(true);
  }, [storageKey]);

  useEffect(() => {
    if (!ready) return;
    try {
      localStorage.setItem(storageKey, JSON.stringify({ locked, x: position.x, y: position.y }));
    } catch {
      // 저장 공간을 사용할 수 없어도 툴바 동작은 유지합니다.
    }
  }, [ready, locked, position, storageKey]);

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.matchMedia("(max-width: 767px)").matches);
      const { width, height } = measure();
      setPosition((prev) => clampPosition(prev.x, prev.y, width, height));
    };
    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [measure]);

  const floating = ready && !locked && !isMobile;

  const unlock = () => {
    const rect = panelRef.current?.getBoundingClientRect();
    const { width, height } = measure();
    const target = rect
      ? clampPosition(rect.left, rect.top, rect.width, rect.height)
      : clampPosition(defaultPosition().x, defaultPosition().y, width, height);
    setPosition(target);
    setLocked(false);
  };

  const resetPosition = () => {
    const base = defaultPosition();
    const { width, height } = measure();
    setPosition(clampPosition(base.x, base.y, width, height));
  };

  const startDrag = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!floating) return;
    const rect = panelRef.current?.getBoundingClientRect();
    if (!rect) return;
    dragRef.current = { dx: event.clientX - rect.left, dy: event.clientY - rect.top };
    setDragging(true);
    event.currentTarget.setPointerCapture(event.pointerId);
    event.preventDefault();
  };

  const moveDrag = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!dragRef.current) return;
    const { width, height } = measure();
    setPosition(
      clampPosition(event.clientX - dragRef.current.dx, event.clientY - dragRef.current.dy, width, height),
    );
  };

  const endDrag = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!dragRef.current) return;
    dragRef.current = null;
    setDragging(false);
    try {
      event.currentTarget.releasePointerCapture(event.pointerId);
    } catch {
      // 이미 해제된 포인터는 무시합니다.
    }
  };

  const viewControl = (
    <div className="flex items-center gap-0.5 rounded-full border border-background-300 bg-background-100 p-0.5">
      {VIEW_OPTIONS.map((option) => (
        <button
          key={option.key}
          type="button"
          onClick={() => onChangeView(option.key)}
          aria-pressed={view === option.key}
          className={`cursor-pointer whitespace-nowrap rounded-full px-3 py-1 text-[11.5px] font-medium transition ${
            view === option.key
              ? "bg-background-50 text-primary-700 shadow-card"
              : "text-foreground-600 hover:text-foreground-900"
          }`}
        >
          {option.label}
        </button>
      ))}
    </div>
  );

  return (
    <div
      ref={panelRef}
      role="toolbar"
      aria-label="간트 도구 모음"
      style={floating ? { left: position.x, top: position.y } : undefined}
      className={`border border-background-300 bg-background-50/95 backdrop-blur ${
        floating
          ? "fixed z-20 flex items-center gap-1.5 rounded-xl p-1.5 shadow-panel"
          : "sticky top-16 z-20 flex w-full flex-wrap items-center gap-1.5 rounded-xl p-1.5 shadow-card sm:w-fit"
      }`}
    >
      <div className="flex flex-wrap items-center gap-1.5">
        {floating ? (
          <div
            role="button"
            tabIndex={0}
            aria-label="툴바 이동 핸들"
            title="드래그하여 툴바 이동"
            onPointerDown={startDrag}
            onPointerMove={moveDrag}
            onPointerUp={endDrag}
            onPointerCancel={endDrag}
            className={`flex h-8 w-7 shrink-0 touch-none select-none items-center justify-center rounded-md transition ${
              dragging
                ? "cursor-grabbing bg-primary-100 text-primary-700"
                : "cursor-grab text-foreground-500 hover:bg-background-200"
            }`}
          >
            <i className="ri-drag-move-2-line text-[15px]" aria-hidden="true" />
          </div>
        ) : (
          <span
            className="flex h-8 w-7 shrink-0 items-center justify-center rounded-md text-foreground-400"
            title={isMobile ? "모바일에서는 툴바가 상단에 고정됩니다" : "툴바가 상단에 고정되어 있습니다"}
          >
            <i className="ri-lock-2-line text-[14px]" aria-hidden="true" />
          </span>
        )}

        <span className="hidden whitespace-nowrap text-[11.5px] font-semibold text-foreground-700 sm:block">
          간트 도구
        </span>

        {(!isMobile || !collapsed) && viewControl}

        {!isMobile &&
          (locked ? (
            <>
              <span className="hidden whitespace-nowrap rounded-full border border-background-300 bg-background-100 px-2 py-[1px] text-[10px] text-foreground-500 lg:inline">
                상단 고정
              </span>
              <button
                type="button"
                onClick={unlock}
                title="툴바 이동을 허용합니다"
                className="flex cursor-pointer items-center gap-1 whitespace-nowrap rounded-md border border-background-300 bg-background-50 px-2 py-1 text-[11px] font-medium text-foreground-700 hover:bg-background-100"
              >
                <i className="ri-drag-move-2-line text-[13px]" aria-hidden="true" />
                이동 허용
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={() => setLocked(true)}
                title="툴바를 상단에 다시 고정합니다"
                className="flex cursor-pointer items-center gap-1 whitespace-nowrap rounded-md border border-primary-200 bg-primary-50 px-2 py-1 text-[11px] font-medium text-primary-700 hover:bg-primary-100"
              >
                <i className="ri-lock-2-line text-[13px]" aria-hidden="true" />
                상단 고정
              </button>
              <button
                type="button"
                onClick={resetPosition}
                title="툴바 위치를 기본 위치로 되돌립니다"
                className="flex cursor-pointer items-center gap-1 whitespace-nowrap rounded-md border border-background-300 bg-background-50 px-2 py-1 text-[11px] font-medium text-foreground-700 hover:bg-background-100"
              >
                <i className="ri-restart-line text-[13px]" aria-hidden="true" />
                위치 초기화
              </button>
              <span className="hidden whitespace-nowrap text-[10px] text-foreground-400 xl:inline">
                핸들을 잡고 이동
              </span>
            </>
          ))}

        {isMobile && (
          <button
            type="button"
            onClick={() => setCollapsed((prev) => !prev)}
            aria-expanded={!collapsed}
            className="ml-auto flex cursor-pointer items-center gap-1 whitespace-nowrap rounded-md border border-background-300 bg-background-50 px-2 py-1 text-[11px] font-medium text-foreground-700 hover:bg-background-100"
          >
            <i className={collapsed ? "ri-arrow-down-s-line text-[13px]" : "ri-arrow-up-s-line text-[13px]"} aria-hidden="true" />
            {collapsed ? "펼치기" : "접기"}
          </button>
        )}
      </div>
    </div>
  );
}