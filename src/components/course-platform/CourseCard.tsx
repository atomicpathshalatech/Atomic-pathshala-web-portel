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
}

export function CourseCard({ course }: { course: CourseData }) {
  const discount =
    course.originalPrice > course.price
      ? Math.round(((course.originalPrice - course.price) / course.originalPrice) * 100)
      : course.discountPercentage || 0;

  return (
    <article className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 overflow-hidden hover:shadow-[0_8px_30px_rgb(3,22,53,0.08)] transition-all duration-300 flex flex-col group hover:-translate-y-1">
      {/* Thumbnail Area */}
      <div className="aspect-video relative bg-slate-900 overflow-hidden">
        {course.thumbnailUrl ? (
          <img
            src={course.thumbnailUrl}
            alt={course.title}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
          />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-[#031635] via-[#1a237e] to-[#6b46c1] p-5 flex flex-col justify-between group-hover:scale-105 transition-transform duration-500">
            <span className="material-symbols-outlined text-4xl text-white/40">school</span>
            <span className="font-extrabold text-sm sm:text-base text-white line-clamp-2">{course.title}</span>
          </div>
        )}

        {/* Floating Badges */}
        <div className="absolute top-3 left-3 flex items-center gap-1.5 flex-wrap">
          <span className="bg-[#031635] text-white px-2.5 py-1 rounded-lg font-bold text-[10px] sm:text-[11px] uppercase tracking-wider shadow-sm">
            {course.exam} {course.examYear || ""}
          </span>
          {course.isNewBatch && (
            <span className="bg-[#9ff5c1] text-[#005231] px-2.5 py-1 rounded-lg font-extrabold text-[10px] sm:text-[11px] uppercase tracking-wider shadow-sm">
              Batch
            </span>
          )}
        </div>

        {course.studentsCount > 0 && (
          <div className="absolute bottom-3 right-3 bg-black/60 backdrop-blur-sm text-white px-2 py-0.5 rounded text-[10px] font-semibold flex items-center gap-1">
            <span className="material-symbols-outlined text-[13px] text-amber-400">group</span>
            <span>{course.studentsCount} Enrolled</span>
          </div>
        )}
      </div>

      {/* Content Area */}
      <div className="p-5 flex flex-col flex-1">
        <h3 className="font-bold text-base text-[#031635] dark:text-white line-clamp-1 mb-1 group-hover:text-[#6b46c1] transition-colors">
          {course.title}
        </h3>
        <p className="text-xs text-slate-500 font-medium mb-3 truncate">{course.educators}</p>

        {/* Metadata Badges */}
        <div className="flex flex-wrap gap-1.5 mb-4">
          <span className="flex items-center gap-1 bg-[#e7eeff] dark:bg-slate-800 text-[#031635] dark:text-slate-200 px-2 py-1 rounded-md text-[11px] font-semibold">
            <span className="material-symbols-outlined text-[13px]">menu_book</span>
            {course.courseType || "Batch"}
          </span>
          <span className="flex items-center gap-1 bg-[#e7eeff] dark:bg-slate-800 text-[#031635] dark:text-slate-200 px-2 py-1 rounded-md text-[11px] font-semibold">
            <span className="material-symbols-outlined text-[13px]">translate</span>
            {course.language}
          </span>
          <span className="flex items-center gap-1 bg-[#e7eeff] dark:bg-slate-800 text-[#031635] dark:text-slate-200 px-2 py-1 rounded-md text-[11px] font-semibold">
            <span className="material-symbols-outlined text-[13px]">schedule</span>
            {course.duration}
          </span>
        </div>

        {/* Stats Row */}
        <div className="flex items-center justify-around py-2.5 mb-4 border-y border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40 rounded-xl text-center">
          <div>
            <span className="font-black text-sm text-[#031635] dark:text-white block">{course.classesCount}</span>
            <span className="text-[10px] font-medium text-slate-500 uppercase tracking-wide">Classes</span>
          </div>
          <div className="w-px h-6 bg-slate-200 dark:bg-slate-700" />
          <div>
            <span className="font-black text-sm text-[#031635] dark:text-white block">{course.testsCount}</span>
            <span className="text-[10px] font-medium text-slate-500 uppercase tracking-wide">Mock Tests</span>
          </div>
          <div className="w-px h-6 bg-slate-200 dark:bg-slate-700" />
          <div>
            <span className="font-black text-sm text-[#031635] dark:text-white block truncate max-w-[80px]">{course.subject}</span>
            <span className="text-[10px] font-medium text-slate-500 uppercase tracking-wide">Subject</span>
          </div>
        </div>

        {/* Price & Action Row */}
        <div className="mt-auto pt-1">
          <div className="flex items-end gap-2 mb-3">
            <span className="text-xl font-black text-[#031635] dark:text-white">₹{course.price.toLocaleString("en-IN")}</span>
            {course.originalPrice > course.price && (
              <>
                <span className="text-xs text-slate-400 line-through mb-0.5">₹{course.originalPrice.toLocaleString("en-IN")}</span>
                <span className="text-[10px] font-extrabold text-[#005231] bg-[#9ff5c1] px-1.5 py-0.5 rounded ml-1 mb-0.5">
                  {discount}% OFF
                </span>
              </>
            )}
          </div>

          <div className="grid grid-cols-2 gap-2">
            <Link
              href={`/courses/${course.slug}`}
              className="border border-[#031635] dark:border-slate-600 text-[#031635] dark:text-slate-200 font-bold text-xs py-2.5 rounded-xl hover:bg-[#031635]/5 dark:hover:bg-slate-800 transition-colors text-center flex items-center justify-center"
            >
              View Course
            </Link>
            <Link
              href={`/checkout/${course.slug}`}
              className="bg-[#6b46c1] hover:bg-[#5b3da5] text-white font-bold text-xs py-2.5 rounded-xl shadow-md shadow-purple-500/20 transition-all text-center flex items-center justify-center"
            >
              Buy Now
            </Link>
          </div>
        </div>
      </div>
    </article>
  );
}
