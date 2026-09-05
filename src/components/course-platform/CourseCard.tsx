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
    <article className="bg-white rounded-2xl border border-slate-200/90 overflow-hidden hover:shadow-md transition-all duration-300 flex flex-col group hover:-translate-y-0.5">
      {/* Thumbnail Area */}
      <div className="aspect-video relative bg-slate-900 overflow-hidden">
        {course.thumbnailUrl ? (
          <img
            src={course.thumbnailUrl}
            alt={course.title}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
          />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-[#031635] via-[#1a237e] to-[#6b46c1] p-4 flex flex-col justify-between group-hover:scale-105 transition-transform duration-500">
            <span className="material-symbols-outlined text-3xl text-white/50">school</span>
            <span className="font-extrabold text-xs sm:text-sm text-white line-clamp-2">{course.title}</span>
          </div>
        )}

        {/* Floating Badges */}
        <div className="absolute top-2.5 left-2.5 flex items-center gap-1.5 flex-wrap">
          <span className="bg-[#031635] text-white px-2 py-0.5 rounded-md font-bold text-[10px] uppercase tracking-wider shadow-2xs">
            {course.exam} {course.examYear || ""}
          </span>
          {course.isNewBatch && (
            <span className="bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded-md font-extrabold text-[10px] uppercase tracking-wider shadow-2xs">
              Batch
            </span>
          )}
        </div>

        {course.studentsCount > 0 && (
          <div className="absolute bottom-2.5 right-2.5 bg-black/60 backdrop-blur-xs text-white px-2 py-0.5 rounded text-[10px] font-semibold flex items-center gap-1">
            <span className="material-symbols-outlined text-[13px] text-amber-400">group</span>
            <span>{course.studentsCount} Enrolled</span>
          </div>
        )}
      </div>

      {/* Content Area */}
      <div className="p-4 flex flex-col flex-1">
        <h3 className="font-bold text-sm sm:text-base text-[#031635] line-clamp-1 mb-0.5 group-hover:text-[#6b46c1] transition-colors">
          {course.title}
        </h3>
        <p className="text-xs text-slate-500 font-medium mb-2.5 truncate">{course.educators}</p>

        {/* Metadata Badges */}
        <div className="flex flex-wrap gap-1.5 mb-3">
          <span className="flex items-center gap-1 bg-slate-50 border border-slate-200/80 text-slate-700 px-2 py-0.5 rounded-md text-[10px] font-semibold">
            <span className="material-symbols-outlined text-[12px]">menu_book</span>
            {course.courseType || "Batch"}
          </span>
          <span className="flex items-center gap-1 bg-slate-50 border border-slate-200/80 text-slate-700 px-2 py-0.5 rounded-md text-[10px] font-semibold">
            <span className="material-symbols-outlined text-[12px]">translate</span>
            {course.language}
          </span>
          <span className="flex items-center gap-1 bg-slate-50 border border-slate-200/80 text-slate-700 px-2 py-0.5 rounded-md text-[10px] font-semibold">
            <span className="material-symbols-outlined text-[12px]">schedule</span>
            {course.duration}
          </span>
        </div>

        {/* Stats Row */}
        <div className="flex items-center justify-around py-2 mb-3 border border-slate-100 bg-white rounded-xl text-center shadow-2xs">
          <div>
            <span className="font-black text-xs sm:text-sm text-[#031635] block">{course.classesCount}</span>
            <span className="text-[9px] font-medium text-slate-500 uppercase tracking-wide">Classes</span>
          </div>
          <div className="w-px h-5 bg-slate-200" />
          <div>
            <span className="font-black text-xs sm:text-sm text-[#031635] block">{course.testsCount}</span>
            <span className="text-[9px] font-medium text-slate-500 uppercase tracking-wide">Mock Tests</span>
          </div>
          <div className="w-px h-5 bg-slate-200" />
          <div>
            <span className="font-black text-xs sm:text-sm text-[#031635] block truncate max-w-[80px]">{course.subject}</span>
            <span className="text-[9px] font-medium text-slate-500 uppercase tracking-wide">Subject</span>
          </div>
        </div>

        {/* Price & Action Row */}
        <div className="mt-auto pt-1">
          <div className="flex items-end gap-2 mb-2.5">
            <span className="text-lg font-black text-[#031635]">₹{course.price.toLocaleString("en-IN")}</span>
            {course.originalPrice > course.price && (
              <>
                <span className="text-xs text-slate-400 line-through mb-0.5">₹{course.originalPrice.toLocaleString("en-IN")}</span>
                <span className="text-[10px] font-extrabold text-emerald-700 bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded ml-1 mb-0.5">
                  {discount}% OFF
                </span>
              </>
            )}
          </div>

          <div className="grid grid-cols-2 gap-2">
            <Link
              href={`/courses/${course.slug}`}
              className="border border-slate-300 text-slate-700 font-bold text-xs py-2 rounded-xl hover:bg-slate-50 transition-colors text-center flex items-center justify-center"
            >
              View Batch
            </Link>
            <Link
              href={`/checkout/${course.slug}`}
              className="bg-[#6b46c1] hover:bg-[#5b3da5] text-white font-bold text-xs py-2 rounded-xl shadow-2xs transition-all text-center flex items-center justify-center"
            >
              Enroll Now
            </Link>
          </div>
        </div>
      </div>
    </article>
  );
}
