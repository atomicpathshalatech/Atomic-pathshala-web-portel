"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChapterThumbnailBanner } from "./ChapterThumbnailBanner";
import { ChapterRoadmapTimeline, RoadmapTopicGroup } from "./ChapterRoadmapTimeline";
import { ChapterReviewsSection, ChapterReviewItem } from "./ChapterReviewsSection";

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
  const [activeTab, setActiveTab] = useState<"overview" | "teacher" | "roadmap" | "reviews">("overview");

  const totalLessons = data.totalLectures + data.totalDpps + data.totalTests;
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
    <div className="min-h-screen bg-[#090b14] text-slate-100 pb-28">
      {/* Top Mobile/Desktop App Bar */}
      <div className="sticky top-0 z-30 bg-[#090b14]/90 backdrop-blur-md border-b border-slate-800/80 px-4 py-3 flex items-center justify-between">
        <Link
          href={backHref}
          className="w-9 h-9 rounded-full bg-slate-900 border border-slate-800 flex items-center justify-center text-slate-300 hover:text-white transition"
        >
          <span className="material-symbols-outlined text-lg">chevron_left</span>
        </Link>

        <div className="flex items-center gap-1.5 font-bold text-xs tracking-wider text-slate-300 uppercase">
          <span className="text-amber-400">Atomic</span>
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
            className="w-9 h-9 rounded-full bg-slate-900 border border-slate-800 flex items-center justify-center text-slate-300 hover:text-white transition"
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
        <div className="flex items-center gap-6 border-b border-slate-800 overflow-x-auto scrollbar-none text-xs sm:text-sm font-semibold select-none">
          <button
            type="button"
            onClick={() => setActiveTab("overview")}
            className={`pb-2.5 transition relative whitespace-nowrap ${
              activeTab === "overview"
                ? "text-white font-bold"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            <span>Overview</span>
            {activeTab === "overview" && (
              <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-rose-500 rounded-full" />
            )}
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("teacher")}
            className={`pb-2.5 transition relative whitespace-nowrap ${
              activeTab === "teacher"
                ? "text-white font-bold"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            <span>Faculty Profile</span>
            {activeTab === "teacher" && (
              <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-rose-500 rounded-full" />
            )}
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("roadmap")}
            className={`pb-2.5 transition relative whitespace-nowrap ${
              activeTab === "roadmap"
                ? "text-white font-bold"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            <span>Roadmap</span>
            {activeTab === "roadmap" && (
              <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-rose-500 rounded-full" />
            )}
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("reviews")}
            className={`pb-2.5 transition relative whitespace-nowrap ${
              activeTab === "reviews"
                ? "text-white font-bold"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            <span>Reviews</span>
            {activeTab === "reviews" && (
              <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-rose-500 rounded-full" />
            )}
          </button>
        </div>

        {/* 3. Main Title & Meta Stats */}
        <div className="space-y-3">
          <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-white tracking-tight leading-snug">
            {data.title}: Complete Chapter
          </h1>

          {/* Meta Line: Duration | Lessons | Rating */}
          <div className="flex items-center gap-3 text-xs sm:text-sm text-slate-300 font-medium">
            <div className="flex items-center gap-1">
              <span className="material-symbols-outlined text-sm text-amber-400">schedule</span>
              <span>{data.totalDurationMin || 180} Min</span>
            </div>
            <span className="text-slate-600">|</span>
            <div className="flex items-center gap-1">
              <span className="material-symbols-outlined text-sm text-indigo-400">menu_book</span>
              <span>{totalLessons || 8} Lessons</span>
            </div>
            <span className="text-slate-600">|</span>
            <div className="flex items-center gap-1 text-amber-400">
              <span>★</span>
              <span>{data.averageRating || 4.9}</span>
            </div>
          </div>

          {/* Learner Avatars Stack */}
          <div className="flex items-center gap-2.5 pt-1">
            <div className="flex -space-x-2 overflow-hidden">
              <div className="w-6 h-6 rounded-full bg-rose-500 border-2 border-[#090b14] flex items-center justify-center text-[10px] font-bold text-white">
                P
              </div>
              <div className="w-6 h-6 rounded-full bg-indigo-500 border-2 border-[#090b14] flex items-center justify-center text-[10px] font-bold text-white">
                R
              </div>
              <div className="w-6 h-6 rounded-full bg-amber-500 border-2 border-[#090b14] flex items-center justify-center text-[10px] font-bold text-black font-bold">
                A
              </div>
            </div>
            <span className="text-xs text-slate-400 font-medium">
              {(data.learnerCount || 51200).toLocaleString()}+ learners already learning
            </span>
          </div>

          {/* Certificate Badge Pill */}
          <div className="py-2 flex items-center justify-center">
            <div className="relative w-full max-w-sm flex items-center justify-center">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-amber-500/20" />
              </div>
              <div className="relative px-4 py-1.5 rounded-full bg-gradient-to-r from-[#211b11] via-[#332612] to-[#211b11] border border-amber-500/40 shadow-sm flex items-center gap-2 text-amber-300 text-xs font-bold uppercase tracking-wider">
                <span className="material-symbols-outlined text-sm text-amber-400">school</span>
                <span>MASTERY CERTIFICATE INCLUDED</span>
              </div>
            </div>
          </div>

          {/* Endorsement Laurel Ribbon */}
          <div className="flex items-center justify-center gap-2 py-1 text-xs text-slate-400">
            <span className="text-slate-600">🌿</span>
            <span className="text-[11px] uppercase tracking-wider font-semibold">
              Trusted by Atomic Pathshala Learners
            </span>
            <span className="text-slate-600">🌿</span>
          </div>
        </div>

        {/* 4. TAB CONTENTS */}

        {/* A. OVERVIEW TAB */}
        {(activeTab === "overview" || activeTab === "teacher") && (
          <div className="space-y-6 pt-2">
            {/* About the Chapter */}
            <div className="space-y-3">
              <h3 className="text-lg font-bold text-white tracking-tight">
                About the Chapter
              </h3>
              <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
                {data.description ||
                  `Master the core concepts of ${data.title} in ${data.subjectName}. Designed with 100% NCERT alignment, conceptual video lectures, high-yield DPP problem sets, and timed chapter mastery tests for NEET, JEE & CBSE.`}
              </p>

              {/* Key Learning Outcomes (Star Bullets) */}
              <div className="space-y-2.5 pt-2">
                {data.learningOutcomes && data.learningOutcomes.length > 0 ? (
                  data.learningOutcomes.map((outcome, idx) => (
                    <div key={idx} className="flex items-start gap-2.5 text-xs sm:text-sm text-slate-200">
                      <span className="text-amber-400 text-base leading-none">☆</span>
                      <span className="leading-snug">{outcome}</span>
                    </div>
                  ))
                ) : (
                  <>
                    <div className="flex items-start gap-2.5 text-xs sm:text-sm text-slate-200">
                      <span className="text-amber-400 text-base leading-none">☆</span>
                      <span className="leading-snug">Understand fundamental concepts & postulates from ground up</span>
                    </div>
                    <div className="flex items-start gap-2.5 text-xs sm:text-sm text-slate-200">
                      <span className="text-amber-400 text-base leading-none">☆</span>
                      <span className="leading-snug">Master core formulas, diagrams, and numerical calculation techniques</span>
                    </div>
                    <div className="flex items-start gap-2.5 text-xs sm:text-sm text-slate-200">
                      <span className="text-amber-400 text-base leading-none">☆</span>
                      <span className="leading-snug">Solve high-yield previous year questions (PYQs) for NEET & JEE</span>
                    </div>
                    <div className="flex items-start gap-2.5 text-xs sm:text-sm text-slate-200">
                      <span className="text-amber-400 text-base leading-none">☆</span>
                      <span className="leading-snug">Line-by-line NCERT canonical coverage with concept clarity</span>
                    </div>
                    <div className="flex items-start gap-2.5 text-xs sm:text-sm text-slate-200">
                      <span className="text-amber-400 text-base leading-none">☆</span>
                      <span className="leading-snug">Timed Daily Practice Problems (DPPs) with detailed video solutions</span>
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* Your Faculty / Educator Section (Matches Reference Image 2) */}
            <div className="space-y-3 pt-4 border-t border-slate-800">
              <h3 className="text-lg font-bold text-white tracking-tight">
                Your Faculty
              </h3>

              <div className="flex items-start gap-3.5 p-4 rounded-2xl bg-[#141627] border border-slate-800 shadow-md">
                <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-full overflow-hidden bg-slate-800 flex-shrink-0 border border-amber-500/40 flex items-center justify-center">
                  {data.teacher.photo ? (
                    <img
                      src={data.teacher.photo}
                      alt={data.teacher.name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <span className="material-symbols-outlined text-2xl text-amber-400">
                      person
                    </span>
                  )}
                </div>

                <div className="space-y-1">
                  <h4 className="text-sm sm:text-base font-bold text-white leading-tight">
                    {data.teacher.name}
                  </h4>
                  <p className="text-xs text-amber-400 font-medium">
                    {data.teacher.designation || `Faculty in ${data.subjectName}`}
                  </p>
                  <p className="text-xs text-slate-300 pt-1 leading-relaxed">
                    • {data.teacher.bio ||
                      `Dedicated educator simplifying ${data.subjectName} concepts, helping thousands of NEET & JEE aspirants score top marks.`}
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* B. ROADMAP SECTION (Matches Reference Image 3) */}
        {(activeTab === "overview" || activeTab === "roadmap") && (
          <div id="roadmap-section" className="space-y-3 pt-4 border-t border-slate-800">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-white tracking-tight">
                Roadmap
              </h3>
              <span className="text-xs text-slate-400 font-mono">
                {data.roadmap.length} Steps
              </span>
            </div>

            <ChapterRoadmapTimeline
              roadmap={data.roadmap}
              startChapterHref={startDestination}
            />
          </div>
        )}

        {/* C. REVIEWS SECTION (Matches Reference Image 3) */}
        {(activeTab === "overview" || activeTab === "reviews") && (
          <div className="space-y-3 pt-4 border-t border-slate-800">
            <h3 className="text-lg font-bold text-white tracking-tight">
              Reviews
            </h3>

            <ChapterReviewsSection reviews={data.reviews} />
          </div>
        )}
      </div>

      {/* 5. STICKY BOTTOM CTA: "Start Chapter" (Matches Reference UI) */}
      <div className="fixed bottom-0 left-0 right-0 z-40 bg-[#090b14]/95 backdrop-blur-xl border-t border-slate-800/80 p-4 flex items-center justify-center">
        <div className="max-w-2xl w-full">
          <button
            type="button"
            onClick={handleStartChapter}
            className="w-full py-3.5 px-6 rounded-xl bg-gradient-to-r from-rose-600 to-rose-700 hover:from-rose-500 hover:to-rose-600 active:scale-[0.99] text-white font-extrabold text-sm sm:text-base shadow-xl shadow-rose-900/30 transition flex items-center justify-center gap-2"
          >
            <span className="material-symbols-outlined text-lg">play_arrow</span>
            <span>Start Chapter</span>
          </button>
        </div>
      </div>
    </div>
  );
}