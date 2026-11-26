import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useDemoStore } from "@/stores/DemoStore";
import { hasShownLoginNotice, markLoginNoticeShown } from "@/features/notification/utils/notificationNotice";
import type { NotificationType } from "@/types";
import { BUTTON_TEXT } from "@/shared/i18n/catalog/button";
import { NOTIFICATION_TEXT, NOTIFICATION_TYPE_LABEL } from "@/shared/i18n/catalog/notification";
import { formatLabel } from "@/shared/i18n/store";

const NOTI_STYLE: Record<NotificationType, { icon: string; className: string; label: string }> = {
  assign: { icon: "ri-user-add-line", className: "bg-primary-50 text-primary-600", get label() { return NOTIFICATION_TYPE_LABEL.assign; } },
  mention: { icon: "ri-at-line", className: "bg-accent-50 text-accent-700", get label() { return NOTIFICATION_TYPE_LABEL.mention; } },
  status: { icon: "ri-refresh-line", className: "bg-secondary-100 text-secondary-600", get label() { return NOTIFICATION_TYPE_LABEL.status; } },
  due: { icon: "ri-time-line", className: "bg-amber-50 text-amber-600", get label() { return NOTIFICATION_TYPE_LABEL.due; } },
  deliverable: { icon: "ri-file-check-line", className: "bg-emerald-50 text-emerald-600", get label() { return NOTIFICATION_TYPE_LABEL.deliverable; } },
  missing: { icon: "ri-question-line", className: "bg-amber-50 text-amber-700", get label() { return NOTIFICATION_TYPE_LABEL.missing; } },
  risk: { icon: "ri-alert-line", className: "bg-rose-50 text-rose-600", get label() { return NOTIFICATION_TYPE_LABEL.risk; } },
};

