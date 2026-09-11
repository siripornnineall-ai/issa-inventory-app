"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Bell, BellOff } from "lucide-react";
import { useStore, useActions } from "@/lib/store";
import { useCurrentUser } from "@/lib/auth/session";
import { formatThaiDateTime } from "@/lib/utils/date";
import type { AppNotification } from "@/lib/types";

export function NotificationBell() {
  const user = useCurrentUser();
  const allNotifications = useStore((s) => s.notifications);
  const { markNotificationRead } = useActions();
  const router = useRouter();
  const [open, setOpen] = useState(false);

  const notifications = useMemo(
    () =>
      Object.values(allNotifications)
        .filter((n) => n.userId === user?.id)
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()),
    [allNotifications, user?.id]
  );
  const unreadCount = notifications.filter((n) => !n.read).length;

  function handleClick(n: AppNotification) {
    if (!n.read) markNotificationRead(n.id);
    setOpen(false);
    if (n.link) router.push(n.link);
  }

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="relative flex h-10 w-10 items-center justify-center rounded-full border border-[var(--color-border)] bg-white text-[var(--color-on-surface-variant)]"
        aria-label="การแจ้งเตือน"
      >
        <Bell className="h-[18px] w-[18px]" />
        {unreadCount > 0 && (
          <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-[var(--color-danger)] px-1 text-[10px] font-semibold text-white">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute right-0 z-20 mt-2 max-h-[28rem] w-96 overflow-y-auto rounded-xl border border-[var(--color-border)] bg-white shadow-[var(--shadow-micro)]">
            <div className="border-b border-[var(--color-border)] px-4 py-3">
              <p className="text-sm font-semibold text-[var(--color-on-surface)]">การแจ้งเตือน</p>
            </div>
            {notifications.length === 0 ? (
              <div className="flex flex-col items-center gap-2 px-4 py-10 text-center text-[var(--color-on-surface-variant)]">
                <BellOff className="h-6 w-6" />
                <p className="text-sm">ยังไม่มีการแจ้งเตือน</p>
              </div>
            ) : (
              <ul>
                {notifications.map((n) => (
                  <li key={n.id}>
                    <button
                      onClick={() => handleClick(n)}
                      className={`flex w-full flex-col gap-0.5 border-b border-[var(--color-border)] px-4 py-3 text-left last:border-b-0 hover:bg-[var(--color-surface-container)] ${
                        n.read ? "" : "bg-[var(--color-primary-container)]/5"
                      }`}
                    >
                      <span className="flex items-center gap-2">
                        {!n.read && <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--color-danger)]" />}
                        <span className="text-sm font-medium text-[var(--color-on-surface)]">{n.title}</span>
                      </span>
                      {n.body && <span className="text-xs text-[var(--color-on-surface-variant)]">{n.body}</span>}
                      <span className="text-[11px] text-[var(--color-on-surface-variant)]">{formatThaiDateTime(n.createdAt)}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </>
      )}
    </div>
  );
}
