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
  const defaultReviews: ChapterReviewItem[] = [
    {
      id: "rev-1",
      studentName: "Priya Nair",
      avatarColor: "bg-rose-500/30 text-rose-300",
      rating: 5,
      comment: "Outstanding explanation of concepts! The DPPs and notes cleared all my doubts for NEET.",
      date: "2 days ago",
    },
    {
      id: "rev-2",
      studentName: "Aman Sharma",
      avatarColor: "bg-indigo-500/30 text-indigo-300",
      rating: 5,
      comment: "Line-by-line NCERT breakdown helped me score 100% in my chapter test. Highly recommended!",
      date: "1 week ago",
    },
    {
      id: "rev-3",
      studentName: "Rohan Patel",
      avatarColor: "bg-emerald-500/30 text-emerald-300",
      rating: 5,
      comment: "Best chapter sequence. Covered all NCERT topics and previous year questions easily.",
      date: "2 weeks ago",
    },
  ];

  const displayReviews = reviews && reviews.length > 0 ? reviews : defaultReviews;

  return (
    <div className="space-y-3">
      {/* Horizontal Snap Scroll Carousel */}
      <div className="flex gap-4 overflow-x-auto pb-4 pt-1 snap-x scrollbar-thin scrollbar-thumb-slate-800">
        {displayReviews.map((rev) => {
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