"use client";

import React from "react";
import Link from "next/link";
import { CourseData } from "./CourseCard";

export function StickyPurchaseBar({ course }: { course: CourseData }) {
  const discount = Math.round(((course.originalPrice - course.price) / course.originalPrice) * 100);

  return (
    <>
      {/* 1. Desktop Sticky Purchase Card (Right Column) */}
      <div className="hidden lg:block sticky top-24 bg-white rounded-3xl border border-slate-200/80 p-6 shadow-xl shadow-slate-200/40 space-y-5">
        <div>
          <span className="text-[10px] uppercase font-black tracking-wider text-slate-400 block mb-1">
            Special Admission Price
          </span>
          <div className="flex items-end gap-2.5">
            <span className="text-3xl font-black text-[#031635]">
              ₹{course.price.toLocaleString("en-IN")}
            </span>
            <span className="text-sm text-slate-400 line-through pb-1">
              ₹{course.originalPrice.toLocaleString("en-IN")}
            </span>
            <span className="text-xs font-black text-[#005231] bg-[#9ff5c1] px-2 py-0.5 rounded-lg mb-1">
              {discount}% OFF
            </span>
          </div>
          <p className="text-[11px] text-slate-500 mt-1 flex items-center gap-1">
            <span className="material-symbols-outlined text-xs text-emerald-600">verified</span>
            <span>Valid for {course.duration} until exam conclusion</span>
          </p>
        </div>

        <div className="space-y-2.5">
          <Link
            href={`/checkout/${course.slug}`}
            className="w-full bg-[#6b46c1] hover:bg-[#5b3da5] text-white font-extrabold text-sm py-3.5 rounded-2xl shadow-lg shadow-purple-500/25 transition-all text-center flex items-center justify-center gap-2 group"
          >
            <span>BUY NOW</span>
            <span className="material-symbols-outlined text-base group-hover:translate-x-1 transition-transform">
              arrow_forward
            </span>
          </Link>

          <a
            href="#trial"
            className="w-full bg-slate-100 hover:bg-slate-200 text-[#031635] font-bold text-xs py-3 rounded-2xl transition-all text-center flex items-center justify-center gap-1.5"
          >
            <span className="material-symbols-outlined text-base text-amber-500">play_circle</span>
            <span>Start Free Trial (3 Classes)</span>
          </a>
        </div>

        {/* Benefits Checklist */}
        <div className="pt-4 border-t border-slate-100 space-y-2 text-xs">
          <span className="font-bold text-slate-700 block text-[11px] uppercase tracking-wider">
            Included in this batch:
          </span>
          <div className="space-y-1.5 text-slate-600">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-xs text-emerald-600">check_circle</span>
              <span>128+ Full Syllabus Live & Recorded Classes</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-xs text-emerald-600">check_circle</span>
              <span>21 Standardized All-India Mock Tests</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-xs text-emerald-600">check_circle</span>
              <span>Downloadable Chapter Notes & DPP PDFs</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-xs text-emerald-600">check_circle</span>
              <span>24/7 Expert Faculty Doubt Assistance</span>
            </div>
          </div>
        </div>
      </div>

      {/* 2. Mobile Fixed Bottom Purchase Bar */}
      <div className="fixed bottom-0 left-0 w-full z-50 bg-white/95 backdrop-blur-md border-t border-slate-200/80 shadow-[0_-8px_20px_rgba(3,22,53,0.08)] p-3.5 px-4 lg:hidden flex items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-lg font-black text-[#031635]">
              ₹{course.price.toLocaleString("en-IN")}
            </span>
            <span className="text-xs text-slate-400 line-through">
              ₹{course.originalPrice.toLocaleString("en-IN")}
            </span>
          </div>
          <span className="text-[10px] font-extrabold text-[#005231] bg-[#9ff5c1] px-1.5 py-0.5 rounded">
            {discount}% OFF
          </span>
        </div>

        <div className="flex items-center gap-2">
          <a
            href="#trial"
            className="bg-slate-100 text-[#031635] text-[11px] font-bold px-3 py-2.5 rounded-xl whitespace-nowrap"
          >
            Free Trial
          </a>
          <Link
            href={`/checkout/${course.slug}`}
            className="bg-[#6b46c1] hover:bg-[#5b3da5] text-white font-black text-xs px-5 py-2.5 rounded-xl shadow-md shadow-purple-500/20 whitespace-nowrap"
          >
            BUY NOW
          </Link>
        </div>
      </div>
    </>
  );
}