export default function NotificationBell() {
  const navigate = useNavigate();
  const {
    notifications,
    notificationStatus,
    notificationError,
    loadNotifications,
    markNotificationsRead,
    markNotificationRead,
    currentUser,
  } = useDemoStore();

  const [open, setOpen] = useState(false);
  const [noticeCount, setNoticeCount] = useState<number | null>(null);
  const noticeCheckedRef = useRef(false);

  const unread = useMemo(() => notifications.filter((item) => !item.read).length, [notifications]);

  // 로그인 후 알림 목록을 서버(데모 저장소)에서 다시 불러옵니다.
  useEffect(() => {
    loadNotifications();
  }, [loadNotifications]);

  // 로그인 직후 미확인 알림 안내를 한 번만 표시합니다. 페이지 이동 시에는 반복되지 않습니다.
  useEffect(() => {
    if (noticeCheckedRef.current) return;
    if (notificationStatus !== "ready") return;
    noticeCheckedRef.current = true;
    if (unread <= 0) return;
    if (hasShownLoginNotice(currentUser.id)) return;
    markLoginNoticeShown(currentUser.id);
    setNoticeCount(unread);
  }, [notificationStatus, unread, currentUser.id]);

  useEffect(() => {
    if (noticeCount === null) return undefined;
    const timer = window.setTimeout(() => setNoticeCount(null), 8000);
    return () => window.clearTimeout(timer);
  }, [noticeCount]);

  return (
    <>
      {noticeCount !== null && !open && (
        <div
          role="status"
          className="fixed right-4 top-[76px] z-40 w-[300px] rounded-lg border border-background-300 bg-background-50 p-3 shadow-panel md:right-6"
        >
          <div className="flex items-start gap-2.5">
            <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary-50 text-primary-600">
              <i className="ri-notification-3-line text-[14px]" aria-hidden="true" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-[12.5px] font-medium leading-5 text-foreground-950">
                {formatLabel(NOTIFICATION_TEXT.unreadNotice, { count: noticeCount })}
              </p>
              <div className="mt-2 flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setNoticeCount(null);
                    setOpen(true);
                    loadNotifications();
                  }}
                  className="cursor-pointer whitespace-nowrap rounded-md bg-primary-500 px-2.5 py-1 text-[11.5px] font-medium text-background-50 hover:bg-primary-600"
                >
                  {BUTTON_TEXT.viewNotifications}
                </button>
                <button
                  type="button"
                  onClick={() => setNoticeCount(null)}
                  className="cursor-pointer whitespace-nowrap rounded-md px-2 py-1 text-[11.5px] text-foreground-600 hover:bg-background-100"
                >
                  {BUTTON_TEXT.later}
                </button>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setNoticeCount(null)}
              aria-label={BUTTON_TEXT.closeNotice}
              className="flex h-6 w-6 shrink-0 cursor-pointer items-center justify-center rounded-md text-foreground-400 hover:bg-background-100 hover:text-foreground-700"
            >
              <i className="ri-close-line text-[13px]" aria-hidden="true" />
            </button>
          </div>
        </div>
      )}

      <div className="relative">
        <button
          type="button"
          aria-label={BUTTON_TEXT.notifications}
          onClick={() => {
            setOpen((prev) => !prev);
            setNoticeCount(null);
          }}
          className="relative flex h-12 w-12 cursor-pointer items-center justify-center overflow-visible rounded-md border border-background-300 bg-background-50 text-foreground-600 hover:bg-background-100"
        >
          <i className="ri-notification-3-line text-[17px]" aria-hidden="true" />
          {unread > 0 && (
            <span className="pointer-events-none absolute -right-0.5 -top-0.5 flex h-[17px] min-w-[17px] items-center justify-center rounded-full border border-background-50 bg-rose-500 px-[3px] text-[9.5px] font-semibold leading-none text-background-50">
              {unread > 99 ? "99+" : unread}
            </span>
          )}
        </button>

        {open && (
          <>
            <button
              type="button"
              aria-label={BUTTON_TEXT.closeNotifications}
              className="fixed inset-0 z-30 cursor-default"
              onClick={() => setOpen(false)}
            />
            <div className="absolute right-0 z-40 mt-2 w-[360px] overflow-hidden rounded-xl border border-background-300 bg-background-50 shadow-panel">
              <div className="flex items-center justify-between border-b border-background-200 px-4 py-3">
                <p className="text-[13px] font-semibold text-foreground-950">
                  {NOTIFICATION_TEXT.title}{" "}
                  <span className="text-[11px] font-normal text-foreground-500">{formatLabel(NOTIFICATION_TEXT.unreadCount, { count: unread })}</span>
                </p>
                <button
                  type="button"
                  onClick={markNotificationsRead}
                  disabled={unread === 0}
                  className="cursor-pointer whitespace-nowrap text-[11.5px] font-medium text-primary-600 hover:text-primary-700 disabled:cursor-not-allowed disabled:text-foreground-400"
                >
                  {BUTTON_TEXT.markAllRead}
                </button>
              </div>

              <ul className="max-h-[360px] overflow-y-auto">
                {notificationStatus === "loading" || notificationStatus === "idle" ? (
                  <li className="space-y-2 px-4 py-4" aria-live="polite">
                    <span className="sr-only">{NOTIFICATION_TEXT.loading}</span>
                    {[0, 1, 2].map((row) => (
                      <span key={row} className="flex gap-2.5">
                        <span className="h-7 w-7 shrink-0 animate-pulse rounded-full bg-background-200" />
                        <span className="flex-1 space-y-1.5">
                          <span className="block h-2.5 w-2/3 animate-pulse rounded bg-background-200" />
                          <span className="block h-2 w-full animate-pulse rounded bg-background-100" />
                        </span>
                      </span>
                    ))}
                  </li>
                ) : notificationStatus === "error" ? (
                  <li className="px-4 py-8 text-center">
                    <span className="mx-auto flex h-9 w-9 items-center justify-center rounded-full bg-rose-50 text-rose-600">
                      <i className="ri-error-warning-line text-[16px]" aria-hidden="true" />
                    </span>
                    <p className="mt-2.5 text-[12px] leading-5 text-foreground-800">
                      {notificationError || NOTIFICATION_TEXT.loadFailed}
                    </p>
                    <button
                      type="button"
                      onClick={() => loadNotifications()}
                      className="mt-2.5 cursor-pointer whitespace-nowrap rounded-md border border-background-300 bg-background-50 px-2.5 py-1 text-[11.5px] font-medium text-foreground-700 hover:bg-background-100"
                    >
                      {BUTTON_TEXT.retry}
                    </button>
                  </li>
                ) : notifications.length === 0 ? (
                  <li className="px-4 py-8 text-center">
                    <span className="mx-auto flex h-9 w-9 items-center justify-center rounded-full bg-background-100 text-foreground-400">
                      <i className="ri-notification-off-line text-[16px]" aria-hidden="true" />
                    </span>
                    <p className="mt-2.5 text-[12px] leading-5 text-foreground-600">{NOTIFICATION_TEXT.empty}</p>
                    <p className="mt-1 text-[11px] leading-4 text-foreground-500">
                      {NOTIFICATION_TEXT.emptyHint}
                    </p>
                  </li>
                ) : (
                  notifications.map((item) => {
                    const style = NOTI_STYLE[item.type];
                    return (
                      <li key={item.id}>
                        <button
                          type="button"
                          onClick={() => {
                            markNotificationRead(item.id);
                            setOpen(false);
                            const path = item.targetPath || (item.projectId ? `/projects/${item.projectId}` : null);
                            if (path) navigate(path);
                          }}
                          className={`flex w-full cursor-pointer gap-2.5 border-b border-background-200 px-4 py-3 text-left last:border-0 hover:bg-background-100 ${
                            item.read ? "" : "bg-primary-50/40"
                          }`}
                        >
                          <span className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${style.className}`}>
                            <i className={`${style.icon} text-[13px]`} aria-hidden="true" />
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="flex items-center gap-1.5">
                              <span className="block flex-1 text-[12.5px] font-medium text-foreground-900">{item.title}</span>
                              {!item.read && <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-primary-500" />}
                            </span>
                            <span className="mt-0.5 block text-[11.5px] leading-4 text-foreground-600">{item.body}</span>
                            {item.evidence && (
                              <span className="mt-1 block rounded border border-rose-100 bg-rose-50/60 px-1.5 py-1 text-[10.5px] leading-4 text-rose-700">
                                {formatLabel(NOTIFICATION_TEXT.evidence, { text: item.evidence })}
                              </span>
                            )}
                            <span className="mt-1 block text-[10px] text-foreground-400">{formatLabel(NOTIFICATION_TEXT.typeSuffix, { type: style.label })}</span>
                          </span>
                        </button>
                      </li>
                    );
                  })
                )}
              </ul>

              <div className="border-t border-background-200 bg-background-100 px-4 py-2 text-center text-[11px] text-foreground-500">
                {NOTIFICATION_TEXT.demoFooter}
              </div>
            </div>
          </>
        )}
      </div>
    </>
  );
}