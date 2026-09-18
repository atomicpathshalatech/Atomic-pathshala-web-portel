"use client";

import React, { useState, useMemo } from "react";
import { CourseCard, CourseData } from "./CourseCard";

export function CourseListingMasterView({ courses = [] }: { courses?: CourseData[] }) {
  const [selectedExam, setSelectedExam] = useState("All");
  const [selectedSubject, setSelectedSubject] = useState("All");

  const exams = ["All", "NEET", "JEE Mains", "JEE Advanced", "Boards"];
  const subjects = ["All", "Physics", "Chemistry", "Biology", "Mathematics"];

  const filteredCourses = useMemo(() => {
    return courses.filter((c) => {
      const matchesExam =
        selectedExam === "All" ||
        (c.exam && c.exam.toLowerCase().includes(selectedExam.toLowerCase()));
      const matchesSubject =
        selectedSubject === "All" ||
        (c.subject && c.subject.toLowerCase() === selectedSubject.toLowerCase());

      return matchesExam && matchesSubject;
    });
  }, [courses, selectedExam, selectedSubject]);

  return (
    <div className="space-y-4">
      {/* Sleek Compact Dropdown Filter Bar */}
      <div className="flex items-center justify-between gap-3 flex-wrap bg-white/70 dark:bg-slate-900/70 backdrop-blur-md p-3 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-2xs">
        <div className="flex items-center gap-2.5 flex-wrap">
          {/* Exam Dropdown */}
          <div className="flex items-center gap-2 bg-slate-50 dark:bg-slate-800/90 border border-slate-200/90 dark:border-slate-700/80 rounded-xl px-3 py-1.5 shadow-2xs">
            <span className="material-symbols-outlined text-slate-400 text-[16px]">school</span>
            <label htmlFor="exam-select" className="text-[11px] font-extrabold text-slate-400 uppercase tracking-wider">
              Exam:
            </label>
            <select
              id="exam-select"
              value={selectedExam}
              onChange={(e) => setSelectedExam(e.target.value)}
              className="bg-transparent text-xs font-bold text-slate-800 dark:text-slate-200 outline-none cursor-pointer pr-1"
            >
              {exams.map((ex) => (
                <option
                  key={ex}
                  value={ex}
                  className="bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200"
                >
                  {ex === "All" ? "All Exams" : ex}
                </option>
              ))}
            </select>
          </div>

          {/* Subject Dropdown */}
          <div className="flex items-center gap-2 bg-slate-50 dark:bg-slate-800/90 border border-slate-200/90 dark:border-slate-700/80 rounded-xl px-3 py-1.5 shadow-2xs">
            <span className="material-symbols-outlined text-slate-400 text-[16px]">menu_book</span>
            <label htmlFor="subject-select" className="text-[11px] font-extrabold text-slate-400 uppercase tracking-wider">
              Subject:
            </label>
            <select
              id="subject-select"
              value={selectedSubject}
              onChange={(e) => setSelectedSubject(e.target.value)}
              className="bg-transparent text-xs font-bold text-slate-800 dark:text-slate-200 outline-none cursor-pointer pr-1"
            >
              {subjects.map((sub) => (
                <option
                  key={sub}
                  value={sub}
                  className="bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200"
                >
                  {sub === "All" ? "All Subjects" : sub}
                </option>
              ))}
            </select>
          </div>

          {(selectedExam !== "All" || selectedSubject !== "All") && (
            <button
              type="button"
              onClick={() => {
                setSelectedExam("All");
                setSelectedSubject("All");
              }}
              className="text-xs font-bold text-orange-600 hover:text-orange-700 dark:text-orange-400 hover:underline px-2 py-1 cursor-pointer"
            >
              Reset Filters
            </button>
          )}
        </div>

        <div className="text-xs font-bold text-slate-500 dark:text-slate-400">
          Showing <span className="text-slate-900 dark:text-white font-extrabold">{filteredCourses.length}</span>{" "}
          {filteredCourses.length === 1 ? "Batch" : "Batches"}
        </div>
      </div>

      {/* Course Cards Grid */}
      <section className="space-y-4">
        {filteredCourses.length === 0 ? (
          <div className="p-10 text-center bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 space-y-3 shadow-2xs">
            <span className="material-symbols-outlined text-4xl text-slate-300 dark:text-slate-600">
              search_off
            </span>
            <p className="text-sm font-bold text-slate-900 dark:text-white">
              {courses.length === 0
                ? "No batches published yet"
                : "No batches found matching your selected filters"}
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md mx-auto">
              {courses.length === 0
                ? "New batches will appear here as soon as they are launched."
                : "Try selecting All Exams or All Subjects."}
            </p>
            {courses.length > 0 && (
              <button
                type="button"
                onClick={() => {
                  setSelectedExam("All");
                  setSelectedSubject("All");
                }}
                className="text-xs font-bold text-blue-600 dark:text-blue-400 hover:underline cursor-pointer"
              >
                Clear all filters
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
            {filteredCourses.map((c, idx) => (
              <CourseCard key={c.id} course={c} index={idx} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
