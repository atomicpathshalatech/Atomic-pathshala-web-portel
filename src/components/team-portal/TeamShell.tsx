"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { PanelLeft, Menu, X } from "lucide-react";
import { TeamProfileMenu } from "@/components/team-portal/TeamProfileMenu";
import { GlobalSearchBar } from "@/components/search/GlobalSearchBar";
import { NotificationBell } from "@/components/student/NotificationBell";
import { NotificationPopupLayer } from "@/components/common/NotificationPopupLayer";
import { DownloadAppsModal } from "@/components/common/DownloadAppsModal";
import { PortalSwitch } from "@/components/common/PortalSwitch";
import { TeamBreadcrumb } from "@/components/team-portal/TeamBreadcrumb";
import { QuickActionsMenu } from "@/components/team-portal/QuickActionsMenu";
import { AtomicSidebarNav } from "@/components/team-portal/AtomicSidebarNav";
import type { TeamNavGroup } from "@/lib/navigation/team-nav-departments";

export function TeamShell({
  userName,
  userRoleLabel,
  hasTeacherProfile,
  canViewAsStudent = false,
  groups,
  children,
}: {
  userName: string;
  userRoleLabel: string;
  hasTeacherProfile: boolean;
  canViewAsStudent?: boolean;
  groups?: TeamNavGroup[];
  children: React.ReactNode;
}) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [downloadAppOpen, setDownloadAppOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);

  const pathname = usePathname();
  const isLiveStudio =
    pathname?.startsWith("/team/live-class") ||
    pathname?.startsWith("/team/live-studio") ||
    pathname?.startsWith("/team/whiteboard/test");

  // Load saved sidebar collapsed state
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

  if (isLiveStudio) {
    return (
      <div className="fixed inset-0 overflow-hidden bg-[#10131b]">
        {children}
      </div>
    );
  }

  const activeGroups = groups || [];

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-[#0F172A] flex antialiased">
      {/* 1. FIXED DESKTOP VERTICAL SIDEBAR (FULL HEIGHT) */}
      <aside
        className={`hidden lg:flex flex-col shrink-0 h-screen sticky top-0 transition-all duration-200 z-40 ${
          collapsed ? "w-[4.5rem]" : "w-64"
        }`}
      >
        <AtomicSidebarNav
          groups={activeGroups}
          userName={userName}
          userRoleLabel={userRoleLabel}
          collapsed={collapsed}
          onToggleCollapse={handleToggleCollapse}
        />
      </aside>

      {/* 2. MOBILE DRAWER NAVIGATION */}
      {drawerOpen && (
        <div className="lg:hidden fixed inset-0 z-50 animate-fade-in">
          <div
            className="absolute inset-0 bg-slate-900/60 backdrop-blur-xs"
            onClick={() => setDrawerOpen(false)}
          />
          <aside className="absolute inset-y-0 left-0 w-72 max-w-[85vw] h-full shadow-2xl flex flex-col z-10 animate-in slide-in-from-left duration-200">
            <div className="flex items-center justify-between p-3 bg-[#080E21] border-b border-slate-800 text-white">
              <div className="flex items-center gap-2">
                <img src="/brand/logo.png" alt="Logo" className="w-6 h-6 object-contain" />
                <span className="font-bold text-xs tracking-tight">Atomic OPS</span>
              </div>
              <button
                type="button"
                onClick={() => setDrawerOpen(false)}
                className="w-7 h-7 rounded flex items-center justify-center text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="flex-1 overflow-hidden">
              <AtomicSidebarNav
                groups={activeGroups}
                userName={userName}
                userRoleLabel={userRoleLabel}
                collapsed={false}
                onNavigate={() => setDrawerOpen(false)}
              />
            </div>
          </aside>
        </div>
      )}

      {/* 3. MAIN WORKSPACE CONTAINER */}
      <div className="flex-1 flex flex-col min-w-0 min-h-screen">
        {/* PREMIUM COMPACT TOPBAR */}
        <header className="sticky top-0 z-30 h-14 bg-white border-b border-[#E2E8F0] px-4 sm:px-6 flex items-center justify-between gap-4">
          {/* Left: Sidebar toggle (Mobile/Desktop) & Breadcrumbs */}
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setDrawerOpen(true)}
              className="lg:hidden w-8 h-8 rounded-md flex items-center justify-center text-slate-600 hover:bg-slate-100 transition"
              aria-label="Open menu"
            >
              <Menu className="w-5 h-5" />
            </button>

            <button
              type="button"
              onClick={handleToggleCollapse}
              className="hidden lg:flex w-8 h-8 rounded-md items-center justify-center text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition"
              title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            >
              <PanelLeft className="w-4 h-4" />
            </button>

            <div className="h-4 w-px bg-slate-200 hidden sm:block" />

            <TeamBreadcrumb />
          </div>

          {/* Center: Global Search Bar */}
          <div className="hidden md:flex flex-1 max-w-md justify-center">
            <GlobalSearchBar />
          </div>

          {/* Right: Quick Create, Notifications, Portal Switch, Profile */}
          <div className="flex items-center gap-2 shrink-0">
            <div className="md:hidden">
              <GlobalSearchBar compact />
            </div>

            <QuickActionsMenu />

            {canViewAsStudent && <PortalSwitch current="team" />}

            <NotificationBell />

            <div className="h-4 w-px bg-slate-200" />

            <TeamProfileMenu
              userName={userName}
              userRoleLabel={userRoleLabel}
              hasTeacherProfile={hasTeacherProfile}
            />
          </div>
        </header>

        {/* WORKSPACE PAGE CONTENT */}
        <main className="flex-1 min-w-0 px-4 sm:px-6 lg:px-8 py-6 bg-[#F8FAFC]">
          <div className="mx-auto w-full max-w-screen-2xl">
            {children}
          </div>
        </main>
      </div>

      <NotificationPopupLayer />
      <DownloadAppsModal isOpen={downloadAppOpen} onClose={() => setDownloadAppOpen(false)} />
    </div>
  );
}
