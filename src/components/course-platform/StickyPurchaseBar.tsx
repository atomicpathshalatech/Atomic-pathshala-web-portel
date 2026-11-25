"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { CourseData } from "./CourseCard";

export function StickyPurchaseBar({ course }: { course: CourseData }) {
  const router = useRouter();
  const [isEnrolling, setIsEnrolling] = useState(false);

  const isFree = course.price === 0;
  const isClosed = course.isPurchasable === false;
  const discount =
    typeof course.discountPercentage === "number"
      ? course.discountPercentage
      : isFree
      ? (course.originalPrice > 0 ? 100 : 0)
      : course.originalPrice > course.price
      ? Math.round(((course.originalPrice - course.price) / course.originalPrice) * 100)
      : 0;

  async function handleFreeEnroll() {
    setIsEnrolling(true);
    try {
      const res = await fetch(`/api/batches/${course.slug}/enroll`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });

      if (res.status === 401) {
        toast.info("Please sign in or create a student account to join this free batch.");
        router.push(`/login?callbackUrl=/courses/${course.slug}`);
        return;
      }

      const data = await res.json();
      if (!res.ok || !data.success) {
        toast.error(data.error || "Could not complete free enrollment. Please try again.");
        return;
      }

      toast.success(data.data?.message || "Successfully enrolled! Welcome to the batch. 🎉");
      router.refresh();
      // Navigate to the subjects/learning area
      router.push(`/courses/${course.slug}/subjects`);
    } catch {
      toast.error("Network error. Please check your connection and try again.");
    } finally {
      setIsEnrolling(false);
    }
  }

  if (course.isEnrolled) {
    return (
      <>
        {/* 1. Desktop Enrolled Status Card (Right Column) */}
        <div className="hidden lg:block sticky top-24 bg-white dark:bg-slate-900 rounded-3xl border border-emerald-200/90 dark:border-emerald-800/60 p-6 shadow-xl shadow-emerald-500/5 space-y-5">
          <div className="space-y-2">
            <span className="inline-flex items-center gap-1.5 bg-emerald-50 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 px-3 py-1 rounded-full text-[11px] font-extrabold uppercase tracking-wider">
              <span className="material-symbols-outlined text-[13px] text-emerald-600">verified</span>
              Enrolled &amp; Active
            </span>
            <h3 className="text-xl font-black text-[#031635] dark:text-white">Your Batch Access is Active</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
              You are enrolled in this batch. Access all live lectures, recordings, assignments, and test series anytime.
            </p>
          </div>

          <div className="space-y-2.5">
            <Link
              href={`/courses/${course.slug}/subjects`}
              className="w-full bg-[#031635] hover:bg-[#1a237e] text-white font-bold text-xs py-3.5 rounded-2xl shadow-md transition-all text-center flex items-center justify-center gap-2"
            >
              <span className="material-symbols-outlined text-base">play_circle</span>
              <span>Continue Learning</span>
            </Link>
          </div>

          {/* Benefits Checklist */}
          <div className="pt-4 border-t border-slate-100 dark:border-slate-800 space-y-2 text-xs">
            <span className="font-bold text-slate-700 dark:text-slate-300 block text-[11px] uppercase tracking-wider">
              Unlocked with your batch:
            </span>
            <div className="space-y-2 text-slate-600 dark:text-slate-400">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-xs text-emerald-600">check_circle</span>
                <span>Full Syllabus Live &amp; Recorded Lectures</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-xs text-emerald-600">check_circle</span>
                <span>All-India Mock Tests &amp; Performance Analysis</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-xs text-emerald-600">check_circle</span>
                <span>Downloadable Chapter Notes &amp; DPP PDFs</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-xs text-emerald-600">check_circle</span>
                <span>Expert Faculty Doubt Sessions</span>
              </div>
            </div>
          </div>
        </div>

        {/* 2. Mobile Fixed Bottom Enrolled Bar */}
        <div className="fixed bottom-0 left-0 w-full z-50 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-t border-slate-200/80 dark:border-slate-800 shadow-[0_-8px_20px_rgba(3,22,53,0.08)] p-3.5 px-4 lg:hidden flex items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-emerald-600 text-lg">verified</span>
            <div>
              <span className="text-xs font-black text-[#031635] dark:text-white block">Enrolled &amp; Active</span>
              <span className="text-[10px] text-slate-500 font-medium">Batch Access Unlocked</span>
            </div>
          </div>

          <Link
            href={`/courses/${course.slug}/subjects`}
            className="bg-[#031635] hover:bg-[#1a237e] text-white font-bold text-xs px-5 py-2.5 rounded-xl shadow-sm whitespace-nowrap flex items-center gap-1.5"
          >
            <span>Continue</span>
            <span className="material-symbols-outlined text-sm">arrow_forward</span>
          </Link>
        </div>
      </>
    );
  }

  // Not enrolled: Render purchase / free join card
  return (
    <>
      {/* 1. Desktop Sticky Purchase Card (Right Column) */}
      <div className="hidden lg:block sticky top-24 bg-white dark:bg-slate-900 rounded-3xl border border-slate-200/80 dark:border-slate-800 p-6 shadow-xl shadow-slate-200/40 dark:shadow-none space-y-5">
        <div>
          <span className="text-[10px] uppercase font-black tracking-wider text-slate-400 block mb-1">
            {isFree ? "Free Cohort Admission" : "Special Admission Price"}
          </span>
          <div className="flex items-end gap-2.5 flex-wrap">
            {isFree ? (
              <>
                <span className="text-3xl font-black text-emerald-600 dark:text-emerald-400">
                  FREE
                </span>
                {course.originalPrice > 0 && (
                  <span className="text-sm text-slate-400 line-through pb-1">
                    ₹{course.originalPrice.toLocaleString("en-IN")}
                  </span>
                )}
                {discount > 0 && (
                  <span className="text-xs font-black text-emerald-800 dark:text-emerald-300 bg-emerald-100 dark:bg-emerald-950 px-2 py-0.5 rounded-lg mb-1">
                    {discount}% OFF
                  </span>
                )}
              </>
            ) : (
              <>
                <span className="text-3xl font-black text-[#031635] dark:text-white">
                  ₹{course.price.toLocaleString("en-IN")}
                </span>
                {course.originalPrice > course.price && (
                  <span className="text-sm text-slate-400 line-through pb-1">
                    ₹{course.originalPrice.toLocaleString("en-IN")}
                  </span>
                )}
                {discount > 0 && (
                  <span className="text-xs font-black text-[#005231] bg-[#9ff5c1] px-2 py-0.5 rounded-lg mb-1">
                    {discount}% OFF
                  </span>
                )}
              </>
            )}
          </div>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 flex items-center gap-1">
            <span className="material-symbols-outlined text-xs text-emerald-600">verified</span>
            <span>Valid for {course.duration} until exam conclusion</span>
          </p>
        </div>

        <div className="space-y-2.5">
          {isClosed ? (
            <button
              disabled
              className="w-full bg-slate-200 dark:bg-slate-800 text-slate-500 font-extrabold text-sm py-3.5 rounded-2xl cursor-not-allowed text-center"
            >
              ENROLLMENT CLOSED
            </button>
          ) : isFree ? (
            <button
              type="button"
              disabled={isEnrolling}
              onClick={handleFreeEnroll}
              className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-sm py-3.5 rounded-2xl shadow-lg shadow-emerald-600/25 transition-all text-center flex items-center justify-center gap-2 group active:scale-98 disabled:opacity-60"
            >
              <span className="material-symbols-outlined text-base">how_to_reg</span>
              <span>{isEnrolling ? "ENROLLING YOU..." : "JOIN FREE — ENROLL NOW"}</span>
            </button>
          ) : (
            <Link
              href={`/checkout/${course.slug}`}
              className="w-full bg-[#6b46c1] hover:bg-[#5b3da5] text-white font-extrabold text-sm py-3.5 rounded-2xl shadow-lg shadow-blue-500/25 transition-all text-center flex items-center justify-center gap-2 group"
            >
              <span>BUY NOW</span>
              <span className="material-symbols-outlined text-base group-hover:translate-x-1 transition-transform">
                arrow_forward
              </span>
            </Link>
          )}
        </div>

        {/* Benefits Checklist */}
        <div className="pt-4 border-t border-slate-100 dark:border-slate-800 space-y-2 text-xs">
          <span className="font-bold text-slate-700 dark:text-slate-300 block text-[11px] uppercase tracking-wider">
            Included in this batch:
          </span>
          <div className="space-y-1.5 text-slate-600 dark:text-slate-400">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-xs text-emerald-600">check_circle</span>
              <span>128+ Full Syllabus Live &amp; Recorded Classes</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-xs text-emerald-600">check_circle</span>
              <span>21 Standardized All-India Mock Tests</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-xs text-emerald-600">check_circle</span>
              <span>Downloadable Chapter Notes &amp; DPP PDFs</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-xs text-emerald-600">check_circle</span>
              <span>24/7 Expert Faculty Doubt Assistance</span>
            </div>
          </div>
        </div>
      </div>

      {/* 2. Mobile Fixed Bottom Purchase / Free Join Bar */}
      <div className="fixed bottom-0 left-0 w-full z-50 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-t border-slate-200/80 dark:border-slate-800 shadow-[0_-8px_20px_rgba(3,22,53,0.08)] p-3.5 px-4 lg:hidden flex items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            {isFree ? (
              <>
                <span className="text-lg font-black text-emerald-600 dark:text-emerald-400">
                  FREE
                </span>
                {course.originalPrice > 0 && (
                  <span className="text-xs text-slate-400 line-through">
                    ₹{course.originalPrice.toLocaleString("en-IN")}
                  </span>
                )}
              </>
            ) : (
              <>
                <span className="text-lg font-black text-[#031635] dark:text-white">
                  ₹{course.price.toLocaleString("en-IN")}
                </span>
                {course.originalPrice > course.price && (
                  <span className="text-xs text-slate-400 line-through">
                    ₹{course.originalPrice.toLocaleString("en-IN")}
                  </span>
                )}
              </>
            )}
          </div>
          {discount > 0 && (
            <span className="text-[10px] font-extrabold text-[#005231] bg-[#9ff5c1] px-1.5 py-0.5 rounded">
              {discount}% OFF
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {isClosed ? (
            <button
              disabled
              className="bg-slate-200 dark:bg-slate-800 text-slate-500 font-bold text-xs px-5 py-2.5 rounded-xl cursor-not-allowed whitespace-nowrap"
            >
              Closed
            </button>
          ) : isFree ? (
            <button
              type="button"
              disabled={isEnrolling}
              onClick={handleFreeEnroll}
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs px-6 py-2.5 rounded-xl shadow-md shadow-emerald-600/20 whitespace-nowrap active:scale-98 disabled:opacity-60"
            >
              {isEnrolling ? "Joining..." : "JOIN FREE"}
            </button>
          ) : (
            <Link
              href={`/checkout/${course.slug}`}
              className="bg-[#6b46c1] hover:bg-[#5b3da5] text-white font-black text-xs px-6 py-2.5 rounded-xl shadow-md shadow-blue-500/20 whitespace-nowrap"
            >
              BUY NOW
            </Link>
          )}
        </div>
      </div>
    </>
  );
}
