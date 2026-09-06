"use client";

import Link from "next/link";
import { useRealtimeNotifications } from "@/hooks/useRealtimeNotifications";

export function NotificationBell() {
  const { unreadCount } = useRealtimeNotifications();

  return (
    <Link
      href="/notifications"
      aria-label="Notifications"
      className="relative w-9 h-9 flex items-center justify-center rounded-xl bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 shadow-2xs hover:border-slate-300 transition-all focus:outline-none"
    >
      <svg
        className="w-4.5 h-4.5 text-slate-600 dark:text-slate-300"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.8"
        viewBox="0 0 24 24"
      >
        <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
        <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
      </svg>

      {/* Dynamic Unread Badge */}
      {unreadCount > 0 && (
        <span className="absolute -top-1 -right-1 min-w-4.5 h-4.5 px-1 bg-red-500 text-white text-[10px] font-bold flex items-center justify-center rounded-full ring-2 ring-white dark:ring-slate-900 animate-in fade-in zoom-in duration-200">
          {unreadCount > 99 ? "99+" : unreadCount}
        </span>
      )}
    </Link>
  );
}
