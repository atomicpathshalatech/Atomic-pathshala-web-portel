"use client";

import React from "react";
import Link from "next/link";

export interface CourseData {
  id: string;
  slug: string;
  title: string;
  subtitle?: string;
  exam: string;
  examYear?: string;
  subject: string;
  courseType: string;
  language: string;
  educators: string;
  duration: string;
  classesCount: number;
  testsCount: number;
  studentsCount: number;
  price: number;
  originalPrice: number;
  discountPercentage?: number;
  thumbnailUrl?: string | null;
  isNewBatch?: boolean;
  isEnrolled?: boolean;
}

export const BATCH_GRADIENT_THEMES = [
  // 1. Mint / Emerald (Image Reference 1)
  {
    cardBg: "bg-gradient-to-br from-emerald-500/10 via-teal-500/5 to-emerald-500/15 dark:from-emerald-950/40 dark:via-slate-900/90 dark:to-teal-950/30",
    cardBorder: "border-emerald-200/90 dark:border-emerald-800/60",
    headerGrad: "from-emerald-600 via-teal-600 to-emerald-800",
    accentText: "text-emerald-700 dark:text-emerald-300",
    pillBg: "bg-emerald-500/10 text-emerald-800 dark:text-emerald-300 border-emerald-200/80 dark:border-emerald-800/60",
    btnGrad: "bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white shadow-xs shadow-emerald-600/20",
    statBorder: "border-emerald-100 dark:border-emerald-900/40",
  },
  // 2. Lavender / Purple (Image Reference 2)
  {
    cardBg: "bg-gradient-to-br from-purple-500/10 via-fuchsia-500/5 to-indigo-500/15 dark:from-purple-950/40 dark:via-slate-900/90 dark:to-indigo-950/30",
    cardBorder: "border-purple-200/90 dark:border-purple-800/60",
    headerGrad: "from-purple-600 via-indigo-600 to-violet-800",
    accentText: "text-purple-700 dark:text-purple-300",
    pillBg: "bg-purple-500/10 text-purple-800 dark:text-purple-300 border-purple-200/80 dark:border-purple-800/60",
    btnGrad: "bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white shadow-xs shadow-purple-600/20",
    statBorder: "border-purple-100 dark:border-purple-900/40",
  },
  // 3. Sky / Cyan (Image Reference 3)
  {
    cardBg: "bg-gradient-to-br from-sky-500/10 via-cyan-500/5 to-blue-500/15 dark:from-sky-950/40 dark:via-slate-900/90 dark:to-blue-950/30",
    cardBorder: "border-sky-200/90 dark:border-sky-800/60",
    headerGrad: "from-sky-600 via-cyan-600 to-blue-800",
    accentText: "text-sky-700 dark:text-sky-300",
    pillBg: "bg-sky-500/10 text-sky-800 dark:text-sky-300 border-sky-200/80 dark:border-sky-800/60",
    btnGrad: "bg-gradient-to-r from-sky-600 to-cyan-600 hover:from-sky-700 hover:to-cyan-700 text-white shadow-xs shadow-sky-600/20",
    statBorder: "border-sky-100 dark:border-sky-900/40",
  },
  // 4. Amber / Coral / Sunset
  {
    cardBg: "bg-gradient-to-br from-amber-500/10 via-orange-500/5 to-rose-500/15 dark:from-amber-950/40 dark:via-slate-900/90 dark:to-orange-950/30",
    cardBorder: "border-amber-200/90 dark:border-amber-800/60",
    headerGrad: "from-amber-600 via-orange-600 to-rose-700",
    accentText: "text-amber-800 dark:text-amber-300",
    pillBg: "bg-amber-500/10 text-amber-900 dark:text-amber-300 border-amber-200/80 dark:border-amber-800/60",
    btnGrad: "bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-700 hover:to-orange-700 text-white shadow-xs shadow-amber-600/20",
    statBorder: "border-amber-100 dark:border-amber-900/40",
  },
  // 5. Rose / Pink / Ruby
  {
    cardBg: "bg-gradient-to-br from-rose-500/10 via-pink-500/5 to-fuchsia-500/15 dark:from-rose-950/40 dark:via-slate-900/90 dark:to-pink-950/30",
    cardBorder: "border-rose-200/90 dark:border-rose-800/60",
    headerGrad: "from-rose-600 via-pink-600 to-purple-800",
    accentText: "text-rose-700 dark:text-rose-300",
    pillBg: "bg-rose-500/10 text-rose-800 dark:text-rose-300 border-rose-200/80 dark:border-rose-800/60",
    btnGrad: "bg-gradient-to-r from-rose-600 to-pink-600 hover:from-rose-700 hover:to-pink-700 text-white shadow-xs shadow-rose-600/20",
    statBorder: "border-rose-100 dark:border-rose-900/40",
  },
];

