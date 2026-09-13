"use client";

import React from "react";

export interface ChapterReviewItem {
  id: string;
  studentName: string;
  avatarColor?: string;
  rating: number;
  comment: string;
  date?: string;
}

export function ChapterReviewsSection({
  reviews,
}: {
  reviews: ChapterReviewItem[];
}) {
  // Previously fell back to 3 hardcoded fake reviews (fake names, fake
  // 5-star ratings, fake relative dates like "2 days ago") whenever the
  // real `reviews` array was empty — every chapter with zero real reviews
  // showed identical fabricated testimonials. No student-review data model
  // exists in the schema at all, so an empty state is honest; a fake one
  // was not.
  if (!reviews || reviews.length === 0) {
    return <p className="text-xs text-slate-400 py-4">No student reviews yet.</p>;
  }

  return (
    <div className="space-y-3">
      {/* Horizontal Snap Scroll Carousel */}
      <div className="flex gap-4 overflow-x-auto pb-4 pt-1 snap-x scrollbar-thin scrollbar-thumb-slate-800">
        {reviews.map((rev) => {
          const initials = rev.studentName
            .split(" ")
            .map((n) => n[0])
            .join("")
            .slice(0, 2)
            .toUpperCase();

          return (
            <div
              key={rev.id}
              className="flex-shrink-0 w-72 sm:w-80 rounded-2xl p-4 bg-[#141627] border border-slate-800/80 shadow-lg space-y-3 snap-start"
            >
              {/* Reviewer Header */}
              <div className="flex items-center gap-3">
                <div
                  className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-xs ${
                    rev.avatarColor || "bg-amber-500/20 text-amber-300"
                  }`}
                >
                  {initials}
                </div>
                <div>
                  <h5 className="text-sm font-bold text-white leading-tight">
                    {rev.studentName}
                  </h5>
                  {rev.date && (
                    <span className="text-[10px] text-slate-500">{rev.date}</span>
                  )}
                </div>
              </div>

              {/* Star Rating */}
              <div className="flex items-center gap-1 text-amber-400 text-xs">
                {Array.from({ length: rev.rating || 5 }).map((_, i) => (
                  <span key={i}>★</span>
                ))}
              </div>

              {/* Review Text */}
              <p className="text-xs text-slate-300 line-clamp-3 leading-relaxed">
                "{rev.comment}"
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}