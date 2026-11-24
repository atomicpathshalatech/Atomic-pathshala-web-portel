"use client";

import React from "react";
import Link from "next/link";
import type { CourseData } from "./CourseCard";

/**
 * Preview view for sample/catalog courses:
 * Replaces the old mock payment with an honest admissions notice and catalog link.
 * Fake payment success states and hardcoded coupons are strictly removed.
 */
export function CheckoutView({ course }: { course: CourseData }) {
  return (
    <div className="min-h-screen bg-[#f9f9ff] text-[#121c2c] py-8 sm:py-12 px-4 font-sans">
      <div className="max-w-xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <Link
            href="/courses"
            className="flex items-center gap-1 text-xs font-bold text-slate-500 hover:text-[#031635] transition"
          >
            <span className="material-symbols-outlined text-base">arrow_back</span>
            <span>Back to All Courses &amp; Batches</span>
          </Link>
          <div className="flex items-center gap-1 text-xs font-bold text-emerald-600">
            <span className="material-symbols-outlined text-sm">verified</span>
            <span>Atomic Pathshala Verified</span>
          </div>
        </div>

        <div className="bg-white rounded-3xl border border-slate-200/80 p-6 sm:p-8 space-y-6 shadow-sm text-center">
          <div className="w-16 h-16 rounded-2xl bg-purple-100 text-purple-700 mx-auto flex items-center justify-center">
            <span className="material-symbols-outlined text-3xl">school</span>
          </div>

          <div className="space-y-2">
            <span className="bg-purple-100 text-purple-800 text-[10px] font-extrabold uppercase px-2.5 py-1 rounded-full">
              Course Catalog Preview
            </span>
            <h2 className="text-xl font-black text-[#031635]">{course.title}</h2>
            <p className="text-xs text-slate-500 max-w-sm mx-auto leading-relaxed">
              Enrollments for this course are organized by academic batches and cohorts with assigned faculty and live schedules.
            </p>
          </div>

          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100 text-left text-xs space-y-2">
            <div className="flex justify-between">
              <span className="text-slate-500">Subject:</span>
              <span className="font-bold text-[#031635]">{course.subject}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Standard Fee:</span>
              <span className="font-mono font-bold text-[#031635]">₹{course.price.toLocaleString("en-IN")}</span>
            </div>
          </div>

          <div className="space-y-3 pt-2">
            <Link
              href="/courses"
              className="w-full py-3.5 rounded-2xl bg-[#6b46c1] hover:bg-[#5b3da5] text-white font-bold text-xs block transition shadow-lg shadow-purple-500/20"
            >
              Explore Active Batches &amp; Enroll
            </Link>
            <Link
              href="/subscription"
              className="w-full py-3 rounded-2xl border border-slate-200 text-slate-700 font-bold text-xs block hover:bg-slate-50 transition"
            >
              View All-Access Subscription Plans
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
