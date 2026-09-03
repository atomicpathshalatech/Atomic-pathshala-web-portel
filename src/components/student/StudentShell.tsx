"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LogoutButton } from "@/components/student/LogoutButton";

export type StudentNavItem = {
  href: string;
  label: string;
  icon: string;
};

/**
 * The whole student panel now runs on 5 tabs, not the old 11-item sidebar —
 * everything else (My Batches, Subscription, Doubt Portal, DPP, etc.) lives
 * *inside* one of these five, the same way the reference app folds a much
 * bigger feature set into Plus/Prime/QBank/Test/Store. Route ownership:
 *   Home         → /dashboard   (goal banner, promos, popular batches)
 *   My Schedule  → /schedule    (today's/upcoming classes, Join/Enter)
 *   Practice     → /dpp         (DPP + a Doubt Portal shortcut)
 *   Tests        → /tests       (Test Series)
 *   Batches      → /courses     (My Batches + upgrade/store)
 * "Website Homepage" and "Notifications" are still real, useful links but
 * don't deserve one of only 5 tab slots — they live in the avatar menu
 * instead (see AccountMenu below), alongside Profile/Settings/Logout.
 */
const NAV_ITEMS: StudentNavItem[] = [
  { href: "/dashboard", label: "Home", icon: "home" },
  { href: "/schedule", label: "My Schedule", icon: "calendar_month" },
  { href: "/dpp", label: "Practice", icon: "menu_book" },
  { href: "/tests", label: "Tests", icon: "edit_document" },
  { href: "/courses", label: "Batches", icon: "storefront" },
];

function isActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

