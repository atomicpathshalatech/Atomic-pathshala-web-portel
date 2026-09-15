"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { generateSlug } from "@/lib/teacher/profile";

export interface DirectoryTeacher {
  id: string;
  department: string;
  displayName: string | null;
  subjects: string[];
  targetExams: string[];
  classes: string[];
  languages: string[];
  experienceYears: string | null;
  qualifications: any;
  user: {
    id: string;
    name: string | null;
    photoUrl: string | null;
    email: string;
  };
  badges: Array<{
    id: string;
    title: string;
    icon: string | null;
  }>;
  batchAssignments: Array<{
    batch: { id: string; name: string };
  }>;
  followers: Array<{ id: string }>;
}

const EXAM_CATEGORIES = [
  { id: "all", label: "All Educators", icon: "groups" },
  { id: "neet", label: "NEET", icon: "medical_services" },
  { id: "jee", label: "JEE Main & Adv", icon: "engineering" },
  { id: "foundation", label: "Foundation (9-10)", icon: "auto_stories" },
  { id: "boards", label: "Class 11-12 / Boards", icon: "menu_book" },
];

const SUBJECT_FILTERS = [
  "All Subjects",
  "Physics",
  "Chemistry",
  "Biology",
  "Mathematics",
  "Botany",
  "Zoology",
];

