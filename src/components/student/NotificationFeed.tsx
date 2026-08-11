"use client";

import { useMemo, useState, useTransition } from "react";
import { formatDistanceToNow } from "date-fns";
import { getNotificationVisual } from "@/lib/utils/notification-visual";

type Notification = {
  id: string;
  title: string;
  body: string;
  isRead: boolean;
  createdAt: string;
};

export function NotificationFeed({ initial }: { initial: Notification[] }) {
  const [notifications, setNotifications] = useState(initial);
  const [filter, setFilter] = useState<"all" | "unread">("all");
  const [isPending, startTransition] = useTransition();

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
                  ? "bg-primary-container text-on-primary-container"
                  : "hover:bg-surface-container-high text-on-surface-variant"
              }`}
            >
              <span className="flex items-center gap-2">
                <span className="material-symbols-outlined">all_inclusive</span>
                All Notifications
              </span>
              <span className="text-xs bg-white/20 px-2 py-0.5 rounded-full">
                {notifications.length}
              </span>
            </button>
            <button
              onClick={() => setFilter("unread")}
              className={`w-full flex items-center justify-between p-stack-sm rounded-lg font-label-md text-label-md transition-colors ${
                filter === "unread"
                  ? "bg-primary-container text-on-primary-container"
                  : "hover:bg-surface-container-high text-on-surface-variant"
              }`}
            >
              <span className="flex items-center gap-2">
                <span className="material-symbols-outlined">mark_email_unread</span>
                Unread
              </span>
              <span className="text-xs bg-white/20 px-2 py-0.5 rounded-full">{unreadCount}</span>
            </button>
          </div>
        </div>

        <div className="glass-card rounded-xl p-stack-md bg-secondary-container/10">
          <h3 className="font-label-md text-label-md text-secondary mb-2">Upcoming Schedule</h3>
          <p className="text-label-sm text-on-surface-variant">
            Live classes and test schedules will appear here once the Course and Test modules
            are live.
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
            className="text-primary font-label-md hover:underline decoration-primary underline-offset-4 transition-all disabled:opacity-40 disabled:no-underline disabled:cursor-not-allowed"
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
              return (
                <div
                  key={n.id}
                  className={`glass-card notification-item rounded-xl p-stack-md transition-all duration-300 ${
                    n.isRead ? "opacity-80" : "border-l-4 border-l-primary"
                  }`}
                >
                  <div className="flex gap-stack-md">
                    <div
                      className={`w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0 ${visual.bgClass}`}
                    >
                      <span className={`material-symbols-outlined ${visual.colorClass}`}>
                        {visual.icon}
                      </span>
                    </div>
                    <div className="flex-grow min-w-0">
                      <div className="flex justify-between items-start mb-1 gap-3">
                        <h4 className="font-label-md text-label-md text-on-surface">{n.title}</h4>
                        <span className="text-label-sm text-outline whitespace-nowrap">
                          {formatDistanceToNow(new Date(n.createdAt), { addSuffix: true })}
                        </span>
                      </div>
                      <p className="text-body-md text-on-surface-variant mb-stack-md">{n.body}</p>
                      {!n.isRead && (
                        <button
                          onClick={() => markOneRead(n.id)}
                          className="px-stack-md py-2 text-on-surface-variant font-label-md hover:bg-surface-container-high rounded-lg transition-colors -ml-4"
                        >
                          Mark as read
                        </button>
                      )}
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
