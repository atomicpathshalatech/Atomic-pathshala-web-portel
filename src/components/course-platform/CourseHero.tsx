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
    <div className="bg-white rounded-3xl border border-slate-200/80 overflow-hidden shadow-sm">
      {/* 1. Header Toolbar with Back, Title, Share, Wishlist */}
      <div className="flex items-center justify-between px-4 sm:px-6 py-3.5 border-b border-slate-100 bg-white">
        <Link
          href="/courses"
          className="flex items-center gap-1.5 text-xs font-bold text-slate-600 hover:text-[#031635] transition"
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
                : "border-slate-200 text-slate-500 hover:bg-slate-50"
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
            className="p-2 rounded-full border border-slate-200 text-slate-500 hover:bg-slate-50 transition"
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
        <img
          src={course.thumbnailUrl}
          alt={course.title}
          className="w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-[#031635]/90 via-[#031635]/30 to-transparent" />

        <div className="absolute bottom-4 left-4 sm:bottom-6 sm:left-6 flex items-center gap-2">
          <span className="bg-[#9ff5c1] text-[#005231] font-extrabold text-[10px] sm:text-xs px-2.5 py-1 rounded-lg uppercase tracking-wider shadow">
            UPCOMING BATCH
          </span>
          <span className="bg-[#a480fe] text-[#39008c] font-extrabold text-[10px] sm:text-xs px-2.5 py-1 rounded-lg uppercase tracking-wider shadow">
            {course.exam} {course.examYear}
          </span>
          <span className="bg-white/20 backdrop-blur-md text-white font-bold text-[10px] sm:text-xs px-2.5 py-1 rounded-lg">
            {course.subject}
          </span>
        </div>
      </div>

      {/* 3. Hero Content Details */}
      <div className="p-5 sm:p-7">
        <h1 className="text-xl sm:text-2xl md:text-3xl font-extrabold text-[#031635] tracking-tight mb-2">
          {course.title}
        </h1>
        <p className="text-xs sm:text-sm text-slate-600 max-w-3xl leading-relaxed mb-5">
          {course.subtitle ||
            "Comprehensive, structured preparation with live interactive lectures, curated NCERT notes, daily practice problems (DPPs), and all-India standardized mock tests."}
        </p>

        {/* Social Proof Bar */}
        <div className="flex flex-wrap items-center gap-4 py-3 border-y border-slate-100 mb-5">
          <div className="flex items-center gap-2">
            <div className="flex -space-x-2">
              <div className="w-7 h-7 rounded-full bg-indigo-500 border-2 border-white flex items-center justify-center text-[10px] font-bold text-white">
                AS
              </div>
              <div className="w-7 h-7 rounded-full bg-purple-500 border-2 border-white flex items-center justify-center text-[10px] font-bold text-white">
                RK
              </div>
              <div className="w-7 h-7 rounded-full bg-emerald-500 border-2 border-white flex items-center justify-center text-[10px] font-bold text-white">
                PS
              </div>
              <div className="w-7 h-7 rounded-full bg-slate-800 border-2 border-white flex items-center justify-center text-[9px] font-bold text-white">
                +800
              </div>
            </div>
            <span className="text-xs font-bold text-[#031635]">
              {course.studentsCount}+ students enrolled
            </span>
          </div>

          <div className="h-4 w-px bg-slate-200 hidden sm:block" />

          <div className="flex items-center gap-1.5 text-xs text-amber-500 font-bold">
            <span className="material-symbols-outlined text-sm fill-current">star</span>
            <span className="text-slate-800">4.9</span>
            <span className="text-slate-400 font-normal">(420 reviews)</span>
          </div>
        </div>

        {/* Essential Metadata Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 sm:gap-3">
          <div className="p-3 rounded-2xl bg-slate-50 border border-slate-100">
            <span className="text-[10px] uppercase font-bold text-slate-400 block">Starts</span>
            <span className="text-xs font-black text-[#031635]">03 Sept 2026</span>
          </div>
          <div className="p-3 rounded-2xl bg-slate-50 border border-slate-100">
            <span className="text-[10px] uppercase font-bold text-slate-400 block">Validity</span>
            <span className="text-xs font-black text-[#031635]">{course.duration}</span>
          </div>
          <div className="p-3 rounded-2xl bg-slate-50 border border-slate-100">
            <span className="text-[10px] uppercase font-bold text-slate-400 block">Language</span>
            <span className="text-xs font-black text-[#031635]">{course.language}</span>
          </div>
          <div className="p-3 rounded-2xl bg-slate-50 border border-slate-100">
            <span className="text-[10px] uppercase font-bold text-slate-400 block">Educators</span>
            <span className="text-xs font-black text-[#031635]">{course.educators}</span>
          </div>
        </div>
      </div>
    </div>
  );
}