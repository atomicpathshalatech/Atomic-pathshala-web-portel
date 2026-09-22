"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
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

export function NotificationFeed({
  initial,
  userRole = "STUDENT",
}: {
  initial: Notification[];
  userRole?: string;
}) {
  const router = useRouter();
  const [notifications, setNotifications] = useState<Notification[]>(initial);
  const [filter, setFilter] = useState<string>("all");
  const [isPending, startTransition] = useTransition();
  const [pushStatus, setPushStatus] = useState<"default" | "enabled" | "denied">("default");
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

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

  const activeCategoryItem =
    CATEGORY_ITEMS.find((c) => c.key === filter) ?? {
      key: "all",
      label: "All Notifications",
      icon: "notifications",
    };

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
    const rawTarget = item.actionUrl || item.deepLink;

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

    // If no target URL, do not redirect to home or arbitrary page
    if (!rawTarget || rawTarget === "/" || rawTarget === "#") {
      return;
    }

    let target = rawTarget;
    // Safe route resolution for Teachers & Admins
    if (userRole !== "STUDENT" && userRole !== "PARENT") {
      if (target.startsWith("/messages?")) {
        target = target.replace("/messages?", "/team/messages?");
      } else if (target === "/messages") {
        target = "/team/messages";
      }
    }

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

  const handleGoBack = () => {
    if (typeof window !== "undefined" && window.history.length > 1) {
      router.back();
    } else {
      router.push(userRole === "STUDENT" ? "/dashboard" : "/team");
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-3 pb-8">
      {/* 1. TOP HEADER TOOLBAR WITH BACK BUTTON & CATEGORY DRAWER TRIGGER */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-3 sm:p-4 shadow-sm flex flex-col gap-3">
        <div className="flex items-center justify-between gap-2">
          {/* Back button + Title */}
          <div className="flex items-center gap-2.5 min-w-0">
            <button
              type="button"
              onClick={handleGoBack}
              className="w-8 h-8 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 transition flex items-center justify-center shrink-0 active:scale-95"
              title="Go Back"
              aria-label="Go Back"
            >
              <span className="material-symbols-outlined text-lg">arrow_back</span>
            </button>

            <div className="min-w-0">
              <h1 className="font-headline-lg text-base sm:text-lg font-black text-slate-900 dark:text-white flex items-center gap-1.5 truncate">
                <span>Notifications</span>
                {unreadCount > 0 && (
                  <span className="px-1.5 py-0.2 text-[10px] font-extrabold bg-red-500 text-white rounded-full">
                    {unreadCount}
                  </span>
                )}
              </h1>
            </div>
          </div>

          {/* Mark All As Read */}
          {unreadCount > 0 && (
            <button
              onClick={markAllRead}
              disabled={isPending}
              className="flex items-center gap-1 text-[11px] font-bold text-blue-600 dark:text-blue-400 hover:text-blue-700 px-2.5 py-1.5 rounded-lg border border-blue-200 dark:border-blue-900 bg-blue-50/50 dark:bg-blue-950/40 transition active:scale-95 shrink-0"
            >
              <span className="material-symbols-outlined text-sm">done_all</span>
              <span className="hidden sm:inline">Mark all read</span>
            </button>
          )}
        </div>

        {/* Category Trigger Pill Bar (Right under back button) */}
        <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-100 dark:border-slate-800/80">
          <button
            type="button"
            onClick={() => setIsDrawerOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-600 text-white text-xs font-bold shadow-xs hover:bg-blue-700 transition active:scale-95"
          >
            <span className="material-symbols-outlined text-base">tune</span>
            <span>Category: {activeCategoryItem.label}</span>
            <span className="material-symbols-outlined text-sm">expand_more</span>
          </button>

          <span className="text-[11px] text-slate-400 font-medium">
            {visible.length} update{visible.length === 1 ? "" : "s"}
          </span>
        </div>
      </div>

      {/* 2. SIDEBAR POPUP DRAWER (CATEGORIES, FILTERS & PREFERENCES) */}
      {isDrawerOpen && (
        <div className="fixed inset-0 z-50 flex">
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-black/60 backdrop-blur-xs transition-opacity animate-in fade-in"
            onClick={() => setIsDrawerOpen(false)}
          />

          {/* Slide-over Drawer Panel */}
          <div className="relative w-80 max-w-[85vw] bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 shadow-2xl z-50 flex flex-col justify-between p-5 overflow-y-auto animate-in slide-in-from-left duration-200">
            <div className="space-y-4">
              {/* Drawer Header */}
              <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-blue-600 text-xl">category</span>
                  <h3 className="font-extrabold text-sm text-slate-900 dark:text-white">
                    Filter by Category
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setIsDrawerOpen(false)}
                  className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-500 hover:text-slate-800 dark:hover:text-white flex items-center justify-center transition"
                >
                  <span className="material-symbols-outlined text-lg">close</span>
                </button>
              </div>

              {/* Category List Items */}
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
                      onClick={() => {
                        setFilter(c.key);
                        setIsDrawerOpen(false);
                      }}
                      className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-semibold transition-all ${
                        active
                          ? "bg-blue-600 text-white font-bold shadow-xs"
                          : "text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
                      }`}
                    >
                      <span className="flex items-center gap-2.5 truncate">
                        <span className="material-symbols-outlined text-base shrink-0">{c.icon}</span>
                        <span className="truncate">{c.label}</span>
                      </span>
                      <span
                        className={`text-[10px] px-2 py-0.5 rounded-full ${
                          active
                            ? "bg-white/20 text-white font-bold"
                            : "bg-slate-100 dark:bg-slate-800 text-slate-500"
                        }`}
                      >
                        {count}
                      </span>
                    </button>
                  );
                })}
              </nav>
            </div>

            {/* Preferences Section at bottom of drawer */}
            <div className="pt-4 mt-6 border-t border-slate-100 dark:border-slate-800 space-y-2.5">
              <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                Notification Preferences
              </h4>

              {/* Sound Toggle */}
              <button
                type="button"
                onClick={toggleSound}
                className="w-full flex items-center justify-between text-xs text-slate-600 dark:text-slate-300 hover:text-blue-600 transition-colors py-1"
              >
                <span className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-base">
                    {soundEnabled ? "volume_up" : "volume_off"}
                  </span>
                  Sound Alerts
                </span>
                <span className={`text-[10px] font-bold ${soundEnabled ? "text-emerald-500" : "text-slate-400"}`}>
                  {soundEnabled ? "ON" : "OFF"}
                </span>
              </button>

              {/* Browser Push Button */}
              <button
                type="button"
                onClick={toggleBrowserPush}
                disabled={pushStatus === "enabled"}
                className={`w-full flex items-center justify-between text-xs py-1 transition-colors ${
                  pushStatus === "enabled"
                    ? "text-emerald-600 dark:text-emerald-400 font-bold"
                    : "text-slate-600 dark:text-slate-300 hover:text-blue-600"
                }`}
              >
                <span className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-base">notifications_active</span>
                  Push Alerts
                </span>
                <span className="text-[10px] font-bold">
                  {pushStatus === "enabled" ? "Active" : pushStatus === "denied" ? "Blocked" : "Enable"}
                </span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 3. COMPACT NOTIFICATIONS FEED (STREAMLINED BOXES, FULL SCREEN LENGTH) */}
      <main className="space-y-2">
        {visible.length === 0 ? (
          <div className="text-center py-16 px-4 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
            <span className="material-symbols-outlined text-4xl text-slate-300 dark:text-slate-600 mb-1">
              notifications_off
            </span>
            <h3 className="font-bold text-sm text-slate-700 dark:text-slate-200">
              No notifications in this category
            </h3>
            <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1">
              All caught up! New updates regarding classes, materials, and tests will appear here.
            </p>
          </div>
        ) : (
          visible.map((n) => {
            const visual = getNotificationVisual(n.type, n.title, n.body, n.category);
            const actionLabel = n.actionType
              ? ACTION_LABELS[n.actionType] || n.actionType.replace(/_/g, " ")
              : n.actionUrl || n.deepLink
              ? "Open"
              : null;

            const isUrgent = n.priority === "URGENT";
            const isHigh = n.priority === "HIGH";

            const categoryName =
              CATEGORY_ITEMS.find((c) => c.key === n.category)?.label ||
              n.category ||
              "Notice";

            // Clean decorative emojis from start of title if live badge or type icon already indicates it
            const displayTitle = n.title.replace(/^[🔴🟢🟠🟡🔵🟣\s]+/, "").trim();

            return (
              <div
                key={n.id}
                role="button"
                tabIndex={0}
                onClick={() => handleActionClick(n)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    handleActionClick(n);
                  }
                }}
                className={`relative w-full rounded-2xl border transition-all duration-150 cursor-pointer text-left group select-none overflow-hidden ${
                  !n.isRead
                    ? `${visual.cardBorder} ${visual.cardBg} shadow-xs ring-1 ring-black/5 dark:ring-white/5`
                    : "bg-white/90 dark:bg-slate-900/90 border-slate-200/80 dark:border-slate-800/80 hover:bg-white dark:hover:bg-slate-900 shadow-2xs"
                } ${visual.cardHoverBorder} hover:shadow-md active:scale-[0.995]`}
              >
                {/* Left accent gradient bar */}
                <div
                  className={`absolute left-0 top-0 bottom-0 w-1 sm:w-1.5 bg-gradient-to-b ${visual.accentBar}`}
                />

                <div className="py-2.5 px-3 sm:py-2.5 sm:px-3.5 pl-3.5 sm:pl-4 flex items-center gap-2.5 sm:gap-3">
                  {/* Vibrant Gradient Icon */}
                  <div
                    className={`w-8 h-8 sm:w-8 sm:h-8 rounded-xl bg-gradient-to-br ${visual.iconGradient} text-white shadow-sm ${visual.iconShadow} flex items-center justify-center shrink-0 transition-transform group-hover:scale-105`}
                  >
                    <span className="material-symbols-outlined text-base sm:text-lg">
                      {visual.icon}
                    </span>
                  </div>

                  {/* Notification Content */}
                  <div className="flex-1 min-w-0">
                    {/* Top Row: Badges, Title, Relative Time */}
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5 min-w-0 flex-wrap sm:flex-nowrap">
                        {!n.isRead && (
                          <span
                            className="w-2 h-2 rounded-full bg-blue-600 shrink-0 shadow-xs"
                            title="Unread"
                          />
                        )}

                        {/* Specific Live / Rescheduled / Category Badges */}
                        {visual.isLive ? (
                          <span className="inline-flex items-center gap-1 px-1.5 py-0.2 rounded-full text-[8.5px] font-black uppercase tracking-wider bg-rose-600 text-white shadow-xs shrink-0 animate-pulse">
                            <span className="w-1.5 h-1.5 rounded-full bg-white animate-ping" />
                            LIVE NOW
                          </span>
                        ) : visual.isRescheduled ? (
                          <span className="inline-flex items-center gap-1 px-1.5 py-0.2 rounded-md text-[8.5px] font-black uppercase tracking-wider bg-amber-500 text-white shadow-xs shrink-0">
                            <span className="material-symbols-outlined text-[10px]">update</span>
                            RESCHEDULED
                          </span>
                        ) : (
                          <span
                            className={`text-[8.5px] px-1.5 py-0.2 rounded-md font-bold uppercase tracking-wider shrink-0 ${
                              visual.variant === "test"
                                ? "bg-purple-100 dark:bg-purple-950 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800"
                                : visual.variant === "material"
                                ? "bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800"
                                : visual.variant === "offer"
                                ? "bg-pink-100 dark:bg-pink-950 text-pink-700 dark:text-pink-300 border border-pink-200 dark:border-pink-800"
                                : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400"
                            }`}
                          >
                            {visual.badgeLabel || categoryName}
                          </span>
                        )}

                        <h4 className="text-xs sm:text-[13px] font-extrabold text-slate-900 dark:text-slate-100 truncate">
                          {displayTitle}
                        </h4>

                        {isUrgent && (
                          <span className="px-1.5 py-0.2 text-[8px] font-black bg-red-600 text-white rounded shrink-0 uppercase tracking-wider">
                            URGENT
                          </span>
                        )}
                        {isHigh && (
                          <span className="px-1.5 py-0.2 text-[8px] font-black bg-amber-500 text-black rounded shrink-0 uppercase tracking-wider">
                            HIGH
                          </span>
                        )}
                      </div>

                      <span className="text-[10px] text-slate-400 whitespace-nowrap shrink-0 ml-auto font-medium">
                        {formatDistanceToNow(new Date(n.createdAt), { addSuffix: true })}
                      </span>
                    </div>

                    {/* Bottom Row: Message body + Inline Action Link */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 mt-0.5">
                      <p className="text-[11px] sm:text-xs text-slate-600 dark:text-slate-300 line-clamp-1 sm:line-clamp-2 leading-snug flex-1">
                        {n.body}
                      </p>

                      <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                        {actionLabel && (
                          <span
                            className={`inline-flex items-center gap-1 text-[10px] sm:text-[11px] font-bold px-2.5 py-0.5 rounded-lg transition-all ${visual.actionBgClass}`}
                          >
                            <span>{actionLabel}</span>
                            <span className="material-symbols-outlined text-[12px] transition-transform group-hover:translate-x-0.5">
                              arrow_forward
                            </span>
                          </span>
                        )}

                        {!n.isRead && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              markOneRead(n.id);
                            }}
                            className="text-[10px] text-slate-400 hover:text-blue-600 flex items-center gap-0.5 px-1 py-0.5 rounded transition"
                            title="Mark as read"
                          >
                            <span className="material-symbols-outlined text-xs">done</span>
                            <span className="hidden sm:inline">Mark read</span>
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </main>
    </div>
  );
}
