"use client";

import React, { useState } from "react";
import Link from "next/link";
import { CourseData } from "./CourseCard";

export function CourseHero({ course }: { course: CourseData }) {
  const [copied, setCopied] = useState(false);
  const [wishlisted, setWishlisted] = useState(false);

  const handleShare = () => {
    if (typeof window !== "undefined") {
      navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200/80 dark:border-slate-800 overflow-hidden shadow-sm">
      {/* 1. Header Toolbar with Back, Title, Share, Wishlist */}
      <div className="flex items-center justify-between px-4 sm:px-6 py-3.5 border-b border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900">
        <Link
          href="/courses"
          className="flex items-center gap-1.5 text-xs font-bold text-slate-600 dark:text-slate-300 hover:text-primary transition"
        >
          <span className="material-symbols-outlined text-lg">arrow_back</span>
          <span>All Courses</span>
        </Link>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setWishlisted(!wishlisted)}
            className={`p-2 rounded-full border transition ${
              wishlisted
                ? "bg-rose-50 border-rose-200 text-rose-500"
                : "border-slate-200 dark:border-slate-700 text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800"
            }`}
            title="Wishlist"
          >
            <span className="material-symbols-outlined text-base">
              {wishlisted ? "favorite" : "favorite_border"}
            </span>
          </button>

          <button
            type="button"
            onClick={handleShare}
            className="p-2 rounded-full border border-slate-200 dark:border-slate-700 text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800 transition"
            title="Share Course"
          >
            <span className="material-symbols-outlined text-base">
              {copied ? "check" : "share"}
            </span>
          </button>
        </div>
      </div>

      {/* 2. Banner Visual */}
      <div className="relative aspect-[21/9] sm:aspect-[24/9] w-full bg-slate-900 overflow-hidden">
        {course.thumbnailUrl ? (
          <img
            src={course.thumbnailUrl}
            alt={course.title}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full bg-gradient-to-r from-primary to-primary-container flex items-center justify-center">
            <span className="font-headline-lg text-4xl text-white font-black">{course.title}</span>
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-[#031635]/90 via-[#031635]/30 to-transparent" />

        <div className="absolute bottom-4 left-4 sm:bottom-6 sm:left-6 flex items-center gap-2 flex-wrap">
          <span className="bg-emerald-400 text-emerald-950 font-extrabold text-[10px] sm:text-xs px-2.5 py-1 rounded-lg uppercase tracking-wider shadow">
            BATCH
          </span>
          {course.exam && (
            <span className="bg-purple-500 text-white font-extrabold text-[10px] sm:text-xs px-2.5 py-1 rounded-lg uppercase tracking-wider shadow">
              {course.exam} {course.examYear || ""}
            </span>
          )}
          {course.subject && (
            <span className="bg-white/20 backdrop-blur-md text-white font-bold text-[10px] sm:text-xs px-2.5 py-1 rounded-lg">
              {course.subject}
            </span>
          )}
        </div>
      </div>

      {/* 3. Hero Content Details */}
      <div className="p-5 sm:p-7">
        <h1 className="text-xl sm:text-2xl md:text-3xl font-extrabold text-[#031635] dark:text-white tracking-tight mb-2">
          {course.title}
        </h1>
        {course.subtitle && (
          <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 max-w-3xl leading-relaxed mb-5">
            {course.subtitle}
          </p>
        )}

        {/* Essential Metadata Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 sm:gap-3">
          <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800">
            <span className="text-[10px] uppercase font-bold text-slate-400 block">Status</span>
            <span className="text-xs font-black text-[#031635] dark:text-white">Active Batch</span>
          </div>
          <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800">
            <span className="text-[10px] uppercase font-bold text-slate-400 block">Validity</span>
            <span className="text-xs font-black text-[#031635] dark:text-white">{course.duration || "Academic Year"}</span>
          </div>
          <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800">
            <span className="text-[10px] uppercase font-bold text-slate-400 block">Language</span>
            <span className="text-xs font-black text-[#031635] dark:text-white">{course.language || "English / Hindi"}</span>
          </div>
          <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800">
            <span className="text-[10px] uppercase font-bold text-slate-400 block">Faculty</span>
            <span className="text-xs font-black text-[#031635] dark:text-white truncate block">
              {course.educators || "Atomic Faculty"}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
