"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { X, Search, BookOpen, Sparkles, CheckCircle2, ArrowRight } from "lucide-react";

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

  // Modal State: When a subject box is clicked, open modal popup
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [chapterSearchQuery, setChapterSearchQuery] = useState("");

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

  const handleOpenSubjectModal = (sub: NcertSubject) => {
    setSelectedSubject(sub);
    setChapterSearchQuery("");
    setIsModalOpen(true);
  };

  const handleStartPractice = () => {
    if (activeDocumentId) {
      router.push(`/practice/ncert/${activeDocumentId}`);
    }
  };

  const filteredChapters = chapters.filter(
    (ch) =>
      ch.title.toLowerCase().includes(chapterSearchQuery.toLowerCase()) ||
      (ch.titleHindi && ch.titleHindi.toLowerCase().includes(chapterSearchQuery.toLowerCase())) ||
      ch.chapterNumber.toString() === chapterSearchQuery.trim()
  );

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
            Select your class and subject box to open the full chapter list and begin page-by-page verified practice.
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
                      <span className="block text-sm font-bold">{cls.name}</span>
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

        {/* STEP 2: CHOOSE SUBJECT BOXES - DIRECTLY OPENS CHAPTER MODAL */}
        <div className="space-y-2.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-100 text-xs font-bold text-emerald-700">
                2
              </span>
              <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-800">
                Select Subject Box (Click to Open Chapters)
              </h2>
            </div>
            <span className="text-xs text-slate-400">Click any box to view all chapters</span>
          </div>

          {loadingSubjects ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="h-28 animate-pulse rounded-2xl bg-slate-100" />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
              {subjects.map((sub) => {
                const isSelected = selectedSubject?.id === sub.id;
                const isBiology = sub.name.toLowerCase().includes("bio");
                const isPhysics = sub.name.toLowerCase().includes("phy");
                const isChemistry = sub.name.toLowerCase().includes("chem");

                const icon = isBiology ? "🌿" : isPhysics ? "⚡" : isChemistry ? "🧪" : "📐";
                const bgGradient = isBiology
                  ? "from-emerald-50 to-teal-50 border-emerald-200"
                  : isPhysics
                  ? "from-blue-50 to-indigo-50 border-blue-200"
                  : isChemistry
                  ? "from-amber-50 to-orange-50 border-amber-200"
                  : "from-purple-50 to-pink-50 border-purple-200";

                return (
                  <div
                    key={sub.id}
                    onClick={() => handleOpenSubjectModal(sub)}
                    className={`relative flex flex-col justify-between rounded-2xl border-2 p-5 text-left transition-all duration-200 cursor-pointer shadow-sm hover:shadow-md hover:scale-[1.02] bg-gradient-to-br ${bgGradient} ${
                      isSelected ? "ring-2 ring-emerald-500/40" : ""
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-3xl">{icon}</span>
                        <span className="inline-flex items-center gap-1 rounded-full bg-white px-2.5 py-0.5 text-[11px] font-bold text-slate-700 shadow-2xs border border-slate-200">
                          <span>Open Box</span>
                          <ArrowRight className="w-3 h-3 text-emerald-600" />
                        </span>
                      </div>
                      <h3 className="text-base font-extrabold text-slate-900">{sub.name}</h3>
                      {sub.nameHindi && (
                        <p className="text-xs text-slate-600 font-medium">{sub.nameHindi}</p>
                      )}
                    </div>

                    <div className="mt-4 pt-2 border-t border-black/5 flex items-center justify-between text-xs">
                      <span className="font-semibold text-slate-600">
                        {selectedClass?.name || "Class 11"}
                      </span>
                      <span className="font-bold text-emerald-700 bg-white/80 px-2 py-0.5 rounded-md">
                        Explore →
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* ========================================================================= */}
      {/* CHAPTER SELECTION MODAL (OPENS IMMEDIATELY ON BOX CLICK)                 */}
      {/* ========================================================================= */}
      {isModalOpen && selectedSubject && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/60 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="relative w-full max-w-2xl max-h-[90vh] flex flex-col bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden">
            {/* Modal Header */}
            <div className="bg-gradient-to-r from-emerald-900 via-teal-900 to-slate-900 text-white p-5 relative shrink-0">
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="absolute top-4 right-4 w-8 h-8 rounded-full bg-white/15 hover:bg-white/25 flex items-center justify-center text-white transition"
              >
                <X className="w-4 h-4" />
              </button>

              <div className="flex items-center gap-2 text-emerald-300 text-xs font-bold uppercase tracking-wider mb-1">
                <Sparkles className="w-3.5 h-3.5" />
                <span>{selectedClass?.name || "NCERT"} Chapter Directory</span>
              </div>
              <h2 className="text-lg sm:text-xl font-black text-white leading-tight">
                {selectedSubject.name} {selectedSubject.nameHindi ? `(${selectedSubject.nameHindi})` : ""}
              </h2>
              <p className="text-xs text-emerald-100/80 mt-0.5">
                {chapters.length} Official NCERT Chapters Available for Practice
              </p>
            </div>

            {/* Search Filter Bar */}
            <div className="p-4 bg-slate-50 border-b border-slate-200 shrink-0">
              <div className="relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={chapterSearchQuery}
                  onChange={(e) => setChapterSearchQuery(e.target.value)}
                  placeholder="Search chapter name or number..."
                  className="w-full pl-9 pr-4 py-2 text-xs rounded-xl border border-slate-300 bg-white text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-emerald-500 font-medium"
                />
              </div>
            </div>

            {/* Modal Body: Scrollable Chapters List & Language Picker */}
            <div className="p-4 sm:p-6 space-y-4 overflow-y-auto flex-1 min-h-0">
              {loadingChapters ? (
                <div className="space-y-2 py-4">
                  {[1, 2, 3, 4].map((i) => (
                    <div key={i} className="h-14 animate-pulse rounded-xl bg-slate-100" />
                  ))}
                </div>
              ) : filteredChapters.length === 0 ? (
                <div className="p-8 text-center text-slate-400 text-xs">
                  No chapters found matching &quot;{chapterSearchQuery}&quot;
                </div>
              ) : (
                <div className="space-y-2">
                  {filteredChapters.map((ch) => {
                    const isSelected = selectedChapter?.id === ch.id;
                    return (
                      <div
                        key={ch.id}
                        onClick={() => setSelectedChapter(ch)}
                        className={`p-3.5 rounded-2xl border-2 transition-all cursor-pointer ${
                          isSelected
                            ? "border-emerald-600 bg-emerald-50/50 shadow-sm"
                            : "border-slate-200 hover:border-slate-300 bg-white hover:bg-slate-50/60"
                        }`}
                      >
                        <div className="flex items-center justify-between gap-3">
                          <div className="flex items-center gap-3 min-w-0">
                            <span className="w-7 h-7 rounded-xl bg-emerald-100 text-emerald-800 font-extrabold text-xs flex items-center justify-center shrink-0">
                              {ch.chapterNumber}
                            </span>
                            <div className="min-w-0">
                              <h4 className="font-bold text-xs sm:text-sm text-slate-900 truncate">
                                {ch.title}
                              </h4>
                              {ch.titleHindi && (
                                <p className="text-[11px] text-slate-500 truncate">{ch.titleHindi}</p>
                              )}
                            </div>
                          </div>

                          <div className="flex items-center gap-2 shrink-0">
                            {ch.hasContent ? (
                              <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-bold">
                                Ready
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-500 text-[10px] font-medium">
                                Processing
                              </span>
                            )}
                            {isSelected && (
                              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                            )}
                          </div>
                        </div>

                        {/* If Selected: Show Language Choice & Instant Action right inside the card */}
                        {isSelected && (
                          <div className="mt-3 pt-3 border-t border-emerald-200/60 space-y-2.5 animate-in fade-in duration-150">
                            <div className="flex items-center justify-between text-xs">
                              <span className="font-bold text-slate-700">Choose Medium (माध्यम):</span>
                              <span className="text-[11px] text-slate-500">Authentic NCERT Textbook</span>
                            </div>

                            <div className="grid grid-cols-2 gap-2">
                              {languages.map((lang) => {
                                const isLangSelected = selectedLanguage === lang.language;
                                return (
                                  <button
                                    key={lang.language}
                                    type="button"
                                    disabled={!lang.available}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setSelectedLanguage(lang.language);
                                    }}
                                    className={`p-2.5 rounded-xl border text-left text-xs transition ${
                                      isLangSelected
                                        ? "border-emerald-600 bg-white font-bold text-emerald-950 ring-2 ring-emerald-500/30 shadow-2xs"
                                        : lang.available
                                        ? "border-slate-200 bg-white hover:bg-slate-100 text-slate-700 font-medium"
                                        : "border-dashed border-slate-200 bg-slate-50 text-slate-400 cursor-not-allowed"
                                    }`}
                                  >
                                    <div className="flex items-center justify-between">
                                      <span>{lang.label}</span>
                                      {isLangSelected && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />}
                                    </div>
                                    <span className="text-[10px] font-normal text-slate-500 block">
                                      {lang.available ? `${lang.totalPages} Pages` : "Coming Soon"}
                                    </span>
                                  </button>
                                );
                              })}
                            </div>

                            {/* Direct Launch Button */}
                            {activeDocumentId ? (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleStartPractice();
                                }}
                                className="w-full mt-2 py-3 px-4 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 text-white text-xs font-bold flex items-center justify-center gap-2 shadow-md shadow-emerald-600/20 hover:brightness-105 active:scale-[0.99] transition cursor-pointer"
                              >
                                <BookOpen className="w-4 h-4" />
                                <span>Open Reader &amp; Start Practice ({selectedLanguage === "HINDI" ? "हिंदी" : "English"})</span>
                                <ArrowRight className="w-4 h-4" />
                              </button>
                            ) : (
                              <p className="text-[11px] text-amber-700 bg-amber-50 p-2 rounded-lg text-center font-medium">
                                Please select an available language above to begin.
                              </p>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="bg-slate-50 px-6 py-3 border-t border-slate-200 flex items-center justify-between text-xs text-slate-500 shrink-0">
              <span>NCERT Page-by-Page Verified Practice</span>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="font-bold text-slate-700 hover:underline"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
