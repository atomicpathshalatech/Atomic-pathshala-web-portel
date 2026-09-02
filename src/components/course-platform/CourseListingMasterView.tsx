"use client";

import React, { useState, useMemo } from "react";
import { CourseCard, CourseData } from "./CourseCard";

export function CourseListingMasterView({ courses = [] }: { courses?: CourseData[] }) {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedExam, setSelectedExam] = useState("All");
  const [selectedSubject, setSelectedSubject] = useState("All");

  const exams = ["All", "NEET", "JEE Mains", "JEE Advanced", "Boards"];
  const subjects = ["All", "Physics", "Chemistry", "Biology", "Mathematics"];

  const filteredCourses = useMemo(() => {
    return courses.filter((c) => {
      const matchesSearch =
        !searchQuery ||
        c.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.subject.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.educators.toLowerCase().includes(searchQuery.toLowerCase());

      const matchesExam = selectedExam === "All" || (c.exam && c.exam.includes(selectedExam));
      const matchesSubject = selectedSubject === "All" || c.subject.toLowerCase() === selectedSubject.toLowerCase();

      return matchesSearch && matchesExam && matchesSubject;
    });
  }, [courses, searchQuery, selectedExam, selectedSubject]);

  return (
    <div className="space-y-6">
      {/* 1. Hero Banner */}
      <section className="bg-[#031635] text-white rounded-3xl p-6 sm:p-10 relative overflow-hidden flex flex-col justify-center min-h-[220px] shadow-lg shadow-navy-950/20">
        <div className="relative z-10 max-w-2xl space-y-2">
          <div className="flex items-center gap-2">
            <span className="bg-[#9ff5c1] text-[#005231] font-extrabold text-[10px] px-2.5 py-0.5 rounded-full uppercase tracking-wider">
              Atomic Pathshala Admissions Open
            </span>
          </div>
          <h1 className="text-2xl sm:text-4xl font-extrabold tracking-tight">
            Prepare Smarter. Score Higher.
          </h1>
          <p className="text-xs sm:text-base text-slate-300 leading-relaxed max-w-xl">
            Explore India&apos;s most structured NEET, JEE, and Board batches with India&apos;s leading faculty.
          </p>
        </div>
      </section>

      {/* 2. Global Search Bar */}
      <div className="relative">
        <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 text-xl">
          search
        </span>
        <input
          type="text"
          placeholder="Search courses, chapters, teachers (e.g. Chemistry, Physics, Biology)..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full pl-12 pr-4 py-3.5 bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-2xl text-xs sm:text-sm text-[#031635] dark:text-white font-medium shadow-sm focus:border-[#6b46c1] focus:ring-2 focus:ring-[#6b46c1]/20 outline-none transition"
        />
        {searchQuery && (
          <button
            type="button"
            onClick={() => setSearchQuery("")}
            className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
          >
            ✕
          </button>
        )}
      </div>

      {/* 3. Filter Controls */}
      <div className="space-y-3">
        {/* Exam Filters */}
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-1">
          <span className="text-xs font-bold text-slate-400 uppercase tracking-wider mr-1 shrink-0">
            Exam:
          </span>
          {exams.map((ex) => (
            <button
              key={ex}
              type="button"
              onClick={() => setSelectedExam(ex)}
              className={`px-4 py-1.5 rounded-full text-xs font-bold transition whitespace-nowrap ${
                selectedExam === ex
                  ? "bg-[#031635] dark:bg-primary text-white shadow-sm"
                  : "bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:border-slate-400"
              }`}
            >
              {ex}
            </button>
          ))}
        </div>

        {/* Subject Filters */}
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-1">
          <span className="text-xs font-bold text-slate-400 uppercase tracking-wider mr-1 shrink-0">
            Subject:
          </span>
          {subjects.map((sub) => (
            <button
              key={sub}
              type="button"
              onClick={() => setSelectedSubject(sub)}
              className={`px-3.5 py-1 rounded-full text-xs font-semibold transition whitespace-nowrap ${
                selectedSubject === sub
                  ? "bg-[#6b46c1] text-white shadow-sm"
                  : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200"
              }`}
            >
              {sub}
            </button>
          ))}
        </div>
      </div>

      {/* 4. Course Grid */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-base sm:text-lg font-extrabold text-[#031635] dark:text-white">
            Available Batches ({filteredCourses.length})
          </h2>
        </div>

        {filteredCourses.length === 0 ? (
          <div className="p-12 text-center bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 space-y-3">
            <span className="material-symbols-outlined text-4xl text-slate-300">school</span>
            <p className="text-sm font-bold text-[#031635] dark:text-white">
              {courses.length === 0
                ? "No active batches published yet"
                : "No batches found matching your criteria"}
            </p>
            <p className="text-xs text-slate-500 max-w-md mx-auto">
              {courses.length === 0
                ? "New batches will appear here as soon as they are launched by the academic team."
                : "Try resetting filters or searching with a different term."}
            </p>
            {courses.length > 0 && (
              <button
                type="button"
                onClick={() => {
                  setSearchQuery("");
                  setSelectedExam("All");
                  setSelectedSubject("All");
                }}
                className="text-xs font-bold text-[#6b46c1] hover:underline"
              >
                Clear all filters
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredCourses.map((c) => (
              <CourseCard key={c.id} course={c} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
