"use client";

import React from "react";

export const COURSE_TABS = [
  { id: "about", label: "About", icon: "info", accent: "blue" },
  { id: "educators", label: "Educators", icon: "groups", accent: "violet" },
  { id: "syllabus", label: "Syllabus", icon: "menu_book", accent: "emerald" },
  { id: "lectures", label: "My Lectures", icon: "play_circle", accent: "indigo" },
  { id: "classes", label: "Classes", icon: "video_camera_front", accent: "rose" },
  { id: "tests", label: "Tests", icon: "quiz", accent: "orange" },
  { id: "schedule", label: "Schedule", icon: "calendar_month", accent: "teal" },
  { id: "material", label: "Study Material", icon: "folder_open", accent: "amber" },
  { id: "faq", label: "FAQs", icon: "help", accent: "fuchsia" },
] as const;

export type CourseTabId = (typeof COURSE_TABS)[number]["id"];

type Accent = (typeof COURSE_TABS)[number]["accent"];

const ACCENT: Record<Accent, string> = {
  blue: "bg-blue-50 text-blue-600 ring-blue-100",
  violet: "bg-violet-50 text-violet-600 ring-violet-100",
  emerald: "bg-emerald-50 text-emerald-600 ring-emerald-100",
  indigo: "bg-indigo-50 text-indigo-600 ring-indigo-100",
  rose: "bg-rose-50 text-rose-600 ring-rose-100",
  orange: "bg-orange-50 text-orange-600 ring-orange-100",
  teal: "bg-teal-50 text-teal-600 ring-teal-100",
  amber: "bg-amber-50 text-amber-600 ring-amber-100",
  fuchsia: "bg-fuchsia-50 text-fuchsia-600 ring-fuchsia-100",
};

/**
 * Was previously an anchor-scroll bar, then a slim pill/button tab strip.
 * Now a grid of clickable tiles matching the student home screen's
 * QuickAccessGrid box language, with a soft lift-on-hover for a "3D" feel.
 * Same controlled-tab contract as before: the parent (CourseDetailMasterView)
 * owns `activeTab` and conditionally renders only that section, so clicking
 * a tile swaps content in place with no scroll movement at all.
 */
export function CourseTabs({
  activeTab,
  onChange,
}: {
  activeTab: CourseTabId;
  onChange: (id: CourseTabId) => void;
}) {
  return (
    <div className="rounded-2xl bg-white/95 backdrop-blur-md border border-slate-200/80 shadow-sm p-3 sm:p-4 [perspective:1000px]">
      <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-5 gap-2.5 sm:gap-3">
        {COURSE_TABS.map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => onChange(tab.id)}
              aria-pressed={isActive}
              className={`group relative flex flex-col items-center justify-center gap-1.5 rounded-2xl border p-3 sm:p-4 text-center transition-all duration-300 ease-out will-change-transform hover:-translate-y-1.5 hover:scale-[1.04] hover:shadow-xl active:scale-95 active:translate-y-0 ${
                isActive
                  ? "-translate-y-0.5 border-[#031635] bg-[#031635] shadow-lg shadow-[#031635]/20"
                  : "border-slate-200/80 bg-white hover:border-slate-300"
              }`}
            >
              <span
                className={`flex h-10 w-10 items-center justify-center rounded-xl ring-1 transition-transform duration-300 group-hover:scale-110 group-hover:rotate-3 ${
                  isActive ? "bg-white/15 text-white ring-white/20" : ACCENT[tab.accent]
                }`}
              >
                <span className="material-symbols-outlined text-[20px]">{tab.icon}</span>
              </span>
              <span
                className={`text-[11px] sm:text-xs font-bold leading-tight ${
                  isActive ? "text-white" : "text-slate-700"
                }`}
              >
                {tab.label}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
