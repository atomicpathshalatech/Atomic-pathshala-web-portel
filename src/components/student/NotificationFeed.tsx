"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import { getNotificationVisual } from "@/lib/utils/notification-visual";

export type Notification = {
  id: string;
  title: string;
  body: string;
  type?: string;
  deepLink?: string | null;
  metadata?: any;
  isRead: boolean;
  createdAt: string;
};

/**
 * Local timestamp-based countdown component.
 * Displays "Starts in Xm Ys" without any second-by-second push from the server!
 */
function EventCountdown({ targetTime }: { targetTime: string }) {
  const [remainingSec, setRemainingSec] = useState(() => {
    return Math.max(0, Math.floor((new Date(targetTime).getTime() - Date.now()) / 1000));
  });

  useEffect(() => {
    const timer = setInterval(() => {
      const diff = Math.max(0, Math.floor((new Date(targetTime).getTime() - Date.now()) / 1000));
      setRemainingSec(diff);
      if (diff <= 0) clearInterval(timer);
    }, 1000);
    return () => clearInterval(timer);
  }, [targetTime]);

  if (remainingSec <= 0) {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-bold text-amber-600 bg-amber-50 px-2 py-0.5 rounded-md border border-amber-200">
        Starting now
      </span>
    );
  }

  const mins = Math.floor(remainingSec / 60);
  const secs = remainingSec % 60;

  return (
    <span className="inline-flex items-center gap-1 text-xs font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-md border border-indigo-200 animate-pulse">
      <span className="material-symbols-outlined text-xs">timer</span>
      {mins}m {secs}s left
    </span>
  );
}

