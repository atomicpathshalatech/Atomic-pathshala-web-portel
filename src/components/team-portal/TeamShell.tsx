"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { TeamProfileMenu } from "@/components/team-portal/TeamProfileMenu";
import { OpsBackButton } from "@/components/common/OpsBackButton";
import { GlobalSearchBar } from "@/components/search/GlobalSearchBar";
import { NotificationBell } from "@/components/student/NotificationBell";
import { NotificationPopupLayer } from "@/components/common/NotificationPopupLayer";
import { DownloadAppsModal } from "@/components/common/DownloadAppsModal";
import { PortalSwitch } from "@/components/common/PortalSwitch";
import { TeamBreadcrumb } from "@/components/team-portal/TeamBreadcrumb";
import { QuickActionsMenu } from "@/components/team-portal/QuickActionsMenu";
import { AtomicSidebarNav } from "@/components/team-portal/AtomicSidebarNav";
import type { TeamNavDepartment } from "@/lib/navigation/team-nav-departments";

export type TeamNavItem = { href: string; label: string; icon: string };
export type TeamNavSection = { title?: string; items: TeamNavItem[] };

export function TeamShell({
  userName,
  userRoleLabel,
  hasTeacherProfile,
  canViewAsStudent = false,
  departments,
  sections,
  children,
}: {
  userName: string;
  userRoleLabel: string;
  hasTeacherProfile: boolean;
  canViewAsStudent?: boolean;
  departments?: TeamNavDepartment[];
  sections?: TeamNavSection[];
  children: React.ReactNode;
}) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [downloadAppOpen, setDownloadAppOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);

  const pathname = usePathname();
  const isRootTeam = pathname === "/team";
  const isLiveStudio =
    pathname?.startsWith("/team/live-class") ||
    pathname?.startsWith("/team/live-studio") ||
    pathname?.startsWith("/team/whiteboard/test");

  // Load saved sidebar state
  useEffect(() => {
    try {
      const saved = localStorage.getItem("atomic_ops_sidebar_collapsed");
      if (saved !== null) {
        setCollapsed(saved === "true");
      }
    } catch {}
  }, []);

  const handleToggleCollapse = () => {
    setCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem("atomic_ops_sidebar_collapsed", String(next));
      } catch {}
      return next;
    });
  };

  // Convert legacy sections to departments if departments prop is not passed directly
  const activeDepartments: TeamNavDepartment[] =
    departments && departments.length > 0
      ? departments
      : (sections ?? []).map((sec, idx) => ({
          id: `section-${idx}`,
          title: sec.title || "General",
          icon: sec.items[0]?.icon || "folder",
          description: sec.title || "Navigation",
          items: sec.items.map((it) => ({
            href: it.href,
            label: it.label,
            icon: it.icon,
            permission: "team.portal.access",
          })),
        }));

  if (isLiveStudio) {
    return (
      <div className="fixed inset-0 overflow-hidden bg-[#10131b]">
        {children}
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-[#0F172A] flex flex-col antialiased">
      {/* Top Header */}
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-[#E2E8F0] shadow-xs">
        <div className="h-16 px-4 sm:px-6 flex items-center justify-between gap-3">
          {/* Left: Brand & Breadcrumbs */}
          <div className="flex items-center gap-3 min-w-0">
            {/* Mobile menu button */}
            <button
              type="button"
              onClick={() => setDrawerOpen(true)}
              className="lg:hidden shrink-0 w-9 h-9 flex items-center justify-center rounded-lg text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors"
              aria-label="Open navigation menu"
            >
              <span className="material-symbols-outlined text-2xl">menu</span>
            </button>

            {/* Brand Logo */}
            <Link
              href="/team"
              className="flex items-center gap-2.5 font-bold text-slate-900 shrink-0 group"
            >
              <img
                src="/brand/logo.png"
                alt="Atomic OPS"
                className="w-8 h-8 rounded-lg object-contain shrink-0 group-hover:scale-105 transition-transform"
              />
              <div className="flex items-center gap-1.5 font-black tracking-tight leading-none">
                <span className="text-sm font-black text-[#102C50]">ATOMIC</span>
                <span className="px-1.5 py-0.5 rounded bg-blue-600 text-white text-[10px] font-black tracking-wider uppercase">
                  OPS 2.0
                </span>
              </div>
            </Link>

            {/* Back button when not on root */}
            {!isRootTeam && (
              <div className="hidden sm:flex items-center pl-2 border-l border-slate-200">
                <OpsBackButton label="Back" fallbackHref="/team" />
              </div>
            )}

            {/* Breadcrumb Navigation */}
            <div className="hidden lg:flex items-center pl-3 border-l border-slate-200">
              <TeamBreadcrumb />
            </div>
          </div>

          {/* Center: Global Search & Command Palette */}
          <div className="hidden md:flex flex-1 max-w-md justify-center px-2">
            <GlobalSearchBar />
          </div>

          {/* Right: Quick Actions, Notifications, Profile */}
          <div className="flex items-center gap-2 sm:gap-2.5 shrink-0">
            <div className="md:hidden">
              <GlobalSearchBar compact />
            </div>

            {/* Quick Actions Dropdown */}
            <QuickActionsMenu />

            {/* View as Student toggle */}
            {canViewAsStudent && <PortalSwitch current="team" />}

            {/* Notifications */}
            <NotificationBell />

            {/* Profile Dropdown */}
            <div className="pl-1 border-l border-slate-200">
              <TeamProfileMenu
                userName={userName}
                userRoleLabel={userRoleLabel}
                hasTeacherProfile={hasTeacherProfile}
              />
            </div>
          </div>
        </div>
      </header>

      {/* Main Workspace with Persistent Left Sidebar */}
      <div className="flex flex-1 min-h-[calc(100vh-4rem)]">
        {/* Desktop Sidebar */}
        <aside
          className={`hidden lg:block shrink-0 border-r border-[#0d223f] bg-[#102C50] sticky top-16 h-[calc(100vh-4rem)] transition-all duration-200 z-30 shadow-md ${
            collapsed ? "w-[4.8rem]" : "w-64"
          }`}
        >
          <AtomicSidebarNav
            departments={activeDepartments}
            collapsed={collapsed}
            onToggleCollapse={handleToggleCollapse}
            onOpenDownloadApp={() => setDownloadAppOpen(true)}
          />
        </aside>

        {/* Mobile / Tablet Drawer */}
        {drawerOpen && (
          <div className="lg:hidden fixed inset-0 z-50 animate-fade-in">
            <div
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-xs"
              onClick={() => setDrawerOpen(false)}
            />
            <aside className="absolute inset-y-0 left-0 w-72 max-w-[85vw] bg-[#102C50] text-white shadow-2xl flex flex-col z-10 animate-in slide-in-from-left duration-200">
              <div className="flex items-center justify-between px-4 py-3.5 border-b border-white/10 bg-[#0d223f]">
                <div className="flex items-center gap-2">
                  <img src="/brand/logo.png" alt="Logo" className="w-6 h-6 object-contain" />
                  <span className="font-bold text-sm tracking-tight text-white">Atomic OPS 2.0</span>
                </div>
                <button
                  type="button"
                  onClick={() => setDrawerOpen(false)}
                  className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-300 hover:text-white hover:bg-white/10 transition-colors"
                  aria-label="Close menu"
                >
                  <span className="material-symbols-outlined text-xl">close</span>
                </button>
              </div>

              <div className="flex-1 overflow-y-auto">
                <AtomicSidebarNav
                  departments={activeDepartments}
                  collapsed={false}
                  onNavigate={() => setDrawerOpen(false)}
                  onOpenDownloadApp={() => {
                    setDrawerOpen(false);
                    setDownloadAppOpen(true);
                  }}
                />
              </div>
            </aside>
          </div>
        )}

        {/* Main Content Area */}
        <main className="flex-1 min-w-0 px-4 sm:px-6 lg:px-8 py-6 lg:py-8 bg-[#F8FAFC]">
          <div className="mx-auto w-full min-w-0 max-w-screen-2xl">
            {!isRootTeam && (
              <div className="sm:hidden mb-3">
                <OpsBackButton label="Back" fallbackHref="/team" />
              </div>
            )}
            {children}
          </div>
        </main>
      </div>

      <NotificationPopupLayer />
      <DownloadAppsModal isOpen={downloadAppOpen} onClose={() => setDownloadAppOpen(false)} />
    </div>
  );
}
