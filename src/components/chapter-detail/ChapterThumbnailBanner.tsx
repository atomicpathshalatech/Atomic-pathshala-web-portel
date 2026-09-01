"use client";

import React from "react";
import Image from "next/image";

interface ChapterThumbnailBannerProps {
  title: string;
  subjectName: string;
  className?: string;
  courseTitle?: string;
  medium?: string;
  teacherName?: string;
  teacherPhoto?: string | null;
}

export function ChapterThumbnailBanner({
  title,
  subjectName,
  className = "Class 11",
  courseTitle = "NEET / JEE / CBSE",
  medium = "Hindi",
  teacherName,
  teacherPhoto,
}: ChapterThumbnailBannerProps) {
  // Generate teacher initials for fallback avatar
  const initials = teacherName
    ? teacherName
        .split(" ")
        .map((n) => n[0])
        .join("")
        .toUpperCase()
        .slice(0, 2)
    : "AP";

  return (
    <div className="relative w-full aspect-[16/9] sm:aspect-[21/9] md:aspect-[16/7] rounded-3xl overflow-hidden shadow-2xl border border-slate-800/80 bg-gradient-to-br from-[#0c0f1d] via-[#131b31] to-[#080a14] p-5 sm:p-7 flex flex-col justify-between select-none">
      {/* Background visual neon/glow elements */}
      <div className="absolute -top-20 -left-20 w-64 h-64 bg-amber-500/15 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-20 -right-20 w-80 h-80 bg-indigo-600/20 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute top-1/2 left-1/3 w-40 h-40 bg-rose-500/10 rounded-full blur-2xl pointer-events-none" />

      {/* Top row: Badges & Brand */}
      <div className="relative z-10 flex items-center justify-between">
        <div className="flex items-center gap-2">
          {/* Gold Certificate / Masterclass badge */}
          <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-gradient-to-r from-amber-500/20 to-amber-600/30 border border-amber-400/40 text-amber-300 text-[11px] font-bold shadow-sm backdrop-blur-md">
            <span className="text-amber-400 text-xs">★</span>
            <span className="tracking-wide">COMPLETE CHAPTER</span>
          </div>

          <span className="px-2.5 py-0.5 rounded-full bg-slate-800/80 text-slate-300 text-[10px] font-semibold border border-slate-700 backdrop-blur-md">
            {medium}
          </span>
        </div>

        {/* Brand Tag */}
        <div className="flex items-center gap-1.5 text-xs font-black tracking-wider text-slate-300 bg-black/40 px-3 py-1 rounded-full border border-slate-800/80">
          <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse" />
          <span className="text-white font-extrabold">ATOMIC</span>
          <span className="text-amber-400">OPS</span>
        </div>
      </div>

      {/* Center & Right: Chapter Title & Teacher Photo Composition */}
      <div className="relative z-10 grid grid-cols-12 items-center gap-4 my-auto">
        {/* Left column: Big Chapter Typography */}
        <div className="col-span-8 sm:col-span-9 space-y-2">
          <div className="flex items-center gap-2 text-xs font-bold text-amber-400 uppercase tracking-widest">
            <span>{subjectName}</span>
            <span>•</span>
            <span>{className}</span>
          </div>

          <h2 className="text-xl sm:text-3xl md:text-4xl font-black text-white tracking-tight uppercase leading-tight drop-shadow-md font-sans">
            {title}
          </h2>

          <div className="inline-block px-2.5 py-1 rounded-lg bg-yellow-400 text-black font-black text-[10px] sm:text-xs tracking-wider uppercase shadow-md">
            {courseTitle} PREPARATION
          </div>
        </div>

        {/* Right column: Teacher Cutout Portrait */}
        <div className="col-span-4 sm:col-span-3 flex flex-col items-center justify-center">
          <div className="relative w-20 h-20 sm:w-28 sm:h-28 md:w-32 md:h-32 rounded-2xl overflow-hidden border-2 border-amber-400/60 shadow-xl bg-slate-900 flex items-center justify-center">
            {teacherPhoto ? (
              <img
                src={teacherPhoto}
                alt={teacherName || "Faculty"}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full bg-gradient-to-br from-indigo-900 to-slate-900 flex flex-col items-center justify-center text-center p-2">
                <span className="material-symbols-outlined text-3xl sm:text-4xl text-amber-400">
                  person
                </span>
                <span className="text-[10px] font-bold text-slate-300 font-mono mt-0.5">
                  {initials}
                </span>
              </div>
            )}
          </div>

          {teacherName && (
            <span className="mt-1.5 text-[10px] sm:text-xs font-bold text-slate-200 text-center line-clamp-1 bg-black/60 px-2 py-0.5 rounded-full border border-slate-800">
              {teacherName}
            </span>
          )}
        </div>
      </div>

      {/* Bottom Timeline Preview Accent */}
      <div className="relative z-10 flex items-center justify-between text-[11px] text-slate-400 pt-2 border-t border-slate-800/60">
        <div className="flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
          <span>NCERT Canonical Curriculum</span>
        </div>
        <span className="font-mono text-[10px] text-amber-400/90 font-semibold">
          Atomic Pathshala Learning Experience
        </span>
      </div>
    </div>
  );
}