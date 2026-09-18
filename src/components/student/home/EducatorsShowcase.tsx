"use client";

import { useRef } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight, CheckCircle, GraduationCap, Award, BookOpen } from "lucide-react";
import { SectionHeader } from "./SectionHeader";

export interface EducatorItem {
  id: string;
  name: string;
  photoUrl: string | null;
  department: string;
  subjects: string[];
  experienceYears: string | null;
  qualifications: string[];
  bio?: string | null;
}

export function EducatorsShowcase({ educators }: { educators: EducatorItem[] }) {
  const scrollRef = useRef<HTMLDivElement | null>(null);

  if (!educators || educators.length === 0) return null;

  const scroll = (direction: "left" | "right") => {
    if (scrollRef.current) {
      const scrollAmount = direction === "left" ? -300 : 300;
      scrollRef.current.scrollBy({ left: scrollAmount, behavior: "smooth" });
    }
  };

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between">
        <SectionHeader title="Our Expert Educators" />
        {educators.length > 2 && (
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => scroll("left")}
              className="flex h-7 w-7 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 shadow-sm transition hover:bg-slate-50 hover:text-slate-900"
              aria-label="Scroll left"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => scroll("right")}
              className="flex h-7 w-7 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 shadow-sm transition hover:bg-slate-50 hover:text-slate-900"
              aria-label="Scroll right"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        )}
      </div>

      <div
        ref={scrollRef}
        className="flex gap-4 overflow-x-auto pb-2 scrollbar-none snap-x snap-mandatory"
        style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
      >
        {educators.map((teacher) => {
          const subjectsDisplay = teacher.subjects.length > 0 ? teacher.subjects.join(" • ") : teacher.department;
          const topQual = teacher.qualifications.length > 0 ? teacher.qualifications[0] : null;

          return (
            <div
              key={teacher.id}
              className="w-[260px] sm:w-[280px] shrink-0 snap-start rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm transition-all duration-200 hover:shadow-md hover:border-blue-200 flex flex-col justify-between"
            >
              <div>
                {/* Header with Avatar and Badge */}
                <div className="flex items-center gap-3">
                  <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-full border-2 border-blue-500/20 bg-slate-100 shadow-sm">
                    {teacher.photoUrl ? (
                      <img
                        src={teacher.photoUrl}
                        alt={teacher.name}
                        className="h-full w-full object-cover object-top"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-blue-500 to-indigo-600 text-lg font-bold text-white">
                        {teacher.name.charAt(0)}
                      </div>
                    )}
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1">
                      <h4 className="truncate text-sm font-bold text-slate-900">{teacher.name}</h4>
                      <CheckCircle className="h-3.5 w-3.5 shrink-0 text-blue-600 fill-blue-100" />
                    </div>
                    <p className="truncate text-xs font-semibold text-blue-600">{subjectsDisplay}</p>
                    {teacher.experienceYears && (
                      <p className="truncate text-[11px] text-slate-500">
                        {teacher.experienceYears}+ years experience
                      </p>
                    )}
                  </div>
                </div>

                {/* Qualification badge */}
                {topQual && (
                  <div className="mt-3 flex items-center gap-1.5 rounded-lg bg-slate-50 px-2.5 py-1.5 text-[11px] font-medium text-slate-700">
                    <GraduationCap className="h-3.5 w-3.5 text-slate-500 shrink-0" />
                    <span className="truncate">{topQual}</span>
                  </div>
                )}

                {/* Bio snippet if available */}
                {teacher.bio && (
                  <p className="mt-2 line-clamp-2 text-xs text-slate-500 leading-relaxed">
                    {teacher.bio}
                  </p>
                )}
              </div>

              {/* View Profile Action */}
              <div className="mt-3.5 pt-2.5 border-t border-slate-100 flex items-center justify-between">
                <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-600">
                  <Award className="w-3 h-3" />
                  Verified Faculty
                </span>
                <Link
                  href={`/faculty/${teacher.id}`}
                  className="text-xs font-bold text-blue-600 hover:text-blue-700 transition hover:underline"
                >
                  View Profile →
                </Link>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
