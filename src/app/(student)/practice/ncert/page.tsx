"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

interface NcertClass {
  id: string;
  name: string;
  numericValue: number;
  documentCount: number;
}

interface NcertSubject {
  id: string;
  name: string;
  nameHindi: string | null;
  code: string | null;
  documentCount: number;
}

interface NcertChapter {
  id: string;
  chapterNumber: number;
  title: string;
  titleHindi: string | null;
  displayTitle: string;
  availableLanguages: string[];
  documents: { id: string; language: string; totalPages: number }[];
  hasContent: boolean;
}

interface LanguageOption {
  language: "ENGLISH" | "HINDI";
  label: string;
  documentId: string | null;
  available: boolean;
  totalPages: number;
}

export default function NcertSelectionPage() {
  const router = useRouter();

  // Selection states
  const [classes, setClasses] = useState<NcertClass[]>([]);
  const [selectedClass, setSelectedClass] = useState<NcertClass | null>(null);

  const [subjects, setSubjects] = useState<NcertSubject[]>([]);
  const [selectedSubject, setSelectedSubject] = useState<NcertSubject | null>(null);

  const [chapters, setChapters] = useState<NcertChapter[]>([]);
  const [selectedChapter, setSelectedChapter] = useState<NcertChapter | null>(null);

  const [languages, setLanguages] = useState<LanguageOption[]>([]);
  const [selectedLanguage, setSelectedLanguage] = useState<"ENGLISH" | "HINDI" | null>(null);

  const [loadingClasses, setLoadingClasses] = useState(true);
  const [loadingSubjects, setLoadingSubjects] = useState(false);
  const [loadingChapters, setLoadingChapters] = useState(false);
  const [loadingLanguages, setLoadingLanguages] = useState(false);

  // 1. Fetch Classes on mount
  useEffect(() => {
    async function loadClasses() {
      setLoadingClasses(true);
      try {
        const res = await fetch("/api/ncert/classes");
        const data = await res.json();
        if (data.classes && data.classes.length > 0) {
          setClasses(data.classes);
          // Default to Class 11 if available
          const c11 = data.classes.find((c: NcertClass) => c.numericValue === 11) || data.classes[0];
          setSelectedClass(c11);
        }
      } catch (err) {
        console.error("Failed to load NCERT classes:", err);
      } finally {
        setLoadingClasses(false);
      }
    }
    loadClasses();
  }, []);

  // 2. Fetch Subjects when selectedClass changes
  useEffect(() => {
    if (!selectedClass) {
      setSubjects([]);
      setSelectedSubject(null);
      return;
    }

    const classId = selectedClass.id;
    async function loadSubjects() {
      setLoadingSubjects(true);
      try {
        const res = await fetch(`/api/ncert/subjects?classId=${classId}`);
        const data = await res.json();
        if (data.subjects && data.subjects.length > 0) {
          setSubjects(data.subjects);
          // Auto-select Biology if available, else first subject
          const bio = data.subjects.find((s: NcertSubject) => s.name.toLowerCase() === "biology") || data.subjects[0];
          setSelectedSubject(bio);
        } else {
          setSubjects([]);
          setSelectedSubject(null);
        }
      } catch (err) {
        console.error("Failed to load subjects:", err);
      } finally {
        setLoadingSubjects(false);
      }
    }
    loadSubjects();
  }, [selectedClass]);

  // 3. Fetch Chapters when selectedSubject changes
  useEffect(() => {
    if (!selectedSubject) {
      setChapters([]);
      setSelectedChapter(null);
      return;
    }

    const subjectId = selectedSubject.id;
    async function loadChapters() {
      setLoadingChapters(true);
      try {
        const res = await fetch(`/api/ncert/chapters?subjectId=${subjectId}`);
        const data = await res.json();
        if (data.chapters && data.chapters.length > 0) {
          setChapters(data.chapters);
          // Auto-select chapter 1 (or first available chapter with content)
          const firstWithContent = data.chapters.find((ch: NcertChapter) => ch.hasContent) || data.chapters[0];
          setSelectedChapter(firstWithContent);
        } else {
          setChapters([]);
          setSelectedChapter(null);
        }
      } catch (err) {
        console.error("Failed to load chapters:", err);
      } finally {
        setLoadingChapters(false);
      }
    }
    loadChapters();
  }, [selectedSubject]);

  // 4. Fetch Languages when selectedChapter changes
  useEffect(() => {
    if (!selectedChapter) {
      setLanguages([]);
      setSelectedLanguage(null);
      return;
    }

    const chapterId = selectedChapter.id;
    async function loadLanguages() {
      setLoadingLanguages(true);
      try {
        const res = await fetch(`/api/ncert/languages?chapterId=${chapterId}`);
        const data = await res.json();
        if (data.languages && data.languages.length > 0) {
          setLanguages(data.languages);
          // Auto-select first available language
          const firstAvail = data.languages.find((l: LanguageOption) => l.available);
          setSelectedLanguage(firstAvail ? firstAvail.language : "ENGLISH");
        } else {
          setLanguages([]);
          setSelectedLanguage(null);
        }
      } catch (err) {
        console.error("Failed to load languages:", err);
      } finally {
        setLoadingLanguages(false);
      }
    }
    loadLanguages();
  }, [selectedChapter]);

  // Find targeted document ID based on selected language
  const activeDocumentId = languages.find((l) => l.language === selectedLanguage)?.documentId;

  const handleStartPractice = () => {
    if (activeDocumentId) {
      router.push(`/practice/ncert/${activeDocumentId}`);
    }
  };

  return (
    <div className="mx-auto max-w-4xl space-y-6 px-3 py-4 sm:px-6">
      {/* Header breadcrumb & title */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <Link href="/dashboard" className="hover:text-blue-600 transition-colors">
              Dashboard
            </Link>
            <span>/</span>
            <Link href="/practice" className="hover:text-blue-600 transition-colors">
              Practice
            </Link>
            <span>/</span>
            <span className="font-semibold text-emerald-600">NCERT Question Practice</span>
          </div>
          <h1 className="mt-1.5 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
            NCERT Question Practice
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            Select your class, subject, chapter, and language to start page-by-page NCERT reading and verified practice.
          </p>
        </div>

        <Link
          href="/dashboard"
          className="inline-flex h-9 items-center gap-1 rounded-xl border border-slate-200 bg-white px-3 text-xs font-medium text-slate-700 shadow-sm hover:bg-slate-50"
        >
          <span className="material-symbols-outlined text-base">close</span>
          <span>Exit</span>
        </Link>
      </div>

      <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm space-y-6 sm:p-7">
        {/* STEP 1: CHOOSE CLASS */}
        <div className="space-y-2.5">
          <div className="flex items-center gap-2">
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-100 text-xs font-bold text-emerald-700">
              1
            </span>
            <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-800">
              Select Class
            </h2>
          </div>

          {loadingClasses ? (
            <div className="flex gap-3">
              <div className="h-12 w-32 animate-pulse rounded-xl bg-slate-100" />
              <div className="h-12 w-32 animate-pulse rounded-xl bg-slate-100" />
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:w-80">
              {classes.map((cls) => {
                const isSelected = selectedClass?.id === cls.id;
                return (
                  <button
                    key={cls.id}
                    type="button"
                    onClick={() => setSelectedClass(cls)}
                    className={`flex items-center justify-between rounded-xl border p-3.5 text-left transition-all ${
                      isSelected
                        ? "border-emerald-600 bg-emerald-50/50 text-emerald-900 ring-2 ring-emerald-500/20 shadow-sm font-semibold"
                        : "border-slate-200 hover:border-slate-300 hover:bg-slate-50/50 text-slate-800"
                    }`}
                  >
                    <div>
                      <span className="block text-sm">{cls.name}</span>
                      <span className="block text-[11px] text-slate-500">
                        {cls.numericValue === 11 ? "NEET / JEE 1st Year" : "NEET / JEE 2nd Year"}
                      </span>
                    </div>
                    {isSelected && (
                      <span className="material-symbols-outlined text-emerald-600 text-lg">check_circle</span>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <hr className="border-slate-100" />

        {/* STEP 2: CHOOSE SUBJECT */}
        <div className="space-y-2.5">
          <div className="flex items-center gap-2">
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-100 text-xs font-bold text-emerald-700">
              2
            </span>
            <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-800">
              Select Subject
            </h2>
          </div>

          {loadingSubjects ? (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="h-14 animate-pulse rounded-xl bg-slate-100" />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {subjects.map((sub) => {
                const isSelected = selectedSubject?.id === sub.id;
                return (
                  <button
                    key={sub.id}
                    type="button"
                    onClick={() => setSelectedSubject(sub)}
                    className={`flex flex-col rounded-xl border p-3.5 text-left transition-all ${
                      isSelected
                        ? "border-emerald-600 bg-emerald-50/50 text-emerald-900 ring-2 ring-emerald-500/20 shadow-sm font-semibold"
                        : "border-slate-200 hover:border-slate-300 hover:bg-slate-50/50 text-slate-800"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-semibold">{sub.name}</span>
                      {isSelected && (
                        <span className="material-symbols-outlined text-emerald-600 text-base">check_circle</span>
                      )}
                    </div>
                    {sub.nameHindi && (
                      <span className="mt-0.5 text-xs text-slate-500">{sub.nameHindi}</span>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <hr className="border-slate-100" />

        {/* STEP 3: CHOOSE CHAPTER */}
        <div className="space-y-2.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-100 text-xs font-bold text-emerald-700">
                3
              </span>
              <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-800">
                Select Chapter
              </h2>
            </div>
            {chapters.length > 0 && (
              <span className="text-xs text-slate-500 font-medium">
                {chapters.length} NCERT Chapters
              </span>
            )}
          </div>

          {loadingChapters ? (
            <div className="space-y-2">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-12 animate-pulse rounded-xl bg-slate-100" />
              ))}
            </div>
          ) : (
            <div className="max-h-64 overflow-y-auto rounded-xl border border-slate-200/80 p-2 space-y-1.5 divide-y divide-slate-100">
              {chapters.map((ch) => {
                const isSelected = selectedChapter?.id === ch.id;
                return (
                  <button
                    key={ch.id}
                    type="button"
                    onClick={() => setSelectedChapter(ch)}
                    className={`w-full flex items-center justify-between rounded-lg px-3 py-2.5 text-left transition-all ${
                      isSelected
                        ? "bg-emerald-50 text-emerald-950 font-semibold"
                        : "hover:bg-slate-50 text-slate-800"
                    }`}
                  >
                    <div className="min-w-0 pr-3">
                      <div className="flex items-center gap-2">
                        <span className="inline-block shrink-0 rounded bg-slate-100 px-1.5 py-0.5 text-[11px] font-mono font-medium text-slate-600">
                          Ch {ch.chapterNumber}
                        </span>
                        <span className="truncate text-sm">{ch.title}</span>
                      </div>
                      {ch.titleHindi && (
                        <p className="ml-8 truncate text-xs text-slate-500">{ch.titleHindi}</p>
                      )}
                    </div>

                    <div className="flex shrink-0 items-center gap-2">
                      {ch.hasContent ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">
                          <span className="h-1 w-1 rounded-full bg-emerald-500" />
                          Ready
                        </span>
                      ) : (
                        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] text-slate-400">
                          Catalog
                        </span>
                      )}
                      {isSelected && (
                        <span className="material-symbols-outlined text-emerald-600 text-base">check</span>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <hr className="border-slate-100" />

        {/* STEP 4: CHOOSE LANGUAGE (After Chapter Selection) */}
        <div className="space-y-2.5">
          <div className="flex items-center gap-2">
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-100 text-xs font-bold text-emerald-700">
              4
            </span>
            <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-800">
              Select Language (माध्यम)
            </h2>
          </div>

          <p className="text-xs text-slate-500">
            Selected language opens the genuine NCERT source text and generates native language questions.
          </p>

          {loadingLanguages ? (
            <div className="flex gap-3">
              <div className="h-14 w-40 animate-pulse rounded-xl bg-slate-100" />
              <div className="h-14 w-40 animate-pulse rounded-xl bg-slate-100" />
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:w-96">
              {languages.map((lang) => {
                const isSelected = selectedLanguage === lang.language;
                return (
                  <button
                    key={lang.language}
                    type="button"
                    disabled={!lang.available}
                    onClick={() => setSelectedLanguage(lang.language)}
                    className={`flex items-center justify-between rounded-xl border p-3.5 text-left transition-all ${
                      isSelected
                        ? "border-emerald-600 bg-emerald-50/50 text-emerald-950 ring-2 ring-emerald-500/20 shadow-sm font-semibold"
                        : lang.available
                        ? "border-slate-200 hover:border-slate-300 hover:bg-slate-50/50 text-slate-800"
                        : "border-dashed border-slate-200 bg-slate-50/40 text-slate-400 cursor-not-allowed"
                    }`}
                  >
                    <div>
                      <span className="block text-sm font-medium">{lang.label}</span>
                      <span className="block text-[11px] text-slate-500">
                        {lang.available ? `${lang.totalPages} Pages available` : "Not yet uploaded"}
                      </span>
                    </div>
                    {isSelected && (
                      <span className="material-symbols-outlined text-emerald-600 text-base">check_circle</span>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Action Button */}
        <div className="pt-2">
          {activeDocumentId ? (
            <button
              type="button"
              onClick={handleStartPractice}
              className="w-full flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 py-3.5 px-6 text-sm font-semibold text-white shadow-md shadow-emerald-600/20 hover:brightness-105 active:scale-[0.99] transition-all"
            >
              <span>Open NCERT Reader &amp; Practice</span>
              <span className="material-symbols-outlined text-base">arrow_forward</span>
            </button>
          ) : (
            <div className="rounded-xl border border-dashed border-amber-200 bg-amber-50/60 p-4 text-center">
              <p className="text-xs font-semibold text-amber-800">
                {selectedChapter && !selectedChapter.hasContent
                  ? "This chapter's NCERT textbook is being processed by our academic team."
                  : "Please choose an available language to proceed."}
              </p>
              <p className="mt-1 text-[11px] text-amber-700">
                Try Class 11 Biology: "The Living World" for immediate practice in English or Hindi!
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