export function NotificationFeed({ initial }: { initial: Notification[] }) {
  const [notifications, setNotifications] = useState<Notification[]>(initial);
  const [filter, setFilter] = useState<"all" | "unread">("all");
  const [isPending, startTransition] = useTransition();

  // Listen for realtime push updates broadcast via custom DOM event from useRealtimeNotifications
  useEffect(() => {
    function handleRealtimeItem(e: Event) {
      const custom = e as CustomEvent<Notification>;
      if (custom.detail) {
        setNotifications((prev) => {
          if (prev.some((item) => item.id === custom.detail.id)) return prev;
          return [custom.detail, ...prev];
        });
      }
    }

    window.addEventListener("atomic:notification_received", handleRealtimeItem);
    return () => window.removeEventListener("atomic:notification_received", handleRealtimeItem);
  }, []);

  const unreadCount = notifications.filter((n) => !n.isRead).length;
  const visible = useMemo(
    () => (filter === "unread" ? notifications.filter((n) => !n.isRead) : notifications),
    [notifications, filter]
  );

  function markOneRead(id: string) {
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, isRead: true } : n)));
    startTransition(() => {
      fetch(`/api/notifications/${id}/read`, { method: "POST" }).catch(() => {});
    });
  }

  function markAllRead() {
    setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
    startTransition(() => {
      fetch("/api/notifications/mark-all-read", { method: "POST" }).catch(() => {});
    });
  }

  return (
    <div className="flex flex-col md:flex-row gap-gutter">
      {/* Left Sidebar */}
      <aside className="w-full md:w-1/4 space-y-stack-md shrink-0">
        <div className="glass-card rounded-xl p-stack-md">
          <h2 className="font-headline-md text-headline-md mb-stack-md">Notifications</h2>
          <div className="space-y-stack-sm">
            <button
              onClick={() => setFilter("all")}
              className={`w-full flex items-center justify-between p-stack-sm rounded-lg font-label-md text-label-md transition-colors ${
                filter === "all"
                  ? "bg-primary-container text-on-primary-container font-bold"
                  : "hover:bg-surface-container-high text-on-surface-variant"
              }`}
            >
              <span className="flex items-center gap-2">
                <span className="material-symbols-outlined">all_inclusive</span>
                All Notifications
              </span>
              <span className="text-xs bg-black/10 dark:bg-white/20 px-2 py-0.5 rounded-full">
                {notifications.length}
              </span>
            </button>
            <button
              onClick={() => setFilter("unread")}
              className={`w-full flex items-center justify-between p-stack-sm rounded-lg font-label-md text-label-md transition-colors ${
                filter === "unread"
                  ? "bg-primary-container text-on-primary-container font-bold"
                  : "hover:bg-surface-container-high text-on-surface-variant"
              }`}
            >
              <span className="flex items-center gap-2">
                <span className="material-symbols-outlined">mark_email_unread</span>
                Unread
              </span>
              <span className="text-xs bg-red-500 text-white px-2 py-0.5 rounded-full font-bold">
                {unreadCount}
              </span>
            </button>
          </div>
        </div>

        <div className="glass-card rounded-xl p-stack-md bg-secondary-container/10 border border-secondary-container/20">
          <h3 className="font-label-md text-label-md text-secondary mb-2 flex items-center gap-2">
            <span className="material-symbols-outlined text-sm">notifications_active</span>
            Push Notifications
          </h3>
          <p className="text-label-sm text-on-surface-variant">
            Live classes, test reminders, and daily morning targets are delivered directly to your device.
          </p>
        </div>
      </aside>

      {/* Main Feed */}
      <div className="w-full md:w-3/4 space-y-stack-md">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-stack-sm">
            <span className="font-headline-lg text-headline-lg">Latest Updates</span>
            {unreadCount > 0 && (
              <span className="bg-primary/10 text-primary px-3 py-1 rounded-full text-label-sm font-bold">
                {unreadCount} New
              </span>
            )}
          </div>
          <button
            onClick={markAllRead}
            disabled={unreadCount === 0 || isPending}
            className="text-primary font-label-md hover:underline decoration-primary underline-offset-4 transition-all disabled:opacity-40 disabled:no-underline disabled:cursor-not-allowed cursor-pointer"
          >
            Mark all as read
          </button>
        </div>

        {visible.length === 0 ? (
          <div className="glass-card rounded-xl p-10 text-center space-y-2">
            <span className="material-symbols-outlined text-primary/40" style={{ fontSize: 40 }}>
              notifications_off
            </span>
            <p className="font-label-md text-label-md text-on-surface-variant">
              {filter === "unread" ? "You're all caught up." : "No notifications yet."}
            </p>
          </div>
        ) : (
          <div className="space-y-stack-md">
            {visible.map((n) => {
              const visual = getNotificationVisual(n.title);
              const startsAt = n.metadata?.startsAt || n.metadata?.openTime;
              const isClassLive = n.type === "CLASS_LIVE" || n.title.includes("LIVE");

              return (
                <div
                  key={n.id}
                  className={`glass-card notification-item rounded-xl p-stack-md transition-all duration-300 ${
                    n.isRead
                      ? "opacity-75 hover:opacity-100"
                      : "border-l-4 border-l-primary bg-primary/2 dark:bg-primary/5"
                  }`}
                >
                  <div className="flex gap-stack-md items-start">
                    <div
                      className={`w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0 ${
                        isClassLive ? "bg-red-100 text-red-600 animate-pulse" : visual.bgClass
                      }`}
                    >
                      <span
                        className={`material-symbols-outlined ${
                          isClassLive ? "text-red-600" : visual.colorClass
                        }`}
                      >
                        {isClassLive ? "sensors" : visual.icon}
                      </span>
                    </div>

                    <div className="flex-grow min-w-0">
                      <div className="flex justify-between items-start mb-1 gap-3 flex-wrap">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h4 className="font-label-md text-label-md font-bold text-on-surface">
                            {n.title}
                          </h4>
                          {isClassLive && (
                            <span className="px-2 py-0.5 text-[10px] font-black uppercase tracking-wider bg-red-600 text-white rounded-md animate-pulse">
                              LIVE NOW
                            </span>
                          )}
                          {startsAt && <EventCountdown targetTime={startsAt} />}
                        </div>
                        <span className="text-label-sm text-outline whitespace-nowrap text-xs">
                          {formatDistanceToNow(new Date(n.createdAt), { addSuffix: true })}
                        </span>
                      </div>

                      <p className="text-body-md text-on-surface-variant mb-stack-md whitespace-pre-line">
                        {n.body}
                      </p>

                      <div className="flex items-center gap-3 mt-3 flex-wrap">
                        {n.deepLink && (
                          <Link
                            href={n.deepLink}
                            onClick={() => !n.isRead && markOneRead(n.id)}
                            className={`inline-flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-bold transition-all shadow-2xs ${
                              isClassLive
                                ? "bg-red-600 hover:bg-red-700 text-white ring-2 ring-red-300"
                                : "bg-primary hover:bg-primary/90 text-on-primary"
                            }`}
                          >
                            <span>{isClassLive ? "Join Live Classroom" : "View Details"}</span>
                            <span className="material-symbols-outlined text-xs">arrow_forward</span>
                          </Link>
                        )}

                        {!n.isRead && (
                          <button
                            onClick={() => markOneRead(n.id)}
                            className="px-3 py-1.5 text-xs text-on-surface-variant font-medium hover:bg-surface-container-high rounded-lg transition-colors cursor-pointer"
                          >
                            Mark as read
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
