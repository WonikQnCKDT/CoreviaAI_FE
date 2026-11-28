import { useState } from "react";
import { useNavigate } from "react-router-dom";
import type { ServerNotification } from "@/features/notification/api/notificationApi";
import { useServerNotifications } from "@/features/notification/hooks/useServerNotifications";
import { SERVER_NOTIFICATION_TEXT } from "@/features/notification/i18n/ko";
import { notificationMessage, notificationPath, STYLE_TYPE } from "@/features/notification/utils/serverNotification";
import { BUTTON_TEXT } from "@/shared/i18n/catalog/button";
import { NOTIFICATION_TEXT, NOTIFICATION_TYPE_LABEL } from "@/shared/i18n/catalog/notification";
import { formatLabel } from "@/shared/i18n/store";
import type { NotificationType } from "@/types";

const STYLE: Record<NotificationType, { icon: string; className: string }> = {
  assign: { icon: "ri-user-add-line", className: "bg-primary-50 text-primary-600" },
  mention: { icon: "ri-at-line", className: "bg-accent-50 text-accent-700" },
  status: { icon: "ri-refresh-line", className: "bg-secondary-100 text-secondary-600" },
  due: { icon: "ri-time-line", className: "bg-amber-50 text-amber-600" },
  deliverable: { icon: "ri-file-check-line", className: "bg-emerald-50 text-emerald-600" },
  missing: { icon: "ri-question-line", className: "bg-amber-50 text-amber-700" },
  risk: { icon: "ri-alert-line", className: "bg-rose-50 text-rose-600" },
};

const timeText = (iso: string) => {
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? "" : date.toLocaleString();
};

/**
 * api 모드 상단 알림(FR-NTF-01): 미확인 수 배지, 누르면 목록. 항목을 누르면 읽음 처리 후 해당 화면으로 간다.
 * 본문은 FE 템플릿 + 서버 값(텍스트)이고, 이동 경로는 숫자 ID로만 만든다.
 */
export default function ServerNotificationBell() {
  const navigate = useNavigate();
  const { state, live, loadMore, markRead, retry } = useServerNotifications();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState("");
  const unread = state.phase === "ready" ? state.unread : 0;

  const openItem = async (item: ServerNotification) => {
    setError("");
    const ok = await markRead(item);
    if (!ok) {
      setError(SERVER_NOTIFICATION_TEXT.readFailed);
      return;
    }
    const path = notificationPath(item);
    setOpen(false);
    if (path) navigate(path);
  };

  const body = () => {
    if (state.phase === "loading") return <li className="px-4 py-6 text-center text-[12px] text-foreground-500" role="status">{NOTIFICATION_TEXT.loading}</li>;
    if (state.phase === "unavailable") return <li className="px-4 py-6 text-center text-[12px] leading-5 text-foreground-600">{SERVER_NOTIFICATION_TEXT.unavailable}</li>;
    if (state.phase === "error") {
      return (
        <li className="px-4 py-6 text-center">
          <p className="text-[12px] text-foreground-800">{NOTIFICATION_TEXT.loadFailed}</p>
          <button type="button" onClick={retry} className="btn-outline mt-2 px-2.5 py-1 text-[11.5px]">{BUTTON_TEXT.retry}</button>
        </li>
      );
    }
    if (state.items.length === 0) {
      return (
        <li className="px-4 py-8 text-center">
          <p className="text-[12px] text-foreground-600">{NOTIFICATION_TEXT.empty}</p>
          <p className="mt-1 text-[11px] text-foreground-500">{NOTIFICATION_TEXT.emptyHint}</p>
        </li>
      );
    }
    return (
      <>
        {state.items.map((item) => {
          const styleType = STYLE_TYPE[item.type];
          const style = STYLE[styleType];
          const message = notificationMessage(item);
          return (
            <li key={item.id}>
              <button
                type="button"
                onClick={() => void openItem(item)}
                aria-label={message}
                className={`flex w-full gap-2.5 border-b border-background-200 px-4 py-3 text-left last:border-0 hover:bg-background-100 ${item.read ? "" : "bg-primary-50/40"}`}
              >
                <span className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${style.className}`}>
                  <i className={`${style.icon} text-[13px]`} aria-hidden="true" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-start gap-1.5">
                    <span className="block flex-1 break-words text-[12.5px] text-foreground-900">{message}</span>
                    {!item.read && <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary-500" />}
                  </span>
                  <span className="mt-1 block text-[10px] text-foreground-400">
                    {formatLabel(NOTIFICATION_TEXT.typeSuffix, { type: NOTIFICATION_TYPE_LABEL[styleType] })} · {timeText(item.createdAt)}
                  </span>
                </span>
              </button>
            </li>
          );
        })}
        {state.nextCursor && (
          <li>
            <button type="button" className="w-full py-2 text-[12px] text-primary-600 hover:bg-background-100" onClick={() => void loadMore()}>
              {SERVER_NOTIFICATION_TEXT.more}
            </button>
          </li>
        )}
      </>
    );
  };

  return (
    <div className="relative">
      <button
        type="button"
        aria-label={BUTTON_TEXT.notifications}
        onClick={() => setOpen((prev) => !prev)}
        className="relative flex h-12 w-12 items-center justify-center overflow-visible rounded-md border border-background-300 bg-background-50 text-foreground-600 hover:bg-background-100"
      >
        <i className="ri-notification-3-line text-[17px]" aria-hidden="true" />
        {unread > 0 && (
          <span data-testid="notification-badge" className="pointer-events-none absolute -right-0.5 -top-0.5 flex h-[17px] min-w-[17px] items-center justify-center rounded-full border border-background-50 bg-rose-500 px-[3px] text-[9.5px] font-semibold leading-none text-background-50">
            {unread > 99 ? "99+" : unread}
          </span>
        )}
      </button>

      {open && (
        <>
          <button type="button" aria-label={BUTTON_TEXT.closeNotifications} className="fixed inset-0 z-30 cursor-default" onClick={() => setOpen(false)} />
          <div role="dialog" aria-label={NOTIFICATION_TEXT.title} className="absolute right-0 z-40 mt-2 w-[360px] overflow-hidden rounded-xl border border-background-300 bg-background-50 shadow-panel">
            <div className="border-b border-background-200 px-4 py-3">
              <p className="text-[13px] font-semibold text-foreground-950">
                {NOTIFICATION_TEXT.title} <span className="text-[11px] font-normal text-foreground-500">{formatLabel(NOTIFICATION_TEXT.unreadCount, { count: unread })}</span>
              </p>
              {error && <p role="alert" className="mt-1 text-[11.5px] text-rose-700">{error}</p>}
            </div>
            <ul className="max-h-[360px] overflow-y-auto">{body()}</ul>
            {state.phase === "ready" && (
              <div className="border-t border-background-200 bg-background-100 px-4 py-2 text-center text-[11px] text-foreground-500">
                {live ? SERVER_NOTIFICATION_TEXT.live : SERVER_NOTIFICATION_TEXT.polling} · {SERVER_NOTIFICATION_TEXT.noMarkAll}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
