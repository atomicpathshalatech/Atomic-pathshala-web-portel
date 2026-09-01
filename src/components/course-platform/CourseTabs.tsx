"use client";

import React, { useState } from "react";

const TABS = [
  { id: "about", label: "About" },
  { id: "educators", label: "Educators" },
  { id: "syllabus", label: "Syllabus" },
  { id: "classes", label: "Classes" },
  { id: "tests", label: "Tests" },
  { id: "schedule", label: "Schedule" },
  { id: "material", label: "Study Material" },
  { id: "trial", label: "Free Trial" },
  { id: "faq", label: "FAQs" },
];

export function CourseTabs() {
  const [activeTab, setActiveTab] = useState("about");

  const scrollToSection = (id: string) => {
    setActiveTab(id);
    const element = document.getElementById(id);
    if (element) {
      element.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  return (
    <div className="sticky top-0 z-30 bg-white/95 backdrop-blur-md border-y border-slate-200/80 -mx-4 px-4 sm:mx-0 sm:px-0 sm:rounded-2xl shadow-sm overflow-x-auto no-scrollbar py-1">
      <nav className="flex items-center gap-1 min-w-max p-1">
        {TABS.map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => scrollToSection(tab.id)}
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