export function FacultyDirectoryList({ teachers }: { teachers: DirectoryTeacher[] }) {
  const [activeCategory, setActiveCategory] = useState("all");
  const [activeSubject, setActiveSubject] = useState("All Subjects");
  const [searchQuery, setSearchQuery] = useState("");

  const filteredTeachers = useMemo(() => {
    return teachers.filter((teacher) => {
      const name = teacher.user.name || "";
      const headline = teacher.displayName || "";
      const dept = teacher.department || "";
      const subjects = teacher.subjects || [];
      const exams = teacher.targetExams || [];
      const classes = teacher.classes || [];

      // 1. Category Filter
      if (activeCategory === "neet") {
        const matchesNeet =
          exams.some((e) => e.toLowerCase().includes("neet")) ||
          headline.toLowerCase().includes("neet") ||
          dept.toLowerCase().includes("biology");
        if (!matchesNeet) return false;
      } else if (activeCategory === "jee") {
        const matchesJee =
          exams.some((e) => e.toLowerCase().includes("jee")) ||
          headline.toLowerCase().includes("jee");
        if (!matchesJee) return false;
      } else if (activeCategory === "foundation") {
        const matchesFoundation =
          exams.some((e) => e.toLowerCase().includes("foundation")) ||
          classes.some((c) => c.toLowerCase().includes("9") || c.toLowerCase().includes("10")) ||
          headline.toLowerCase().includes("foundation");
        if (!matchesFoundation) return false;
      } else if (activeCategory === "boards") {
        const matchesBoards =
          exams.some((e) => e.toLowerCase().includes("board") || e.toLowerCase().includes("11-12")) ||
          classes.some((c) => c.toLowerCase().includes("11") || c.toLowerCase().includes("12")) ||
          headline.toLowerCase().includes("board");
        if (!matchesBoards) return false;
      }

      // 2. Subject Filter
      if (activeSubject !== "All Subjects") {
        const subjectLower = activeSubject.toLowerCase();
        const matchesSubject =
          subjects.some((s) => s.toLowerCase().includes(subjectLower)) ||
          dept.toLowerCase().includes(subjectLower) ||
          headline.toLowerCase().includes(subjectLower);
        if (!matchesSubject) return false;
      }

      // 3. Search Query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchesSearch =
          name.toLowerCase().includes(q) ||
          headline.toLowerCase().includes(q) ||
          dept.toLowerCase().includes(q) ||
          subjects.some((s) => s.toLowerCase().includes(q)) ||
          exams.some((e) => e.toLowerCase().includes(q));
        if (!matchesSearch) return false;
      }

      return true;
    });
  }, [teachers, activeCategory, activeSubject, searchQuery]);

  return (
    <section className="space-y-6">
      {/* Search & Category Filter Section */}
      <div className="bg-white dark:bg-[#111625] rounded-3xl p-4 sm:p-6 border border-slate-200/90 dark:border-slate-800 shadow-sm space-y-4">
        {/* Search Bar */}
        <div className="relative">
          <span className="material-symbols-outlined absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 text-xl pointer-events-none">
            search
          </span>
          <input
            type="text"
            placeholder="Search educators by name, subject, or exam..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-11 pr-10 py-3 rounded-2xl bg-slate-50 dark:bg-slate-900 border border-slate-200/80 dark:border-slate-700/80 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 transition-all"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
            >
              <span className="material-symbols-outlined text-lg">close</span>
            </button>
          )}
        </div>

        {/* Category Tabs */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
          {EXAM_CATEGORIES.map((cat) => {
            const isActive = activeCategory === cat.id;
            return (
              <button
                key={cat.id}
                onClick={() => setActiveCategory(cat.id)}
                className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold transition-all shrink-0 ${
                  isActive
                    ? "bg-blue-600 text-white shadow-md shadow-blue-600/25 ring-2 ring-blue-600/30"
                    : "bg-slate-100 dark:bg-slate-800/80 text-slate-600 dark:text-slate-300 hover:bg-slate-200/70 dark:hover:bg-slate-700/70"
                }`}
              >
                <span className="material-symbols-outlined text-sm">{cat.icon}</span>
                <span>{cat.label}</span>
              </button>
            );
          })}
        </div>

        {/* Subject Filter Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none pt-1 border-t border-slate-100 dark:border-slate-800/60">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider shrink-0 mr-1">
            Subject:
          </span>
          {SUBJECT_FILTERS.map((sub) => {
            const isActive = activeSubject === sub;
            return (
              <button
                key={sub}
                onClick={() => setActiveSubject(sub)}
                className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all shrink-0 ${
                  isActive
                    ? "bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-bold"
                    : "bg-slate-50 dark:bg-slate-900 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white border border-slate-200/60 dark:border-slate-800"
                }`}
              >
                {sub}
              </button>
            );
          })}
        </div>
      </div>

      {/* Results Header */}
      <div className="flex items-center justify-between px-1">
        <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
          <span className="material-symbols-outlined text-blue-600 dark:text-blue-400 text-lg">
            group
          </span>
          <span>Verified Educators</span>
        </h2>
        <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
          {filteredTeachers.length} of {teachers.length} Educators
        </span>
      </div>

      {/* Faculty Cards Grid */}
      {filteredTeachers.length === 0 ? (
        <div className="p-12 text-center bg-white dark:bg-[#111625] rounded-3xl border border-slate-200 dark:border-slate-800 space-y-3">
          <span className="material-symbols-outlined text-4xl text-slate-400">
            search_off
          </span>
          <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">
            No educators found matching your criteria.
          </p>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Try switching category tabs or clearing your search.
          </p>
          <button
            onClick={() => {
              setActiveCategory("all");
              setActiveSubject("All Subjects");
              setSearchQuery("");
            }}
            className="mt-2 inline-flex items-center gap-1.5 px-4 py-2 bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 rounded-xl text-xs font-bold border border-blue-200 dark:border-blue-800 hover:bg-blue-100 transition-colors"
          >
            <span className="material-symbols-outlined text-sm">restart_alt</span>
            <span>Reset All Filters</span>
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredTeachers.map((teacher) => {
            const name = teacher.user.name || "Faculty Member";
            const slug = generateSlug(name);
            const primarySubject =
              teacher.subjects && teacher.subjects.length > 0
                ? teacher.subjects.join(", ")
                : teacher.department || "Faculty";
            const followerCount = teacher.followers.length;
            const badgesCount = teacher.badges.length;

            // Headline / Display Name
            const headline =
              teacher.displayName ||
              (teacher.targetExams && teacher.targetExams.length > 0
                ? `${primarySubject} Faculty | ${teacher.targetExams.join(" & ")}`
                : `${primarySubject} Faculty`);

            // Qualifications summary
            let qualSummary = "";
            if (Array.isArray(teacher.qualifications) && teacher.qualifications.length > 0) {
              qualSummary = (teacher.qualifications as any[])
                .map((q) => q.degree)
                .filter(Boolean)
                .join(", ");
            }

            return (
              <Link
                key={teacher.id}
                href={`/teachers/${slug}`}
                className="bg-white dark:bg-[#111625] rounded-3xl p-6 border border-slate-200/90 dark:border-slate-800 shadow-sm hover:border-blue-500/60 dark:hover:border-blue-500/60 transition-all hover:-translate-y-1 hover:shadow-md flex flex-col justify-between gap-5 group"
              >
                <div className="space-y-4">
                  {/* Top Header */}
                  <div className="flex items-start gap-3.5">
                    <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-500/10 to-blue-600/20 text-blue-600 dark:text-blue-400 flex items-center justify-center font-extrabold text-xl border border-blue-100 dark:border-blue-900/50 shadow-sm shrink-0 overflow-hidden">
                      {teacher.user.photoUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={teacher.user.photoUrl}
                          alt={name}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        name
                          .split(" ")
                          .map((p) => p[0])
                          .slice(0, 2)
                          .join("")
                          .toUpperCase()
                      )}
                    </div>

                    <div className="space-y-1 min-w-0 flex-1">
                      <h3 className="font-extrabold text-base text-slate-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors truncate">
                        {name}
                      </h3>
                      <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 line-clamp-1">
                        {headline}
                      </p>
                      <div className="pt-0.5">
                        <span className="inline-block text-[11px] font-bold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/60 px-2 py-0.5 rounded-md">
                          {primarySubject}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Target Exams & Classes Badges */}
                  <div className="space-y-2 text-xs text-slate-600 dark:text-slate-300">
                    {/* Exam chips */}
                    {teacher.targetExams && teacher.targetExams.length > 0 && (
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {teacher.targetExams.map((exam) => (
                          <span
                            key={exam}
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-blue-50/70 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 text-[11px] font-semibold border border-blue-200/50 dark:border-blue-800/50"
                          >
                            <span className="material-symbols-outlined text-[12px]">flag</span>
                            <span>{exam}</span>
                          </span>
                        ))}
                      </div>
                    )}

                    {/* Classes chips */}
                    {teacher.classes && teacher.classes.length > 0 && (
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {teacher.classes.map((cls) => (
                          <span
                            key={cls}
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-[11px] font-semibold"
                          >
                            <span className="material-symbols-outlined text-[12px]">school</span>
                            <span>{cls}</span>
                          </span>
                        ))}
                      </div>
                    )}

                    {/* Qualifications & Experience */}
                    <div className="pt-1 space-y-1.5 border-t border-slate-100 dark:border-slate-800/60 text-xs">
                      {qualSummary && (
                        <div className="flex items-center gap-1.5 truncate">
                          <span className="material-symbols-outlined text-sm text-slate-400 shrink-0">
                            history_edu
                          </span>
                          <span className="truncate">{qualSummary}</span>
                        </div>
                      )}

                      {teacher.experienceYears && (
                        <div className="flex items-center gap-1.5">
                          <span className="material-symbols-outlined text-sm text-slate-400 shrink-0">
                            work_history
                          </span>
                          <span>{teacher.experienceYears} Years Experience</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Bottom Action */}
                <div className="pt-3 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between">
                  <div className="flex items-center gap-2 text-[11px] text-slate-500 font-semibold">
                    {followerCount > 0 && <span>{followerCount} Followers</span>}
                    {badgesCount > 0 && <span>• {badgesCount} Badges</span>}
                  </div>

                  <span className="inline-flex items-center gap-1 text-xs font-bold text-blue-600 dark:text-blue-400 group-hover:translate-x-0.5 transition-transform">
                    <span>View Profile</span>
                    <span className="material-symbols-outlined text-sm">arrow_forward</span>
                  </span>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </section>
  );
}
