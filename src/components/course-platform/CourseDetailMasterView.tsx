"use client";

import React from "react";
import { CourseData } from "./CourseCard";
import { CourseHero } from "./CourseHero";
import { StickyPurchaseBar } from "./StickyPurchaseBar";
import { CourseTabs } from "./CourseTabs";
import { AboutSection } from "./AboutSection";
import { EducatorsSection } from "./EducatorsSection";
import { SyllabusSection } from "./SyllabusSection";
import { ClassesSection } from "./ClassesSection";
import { TestsSection } from "./TestsSection";
import { ScheduleSection } from "./ScheduleSection";
import { StudyMaterialSection } from "./StudyMaterialSection";
import { FreeTrialSection } from "./FreeTrialSection";
import { FAQSection } from "./FAQSection";

export function CourseDetailMasterView({ course }: { course: CourseData }) {
  return (
    <div className="min-h-screen bg-white text-slate-850 pb-28 lg:pb-16 font-sans">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-6 space-y-6">
        {/* Course Hero Banner */}
        <CourseHero course={course} />

        {/* Sticky Tab Navigation */}
        <CourseTabs />

        {/* 2-Column Grid: Left (8 Cols) = Detailed Sections; Right (4 Cols) = Sticky Purchase Card */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8 items-start">
          {/* Left Column (8 cols) */}
          <div className="lg:col-span-8 space-y-6">
            <AboutSection course={course} />
            <EducatorsSection course={course} />
            <SyllabusSection course={course} />
            <ClassesSection course={course} />
            <TestsSection course={course} />
            <ScheduleSection course={course} />
            <StudyMaterialSection />
            <FreeTrialSection />
            <FAQSection />
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