"use client";

import React, { useState, useEffect } from "react";
import { CourseData } from "./CourseCard";
import { CourseHero } from "./CourseHero";
import { StickyPurchaseBar } from "./StickyPurchaseBar";
import { CourseTabs, COURSE_TABS, type CourseTabId } from "./CourseTabs";
import { AboutSection } from "./AboutSection";
import { EducatorsSection } from "./EducatorsSection";
import { SyllabusSection } from "./SyllabusSection";
import { MyLecturesSection } from "./MyLecturesSection";
import { ClassesSection } from "./ClassesSection";
import { TestsSection } from "./TestsSection";
import { ScheduleSection } from "./ScheduleSection";
import { StudyMaterialSection } from "./StudyMaterialSection";
import { FAQSection } from "./FAQSection";

export function CourseDetailMasterView({ course }: { course: CourseData }) {
  const [activeTab, setActiveTab] = useState<CourseTabId>("about");
  const [isBoxModalOpen, setIsBoxModalOpen] = useState(false);

  // When student clicks any box in CourseTabs, open the dedicated in-box modal directly
  const handleTabChange = (tabId: CourseTabId) => {
    setActiveTab(tabId);
    setIsBoxModalOpen(true);
  };

  // Close modal on escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setIsBoxModalOpen(false);
      }
    };
    if (isBoxModalOpen) {
      window.addEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "unset";
    }
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "unset";
    };
  }, [isBoxModalOpen]);

  const activeTabMeta = COURSE_TABS.find((t) => t.id === activeTab) || COURSE_TABS[0];

  const renderActiveContent = () => {
    switch (activeTab) {
      case "about":
        return <AboutSection course={course} />;
      case "educators":
        return <EducatorsSection course={course} />;
      case "syllabus":
        return <SyllabusSection course={course} />;
      case "lectures":
        return (
          <div className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-6 shadow-sm">
            <h2 className="text-sm font-bold text-slate-800 mb-4">My Lectures</h2>
            <MyLecturesSection batchId={course.id} />
          </div>
        );
      case "classes":
        return <ClassesSection course={course} />;
      case "tests":
        return <TestsSection course={course} />;
      case "schedule":
        return <ScheduleSection course={course} />;
      case "material":
        return <StudyMaterialSection />;
      case "faq":
        return <FAQSection />;
      default:
        return <AboutSection course={course} />;
    }
  };

  return (
    <div className="min-h-screen bg-white text-slate-850 pb-28 lg:pb-16 font-sans">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-6 space-y-6">
        {/* Course Hero Banner */}
        <CourseHero course={course} />

        {/* Tab Navigation Grid: Clicking any box immediately opens that box's contents */}
        <div>
          <div className="flex items-center justify-between mb-2.5 px-1">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Batch Quick Access Boxes (Tap box to open directly)
            </span>
          </div>
          <CourseTabs activeTab={activeTab} onChange={handleTabChange} />
        </div>

        {/* 2-Column Grid for Default In-Page View */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8 items-start">
          {/* Left Column (8 cols): Inline active section view */}
          <div className="lg:col-span-8 space-y-6">
            <div className="flex items-center justify-between bg-slate-50 border border-slate-200/80 rounded-2xl px-4 py-3">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-blue-600 text-lg">
                  {activeTabMeta.icon}
                </span>
                <span className="text-xs sm:text-sm font-black text-[#031635]">
                  Active Section: {activeTabMeta.label}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setIsBoxModalOpen(true)}
                className="text-xs font-bold text-blue-600 hover:text-blue-800 flex items-center gap-1 bg-blue-50 hover:bg-blue-100/80 px-3 py-1.5 rounded-xl border border-blue-200/60 transition"
              >
                <span className="material-symbols-outlined text-sm">fullscreen</span>
                <span>Open in Full Box</span>
              </button>
            </div>

            {renderActiveContent()}
          </div>

          {/* Right Column (4 cols) - Sticky Purchase Card on Desktop */}
          <div className="lg:col-span-4">
            <StickyPurchaseBar course={course} />
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* IN-BOX DIRECT MODAL VIEWER: Opens instantly when student taps any box */}
      {/* ========================================================================= */}
      {isBoxModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-slate-950/70 backdrop-blur-sm animate-in fade-in duration-200">
          <div
            className="w-full max-w-5xl max-h-[92vh] bg-white rounded-3xl border border-slate-200 shadow-2xl flex flex-col overflow-hidden animate-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="h-14 sm:h-16 px-4 sm:px-6 bg-white border-b border-slate-200 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-10 h-10 rounded-2xl bg-blue-50 border border-blue-200 text-blue-600 flex items-center justify-center shrink-0">
                  <span className="material-symbols-outlined text-xl">
                    {activeTabMeta.icon}
                  </span>
                </div>
                <div className="min-w-0">
                  <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 block truncate leading-tight">
                    {course.title}
                  </span>
                  <h2 className="text-sm sm:text-base font-black text-[#031635] truncate leading-tight">
                    {activeTabMeta.label}
                  </h2>
                </div>
              </div>

              {/* Header Quick Tab Switcher & Close Button */}
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsBoxModalOpen(false)}
                  className="flex items-center gap-1.5 px-3.5 py-2 rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-extrabold transition active:scale-95"
                  title="Close Box"
                >
                  <span className="material-symbols-outlined text-base">close</span>
                  <span>Close Box</span>
                </button>
              </div>
            </div>

            {/* Quick Strip Switcher Inside Modal */}
            <div className="px-4 py-2.5 bg-slate-50/80 border-b border-slate-200/80 overflow-x-auto scrollbar-none flex items-center gap-2 shrink-0">
              {COURSE_TABS.map((tab) => {
                const isActive = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setActiveTab(tab.id)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition flex items-center gap-1.5 ${
                      isActive
                        ? "bg-[#031635] text-white shadow-xs"
                        : "bg-white text-slate-600 border border-slate-200/80 hover:bg-slate-100"
                    }`}
                  >
                    <span className="material-symbols-outlined text-sm">{tab.icon}</span>
                    <span>{tab.label}</span>
                  </button>
                );
              })}
            </div>

            {/* Modal Body: Scrollable Content Container */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-6 bg-white space-y-6">
              {renderActiveContent()}
            </div>

            {/* Modal Footer */}
            <div className="h-12 px-4 sm:px-6 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-xs text-slate-500 shrink-0">
              <span>Viewing {activeTabMeta.label} • Atomic Pathshala</span>
              <button
                type="button"
                onClick={() => setIsBoxModalOpen(false)}
                className="text-xs font-bold text-blue-600 hover:text-blue-800"
              >
                Back to Batch Overview
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
