"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChapterThumbnailBanner } from "./ChapterThumbnailBanner";
import { ChapterRoadmapTimeline, RoadmapTopicGroup } from "./ChapterRoadmapTimeline";
import { ChapterReviewsSection, ChapterReviewItem } from "./ChapterReviewsSection";
import { StudentChapterNoticeBoard, StudentNoticeItem } from "./StudentChapterNoticeBoard";

export interface ChapterDetailData {
  id: string;
  title: string;
  description?: string | null;
  medium: string;
  subjectName: string;
  className: string;
  courseTitle: string;
  totalDurationMin: number;
  totalLectures: number;
  totalDpps: number;
  totalTests: number;
  averageRating: number;
  learnerCount: number;
  learningOutcomes: string[];
  teacher: {
    id?: string;
    name: string;
    designation: string;
    photo?: string | null;
    bio: string;
  };
  roadmap: RoadmapTopicGroup[];
  reviews: ChapterReviewItem[];
  notices?: StudentNoticeItem[];
  firstLectureId?: string | null;
  startHref?: string;
}

export function ChapterDetailView({
  data,
  backHref = "/courses",
  isTeacherView = false,
}: {
  data: ChapterDetailData;
  backHref?: string;
  isTeacherView?: boolean;
}) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<"overview" | "notices" | "teacher" | "roadmap" | "reviews">("overview");

  const totalLessons = data.totalLectures;
  const startDestination = data.startHref || (data.firstLectureId ? `#lecture-${data.firstLectureId}` : "#roadmap");

  const handleStartChapter = () => {
    if (data.startHref) {
      router.push(data.startHref);
    } else {
      const roadmapElement = document.getElementById("roadmap-section");
      if (roadmapElement) {
        roadmapElement.scrollIntoView({ behavior: "smooth" });
      }
    }
  };

  return (
    <div className="min-h-screen bg-[#f8fafc] dark:bg-slate-950 text-[#031635] dark:text-white pb-28">
      {/* Top Mobile/Desktop App Bar */}
      <div className="sticky top-0 z-30 bg-white/90 dark:bg-slate-900/90 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 px-4 py-3 flex items-center justify-between">
        <Link
          href={backHref}
          className="w-9 h-9 rounded-full bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center text-slate-700 dark:text-slate-300 hover:text-black dark:hover:text-white transition"
        >
          <span className="material-symbols-outlined text-lg">chevron_left</span>
        </Link>

        <div className="flex items-center gap-1.5 font-bold text-xs tracking-wider text-slate-700 dark:text-slate-300 uppercase">
          <span className="text-primary font-black">Atomic</span>
          <span>Chapter</span>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => {
              if (navigator.share) {
                navigator.share({ title: data.title, url: window.location.href });
              }
            }}
            className="w-9 h-9 rounded-full bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center text-slate-700 dark:text-slate-300 hover:text-black dark:hover:text-white transition"
          >
            <span className="material-symbols-outlined text-base">share</span>
          </button>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 sm:px-6 pt-4 space-y-6">
        {/* 1. Chapter Thumbnail / Hero Card */}
        <ChapterThumbnailBanner
          title={data.title}
          subjectName={data.subjectName}
          className={data.className}
          courseTitle={data.courseTitle}
          medium={data.medium}
          teacherName={data.teacher.name}
          teacherPhoto={data.teacher.photo}
        />

        {/* 2. Navigation Tabs (Matches Reference: Overview | Teacher | Roadmap | Reviews) */}
        <div className="flex items-center gap-6 border-b border-slate-200 dark:border-slate-800 overflow-x-auto scrollbar-none text-xs sm:text-sm font-semibold select-none">
          <button
            type="button"
            onClick={() => setActiveTab("overview")}
            className={`pb-2.5 transition relative whitespace-nowrap ${
              activeTab === "overview"
                ? "text-primary dark:text-primary-container font-bold"
                : "text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
            }`}
          >
            <span>Overview</span>
            {activeTab === "overview" && (
              <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary rounded-full" />
            )}
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("notices")}
            className={`pb-2.5 transition relative whitespace-nowrap flex items-center gap-1.5 cursor-pointer ${
              activeTab === "notices"
                ? "text-primary dark:text-primary-container font-bold"
                : "text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
            }`}
          >
            <span>Notice Board</span>
            {data.notices && data.notices.length > 0 && (
              <span className="px-1.5 py-0.5 rounded-full bg-amber-500 text-slate-950 text-[10px] font-black">
                {data.notices.length}
              </span>
            )}
            {activeTab === "notices" && (
              <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary rounded-full" />
            )}
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("teacher")}
            className={`pb-2.5 transition relative whitespace-nowrap ${
              activeTab === "teacher"
                ? "text-primary dark:text-primary-container font-bold"
                : "text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
            }`}
          >
            <span>Faculty Profile</span>
            {activeTab === "teacher" && (
              <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary rounded-full" />
            )}
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("roadmap")}
            className={`pb-2.5 transition relative whitespace-nowrap ${
              activeTab === "roadmap"
                ? "text-primary dark:text-primary-container font-bold"
                : "text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
            }`}
          >
            <span>Roadmap</span>
            {activeTab === "roadmap" && (
              <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary rounded-full" />
            )}
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("reviews")}
            className={`pb-2.5 transition relative whitespace-nowrap ${
              activeTab === "reviews"
                ? "text-primary dark:text-primary-container font-bold"
                : "text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
            }`}
          >
            <span>Reviews</span>
            {activeTab === "reviews" && (
              <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary rounded-full" />
            )}
          </button>
        </div>

        {/* 3. Main Title & Meta Stats */}
        <div className="space-y-3">
          <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-[#031635] dark:text-white tracking-tight leading-snug">
            {data.title}: Complete Chapter
          </h1>

          {/* Meta Line: Duration | Lessons */}
          <div className="flex items-center gap-3 text-xs sm:text-sm text-slate-600 dark:text-slate-300 font-medium">
            <div className="flex items-center gap-1">
              <span className="material-symbols-outlined text-sm text-amber-500">schedule</span>
              <span>{data.totalDurationMin || 180} Min</span>
            </div>
            <span className="text-slate-300 dark:text-slate-700">|</span>
            <div className="flex items-center gap-1">
              <span className="material-symbols-outlined text-sm text-indigo-500">menu_book</span>
              <span>{totalLessons || 8} Lectures</span>
            </div>
            <span className="text-slate-300 dark:text-slate-700">|</span>
            <div className="flex items-center gap-1 text-amber-500">
              <span>★</span>
              <span>{data.averageRating || 4.9}</span>
            </div>
          </div>
        </div>

        {/* 4. TAB CONTENTS */}

        {/* A. OVERVIEW TAB */}
        {(activeTab === "overview" || activeTab === "teacher") && (
          <div className="space-y-6 pt-2">
            {/* Pinned / Latest Notice Spotlight Banner */}
            {data.notices && data.notices.length > 0 && (
              <div
                onClick={() => setActiveTab("notices")}
                className="p-4 rounded-2xl bg-gradient-to-r from-amber-500/15 via-orange-500/10 to-amber-500/5 border border-amber-300 dark:border-amber-700/60 flex items-start gap-3 cursor-pointer hover:bg-amber-500/20 transition shadow-xs group"
              >
                <div className="w-8 h-8 rounded-xl bg-amber-500 text-slate-950 flex items-center justify-center shrink-0 shadow-xs font-black text-sm">
                  📌
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-black uppercase tracking-wider text-amber-700 dark:text-amber-400">
                      {data.notices.find((n) => n.isPinned) ? "PINNED CHAPTER NOTICE" : "LATEST CHAPTER NOTICE"}
                    </span>
                    <span className="text-[10px] text-slate-400">&bull; Tap to view Notice Board</span>
                  </div>
                  <h4 className="text-xs sm:text-sm font-extrabold text-slate-900 dark:text-white truncate mt-0.5">
                    {(data.notices.find((n) => n.isPinned) || data.notices[0])?.title}
                  </h4>
                  <p className="text-xs text-slate-600 dark:text-slate-300 line-clamp-1 mt-0.5">
                    {(data.notices.find((n) => n.isPinned) || data.notices[0])?.content}
                  </p>
                </div>
                <span className="material-symbols-outlined text-slate-400 group-hover:translate-x-0.5 transition text-base shrink-0 mt-2">
                  arrow_forward
                </span>
              </div>
            )}

            {/* About the Chapter */}
            <div className="space-y-3">
              <h3 className="text-lg font-bold text-[#031635] dark:text-white tracking-tight">
                About the Chapter
              </h3>
              <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                {data.description ||
                  `Master the core concepts of ${data.title} in ${data.subjectName}. Designed with 100% NCERT alignment, conceptual video lectures, high-yield DPP problem sets, and timed chapter mastery tests for NEET, JEE & CBSE.`}
              </p>

              {/* Key Learning Outcomes */}
              <div className="space-y-2.5 pt-2">
                {data.learningOutcomes && data.learningOutcomes.length > 0 ? (
                  data.learningOutcomes.map((outcome, idx) => (
                    <div key={idx} className="flex items-start gap-2.5 text-xs sm:text-sm text-slate-700 dark:text-slate-300">
                      <span className="text-primary text-base leading-none">✓</span>
                      <span className="leading-snug">{outcome}</span>
                    </div>
                  ))
                ) : (
                  <>
                    <div className="flex items-start gap-2.5 text-xs sm:text-sm text-slate-700 dark:text-slate-300">
                      <span className="text-primary text-base leading-none">✓</span>
                      <span className="leading-snug">Understand fundamental concepts & postulates from ground up</span>
                    </div>
                    <div className="flex items-start gap-2.5 text-xs sm:text-sm text-slate-700 dark:text-slate-300">
                      <span className="text-primary text-base leading-none">✓</span>
                      <span className="leading-snug">Master core formulas, diagrams, and numerical calculation techniques</span>
                    </div>
                    <div className="flex items-start gap-2.5 text-xs sm:text-sm text-slate-700 dark:text-slate-300">
                      <span className="text-primary text-base leading-none">✓</span>
                      <span className="leading-snug">Solve high-yield previous year questions (PYQs) for NEET & JEE</span>
                    </div>
                    <div className="flex items-start gap-2.5 text-xs sm:text-sm text-slate-700 dark:text-slate-300">
                      <span className="text-primary text-base leading-none">✓</span>
                      <span className="leading-snug">Line-by-line NCERT canonical coverage with concept clarity</span>
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* Your Faculty / Educator Section */}
            <div className="space-y-3 pt-4 border-t border-slate-200 dark:border-slate-800">
              <h3 className="text-lg font-bold text-[#031635] dark:text-white tracking-tight">
                Your Faculty
              </h3>

              <div className="flex items-start gap-3.5 p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
                <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-full overflow-hidden bg-slate-100 dark:bg-slate-800 flex-shrink-0 border border-slate-200 dark:border-slate-700 flex items-center justify-center">
                  {data.teacher.photo ? (
                    <img
                      src={data.teacher.photo}
                      alt={data.teacher.name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <span className="material-symbols-outlined text-2xl text-primary">
                      person
                    </span>
                  )}
                </div>

                <div className="space-y-1">
                  <h4 className="text-sm sm:text-base font-bold text-[#031635] dark:text-white leading-tight">
                    {data.teacher.name}
                  </h4>
                  <p className="text-xs text-primary font-bold">
                    {data.teacher.designation || `Faculty in ${data.subjectName}`}
                  </p>
                  <p className="text-xs text-slate-600 dark:text-slate-300 pt-1 leading-relaxed">
                    • {data.teacher.bio ||
                      `Dedicated educator simplifying ${data.subjectName} concepts, helping thousands of NEET & JEE aspirants score top marks.`}
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* NOTICE BOARD TAB VIEW */}
        {activeTab === "notices" && (
          <div className="pt-2">
            <StudentChapterNoticeBoard
              notices={data.notices || []}
              chapterTitle={data.title}
              subjectName={data.subjectName}
            />
          </div>
        )}

        {/* B. ROADMAP SECTION */}
        {(activeTab === "overview" || activeTab === "roadmap") && (
          <div id="roadmap-section" className="space-y-3 pt-4 border-t border-slate-200 dark:border-slate-800">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-[#031635] dark:text-white tracking-tight">
                Roadmap
              </h3>
              <span className="text-xs text-slate-500 font-mono">
                {data.roadmap.length} Steps
              </span>
            </div>

            <ChapterRoadmapTimeline
              roadmap={data.roadmap}
              startChapterHref={startDestination}
            />
          </div>
        )}

        {/* C. REVIEWS SECTION */}
        {(activeTab === "overview" || activeTab === "reviews") && (
          <div className="space-y-3 pt-4 border-t border-slate-200 dark:border-slate-800">
            <h3 className="text-lg font-bold text-[#031635] dark:text-white tracking-tight">
              Reviews
            </h3>

            <ChapterReviewsSection reviews={data.reviews} />
          </div>
        )}
      </div>

      {/* 5. STICKY BOTTOM CTA: "Start Chapter" */}
      <div className="fixed bottom-0 left-0 right-0 z-40 bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl border-t border-slate-200 dark:border-slate-800 p-4 flex items-center justify-center">
        <div className="max-w-2xl w-full">
          <button
            type="button"
            onClick={handleStartChapter}
            className="w-full py-3.5 px-6 rounded-xl bg-primary hover:bg-primary/90 active:scale-[0.99] text-on-primary font-extrabold text-sm sm:text-base shadow-md shadow-primary/20 transition flex items-center justify-center gap-2"
          >
            <span className="material-symbols-outlined text-lg">play_arrow</span>
            <span>Start Chapter</span>
          </button>
        </div>
      </div>
    </div>
  );
}
