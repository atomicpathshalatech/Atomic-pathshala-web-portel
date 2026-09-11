"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { formatDistanceToNow } from "date-fns";
import { getNotificationVisual } from "@/lib/utils/notification-visual";
import { registerBrowserPush } from "@/lib/notifications/webPushClient";

export type Notification = {
  id: string;
  title: string;
  body: string;
  type?: string;
  category?: string;
  priority?: "LOW" | "NORMAL" | "HIGH" | "URGENT";
  actionType?: string | null;
  actionUrl?: string | null;
  deepLink?: string | null;
  metadata?: any;
  isRead: boolean;
  createdAt: string;
};

const CATEGORY_ITEMS = [
  { key: "all", label: "All Notifications", icon: "notifications" },
  { key: "unread", label: "Unread", icon: "mark_chat_unread" },
  { key: "CLASSES", label: "Classes", icon: "sensors" },
  { key: "TESTS", label: "Tests", icon: "assignment_turned_in" },
  { key: "STUDY_MATERIAL", label: "Study Material", icon: "folder_open" },
  { key: "OFFERS", label: "Offers", icon: "local_offer" },
  { key: "MOTIVATION", label: "Motivation", icon: "lightbulb" },
  { key: "SYSTEM", label: "System", icon: "info" },
];

const ACTION_LABELS: Record<string, string> = {
  JOIN_CLASS: "Join Class",
  START_TEST: "Start Test",
  VIEW_TEST: "View Test",
  OPEN_PDF: "View PDF",
  OPEN_DPP: "View DPP",
  VIEW_OFFER: "View Offer",
  VIEW_DETAILS: "View Details",
  VIEW_CLASS: "View Class",
  VIEW_SCHEDULE: "View Schedule",
};

