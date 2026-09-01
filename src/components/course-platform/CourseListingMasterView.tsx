"use client";

import React, { useState, useMemo } from "react";
import { CourseCard, CourseData } from "./CourseCard";

export const SAMPLE_COURSES: CourseData[] = [
  {
    id: "c-yodha-chem-2027",
    slug: "yodha-chemistry-neet-2027",
    title: "YODHA Chemistry Batch for NEET 2027",
    subtitle: "Complete NCERT Class 11 & 12 Chemistry preparation with structured live + recorded classes.",
    exam: "NEET",
    examYear: "2027",
    subject: "Chemistry",
    courseType: "Full Syllabus",
    language: "Hinglish",
    educators: "By Sonu Bhaiya & Dr. Priya Sharma",
    duration: "12 Months",
    classesCount: 128,
    testsCount: 21,
    studentsCount: 805,
    price: 4700,
    originalPrice: 5500,
    discountPercentage: 15,
    isNewBatch: true,
    thumbnailUrl:
      "https://lh3.googleusercontent.com/aida-public/AB6AXuD7YAZXVaHigh3RrfotJ1dphorsBl-gSAYvezYpMeV9rQSbQKvPk-AIGgvAUIs_j2OwoO9mv1RtVt-gCvSEP_621X3MnJUCxljXh4RIY-I6RaAwuw1s2rbJcbhRmE4zZjf-Kggrln5NK6LDAzGkCCjaRiQg-wlkb4AQglZ6CtSX0C6SOktuBjAPPjgF7jbnrTLR698i6gAjdpvYGjyIQzSwQYShpDlSqaTeKmUrHC3GKWAEUHK02G85AQ",
  },
  {
    id: "c-prahar-phy-2026",
    slug: "prahar-physics-jee-2026",
    title: "PRAHAR Physics Batch for JEE 2026",
    subtitle: "Advanced Mechanics, Electromagnetism, Optics & Modern Physics with JEE Advanced problem-solving.",
    exam: "JEE Mains",
    examYear: "2026",
    subject: "Physics",
    courseType: "Full Syllabus",
    language: "English",
    educators: "By Rajeev Sir",
    duration: "18 Months",
    classesCount: 150,
    testsCount: 30,
    studentsCount: 1240,
    price: 5200,
    originalPrice: 6000,
    discountPercentage: 13,
    isNewBatch: true,
    thumbnailUrl:
      "https://lh3.googleusercontent.com/aida-public/AB6AXuC5ktTrIRpcdo4b2S3Rb-l69bUtwaKMLFyvDWFclrVX1_J6NTPOe4HC03SFr12Dd-yNYK5YnecJET1c5K2kU4Y3-sa1QbBJ5b0k2LO9li5qbqq87FcJHKrsZ0PySNYtVCNNMg_lHoS5pYpKnNW3xdjs8M-dO1DWGdwNEOWsoc4zTIRFcMSXQrwISZiZOtRZGnA5HxIEaIXsBBeCleS7Yc31vnDtIG2a80rCnn3OXtInJ0HoGkG2z-Jw0w",
  },
  {
    id: "c-victor-bio-2027",
    slug: "victor-biology-neet-2027",
    title: "VICTOR Complete Biology for NEET 2027",
    subtitle: "100% NCERT Line-by-Line Botany & Zoology with Diagram mastery and 360/360 target roadmap.",
    exam: "NEET",
    examYear: "2027",
    subject: "Biology",
    courseType: "Full Syllabus",
    language: "Hinglish",
    educators: "By Dr. Ananya Verma",
    duration: "12 Months",
    classesCount: 140,
    testsCount: 25,
    studentsCount: 950,
    price: 4500,
    originalPrice: 5500,
    discountPercentage: 18,
    isNewBatch: false,
    thumbnailUrl:
      "https://lh3.googleusercontent.com/aida-public/AB6AXuA55rkd5wCltZobTytnsHzMyuy8waC1hw-J_L-zUTj5m0d0y1tJ19GdKzVawO1-j1UY4Ig2rH6TApo6BSKTsKzwZR9e25Gv9-dfkNm3vXfQRFMCGe8pSK6wq-hksTUzspyp3E0H22n8Ni8Kez8nEppOr_ahBNRCqwyZRdZTvMFzrlzd5cR_zERfcsvwnS0O24Q1ZWn5gkixq1MM_5B4OraSGu7fdEvScZz8rc6jps0X0suSHy_TR9jVuw",
  },
  {
    id: "c-sankalp-math-2027",
    slug: "sankalp-mathematics-jee-2027",
    title: "SANKALP Mathematics for JEE 2027",
    subtitle: "Complete Algebra, Calculus, Coordinate Geometry & Vectors with shortcut tricks.",
    exam: "JEE Mains",
    examYear: "2027",
    subject: "Mathematics",
    courseType: "Full Syllabus",
    language: "Hinglish",
    educators: "By Amit Sir",
    duration: "12 Months",
    classesCount: 135,
    testsCount: 24,
    studentsCount: 680,
    price: 4800,
    originalPrice: 5800,
    discountPercentage: 17,
    isNewBatch: true,
    thumbnailUrl:
      "https://lh3.googleusercontent.com/aida-public/AB6AXuASsGXjxZqFMcdUTyW5GdJI6W5tJItNmN_IF4AhjwHvjK9V05a2ge4zc_mW93P5kbIcmx3kLLS28KT-lUTUMFnGmzs8gdQ8CPVjtXxUxiACaVR_--I7NloIj2j-aQMG3hY-WulS4IFD0LvaLOlCGexgOLSooKFB9a3gNrUjKPxDBCUuq4qA7CoOeQgcMn_1ivGeCWZ0hoe6LMMye8FIAJZgXwBtle5AEwPAcRd_5BZIwbySN1azeRsOHA",
  },
];

