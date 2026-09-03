"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LogoutButton } from "@/components/student/LogoutButton";
import { GoalSelectionModal } from "@/components/student/GoalSelectionModal";

export type StudentNavItem = {
  href: string;
  label: string;
  icon: string;
};

// Sidebar items for desktop Learning Hub
const SIDEBAR_ITEMS = [
  { href: "/dashboard", label: "Dashboard", icon: "space_dashboard" },
  { href: "/courses", label: "Study Modules", icon: "menu_book" },
  { href: "/tests", label: "Mock Tests", icon: "assignment_turned_in" },
  { href: "/live-class", label: "Live Classes", icon: "sensors" },
  { href: "/guru", label: "AI Doubt Solver", icon: "psychology_alt" },
  { href: "/predictor", label: "Mastery Pulse", icon: "analytics" },
];

// Bottom floating dock navigation items
const DOCK_ITEMS: StudentNavItem[] = [
  { href: "/dashboard", label: "Home", icon: "home" },
  { href: "/schedule", label: "My Schedule", icon: "calendar_month" },
  { href: "/dpp", label: "Practice", icon: "menu_book" },
  { href: "/tests", label: "Tests", icon: "assignment" },
  { href: "/courses", label: "Batches", icon: "storefront" },
];

function isActive(pathname: string, href: string) {
  return pathname === href || (href !== "/dashboard" && pathname.startsWith(`${href}/`));
}

