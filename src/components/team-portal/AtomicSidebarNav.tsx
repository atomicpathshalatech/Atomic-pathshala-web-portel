"use client";

import React, { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Building2,
  ChevronLeft,
  ChevronRight,
  LogOut,
  User,
  CreditCard,
  ChevronsUpDown,
} from "lucide-react";
import { LucideIcon } from "@/components/common/LucideIcon";
import { LogoutButton } from "@/components/student/LogoutButton";
import type { TeamNavGroup } from "@/lib/navigation/team-nav-departments";

interface AtomicSidebarNavProps {
  groups: TeamNavGroup[];
  userName: string;
  userRoleLabel: string;
  collapsed?: boolean;
  onToggleCollapse?: () => void;
  onNavigate?: () => void;
}

export function AtomicSidebarNav({
  groups,
  userName,
  userRoleLabel,
  collapsed = false,
  onToggleCollapse,
  onNavigate,
}: AtomicSidebarNavProps) {
  const pathname = usePathname();
  const [hoveredItem, setHoveredItem] = useState<{ label: string; group: string; top: number } | null>(null);
  const [orgDropdownOpen, setOrgDropdownOpen] = useState(false);

  const isItemActive = (href: string) =>
    href === "/team" ? pathname === "/team" : pathname === href || pathname.startsWith(`${href}/`);

  const userInitial = userName.trim().charAt(0).toUpperCase() || "A";

  return (
    <div className="flex flex-col h-full bg-[#0B132B] text-slate-300 select-none border-r border-slate-800/80">
      {/* 1. TOP SECTION: Brand Logo & Organization Selector */}
      <div className="p-3 border-b border-slate-800/80 shrink-0 bg-[#080E21]">
        <div className="flex items-center justify-between gap-2">
          <Link
            href="/team"
            onClick={onNavigate}
            className="flex items-center gap-2.5 min-w-0 group"
          >
            <div className="w-8 h-8 rounded-lg bg-blue-600/20 border border-blue-500/30 flex items-center justify-center shrink-0 p-1">
              <img
                src="/brand/logo.png"
                alt="Atomic Pathshala"
                className="w-full h-full object-contain"
              />
            </div>
            {!collapsed && (
              <div className="min-w-0 truncate">
                <div className="flex items-center gap-1.5 leading-none">
                  <span className="font-black text-sm text-white tracking-tight">ATOMIC</span>
                  <span className="text-[10px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded bg-blue-600 text-white">
                    OPS
                  </span>
                </div>
                <span className="text-[10px] text-slate-400 truncate block mt-0.5 font-medium">
                  Enterprise Portal
                </span>
              </div>
            )}
          </Link>

          {onToggleCollapse && (
            <button
              type="button"
              onClick={onToggleCollapse}
              className="hidden lg:flex w-7 h-7 rounded-md items-center justify-center text-slate-400 hover:text-white hover:bg-slate-800 transition"
              title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            >
              {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
            </button>
          )}
        </div>

        {/* Workspace Selector */}
        {!collapsed && (
          <div className="relative mt-2.5">
            <button
              type="button"
              onClick={() => setOrgDropdownOpen((prev) => !prev)}
              className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg bg-slate-900/80 hover:bg-slate-900 border border-slate-800 text-left transition group"
            >
              <div className="flex items-center gap-2 min-w-0">
                <Building2 className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                <span className="text-[11px] font-semibold text-slate-200 truncate">
                  Atomic Pathshala · Main
                </span>
              </div>
              <ChevronsUpDown className="w-3 h-3 text-slate-500 group-hover:text-slate-300 shrink-0" />
            </button>

            {orgDropdownOpen && (
              <div className="absolute top-full left-0 right-0 mt-1 rounded-lg bg-slate-900 border border-slate-700 shadow-xl p-1 z-50 animate-in fade-in zoom-in-95 duration-100">
                <div className="px-2 py-1 text-[10px] uppercase font-bold text-slate-500">
                  Organizations
                </div>
                <button
                  type="button"
                  onClick={() => setOrgDropdownOpen(false)}
                  className="w-full text-left px-2 py-1.5 rounded text-xs font-semibold text-white bg-blue-600/20 text-blue-400 flex items-center justify-between"
                >
                  <span>Atomic Pathshala (Live)</span>
                  <span className="w-1.5 h-1.5 rounded-full bg-blue-400"></span>
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* 2. NAVIGATION GROUPS & ITEMS */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden py-2 px-2 space-y-4 custom-scrollbar">
        {groups.map((group) => {
          if (group.items.length === 0) return null;

          return (
            <div key={group.id} className="space-y-0.5">
              {!collapsed && (
                <div className="px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                  {group.title}
                </div>
              )}

              {group.items.map((item) => {
                const active = isItemActive(item.href);

                return (
                  <div
                    key={item.href}
                    className="relative"
                    onMouseEnter={(e) => {
                      if (collapsed) {
                        const rect = e.currentTarget.getBoundingClientRect();
                        setHoveredItem({ label: item.label, group: group.title, top: rect.top });
                      }
                    }}
                    onMouseLeave={() => setHoveredItem(null)}
                  >
                    <Link
                      href={item.href}
                      onClick={onNavigate}
                      className={`flex items-center gap-2.5 rounded-md px-2.5 py-2 text-xs transition-colors ${
                        collapsed ? "justify-center px-0" : ""
                      } ${
                        active
                          ? "bg-blue-600 text-white font-semibold shadow-xs"
                          : "text-slate-400 hover:text-slate-100 hover:bg-white/[0.06] font-medium"
                      }`}
                    >
                      <LucideIcon
                        name={item.icon}
                        className={`w-4 h-4 shrink-0 ${active ? "text-white" : "text-slate-400"}`}
                        strokeWidth={active ? 2.2 : 1.8}
                      />
                      {!collapsed && <span className="truncate">{item.label}</span>}
                      {!collapsed && item.badge && (
                        <span className="ml-auto text-[9px] font-bold px-1.5 py-0.2 rounded bg-slate-800 text-slate-300">
                          {item.badge}
                        </span>
                      )}
                    </Link>
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>

      {/* Floating Tooltip in Collapsed Mode */}
      {collapsed && hoveredItem && (
        <div
          style={{ top: Math.max(8, hoveredItem.top) }}
          className="fixed left-[4.5rem] z-[999] rounded-md bg-slate-900 border border-slate-700/80 shadow-xl px-2.5 py-1.5 text-white pointer-events-none animate-in fade-in duration-75"
        >
          <div className="text-[10px] font-bold uppercase text-slate-400">{hoveredItem.group}</div>
          <div className="text-xs font-semibold text-slate-100">{hoveredItem.label}</div>
        </div>
      )}

      {/* 3. BOTTOM USER PROFILE & ACTIONS SECTION */}
      <div className="p-2 border-t border-slate-800/80 bg-[#080E21] shrink-0">
        <div className={`flex items-center gap-2.5 p-1.5 rounded-lg ${collapsed ? "justify-center" : ""}`}>
          <div className="w-8 h-8 rounded-full bg-blue-600 text-white font-bold text-xs flex items-center justify-center shrink-0 shadow-xs">
            {userInitial}
          </div>

          {!collapsed && (
            <div className="min-w-0 flex-1">
              <p className="text-xs font-bold text-white truncate leading-tight">{userName}</p>
              <p className="text-[10px] text-slate-400 truncate leading-tight mt-0.5">{userRoleLabel}</p>
            </div>
          )}
        </div>

        {!collapsed && (
          <div className="flex items-center justify-between gap-1 mt-1 pt-1 border-t border-slate-800/60 px-1 text-slate-400 text-xs">
            <Link
              href="/team/profile"
              onClick={onNavigate}
              className="p-1 rounded hover:text-white hover:bg-slate-800 transition"
              title="My Profile"
            >
              <User className="w-3.5 h-3.5" />
            </Link>
            <Link
              href="/team/id-cards"
              onClick={onNavigate}
              className="p-1 rounded hover:text-white hover:bg-slate-800 transition"
              title="ID Cards & Documents"
            >
              <CreditCard className="w-3.5 h-3.5" />
            </Link>
            <div className="[&_button]:!p-1 [&_button]:!text-slate-400 [&_button:hover]:!text-rose-400">
              <LogoutButton />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