function AccountMenu({ studentName, studentIdCode }: { studentName: string; studentIdCode: string }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const initial = studentName.trim().charAt(0).toUpperCase() || "?";

  useEffect(() => {
    if (!open) return;
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-9 h-9 rounded-full bg-primary/15 text-primary font-bold flex items-center justify-center shrink-0 overflow-hidden"
        title={studentName}
      >
        {initial}
      </button>
      {open && (
        <div className="absolute right-0 top-11 w-64 bg-surface rounded-xl shadow-lg border border-outline-variant/20 py-2 z-50">
          <div className="px-4 py-2 border-b border-outline-variant/20 mb-1">
            <p className="font-label-md text-label-md text-on-surface truncate">{studentName}</p>
            <p className="text-label-sm text-on-surface-variant truncate">{studentIdCode}</p>
          </div>
          <Link
            href="/id-card"
            onClick={() => setOpen(false)}
            className="flex items-center gap-3 px-4 py-2 text-label-md text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface"
          >
            <span className="material-symbols-outlined text-lg">badge</span>
            Profile &amp; ID Card
          </Link>
          <Link
            href="/leaderboard"
            onClick={() => setOpen(false)}
            className="flex items-center gap-3 px-4 py-2 text-label-md text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface"
          >
            <span className="material-symbols-outlined text-lg">leaderboard</span>
            Leaderboard
          </Link>
          <Link
            href="/notifications"
            onClick={() => setOpen(false)}
            className="flex items-center gap-3 px-4 py-2 text-label-md text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface"
          >
            <span className="material-symbols-outlined text-lg">notifications</span>
            Notifications
          </Link>
          <Link
            href="/settings"
            onClick={() => setOpen(false)}
            className="flex items-center gap-3 px-4 py-2 text-label-md text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface"
          >
            <span className="material-symbols-outlined text-lg">settings</span>
            Settings
          </Link>
          <Link
            href="/guru"
            onClick={() => setOpen(false)}
            className="flex items-center gap-3 px-4 py-2 text-label-md text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface"
          >
            <span className="material-symbols-outlined text-lg">psychology</span>
            Atomic Guru
          </Link>
          <Link
            href="/predictor"
            onClick={() => setOpen(false)}
            className="flex items-center gap-3 px-4 py-2 text-label-md text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface"
          >
            <span className="material-symbols-outlined text-lg">insights</span>
            Rank &amp; College Predictor
          </Link>
          <Link
            href="/"
            onClick={() => setOpen(false)}
            className="flex items-center gap-3 px-4 py-2 text-label-md text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface"
          >
            <span className="material-symbols-outlined text-lg">public</span>
            Website Homepage
          </Link>
          <div className="border-t border-outline-variant/20 mt-1 pt-1 px-4">
            <LogoutButton />
          </div>
        </div>
      )}
    </div>
  );
}

export function StudentShell({
  studentName,
  studentIdCode,
  targetExam,
  currentStreakDays,
  hasActiveSubscription,
  children,
}: {
  studentName: string;
  studentIdCode: string;
  targetExam: string;
  currentStreakDays: number;
  hasActiveSubscription: boolean;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const isExamAttempt = pathname?.includes("/attempt");

  // When student is in live CBT exam attempt, strip out all shell chrome
  // (header, bottom tab bar, profile, notifications, upgrade banner)
  // so only the fullscreen CBT examination engine occupies the screen.
  if (isExamAttempt) {
    return (
      <div className="min-h-screen w-full bg-[#f8fafc] dark:bg-slate-950">
        {children}
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-surface-container-low/30 flex flex-col">
      {/* Top bar — goal + streak + quick links + account, same on every
          breakpoint (the whole shell now targets the reference app's
          single mobile-first layout rather than a separate desktop chrome). */}
      <header className="sticky top-0 z-40 flex items-center justify-between gap-3 px-margin-mobile md:px-margin-desktop h-16 bg-surface/95 backdrop-blur-md border-b border-outline-variant/20">
        <div className="flex items-center gap-2.5 min-w-0">
          <Link href="/dashboard" className="shrink-0">
            <img src="/brand/logo.png" alt="Atomic Logo" className="w-9 h-9 rounded-xl object-contain shadow-sm" />
          </Link>
          <div className="min-w-0">
            <p className="text-label-sm text-on-surface-variant leading-tight">Current goal</p>
            <p className="font-headline-sm text-headline-sm text-on-surface font-bold truncate leading-tight">
              {targetExam}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1.5 md:gap-2 shrink-0">
          <span
            className="flex items-center gap-1 px-3 py-1.5 rounded-full bg-secondary-container/40 text-secondary text-label-sm font-label-sm"
            title="Daily streak"
          >
            <span className="material-symbols-outlined text-base">local_fire_department</span>
            {currentStreakDays} day{currentStreakDays === 1 ? "" : "s"}
          </span>
          <Link
            href="/subscription"
            className="p-2 rounded-full text-on-surface-variant hover:bg-surface-container-high hover:text-primary transition-colors"
            title="Subscription & Payments"
          >
            <span className="material-symbols-outlined text-xl">account_balance_wallet</span>
          </Link>
          <AccountMenu studentName={studentName} studentIdCode={studentIdCode} />
        </div>
      </header>

      {/* Main content */}
      <main className="flex-1 pb-32">
        <div className="max-w-container-max mx-auto px-margin-mobile md:px-margin-desktop py-stack-lg">
          {children}
        </div>
      </main>

      {/* Persistent upgrade nudge — sits directly above the tab bar on every
          screen, same placement as the reference app's "Join Plus" banner.
          Hidden outright for anyone with a real ACTIVE subscription rather
          than just re-labeled, since there's nothing to upgrade to for them. */}
      {!hasActiveSubscription && (
        <div className="fixed bottom-16 left-0 w-full z-40 flex items-center justify-between gap-3 px-margin-mobile md:px-margin-desktop py-3 bg-gradient-to-r from-secondary to-secondary-container text-on-secondary">
          <div className="min-w-0">
            <p className="font-label-md text-label-md font-semibold truncate">Get access to all batches</p>
            <p className="text-label-sm opacity-90 truncate">Unlock everything with a subscription</p>
          </div>
          <Link
            href="/subscription"
            className="shrink-0 px-4 py-1.5 rounded-full bg-surface text-secondary text-label-md font-label-md font-semibold hover:opacity-90 transition"
          >
            Upgrade
          </Link>
        </div>
      )}

      {/* Bottom tab bar — the 5 tabs, fixed on every breakpoint. */}
      <nav className="fixed bottom-0 left-0 w-full z-40 flex justify-around items-center px-2 py-2 bg-surface border-t border-outline-variant/20 shadow-lg">
        {NAV_ITEMS.map((item) => {
          const active = isActive(pathname, item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex flex-col items-center justify-center gap-0.5 px-3 py-1.5 rounded-full transition-colors min-w-[64px] ${
                active ? "bg-primary-container/10 text-primary" : "text-on-surface-variant"
              }`}
            >
              <span className="material-symbols-outlined text-xl">{item.icon}</span>
              <span className="text-[11px] font-label-sm">{item.label}</span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