export function CourseCard({
  course,
  index = 0,
}: {
  course: CourseData;
  index?: number;
}) {
  const theme =
    BATCH_GRADIENT_THEMES[index % BATCH_GRADIENT_THEMES.length] ||
    BATCH_GRADIENT_THEMES[0] || {
      cardBg: "bg-white",
      cardBorder: "border-slate-200",
      headerGrad: "from-emerald-600 to-teal-600",
      accentText: "text-emerald-700",
      pillBg: "bg-emerald-50 text-emerald-800 border-emerald-200",
      btnGrad: "bg-emerald-600 text-white",
      statBorder: "border-emerald-100",
    };

  const discount =
    course.originalPrice > course.price
      ? Math.round(((course.originalPrice - course.price) / course.originalPrice) * 100)
      : course.discountPercentage || 0;

  return (
    <article
      className={`rounded-2xl border ${theme.cardBorder} ${theme.cardBg} backdrop-blur-md overflow-hidden hover:shadow-lg transition-all duration-300 flex flex-col group hover:-translate-y-1 shadow-xs`}
    >
      {/* Sleek Compact Header / Thumbnail Banner (Reduced Height ~100px) */}
      <div className="h-28 relative overflow-hidden bg-slate-900">
        {course.thumbnailUrl ? (
          <img
            src={course.thumbnailUrl}
            alt={course.title}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
          />
        ) : (
          <div
            className={`w-full h-full bg-gradient-to-r ${theme.headerGrad} p-3.5 flex flex-col justify-between group-hover:scale-105 transition-transform duration-500`}
          >
            <div className="flex items-center justify-between">
              <span className="material-symbols-outlined text-white/70 text-2xl">school</span>
              <span className="bg-black/30 backdrop-blur-xs text-white/90 text-[10px] font-bold px-2 py-0.5 rounded-md uppercase tracking-wider">
                {course.courseType || "Live Batch"}
              </span>
            </div>
            <span className="font-extrabold text-xs sm:text-sm text-white line-clamp-1 drop-shadow-xs">
              {course.title}
            </span>
          </div>
        )}

        {/* Floating Badges */}
        <div className="absolute top-2.5 left-2.5 flex items-center gap-1.5 flex-wrap">
          <span className="bg-slate-900/90 backdrop-blur-xs text-white px-2 py-0.5 rounded-md font-bold text-[10px] uppercase tracking-wider shadow-2xs">
            {course.exam} {course.examYear || ""}
          </span>
          {course.isEnrolled ? (
            <span className="bg-emerald-600 text-white font-extrabold text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-md shadow-2xs flex items-center gap-1">
              <span className="material-symbols-outlined text-[11px]">verified</span>
              Enrolled
            </span>
          ) : course.isNewBatch ? (
            <span className="bg-white/95 dark:bg-slate-900 text-slate-800 dark:text-slate-200 border border-white/20 px-2 py-0.5 rounded-md font-extrabold text-[10px] uppercase tracking-wider shadow-2xs">
              Admissions Open
            </span>
          ) : null}
        </div>

        {course.studentsCount > 0 && (
          <div className="absolute bottom-2 right-2.5 bg-black/60 backdrop-blur-xs text-white px-2 py-0.5 rounded-md text-[10px] font-semibold flex items-center gap-1">
            <span className="material-symbols-outlined text-[12px] text-amber-400">group</span>
            <span>{course.studentsCount} Students</span>
          </div>
        )}
      </div>

      {/* Content Body — Compact, Reduced Thickness */}
      <div className="p-3.5 sm:p-4 flex flex-col flex-1">
        <div className="mb-2">
          <h3 className="font-extrabold text-sm sm:text-base text-slate-900 dark:text-white line-clamp-1 group-hover:opacity-90 transition-opacity">
            {course.title}
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 font-medium truncate mt-0.5">
            {course.educators}
          </p>
        </div>

        {/* Streamlined Feature Badges */}
        <div className="flex flex-wrap gap-1.5 mb-2.5">
          <span
            className={`flex items-center gap-1 border px-2 py-0.5 rounded-md text-[10px] font-bold ${theme.pillBg}`}
          >
            <span className="material-symbols-outlined text-[11px]">science</span>
            {course.subject}
          </span>
          <span className="flex items-center gap-1 bg-white/70 dark:bg-slate-800/70 border border-slate-200/80 dark:border-slate-700 text-slate-700 dark:text-slate-300 px-2 py-0.5 rounded-md text-[10px] font-semibold">
            <span className="material-symbols-outlined text-[11px]">translate</span>
            {course.language}
          </span>
          <span className="flex items-center gap-1 bg-white/70 dark:bg-slate-800/70 border border-slate-200/80 dark:border-slate-700 text-slate-700 dark:text-slate-300 px-2 py-0.5 rounded-md text-[10px] font-semibold">
            <span className="material-symbols-outlined text-[11px]">schedule</span>
            {course.duration}
          </span>
        </div>

        {/* Compact Stats Row */}
        <div
          className={`grid grid-cols-2 py-1.5 px-3 mb-3 bg-white/80 dark:bg-slate-900/80 backdrop-blur-xs rounded-xl border ${theme.statBorder} text-center shadow-2xs`}
        >
          <div className="border-r border-slate-200/60 dark:border-slate-800 pr-2">
            <span className="font-black text-xs text-slate-900 dark:text-white block">
              {course.classesCount}
            </span>
            <span className="text-[9px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide">
              Live Lectures
            </span>
          </div>
          <div className="pl-2">
            <span className="font-black text-xs text-slate-900 dark:text-white block truncate">
              {course.exam}
            </span>
            <span className="text-[9px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide">
              Target
            </span>
          </div>
        </div>

        {/* Action / Price Bottom Row */}
        <div className="mt-auto pt-1">
          {course.isEnrolled ? (
            <Link
              href={`/courses/${course.slug}`}
              className={`w-full ${theme.btnGrad} font-bold text-xs py-2 rounded-xl transition-all text-center flex items-center justify-center gap-1.5 active:scale-98`}
            >
              <span>Go to Batch</span>
              <span className="material-symbols-outlined text-sm">arrow_forward</span>
            </Link>
          ) : (
            <div className="flex items-center justify-between gap-2">
              <div>
                <div className="flex items-baseline gap-1.5">
                  <span className="text-base font-black text-slate-900 dark:text-white">
                    ₹{course.price.toLocaleString("en-IN")}
                  </span>
                  {course.originalPrice > course.price && (
                    <span className="text-[10px] text-slate-400 line-through">
                      ₹{course.originalPrice.toLocaleString("en-IN")}
                    </span>
                  )}
                </div>
                {discount > 0 && (
                  <span className="text-[9px] font-extrabold text-emerald-600 dark:text-emerald-400">
                    {discount}% SAVE
                  </span>
                )}
              </div>

              <div className="flex items-center gap-1.5">
                <Link
                  href={`/courses/${course.slug}`}
                  className="px-3 py-1.5 bg-white/90 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 font-bold text-xs rounded-xl transition"
                >
                  Details
                </Link>
                <Link
                  href={`/courses/${course.slug}`}
                  className={`px-3.5 py-1.5 ${theme.btnGrad} font-bold text-xs rounded-xl transition active:scale-98`}
                >
                  Enroll
                </Link>
              </div>
            </div>
          )}
        </div>
      </div>
    </article>
  );
}
