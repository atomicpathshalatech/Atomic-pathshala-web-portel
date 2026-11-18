"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LogoutButton } from "@/components/student/LogoutButton";
import type { TeamNavDepartment } from "@/lib/navigation/team-nav-departments";

interface AtomicSidebarNavProps {
  departments: TeamNavDepartment[];
  collapsed?: boolean;
  onToggleCollapse?: () => void;
  onNavigate?: () => void;
  onOpenDownloadApp?: () => void;
}

export function AtomicSidebarNav({
  departments,
  collapsed = false,
  onToggleCollapse,
  onNavigate,
  onOpenDownloadApp,
}: AtomicSidebarNavProps) {
  const pathname = usePathname();

  // Expanded departments state (persisted in localStorage)
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  // Active hover tooltip for collapsed mode
  const [hoveredDept, setHoveredDept] = useState<TeamNavDepartment | null>(null);
  const [hoverPosition, setHoverPosition] = useState<number>(0);

  // Initialize expanded state based on current pathname
  useEffect(() => {
    try {
      const saved = localStorage.getItem("atomic_ops_sidebar_expanded");
      const initial: Record<string, boolean> = saved ? JSON.parse(saved) : {};

      // Ensure department containing current route is expanded
      departments.forEach((dept) => {
        const containsActive = dept.items.some((item) =>
          item.href === "/team"
            ? pathname === "/team"
            : pathname === item.href || pathname.startsWith(`${item.href}/`)
        );
        if (containsActive) {
          initial[dept.id] = true;
        } else if (initial[dept.id] === undefined) {
          // Default Overview and Academic open initially
          initial[dept.id] = dept.id === "overview";
        }
      });

      setExpanded(initial);
    } catch {
      // fallback
    }
  }, [pathname, departments]);

  const toggleDept = (deptId: string) => {
    setExpanded((prev) => {
      const next = { ...prev, [deptId]: !prev[deptId] };
      try {
        localStorage.setItem("atomic_ops_sidebar_expanded", JSON.stringify(next));
      } catch {}
      return next;
    });
  };

  const isItemActive = (href: string) =>
    href === "/team" ? pathname === "/team" : pathname === href || pathname.startsWith(`${href}/`);

  return (
    <nav className="flex flex-col justify-between h-full bg-[#102C50] text-slate-100 select-none">
      {/* Scrollable Departments list */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden py-3 px-2 space-y-1.5 custom-scrollbar">
        {departments.map((dept) => {
          const isOpen = Boolean(expanded[dept.id]);
          const hasActiveItem = dept.items.some((item) => isItemActive(item.href));

          if (collapsed) {
            // Collapsed rail mode: Icon only with hover popover
            return (
              <div
                key={dept.id}
                className="relative flex justify-center py-1"
                onMouseEnter={(e) => {
                  const rect = e.currentTarget.getBoundingClientRect();
                  setHoverPosition(rect.top);
                  setHoveredDept(dept);
                }}
                onMouseLeave={() => setHoveredDept(null)}
              >
                <button
                  type="button"
                  onClick={() => {
                    if (dept.items.length === 1 && dept.items[0]) {
                      window.location.href = dept.items[0].href;
                    } else if (onToggleCollapse) {
                      onToggleCollapse();
                      toggleDept(dept.id);
                    }
                  }}
                  className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all ${
                    hasActiveItem
                      ? "bg-blue-600 text-white shadow-md ring-2 ring-blue-400/40"
                      : "text-slate-300 hover:bg-white/10 hover:text-white"
                  }`}
                  title={dept.title}
                >
                  <span className="material-symbols-outlined text-[20px]">{dept.icon}</span>
                </button>
              </div>
            );
          }

          // Expanded mode: Accordion department with sub-items
          return (
            <div key={dept.id} className="space-y-0.5">
              <button
                type="button"
                onClick={() => toggleDept(dept.id)}
                className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all text-left ${
                  hasActiveItem
                    ? "text-blue-300 bg-white/5 font-extrabold"
                    : "text-slate-300 hover:text-white hover:bg-white/5"
                }`}
              >
                <div className="flex items-center gap-2.5 truncate">
                  <span
                    className={`material-symbols-outlined text-[18px] shrink-0 ${
                      hasActiveItem ? "text-blue-400" : "text-slate-400"
                    }`}
                  >
                    {dept.icon}
                  </span>
                  <span className="truncate tracking-wide uppercase text-[11px] font-bold">
                    {dept.title}
                  </span>
                </div>
                <span
                  className={`material-symbols-outlined text-[16px] text-slate-400 transition-transform duration-200 ${
                    isOpen ? "rotate-180" : ""
                  }`}
                >
                  expand_more
                </span>
              </button>

              {isOpen && (
                <div className="pl-6 pr-1 py-0.5 space-y-0.5 border-l border-white/10 ml-4 animate-in fade-in duration-150">
                  {dept.items.map((item) => {
                    const active = isItemActive(item.href);
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        onClick={onNavigate}
                        title={item.label}
                        className={`group relative flex items-center justify-between px-2.5 py-1.5 rounded-md text-xs font-medium transition-all ${
                          active
                            ? "bg-blue-600 text-white font-bold shadow-xs"
                            : "text-slate-300 hover:text-white hover:bg-white/10"
                        }`}
                      >
                        <div className="flex items-center gap-2 truncate min-w-0">
                          <span
                            className={`material-symbols-outlined text-[15px] shrink-0 ${
                              active ? "text-white" : "text-slate-400 group-hover:text-slate-200"
                            }`}
                          >
                            {item.icon}
                          </span>
                          <span className="truncate">{item.label}</span>
                        </div>
                        {item.badge && (
                          <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-white/20 text-white shrink-0">
                            {item.badge}
                          </span>
                        )}
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Floating Flyout Menu when Hovering in Collapsed Mode */}
      {collapsed && hoveredDept && (
        <div
          style={{ top: Math.max(10, hoverPosition - 10) }}
          className="fixed left-[4.8rem] z-[999] w-56 rounded-xl bg-[#0f2442] border border-slate-700/60 shadow-2xl p-2 text-white animate-in fade-in zoom-in-95 duration-100"
          onMouseEnter={() => setHoveredDept(hoveredDept)}
          onMouseLeave={() => setHoveredDept(null)}
        >
          <div className="px-2.5 py-1.5 border-b border-white/10 mb-1">
            <p className="text-xs font-bold text-blue-300 uppercase tracking-wide">
              {hoveredDept.title}
            </p>
            <p className="text-[10px] text-slate-400">{hoveredDept.description}</p>
          </div>
          <div className="space-y-0.5 max-h-64 overflow-y-auto">
            {hoveredDept.items.map((sub) => {
              const active = isItemActive(sub.href);
              return (
                <Link
                  key={sub.href}
                  href={sub.href}
                  onClick={() => setHoveredDept(null)}
                  className={`flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                    active ? "bg-blue-600 text-white font-bold" : "text-slate-200 hover:bg-white/10"
                  }`}
                >
                  <span className="material-symbols-outlined text-[16px] text-slate-400">
                    {sub.icon}
                  </span>
                  <span className="truncate">{sub.label}</span>
                </Link>
              );
            })}
          </div>
        </div>
      )}

      {/* Bottom Footer Section: App Download & Collapse Toggle */}
      <div className="p-2 border-t border-white/10 space-y-1.5 bg-[#0c223e]">
        {onOpenDownloadApp && !collapsed && (
          <button
            type="button"
            onClick={onOpenDownloadApp}
            className="w-full flex items-center gap-2 px-2.5 py-2 rounded-lg bg-white/5 hover:bg-white/10 text-slate-200 text-xs font-semibold border border-white/10 transition-colors text-left"
          >
            <span className="material-symbols-outlined text-amber-400 text-[18px]">
              install_desktop
            </span>
            <div className="truncate min-w-0">
              <span className="block text-xs font-bold text-white">Download Apps</span>
              <span className="block text-[10px] text-slate-400">Windows & Android APK</span>
            </div>
          </button>
        )}

        {onToggleCollapse && (
          <button
            type="button"
            onClick={onToggleCollapse}
            className="w-full flex items-center justify-center gap-2 py-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/5 transition-colors text-xs font-semibold"
            title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            <span className="material-symbols-outlined text-[18px]">
              {collapsed ? "chevron_right" : "chevron_left"}
            </span>
            {!collapsed && <span>Collapse Sidebar</span>}
          </button>
        )}

        <div className="md:hidden px-1 pt-1 [&_button]:!text-slate-300 [&_button:hover]:!text-white">
          <LogoutButton />
        </div>
      </div>
    </nav>
  );
}