function AccountMenu({
  studentName,
  studentIdCode,
}: {
  studentName: string;
  studentIdCode: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const initial = studentName.trim().charAt(0).toUpperCase() || "A";

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
        className="flex items-center gap-1 cursor-pointer group focus:outline-none"
        title={studentName}
      >
        <div className="w-10 h-10 rounded-full bg-indigo-50 border border-indigo-100 dark:bg-indigo-950/60 dark:border-indigo-800 flex items-center justify-center text-indigo-600 dark:text-indigo-400 font-bold text-base shadow-xs group-hover:ring-2 group-hover:ring-indigo-300/60 transition-all">
          {initial}
        </div>
        <svg
          className="w-4 h-4 text-slate-400 group-hover:text-slate-600 transition-colors ml-0.5"
          fill="currentColor"
          viewBox="0 0 20 20"
        >
          <path
            clipRule="evenodd"
            d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z"
            fillRule="evenodd"
          />
        </svg>
      </button>

      {open && (
        <div className="absolute right-0 top-12 w-64 bg-white dark:bg-slate-900 rounded-2xl shadow-xl border border-slate-200/80 dark:border-slate-800 py-2 z-50 animate-in fade-in duration-150">
          <div className="px-4 py-2 border-b border-slate-100 dark:border-slate-800 mb-1">
            <p className="font-bold text-sm text-slate-900 dark:text-white truncate">{studentName}</p>
            <p className="text-xs text-slate-400 font-mono truncate">{studentIdCode}</p>
          </div>
          <Link
            href="/id-card"
            onClick={() => setOpen(false)}
            className="flex items-center gap-3 px-4 py-2 text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 hover:text-slate-900 transition"
          >
            <span className="material-symbols-outlined text-lg text-blue-500">badge</span>
            Profile &amp; ID Card
          </Link>
          <Link
            href="/leaderboard"
            onClick={() => setOpen(false)}
            className="flex items-center gap-3 px-4 py-2 text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 hover:text-slate-900 transition"
          >
            <span className="material-symbols-outlined text-lg text-amber-500">leaderboard</span>
            Leaderboard
          </Link>
          <Link
            href="/notifications"
            onClick={() => setOpen(false)}
            className="flex items-center gap-3 px-4 py-2 text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 hover:text-slate-900 transition"
          >
            <span className="material-symbols-outlined text-lg text-indigo-500">notifications</span>
            Notifications
          </Link>
          <Link
            href="/settings"
            onClick={() => setOpen(false)}
            className="flex items-center gap-3 px-4 py-2 text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 hover:text-slate-900 transition"
          >
            <span className="material-symbols-outlined text-lg text-slate-500">settings</span>
            Settings
          </Link>
          <Link
            href="/guru"
            onClick={() => setOpen(false)}
            className="flex items-center gap-3 px-4 py-2 text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 hover:text-slate-900 transition"
          >
            <span className="material-symbols-outlined text-lg text-purple-500">psychology</span>
            Atomic Guru AI
          </Link>
          <Link
            href="/predictor"
            onClick={() => setOpen(false)}
            className="flex items-center gap-3 px-4 py-2 text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 hover:text-slate-900 transition"
          >
            <span className="material-symbols-outlined text-lg text-cyan-500">insights</span>
            NEET 2026 Rank Predictor
          </Link>
          <Link
            href="/"
            onClick={() => setOpen(false)}
            className="flex items-center gap-3 px-4 py-2 text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 hover:text-slate-900 transition"
          >
            <span className="material-symbols-outlined text-lg text-emerald-500">public</span>
            Website Homepage
          </Link>
          <div className="border-t border-slate-100 dark:border-slate-800 mt-1 pt-1 px-4">
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
  const [activeGoal, setActiveGoal] = useState<string>(targetExam || "NEET");
  const [goalModalOpen, setGoalModalOpen] = useState(false);

  useEffect(() => {
    if (targetExam) setActiveGoal(targetExam);
  }, [targetExam]);

  if (isExamAttempt) {
    return (
      <div className="min-h-screen w-full bg-[#f8fafc] dark:bg-slate-950">
        {children}
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F8FAFC] dark:bg-slate-950 text-slate-800 dark:text-slate-100 flex flex-col selection:bg-orange-100 selection:text-orange-900 font-sans antialiased">
      {/* BEGIN: MainHeader */}
      <header className="sticky top-0 z-40 w-full bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-b border-[#EDE9FE]/70 dark:border-slate-800 shadow-sm transition-all">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-[76px] flex items-center justify-between">
          {/* Left: Brand & Goal Selector */}
          <div className="flex items-center gap-3.5 sm:gap-4 shrink-0">
            {/* Logo Mark Card */}
            <Link
              href="/dashboard"
              aria-label="Home"
              className="group relative flex items-center justify-center w-[48px] h-[48px] rounded-2xl bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 shadow-sm hover:shadow-md transition-all duration-200"
            >
              <svg
                className="w-8 h-8 transition-transform group-hover:scale-105 duration-200"
                fill="none"
                viewBox="0 0 48 48"
                xmlns="http://www.w3.org/2000/svg"
              >
                {/* Stylized dynamic orange orbital swoosh */}
                <path
                  d="M7 35.5C8.8 38.2 13 40.5 20.5 37C32.5 31.5 43.5 17 40.5 12C37.8 7.5 26.5 12.5 16 23.5"
                  stroke="#F97316"
                  strokeDasharray="100"
                  strokeDashoffset="0"
                  strokeLinecap="round"
                  strokeWidth="2.5"
                />
                {/* Orbital particle point */}
                <circle cx="39.5" cy="12.5" fill="#F97316" r="2.2" />
                {/* Bold Stylized Letter 'A' */}
                <path d="M24 8L13 36H19.5L21.8 29.8H26.2L28.5 36H35L24 8Z" fill="#0F172A" className="dark:fill-white" />
                {/* Inner A cutout arrow accent */}
                <polygon fill="#FFFFFF" points="24,14.5 21,24.5 27,24.5" className="dark:fill-slate-900" />
                {/* Sharp upward accent bar in orange */}
                <path d="M19 27.5L24 16.5L29 27.5H23.5L19 27.5Z" fill="#EA580C" />
              </svg>
            </Link>

            {/* Subtle Vertical Separator */}
            <div aria-hidden="true" className="h-8 w-[1px] bg-slate-200/80 dark:bg-slate-800 rounded-full" />

            {/* Current Goal Dropdown Button */}
            <div className="flex flex-col justify-center">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 leading-none mb-1">
                Current goal
              </span>
              <button
                type="button"
                onClick={() => setGoalModalOpen(true)}
                className="group flex items-center gap-1.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-500/50 rounded"
              >
                <span className="text-[17px] sm:text-[18px] font-extrabold text-slate-900 dark:text-white tracking-tight group-hover:text-orange-600 dark:group-hover:text-orange-400 transition-colors">
                  {activeGoal}
                </span>
                <svg
                  className="w-4 h-4 text-slate-400 group-hover:text-slate-600 dark:group-hover:text-slate-200 transition-transform duration-200 group-hover:translate-y-0.5"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                >
                  <path
                    clipRule="evenodd"
                    d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z"
                    fillRule="evenodd"
                  />
                </svg>
              </button>
            </div>
          </div>

          {/* Right Section (Streak, Wallet, Notification, Profile) */}
          <div className="flex items-center gap-2 sm:gap-3.5 shrink-0">
            {/* Streak Pill Badge */}
            <Link
              href="/leaderboard"
              className="flex items-center gap-2 bg-orange-50/80 dark:bg-orange-950/40 border border-orange-200/90 dark:border-orange-800/80 rounded-full pl-1.5 pr-3.5 py-1 shadow-xs hover:bg-orange-100/70 transition-colors cursor-pointer select-none"
              title="Daily study streak"
            >
              <div className="w-6 h-6 rounded-full bg-gradient-to-tr from-orange-600 via-orange-500 to-amber-500 flex items-center justify-center text-white shadow-xs">
                <svg className="w-3.5 h-3.5 fill-current" viewBox="0 0 24 24">
                  <path d="M12.9 2.1c-.4-.5-1.1-.3-1.3.3-.8 2.6-2.5 4.3-4.2 6.1C5.6 10.5 4 12.8 4 16c0 4.4 3.6 8 8 8s8-3.6 8-8c0-3.1-1.4-5.8-3.6-7.8-1.5-1.4-2.7-3.4-3.5-6.1zM12 21.5c-3 0-5.5-2.5-5.5-5.5 0-1.8.9-3.4 2.2-4.6 1.4-1.3 2.6-2.8 3.3-4.7.7 1.8 1.9 3.3 3.3 4.6 1.3 1.2 2.2 2.8 2.2 4.7 0 3-2.5 5.5-5.5 5.5z" />
                </svg>
              </div>
              <div className="flex items-baseline gap-1">
                <span className="text-xs font-bold text-orange-950 dark:text-orange-200 tracking-tight">
                  {currentStreakDays} day{currentStreakDays === 1 ? "" : "s"}
                </span>
                <span className="hidden sm:inline text-[11px] font-medium text-orange-700/80 dark:text-orange-400">
                  Streak
                </span>
              </div>
            </Link>

            {/* Wallet / Subscription Button */}
            <Link
              href="/subscription"
              aria-label="Wallet & Balance"
              className="relative w-10 h-10 flex items-center justify-center rounded-xl bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 border border-slate-200/90 dark:border-slate-700 text-slate-700 dark:text-slate-300 shadow-xs hover:border-slate-300 transition-all focus:outline-none"
            >
              <svg
                className="w-5 h-5 text-slate-600 dark:text-slate-300"
                fill="none"
                stroke="currentColor"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="1.8"
                viewBox="0 0 24 24"
              >
                <rect height="14" rx="3" width="20" x="2" y="5" />
                <line x1="2" x2="22" y1="10" y2="10" />
                <path d="M16 14h2" />
              </svg>
            </Link>

            {/* Notification Bell */}
            <Link
              href="/notifications"
              aria-label="Notifications"
              className="relative w-10 h-10 flex items-center justify-center rounded-xl bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 border border-slate-200/90 dark:border-slate-700 text-slate-700 dark:text-slate-300 shadow-xs hover:border-slate-300 transition-all focus:outline-none"
            >
              <svg
                className="w-5 h-5 text-slate-600 dark:text-slate-300"
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
              {/* Notification Dot */}
              <span className="absolute top-2 right-2 w-2 h-2 bg-orange-500 rounded-full ring-2 ring-white dark:ring-slate-800" />
            </Link>

            {/* User Profile Avatar with Dropdown Indicator */}
            <AccountMenu studentName={studentName} studentIdCode={studentIdCode} />
          </div>
        </div>
      </header>

      {/* Main Layout Container with Desktop Sidebar */}
      <div className="flex-1 flex relative">
        {/* BEGIN: Desktop Sidebar (Learning Hub) */}
        <aside className="hidden lg:flex fixed left-0 top-[76px] bottom-0 w-64 bg-white dark:bg-slate-900 border-r border-slate-200/80 dark:border-slate-800 shadow-sm z-30 flex-col justify-between py-5 px-3">
          <div className="space-y-1">
            <div className="px-3 pb-2 pt-1 text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider font-mono">
              Learning Hub
            </div>
            <nav className="space-y-1">
              {SIDEBAR_ITEMS.map((item) => {
                const active = isActive(pathname, item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-bold transition-all ${
                      active
                        ? "bg-orange-500 text-white shadow-sm shadow-orange-500/20"
                        : "text-slate-600 dark:text-slate-400 hover:bg-slate-100/80 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white"
                    }`}
                  >
                    <span className="material-symbols-outlined text-[22px]">{item.icon}</span>
                    <span>{item.label}</span>
                  </Link>
                );
              })}
            </nav>
          </div>

          {/* Bottom Sidebar: Target Goal Badge + Settings */}
          <div className="space-y-2 pt-4 border-t border-slate-100 dark:border-slate-800">
            <div className="bg-slate-50 dark:bg-slate-800/70 p-3 rounded-2xl flex items-center gap-3 border border-slate-200/60 dark:border-slate-700/60">
              <div className="w-10 h-10 rounded-xl bg-orange-100 dark:bg-orange-950/60 text-orange-600 dark:text-orange-400 flex items-center justify-center flex-shrink-0">
                <span className="material-symbols-outlined text-[20px]">military_tech</span>
              </div>
              <div className="flex flex-col min-w-0">
                <span className="text-xs font-bold text-slate-900 dark:text-white truncate">
                  {activeGoal} Prep
                </span>
                <span className="text-[10px] text-orange-600 dark:text-orange-400 font-semibold truncate">
                  Target 680+ Score
                </span>
              </div>
            </div>

            <Link
              href="/settings"
              className="flex items-center gap-3 px-3.5 py-2 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-100/80 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white transition-all"
            >
              <span className="material-symbols-outlined text-[20px]">settings</span>
              <span>Settings</span>
            </Link>
          </div>
        </aside>

        {/* Content Area (with left margin on lg: screens) */}
        <main className="flex-1 lg:pl-64 pb-44 w-full">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
            {children}
          </div>
        </main>
      </div>

      {/* Floating Subscription Upgrade Banner */}
      {!hasActiveSubscription && (
        <aside className="fixed bottom-24 left-1/2 -translate-x-1/2 w-full max-w-4xl px-4 z-40 pointer-events-auto">
          <div className="rounded-2xl bg-gradient-to-r from-blue-700 via-indigo-600 to-blue-600 text-white shadow-xl p-3 px-5 flex items-center justify-between border border-blue-400/30 backdrop-blur-md">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-9 h-9 rounded-xl bg-white/20 flex items-center justify-center text-white flex-shrink-0 shadow-inner">
                <span className="material-symbols-outlined text-[20px]">lock_open</span>
              </div>
              <div className="flex flex-col min-w-0">
                <span className="text-xs sm:text-sm font-bold leading-tight truncate">
                  Get access to all batches
                </span>
                <span className="text-[11px] sm:text-xs text-white/85 truncate">
                  Unlock 100+ live crash courses, test series &amp; personal mentorship
                </span>
              </div>
            </div>
            <div className="flex items-center gap-3 flex-shrink-0 ml-4">
              <Link
                href="/subscription"
                className="bg-white text-blue-700 font-bold px-5 py-2 rounded-xl shadow hover:bg-blue-50 active:scale-95 transition-all text-xs"
              >
                Upgrade
              </Link>
            </div>
          </div>
        </aside>
      )}

      {/* Ultra-Sleek Floating Pill Dock Navigation Bar */}
      <div className="fixed bottom-4 left-1/2 -translate-x-1/2 w-full max-w-4xl px-4 z-50 pointer-events-auto">
        <nav
          id="bottom-dock-nav"
          className="bg-white/90 dark:bg-slate-900/90 backdrop-blur-xl border border-slate-200/80 dark:border-slate-800 shadow-2xl rounded-2xl p-2 flex items-center justify-around gap-2"
        >
          {DOCK_ITEMS.map((item) => {
            const active = isActive(pathname, item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`dock-item rounded-xl px-4 sm:px-5 py-2.5 flex flex-col items-center justify-center gap-1 group select-none flex-1 text-center transition-all duration-200 ease-out hover:scale-105 active:scale-95 ${
                  active
                    ? "active bg-orange-500/10 text-orange-600 dark:text-orange-400 border border-orange-500/25 shadow-sm font-semibold"
                    : "text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-100 hover:bg-slate-100/80 dark:hover:bg-slate-800/60 border border-transparent"
                }`}
              >
                <span className="material-symbols-outlined text-[22px] transition-transform duration-200 group-hover:-translate-y-0.5">
                  {item.icon}
                </span>
                <span className="text-[11px] font-bold leading-none">{item.label}</span>
              </Link>
            );
          })}
        </nav>
      </div>

      {/* Goal Selection Modal */}
      <GoalSelectionModal
        currentGoal={activeGoal}
        isOpen={goalModalOpen}
        onClose={() => setGoalModalOpen(false)}
        onGoalChanged={(newGoal) => setActiveGoal(newGoal)}
      />
    </div>
  );
}
