"use client";

import React, { useState } from "react";
import { CourseData } from "./CourseCard";
import { CourseHero } from "./CourseHero";
import { StickyPurchaseBar } from "./StickyPurchaseBar";
import { CourseTabs, type CourseTabId } from "./CourseTabs";
import { AboutSection } from "./AboutSection";
import { EducatorsSection } from "./EducatorsSection";
import { SyllabusSection } from "./SyllabusSection";
import { MyLecturesSection } from "./MyLecturesSection";
import { ClassesSection } from "./ClassesSection";
import { TestsSection } from "./TestsSection";
import { ScheduleSection } from "./ScheduleSection";
import { StudyMaterialSection } from "./StudyMaterialSection";
import { FreeTrialSection } from "./FreeTrialSection";
import { FAQSection } from "./FAQSection";

export function CourseDetailMasterView({ course }: { course: CourseData }) {
  const [activeTab, setActiveTab] = useState<CourseTabId>("about");

  return (
    <div className="min-h-screen bg-white text-slate-850 pb-28 lg:pb-16 font-sans">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-6 space-y-6">
        {/* Course Hero Banner */}
        <CourseHero course={course} />

        {/* Tab Navigation — controlled, no scroll-jump (see CourseTabs) */}
        <CourseTabs activeTab={activeTab} onChange={setActiveTab} />

        {/* 2-Column Grid: Left (8 Cols) = active section only; Right (4 Cols) = sticky purchase card */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8 items-start">
          {/* Left Column (8 cols) — only the selected tab's section renders,
              so switching tabs swaps content in place instead of scrolling
              to wherever that section used to sit in a long stacked page. */}
          <div className="lg:col-span-8 space-y-6">
            {activeTab === "about" && <AboutSection course={course} />}
            {activeTab === "educators" && <EducatorsSection course={course} />}
            {activeTab === "syllabus" && <SyllabusSection course={course} />}
            {activeTab === "lectures" && (
              <div className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-6">
                <h2 className="text-sm font-bold text-slate-800 mb-4">My Lectures</h2>
                <MyLecturesSection batchId={course.id} />
              </div>
            )}
            {activeTab === "classes" && <ClassesSection course={course} />}
            {activeTab === "tests" && <TestsSection course={course} />}
            {activeTab === "schedule" && <ScheduleSection course={course} />}
            {activeTab === "material" && <StudyMaterialSection />}
            {activeTab === "trial" && <FreeTrialSection />}
            {activeTab === "faq" && <FAQSection />}
          </div>

          {/* Right Column (4 cols) - Sticky Purchase Card on Desktop */}
          <div className="lg:col-span-4">
            <StickyPurchaseBar course={course} />
          </div>
        </div>
      </div>
    </div>
  );
}
