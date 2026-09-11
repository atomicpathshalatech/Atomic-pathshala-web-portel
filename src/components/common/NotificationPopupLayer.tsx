"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { getPusherClient } from "@/lib/realtime/pusher-client";

export interface PopNotification {
  id: string;
  title: string;
  body: string;
  type?: string;
  category?: string;
  priority?: "LOW" | "NORMAL" | "HIGH" | "URGENT";
  actionType?: string | null;
  actionUrl?: string | null;
  deepLink?: string | null;
  createdAt?: string;
}

const PRIORITY_ORDER: Record<string, number> = {
  URGENT: 4,
  HIGH: 3,
  NORMAL: 2,
  LOW: 1,
};

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

export function NotificationPopupLayer() {
  const { data: session } = useSession();
  const router = useRouter();
  const [visibleQueue, setVisibleQueue] = useState<PopNotification[]>([]);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Load sound preferences
  useEffect(() => {
    try {
      const saved = localStorage.getItem("atomic_notification_sound");
      if (saved !== null) {
        setSoundEnabled(saved === "true");
      }
    } catch {}
  }, []);

  const playNotificationSound = useCallback(() => {
    if (!soundEnabled) return;
    try {
      if (!audioRef.current) {
        audioRef.current = new Audio("/sounds/notification.mp3");
      }
      audioRef.current.currentTime = 0;
      audioRef.current.play().catch(() => {});
    } catch {}
  }, [soundEnabled]);

  const removeNotification = useCallback((id: string) => {
    setVisibleQueue((prev) => prev.filter((item) => item.id !== id));
  }, []);

  const handleActionClick = useCallback(
    async (item: PopNotification) => {
      const targetUrl = item.actionUrl || item.deepLink || "/";

      // Track action server-side
      try {
        fetch("/api/notifications/track-action", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            notificationId: item.id,
            actionType: item.actionType || "NOTIFICATION_CLICK",
            source: "POPUP",
          }),
        }).catch(() => {});
      } catch {}

      removeNotification(item.id);
      router.push(targetUrl);
    },
    [router, removeNotification]
  );

  const enqueueNotification = useCallback(
    (notif: PopNotification) => {
      setVisibleQueue((prev) => {
        // Prevent duplicate popup
        if (prev.some((p) => p.id === notif.id)) return prev;

        const updated = [...prev, notif];
        // Sort by priority descending
        updated.sort(
          (a, b) => (PRIORITY_ORDER[b.priority || "NORMAL"] || 2) - (PRIORITY_ORDER[a.priority || "NORMAL"] || 2)
        );

        // Maximum 3 visible popups at once
        return updated.slice(0, 3);
      });

      playNotificationSound();

      // Auto dismiss timers based on priority
      const priority = notif.priority || "NORMAL";
      const duration =
        priority === "URGENT" ? 14000 : priority === "HIGH" ? 9000 : priority === "LOW" ? 4000 : 6000;

      setTimeout(() => {
        removeNotification(notif.id);
      }, duration);
    },
    [playNotificationSound, removeNotification]
  );

  // Subscribe to user private channel on Pusher
  useEffect(() => {
    const userId = session?.user?.id;
    if (!userId) return;

    const client = getPusherClient();
    const channelName = `private-user-${userId}`;
    const channel = client.subscribe(channelName);

    channel.bind("notification:new", (data: any) => {
      if (!data?.id) return;
      enqueueNotification({
        id: data.id,
        title: data.title,
        body: data.body,
        type: data.type,
        category: data.metadata?.category,
        priority: data.metadata?.priority || "NORMAL",
        actionType: data.metadata?.actionType,
        actionUrl: data.metadata?.actionUrl || data.deepLink,
        deepLink: data.deepLink,
        createdAt: data.createdAt,
      });
    });

    return () => {
      channel.unbind("notification:new");
    };
  }, [session?.user?.id, enqueueNotification]);

  if (visibleQueue.length === 0) return null;

  return (
    <aside
      aria-live="polite"
      aria-label="Notifications"
      className="fixed bottom-4 right-4 sm:top-4 sm:bottom-auto z-toast flex flex-col gap-2.5 max-w-sm w-full px-3 sm:px-0 pointer-events-none"
    >
      {visibleQueue.map((item) => {
        const isUrgent = item.priority === "URGENT";
        const isHigh = item.priority === "HIGH";
        const actionLabel = item.actionType
          ? ACTION_LABELS[item.actionType] || item.actionType.replace(/_/g, " ")
          : item.actionUrl || item.deepLink
          ? "Open"
          : null;

        return (
          <div
            key={item.id}
            role="status"
            className={`pointer-events-auto rounded-2xl p-4 shadow-xl border backdrop-blur-md transition-all duration-300 transform translate-y-0 animate-in fade-in slide-in-from-top-4 ${
              isUrgent
                ? "bg-red-950/95 border-red-500/50 text-white ring-2 ring-red-500/40"
                : isHigh
                ? "bg-slate-900/95 border-amber-500/40 text-white ring-1 ring-amber-500/30"
                : "bg-slate-900/95 border-slate-700/60 text-white"
            }`}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-2">
                <span
                  className={`w-2.5 h-2.5 rounded-full shrink-0 ${
                    isUrgent
                      ? "bg-red-500 animate-ping"
                      : isHigh
                      ? "bg-amber-400"
                      : "bg-emerald-400"
                  }`}
                />
                <h4 className="font-headline-md text-sm font-bold truncate leading-tight">
                  {item.title}
                </h4>
              </div>
              <button
                type="button"
                onClick={() => removeNotification(item.id)}
                className="text-white/60 hover:text-white p-1 -mr-1 -mt-1 rounded-md transition-colors"
                aria-label="Close notification"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <p className="font-body-md text-xs text-white/80 mt-1.5 leading-relaxed line-clamp-2">
              {item.body}
            </p>

            {actionLabel && (
              <div className="mt-3 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => handleActionClick(item)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all shadow-sm ${
                    isUrgent
                      ? "bg-red-500 hover:bg-red-600 text-white active:scale-95"
                      : isHigh
                      ? "bg-amber-500 hover:bg-amber-600 text-black active:scale-95"
                      : "bg-primary hover:bg-primary/90 text-white active:scale-95"
                  }`}
                >
                  {actionLabel}
                </button>
              </div>
            )}
          </div>
        );
      })}
    </aside>
  );
}
