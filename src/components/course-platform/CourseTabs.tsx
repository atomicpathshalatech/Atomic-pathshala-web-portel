"use client";

import React from "react";

export const COURSE_TABS = [
  { id: "about", label: "About" },
  { id: "educators", label: "Educators" },
  { id: "syllabus", label: "Syllabus" },
  { id: "lectures", label: "My Lectures" },
  { id: "classes", label: "Classes" },
  { id: "tests", label: "Tests" },
  { id: "schedule", label: "Schedule" },
  { id: "material", label: "Study Material" },
  { id: "trial", label: "Free Trial" },
  { id: "faq", label: "FAQs" },
] as const;

export type CourseTabId = (typeof COURSE_TABS)[number]["id"];

/**
 * Was previously an anchor-scroll bar over statically-stacked sections —
 * clicking a tab called scrollIntoView() on a same-page section id, which
 * from the student's perspective looked like "the page jumps/scrolls
 * rapidly" rather than a normal tab switch. Now a real controlled tab
 * switcher: the parent (CourseDetailMasterView) owns `activeTab` and
 * conditionally renders only that section, so clicking a tab swaps content
 * in place with no scroll movement at all.
 */
export function CourseTabs({
  activeTab,
  onChange,
}: {
  activeTab: CourseTabId;
  onChange: (id: CourseTabId) => void;
}) {
  return (
    <div className="sticky top-0 z-30 bg-white/95 backdrop-blur-md border-y border-slate-200/80 -mx-4 px-4 sm:mx-0 sm:px-0 sm:rounded-2xl shadow-sm overflow-x-auto no-scrollbar py-1">
      <nav className="flex items-center gap-1 min-w-max p-1">
        {COURSE_TABS.map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => onChange(tab.id)}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all ${
                isActive
                  ? "bg-[#031635] text-white shadow-sm"
                  : "text-slate-600 hover:text-[#031635] hover:bg-slate-100"
              }`}
            >
              {tab.label}
            </button>
          );
        })}
      </nav>
    </div>
  );
}