export function CourseListingMasterView() {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedExam, setSelectedExam] = useState("All");
  const [selectedSubject, setSelectedSubject] = useState("All");
  const [selectedYear, setSelectedYear] = useState("All");
  const [selectedType, setSelectedType] = useState("All");

  const exams = ["All", "NEET", "JEE Mains", "JEE Advanced", "Boards"];
  const subjects = ["All", "Physics", "Chemistry", "Biology", "Mathematics"];
  const years = ["All", "2027", "2026", "2028"];
  const courseTypes = ["All", "Full Syllabus", "Chapter-wise", "Crash Course", "Test Series"];

  const filteredCourses = useMemo(() => {
    return SAMPLE_COURSES.filter((c) => {
      const matchesSearch =
        c.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.subject.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.educators.toLowerCase().includes(searchQuery.toLowerCase());

      const matchesExam = selectedExam === "All" || c.exam.includes(selectedExam);
      const matchesSubject = selectedSubject === "All" || c.subject.toLowerCase() === selectedSubject.toLowerCase();
      const matchesYear = selectedYear === "All" || c.examYear === selectedYear;
      const matchesType = selectedType === "All" || c.courseType.toLowerCase() === selectedType.toLowerCase();

      return matchesSearch && matchesExam && matchesSubject && matchesYear && matchesType;
    });
  }, [searchQuery, selectedExam, selectedSubject, selectedYear, selectedType]);

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
          placeholder="Search courses, chapters, teachers (e.g. Chemistry, Sonu Bhaiya, Thermodynamics)..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full pl-12 pr-4 py-3.5 bg-white border border-slate-200/90 rounded-2xl text-xs sm:text-sm text-[#031635] font-medium shadow-sm focus:border-[#6b46c1] focus:ring-2 focus:ring-[#6b46c1]/20 outline-none transition"
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
                  ? "bg-[#031635] text-white shadow-sm"
                  : "bg-white border border-slate-200 text-slate-600 hover:border-slate-400"
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
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
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
          <h2 className="text-base sm:text-lg font-extrabold text-[#031635]">
            Featured Courses & Batches ({filteredCourses.length})
          </h2>
          <span className="text-xs text-slate-500 font-medium">Sorted by Popularity</span>
        </div>

        {filteredCourses.length === 0 ? (
          <div className="p-12 text-center bg-white rounded-3xl border border-slate-200 space-y-3">
            <span className="material-symbols-outlined text-4xl text-slate-300">search_off</span>
            <p className="text-sm font-bold text-[#031635]">No courses found matching your criteria</p>
            <button
              type="button"
              onClick={() => {
                setSearchQuery("");
                setSelectedExam("All");
                setSelectedSubject("All");
                setSelectedYear("All");
                setSelectedType("All");
              }}
              className="text-xs font-bold text-[#6b46c1] hover:underline"
            >
              Clear all filters
            </button>
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