export function NotificationFeed({ initial }: { initial: Notification[] }) {
  const router = useRouter();
  const [notifications, setNotifications] = useState<Notification[]>(initial);
  const [filter, setFilter] = useState<string>("all");
  const [isPending, startTransition] = useTransition();
  const [pushStatus, setPushStatus] = useState<"default" | "enabled" | "denied">("default");
  const [soundEnabled, setSoundEnabled] = useState(true);

  useEffect(() => {
    try {
      if (typeof window !== "undefined" && "Notification" in window) {
        if (Notification.permission === "granted") setPushStatus("enabled");
        else if (Notification.permission === "denied") setPushStatus("denied");
      }
      const saved = localStorage.getItem("atomic_notification_sound");
      if (saved !== null) setSoundEnabled(saved === "true");
    } catch {}
  }, []);

  // Listen for realtime push updates
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

  const visible = useMemo(() => {
    if (filter === "all") return notifications;
    if (filter === "unread") return notifications.filter((n) => !n.isRead);
    return notifications.filter((n) => n.category === filter);
  }, [notifications, filter]);

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

  async function handleActionClick(item: Notification) {
    markOneRead(item.id);
    const target = item.actionUrl || item.deepLink || "/";

    // Track action
    try {
      fetch("/api/notifications/track-action", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          notificationId: item.id,
          actionType: item.actionType || "NOTIFICATION_CLICK",
          source: "NOTIFICATION_CENTER",
        }),
      }).catch(() => {});
    } catch {}

    router.push(target);
  }

  async function toggleBrowserPush() {
    const res = await registerBrowserPush();
    if (res.success) setPushStatus("enabled");
    else if (res.reason?.includes("denied")) setPushStatus("denied");
  }

  function toggleSound() {
    const next = !soundEnabled;
    setSoundEnabled(next);
    try {
      localStorage.setItem("atomic_notification_sound", String(next));
    } catch {}
  }

  return (
    <div className="flex flex-col md:flex-row gap-gutter max-w-6xl mx-auto">
      {/* Left Navigation / Filters */}
      <aside className="w-full md:w-1/4 space-y-stack-md shrink-0">
        <div className="glass-card rounded-2xl p-5 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
            <h2 className="font-headline-md text-base font-bold text-on-surface">Categories</h2>
            {unreadCount > 0 && (
              <span className="px-2 py-0.5 text-xs font-bold bg-red-500 text-white rounded-full">
                {unreadCount} unread
              </span>
            )}
          </div>

          <nav className="space-y-1">
            {CATEGORY_ITEMS.map((c) => {
              const active = filter === c.key;
              const count =
                c.key === "all"
                  ? notifications.length
                  : c.key === "unread"
                  ? unreadCount
                  : notifications.filter((n) => n.category === c.key).length;

              return (
                <button
                  key={c.key}
                  onClick={() => setFilter(c.key)}
                  className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-sm font-medium transition-all ${
                    active
                      ? "bg-primary text-white font-bold shadow-sm"
                      : "text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800/60"
                  }`}
                >
                  <span className="flex items-center gap-2.5 truncate">
                    <span className="material-symbols-outlined text-lg shrink-0">{c.icon}</span>
                    <span className="truncate">{c.label}</span>
                  </span>
                  <span
                    className={`text-xs px-2 py-0.5 rounded-full ${
                      active ? "bg-white/20 text-white" : "bg-slate-100 dark:bg-slate-800 text-slate-500"
                    }`}
                  >
                    {count}
                  </span>
                </button>
              );
            })}
          </nav>

          {/* Settings Section */}
          <div className="pt-4 border-t border-slate-100 dark:border-slate-800 space-y-3">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Preferences</h3>

            {/* Sound Toggle */}
            <button
              onClick={toggleSound}
              className="w-full flex items-center justify-between text-xs text-slate-600 dark:text-slate-300 hover:text-primary transition-colors py-1"
            >
              <span className="flex items-center gap-2">
                <span className="material-symbols-outlined text-base">
                  {soundEnabled ? "volume_up" : "volume_off"}
                </span>
                Sound Alerts
              </span>
              <span className={`font-bold ${soundEnabled ? "text-emerald-500" : "text-slate-400"}`}>
                {soundEnabled ? "ON" : "OFF"}
              </span>
            </button>

            {/* Browser Push Button */}
            <button
              onClick={toggleBrowserPush}
              disabled={pushStatus === "enabled"}
              className={`w-full flex items-center justify-between text-xs py-1 transition-colors ${
                pushStatus === "enabled"
                  ? "text-emerald-600 dark:text-emerald-400 font-bold"
                  : "text-slate-600 dark:text-slate-300 hover:text-primary"
              }`}
            >
              <span className="flex items-center gap-2">
                <span className="material-symbols-outlined text-base">notifications_active</span>
                Browser Push
              </span>
              <span className="font-bold">
                {pushStatus === "enabled" ? "Active" : pushStatus === "denied" ? "Blocked" : "Enable"}
              </span>
            </button>
          </div>
        </div>
      </aside>

      {/* Main Feed Content */}
      <main className="w-full md:w-3/4 space-y-4">
        {/* Header toolbar */}
        <div className="flex items-center justify-between gap-3 bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
          <div>
            <h1 className="font-headline-lg text-lg font-bold text-on-surface">
              {CATEGORY_ITEMS.find((c) => c.key === filter)?.label || "Notifications"}
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">
              Showing {visible.length} notification{visible.length === 1 ? "" : "s"}
            </p>
          </div>

          {unreadCount > 0 && (
            <button
              onClick={markAllRead}
              disabled={isPending}
              className="flex items-center gap-1.5 text-xs font-bold text-primary hover:text-primary-dark px-3 py-1.5 rounded-lg border border-primary/20 hover:bg-primary/5 transition-all active:scale-95"
            >
              <span className="material-symbols-outlined text-base">done_all</span>
              Mark all as read
            </button>
          )}
        </div>

        {/* Notifications List */}
        {visible.length === 0 ? (
          <div className="text-center py-16 px-4 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
            <span className="material-symbols-outlined text-5xl text-slate-300 dark:text-slate-600">
              notifications_off
            </span>
            <h3 className="font-headline-md text-base font-bold text-slate-700 dark:text-slate-200 mt-3">
              No notifications here
            </h3>
            <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1">
              You are all caught up! Updates about your classes, tests, and materials will appear here.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {visible.map((n) => {
              const visual = getNotificationVisual(n.type ?? "SYSTEM_ANNOUNCEMENT");
              const actionLabel = n.actionType
                ? ACTION_LABELS[n.actionType] || n.actionType.replace(/_/g, " ")
                : n.actionUrl || n.deepLink
                ? "Open"
                : null;

              const isUrgent = n.priority === "URGENT";
              const isHigh = n.priority === "HIGH";

              return (
                <div
                  key={n.id}
                  className={`p-4 rounded-2xl border transition-all duration-200 ${
                    !n.isRead
                      ? "bg-white dark:bg-slate-900 border-primary/30 shadow-md ring-1 ring-primary/10"
                      : "bg-white/80 dark:bg-slate-900/80 border-slate-200/80 dark:border-slate-800 shadow-xs hover:border-slate-300"
                  }`}
                >
                  <div className="flex items-start gap-3.5">
                    {/* Visual Icon */}
                    <div
                      className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                        isUrgent
                          ? "bg-red-50 text-red-600 dark:bg-red-950/50 dark:text-red-400 border border-red-200 dark:border-red-900/50"
                          : isHigh
                          ? "bg-amber-50 text-amber-600 dark:bg-amber-950/50 dark:text-amber-400 border border-amber-200 dark:border-amber-900/50"
                          : "bg-primary/10 text-primary border border-primary/20"
                      }`}
                    >
                      <span className="material-symbols-outlined text-xl">{visual.icon}</span>
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h4 className="font-headline-md text-sm font-bold text-slate-900 dark:text-slate-100">
                            {n.title}
                          </h4>
                          {isUrgent && (
                            <span className="px-1.5 py-0.5 text-[10px] font-extrabold bg-red-500 text-white rounded uppercase tracking-wider">
                              URGENT
                            </span>
                          )}
                          {isHigh && (
                            <span className="px-1.5 py-0.5 text-[10px] font-extrabold bg-amber-500 text-black rounded uppercase tracking-wider">
                              HIGH
                            </span>
                          )}
                          {!n.isRead && (
                            <span className="w-2 h-2 rounded-full bg-primary inline-block" />
                          )}
                        </div>

                        <span className="text-[11px] text-slate-400 whitespace-nowrap shrink-0">
                          {formatDistanceToNow(new Date(n.createdAt), { addSuffix: true })}
                        </span>
                      </div>

                      <p className="text-xs text-slate-600 dark:text-slate-300 mt-1 leading-relaxed">
                        {n.body}
                      </p>

                      {/* Action Button & Mark Read */}
                      <div className="mt-3 flex items-center justify-between gap-3 pt-2 border-t border-slate-100 dark:border-slate-800/60">
                        <div>
                          {actionLabel && (
                            <button
                              type="button"
                              onClick={() => handleActionClick(n)}
                              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all shadow-xs ${
                                isUrgent
                                  ? "bg-red-600 hover:bg-red-700 text-white"
                                  : isHigh
                                  ? "bg-amber-500 hover:bg-amber-600 text-black"
                                  : "bg-primary hover:bg-primary/90 text-white"
                              } active:scale-95`}
                            >
                              {actionLabel}
                            </button>
                          )}
                        </div>

                        {!n.isRead && (
                          <button
                            type="button"
                            onClick={() => markOneRead(n.id)}
                            className="text-[11px] text-slate-400 hover:text-primary transition-colors flex items-center gap-1"
                          >
                            <span className="material-symbols-outlined text-sm">check</span>
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
      </main>
    </div>
  );
}
