"use client";

import React, { useState, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Video,
  FileText,
  HelpCircle,
  Plus,
  Play,
  Calendar,
  Clock,
  MoreVertical,
  Edit2,
  Trash2,
  Upload,
  ArrowRight,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  Layers,
  Sparkles,
  BookOpen,
  X,
  FileUp,
  Share2,
  ShieldCheck,
} from "lucide-react";
import { LectureItem } from "./ChapterLecturesTab";
import { DppItem } from "./ChapterDppsTab";
import { TestItem } from "./ChapterTestsTab";
import { ChapterReviewHistoryTimeline, ReviewHistoryItem } from "./ChapterReviewHistoryTimeline";
import { formatISTDate, formatISTTime, computeISTScheduleDates } from "@/lib/date-utils";

export interface UnifiedChapterScheduleTimelineProps {
  chapterId: string;
  chapterTitle: string;
  chapterMedium: string;
  chapterStatus: string;
  initialLectures: LectureItem[];
  initialDpps: DppItem[];
  initialTests: TestItem[];
  canEdit: boolean;
  reviews?: ReviewHistoryItem[];
}

export type TimelineFilter = "ALL" | "LECTURES" | "DPPS" | "TESTS";

interface TimelineEntry {
  id: string;
  type: "LECTURE" | "DPP" | "TEST";
  itemIndex: number;
  title: string;
  subtitle?: string;
  badge?: string;
  status: string;
  dateStr?: string;
  timeStr?: string;
  durationMin?: number | null;
  lectureData?: LectureItem;
  dppData?: DppItem;
  testData?: TestItem;
}

export function UnifiedChapterScheduleTimeline({
  chapterId,
  chapterTitle,
  chapterMedium,
  chapterStatus,
  initialLectures,
  initialDpps,
  initialTests,
  canEdit,
  reviews = [],
}: UnifiedChapterScheduleTimelineProps) {
  const router = useRouter();

  const [lectures, setLectures] = useState<LectureItem[]>(initialLectures);
  const [dpps, setDpps] = useState<DppItem[]>(initialDpps);
  const [tests, setTests] = useState<TestItem[]>(initialTests);
  const [activeFilter, setActiveFilter] = useState<TimelineFilter>("ALL");
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null);

  // Modals state
  const [showAddLectureModal, setShowAddLectureModal] = useState(false);
  const [editingLecture, setEditingLecture] = useState<LectureItem | null>(null);
  const [notesModalLecture, setNotesModalLecture] = useState<LectureItem | null>(null);

  const [showAddDppModal, setShowAddDppModal] = useState(false);
  const [editingDpp, setEditingDpp] = useState<DppItem | null>(null);

  const [showAddTestModal, setShowAddTestModal] = useState(false);
  const [editingTest, setEditingTest] = useState<TestItem | null>(null);

  // Audit modal state
  const [showAuditModal, setShowAuditModal] = useState(false);

  // Delete modal state
  const [itemToDelete, setItemToDelete] = useState<{
    type: "LECTURE" | "DPP" | "TEST";
    id: string;
    title: string;
  } | null>(null);

  // Form states - Lecture
  const [lecTitle, setLecTitle] = useState("");
  const [lecScheduledDate, setLecScheduledDate] = useState<string>(
    new Date().toISOString().split("T")[0] || ""
  );
  const [lecStartTime, setLecStartTime] = useState("10:00");
  const [lecDurationMin, setLecDurationMin] = useState<number>(60);
  const [lecOrder, setLecOrder] = useState<number>(lectures.length + 1);
  const [lecLanguage, setLecLanguage] = useState(
    chapterMedium === "HINDI" ? "Hindi" : chapterMedium === "HINGLISH" ? "Hinglish" : "English"
  );
  const [notesUrl, setNotesUrl] = useState("");

  // Form states - DPP
  const [dppName, setDppName] = useState("");
  const [dppLevel, setDppLevel] = useState<number>(1);
  const [dppDifficulty, setDppDifficulty] = useState<"EASY" | "MEDIUM" | "HARD">("MEDIUM");
  const [dppTimeMin, setDppTimeMin] = useState<number>(30);
  const [dppCorrect, setDppCorrect] = useState<number>(4);
  const [dppIncorrect, setDppIncorrect] = useState<number>(-1);
  const [dppInstructions, setDppInstructions] = useState("");

  // Form states - Test
  const [testName, setTestName] = useState("");
  const [testDurationMin, setTestDurationMin] = useState<number>(60);
  const [testCorrect, setTestCorrect] = useState<number>(4);
  const [testIncorrect, setTestIncorrect] = useState<number>(-1);
  const [testExamType, setTestExamType] = useState("NEET");
  const [testInstructions, setTestInstructions] = useState("");

  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState("");

  // Construct interleaved unified schedule sequence
  const unifiedTimeline: TimelineEntry[] = useMemo(() => {
    const entries: TimelineEntry[] = [];
    const maxItems = Math.max(lectures.length, dpps.length);

    let seqCounter = 1;

    for (let i = 0; i < maxItems; i++) {
      // 1. Lecture item for this sequence
      const lec = lectures[i];
      if (lec) {
        let dateFormatted = "";
        let timeFormatted = "";

        if (lec.scheduledDate || lec.startTime) {
          const { startsAt, endsAt } = computeISTScheduleDates(
            lec.scheduledDate,
            lec.startTime,
            lec.durationMin || 60
          );
          if (lec.scheduledDate) {
            dateFormatted = formatISTDate(startsAt);
          }
          if (lec.startTime) {
            timeFormatted = `${formatISTTime(startsAt)} – ${formatISTTime(endsAt)} (IST)`;
          }
        }

        entries.push({
          id: `lec-${lec.id}`,
          type: "LECTURE",
          itemIndex: seqCounter++,
          title: lec.title,
          subtitle: lec.slidesUrl ? "Class Notes Attached" : undefined,
          status: lec.status || "SCHEDULED",
          dateStr: dateFormatted || undefined,
          timeStr: timeFormatted || undefined,
          durationMin: lec.durationMin || 60,
          lectureData: lec,
        });
      }

      // 2. Corresponding DPP for this sequence
      const dpp = dpps[i];
      if (dpp) {
        entries.push({
          id: `dpp-${dpp.id}`,
          type: "DPP",
          itemIndex: seqCounter++,
          title: dpp.name,
          subtitle: `${dpp._count?.questions || 0} Questions • +${dpp.correctMarks} / ${dpp.incorrectMarks}`,
          badge: dpp.difficulty,
          status: dpp.status || "ACTIVE",
          durationMin: dpp.estimatedTimeMin,
          dppData: dpp,
        });
      }
    }

    // 3. Append Chapter Tests
    tests.forEach((t) => {
      entries.push({
        id: `test-${t.id}`,
        type: "TEST",
        itemIndex: seqCounter++,
        title: t.name,
        subtitle: `${t.examType || "NEET"} • ${t.durationMin} mins • +${t.correctMarks} / ${t.incorrectMarks}`,
        badge: t.examType || "NEET",
        status: t.status || "SCHEDULED",
        durationMin: t.durationMin,
        testData: t,
      });
    });

    return entries;
  }, [lectures, dpps, tests]);

  // Filtered entries
  const filteredTimeline = useMemo(() => {
    if (activeFilter === "LECTURES") return unifiedTimeline.filter((t) => t.type === "LECTURE");
    if (activeFilter === "DPPS") return unifiedTimeline.filter((t) => t.type === "DPP");
    if (activeFilter === "TESTS") return unifiedTimeline.filter((t) => t.type === "TEST");
    return unifiedTimeline;
  }, [unifiedTimeline, activeFilter]);

  // Schedule Summary Calculation
  const scheduleSummary = useMemo(() => {
    let startDate: Date | undefined;
    let endDate: Date | undefined;
    let totalMins = 0;

    lectures.forEach((l) => {
      if (l.durationMin) totalMins += l.durationMin;
      if (l.scheduledDate) {
        const d = new Date(l.scheduledDate);
        if (!startDate || d < startDate) startDate = d;
        if (!endDate || d > endDate) endDate = d;
      }
    });

    let dateRange = "Active Academic Schedule";
    if (startDate instanceof Date && endDate instanceof Date) {
      const sStr = startDate.toLocaleDateString("en-IN", { month: "short", day: "numeric" });
      const eStr = endDate.toLocaleDateString("en-IN", { month: "short", day: "numeric" });
      dateRange = `${sStr} - ${eStr}`;
    }

    const totalHours = (totalMins / 60).toFixed(1);

    return {
      dateRange,
      totalHours: Number(totalHours) > 0 ? `${totalHours} hrs` : `${lectures.length * 1.5} hrs`,
      lessonCount: `${lectures.length} lessons`,
    };
  }, [lectures]);

  // Handle Create Lecture
  const handleCreateLecture = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!lecTitle.trim()) {
      setFormError("Please enter lecture title.");
      return;
    }
    setSubmitting(true);
    setFormError("");

    try {
      const res = await fetch(`/api/team/chapters/${chapterId}/lectures`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: lecTitle.trim(),
          scheduledDate: lecScheduledDate ? new Date(lecScheduledDate).toISOString() : null,
          startTime: lecStartTime || null,
          durationMin: Number(lecDurationMin) || 60,
          language: lecLanguage,
          order: Number(lecOrder) || lectures.length + 1,
        }),
      });
      const json = await res.json();
      if (!json.success) {
        setFormError(json.error || "Failed to schedule lecture.");
        return;
      }

      setLectures((prev) => [...prev, json.data.lecture]);
      setShowAddLectureModal(false);
      toast.success("Lecture scheduled successfully!");
      router.refresh();
    } catch (err: any) {
      setFormError(err.message || "Network error");
    } finally {
      setSubmitting(false);
    }
  };

  // Handle Edit Lecture
  const handleUpdateLecture = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingLecture || !lecTitle.trim()) return;
    setSubmitting(true);
    setFormError("");

    try {
      const res = await fetch(`/api/team/chapters/${chapterId}/lectures/${editingLecture.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: lecTitle.trim(),
          scheduledDate: lecScheduledDate ? new Date(lecScheduledDate).toISOString() : null,
          startTime: lecStartTime || null,
          durationMin: Number(lecDurationMin) || 60,
          language: lecLanguage,
        }),
      });
      const json = await res.json();
      if (!json.success) {
        setFormError(json.error || "Failed to update lecture.");
        return;
      }

      setLectures((prev) =>
        prev.map((l) => (l.id === editingLecture.id ? json.data.lecture : l))
      );
      setEditingLecture(null);
      toast.success("Lecture updated successfully!");
      router.refresh();
    } catch (err: any) {
      setFormError(err.message || "Network error");
    } finally {
      setSubmitting(false);
    }
  };

  // Handle Notes PDF
  const handleSaveNotes = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!notesModalLecture) return;
    setSubmitting(true);
    setFormError("");

    try {
      const res = await fetch(`/api/team/chapters/${chapterId}/lectures/${notesModalLecture.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          slidesUrl: notesUrl.trim() || null,
        }),
      });
      const json = await res.json();
      if (!json.success) {
        setFormError(json.error || "Failed to save notes.");
        return;
      }

      setLectures((prev) =>
        prev.map((l) => (l.id === notesModalLecture.id ? json.data.lecture : l))
      );
      setNotesModalLecture(null);
      toast.success("Class notes attached successfully!");
      router.refresh();
    } catch (err: any) {
      setFormError(err.message || "Network error");
    } finally {
      setSubmitting(false);
    }
  };

  // Handle Create DPP
  const handleCreateDpp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!dppName.trim()) {
      setFormError("Please provide a name for this DPP.");
      return;
    }
    setSubmitting(true);
    setFormError("");

    try {
      const res = await fetch(`/api/team/chapters/${chapterId}/dpps`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: dppName.trim(),
          level: Number(dppLevel),
          difficulty: dppDifficulty,
          estimatedTimeMin: Number(dppTimeMin),
          correctMarks: Number(dppCorrect),
          incorrectMarks: Number(dppIncorrect),
          instructions: dppInstructions.trim() || undefined,
        }),
      });
      const json = await res.json();
      if (!json.success) {
        setFormError(json.error || "Failed to create DPP.");
        return;
      }

      setDpps((prev) => [...prev, json.data.dpp]);
      setShowAddDppModal(false);
      toast.success("DPP created successfully!");
      router.refresh();
    } catch (err: any) {
      setFormError(err.message || "Network error");
    } finally {
      setSubmitting(false);
    }
  };

  // Handle Edit DPP
  const handleUpdateDpp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingDpp || !dppName.trim()) return;
    setSubmitting(true);
    setFormError("");

    try {
      const res = await fetch(`/api/team/chapters/${chapterId}/dpps/${editingDpp.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: dppName.trim(),
          level: Number(dppLevel),
          difficulty: dppDifficulty,
          estimatedTimeMin: Number(dppTimeMin),
          correctMarks: Number(dppCorrect),
          incorrectMarks: Number(dppIncorrect),
        }),
      });
      const json = await res.json();
      if (!json.success) {
        setFormError(json.error || "Failed to update DPP.");
        return;
      }

      setDpps((prev) => (prev.map((d) => (d.id === editingDpp.id ? json.data.dpp : d))));
      setEditingDpp(null);
      toast.success("DPP updated successfully!");
      router.refresh();
    } catch (err: any) {
      setFormError(err.message || "Network error");
    } finally {
      setSubmitting(false);
    }
  };

  // Handle Create Test
  const handleCreateTest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!testName.trim()) {
      setFormError("Please provide a name for this chapter test.");
      return;
    }
    setSubmitting(true);
    setFormError("");

    try {
      const res = await fetch(`/api/team/chapters/${chapterId}/tests`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: testName.trim(),
          durationMin: Number(testDurationMin),
          correctMarks: Number(testCorrect),
          incorrectMarks: Number(testIncorrect),
          examType: testExamType,
          instructions: testInstructions.trim() || undefined,
        }),
      });
      const json = await res.json();
      if (!json.success) {
        setFormError(json.error || "Failed to create test.");
        return;
      }

      setTests((prev) => [...prev, json.data.test]);
      setShowAddTestModal(false);
      toast.success("Chapter test created successfully!");
      router.refresh();
    } catch (err: any) {
      setFormError(err.message || "Network error");
    } finally {
      setSubmitting(false);
    }
  };

  // Handle Edit Test
  const handleUpdateTest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingTest || !testName.trim()) return;
    setSubmitting(true);
    setFormError("");

    try {
      const res = await fetch(`/api/team/chapters/${chapterId}/tests/${editingTest.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: testName.trim(),
          durationMin: Number(testDurationMin),
          correctMarks: Number(testCorrect),
          incorrectMarks: Number(testIncorrect),
          examType: testExamType,
        }),
      });
      const json = await res.json();
      if (!json.success) {
        setFormError(json.error || "Failed to update test.");
        return;
      }

      setTests((prev) => (prev.map((t) => (t.id === editingTest.id ? json.data.test : t))));
      setEditingTest(null);
      toast.success("Chapter test updated successfully!");
      router.refresh();
    } catch (err: any) {
      setFormError(err.message || "Network error");
    } finally {
      setSubmitting(false);
    }
  };

  // Handle Delete Direct
  const handleConfirmDelete = async () => {
    if (!itemToDelete) return;
    setSubmitting(true);

    try {
      if (itemToDelete.type === "LECTURE") {
        const res = await fetch(`/api/team/chapters/${chapterId}/lectures/${itemToDelete.id}`, {
          method: "DELETE",
        });
        const json = await res.json();
        if (!json.success) {
          toast.error(json.error || "Failed to delete lecture.");
          return;
        }
        setLectures((prev) => prev.filter((l) => l.id !== itemToDelete.id));
        toast.success("Lecture deleted.");
      } else if (itemToDelete.type === "DPP") {
        const res = await fetch(`/api/team/chapters/${chapterId}/dpps/${itemToDelete.id}`, {
          method: "DELETE",
        });
        const json = await res.json();
        if (!json.success) {
          toast.error(json.error || "Failed to delete DPP.");
          return;
        }
        setDpps((prev) => prev.filter((d) => d.id !== itemToDelete.id));
        toast.success("DPP deleted.");
      } else if (itemToDelete.type === "TEST") {
        const res = await fetch(`/api/team/chapters/${chapterId}/tests/${itemToDelete.id}`, {
          method: "DELETE",
        });
        const json = await res.json();
        if (!json.success) {
          toast.error(json.error || "Failed to delete test.");
          return;
        }
        setTests((prev) => prev.filter((t) => t.id !== itemToDelete.id));
        toast.success("Test deleted.");
      }

      setItemToDelete(null);
      router.refresh();
    } catch {
      toast.error("Network error during deletion.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Schedule Header & Filter Tabs */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-3xl p-6 shadow-sm space-y-5">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-black text-slate-900 dark:text-white flex items-center gap-2.5">
              <span>Schedule</span>
              <span className="text-sm font-medium text-slate-400">&middot;</span>
              <span className="text-sm font-semibold text-slate-600 dark:text-slate-300">
                {scheduleSummary.dateRange}
              </span>
              <span className="text-sm font-medium text-slate-400">&middot;</span>
              <span className="text-sm font-semibold text-blue-600 dark:text-blue-400">
                {scheduleSummary.lessonCount}
              </span>
              <span className="text-sm font-medium text-slate-400">&middot;</span>
              <span className="text-sm font-semibold text-purple-600 dark:text-purple-400">
                {scheduleSummary.totalHours}
              </span>
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Unified chronological learning path: Lectures, Practice DPPs, and Assessments in continuous sequence.
            </p>
          </div>

          {/* Quick Add Action Buttons */}
          {canEdit && (
            <div className="flex items-center gap-2 flex-wrap">
              <button
                type="button"
                onClick={() => {
                  setLecTitle(`${chapterTitle} — Lecture ${String(lectures.length + 1).padStart(2, "0")}`);
                  setLecScheduledDate(new Date().toISOString().split("T")[0] || "");
                  setLecStartTime("10:00");
                  setLecDurationMin(90);
                  setLecOrder(lectures.length + 1);
                  setFormError("");
                  setShowAddLectureModal(true);
                }}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold shadow-md shadow-blue-500/20 transition cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Lecture</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setDppName(`DPP ${String(dpps.length + 1).padStart(2, "0")} — ${chapterTitle}`);
                  setDppLevel(1);
                  setDppDifficulty("MEDIUM");
                  setDppTimeMin(30);
                  setDppCorrect(4);
                  setDppIncorrect(-1);
                  setDppInstructions("Solve all questions within the allotted time.");
                  setFormError("");
                  setShowAddDppModal(true);
                }}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 hover:bg-indigo-100 text-indigo-700 dark:text-indigo-300 border border-indigo-200/80 dark:border-indigo-800 text-xs font-bold transition cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Upload DPP</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setTestName(`Chapter Assessment — ${chapterTitle}`);
                  setTestDurationMin(60);
                  setTestCorrect(4);
                  setTestIncorrect(-1);
                  setTestExamType("NEET");
                  setTestInstructions("Standard timed computer-based assessment.");
                  setFormError("");
                  setShowAddTestModal(true);
                }}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 hover:bg-emerald-100 text-emerald-700 dark:text-emerald-300 border border-emerald-200/80 dark:border-emerald-800 text-xs font-bold transition cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Test</span>
              </button>

              {reviews && reviews.length > 0 && (
                <button
                  type="button"
                  onClick={() => setShowAuditModal(true)}
                  className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 border border-slate-200/80 dark:border-slate-700 text-xs font-bold transition cursor-pointer shadow-xs"
                >
                  <ShieldCheck className="w-3.5 h-3.5 text-blue-600" />
                  <span>Audit Log</span>
                  <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-blue-100 dark:bg-blue-900/60 text-blue-700 dark:text-blue-300 font-mono font-bold">
                    {reviews.length}
                  </span>
                </button>
              )}
            </div>
          )}
        </div>

        {/* Filter Pills */}
        <div className="flex items-center gap-2 border-t border-slate-100 dark:border-slate-800 pt-4 overflow-x-auto">
          <button
            type="button"
            onClick={() => setActiveFilter("ALL")}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-bold transition ${
              activeFilter === "ALL"
                ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900 shadow-sm"
                : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
            }`}
          >
            <span>All Content</span>
            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-slate-200/60 dark:bg-slate-700 font-mono">
              {unifiedTimeline.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveFilter("LECTURES")}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-bold transition ${
              activeFilter === "LECTURES"
                ? "bg-blue-600 text-white shadow-sm shadow-blue-500/20"
                : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
            }`}
          >
            <Video className="w-3.5 h-3.5" />
            <span>Lectures</span>
            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-blue-100 dark:bg-blue-900/60 text-blue-800 dark:text-blue-200 font-mono">
              {lectures.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveFilter("DPPS")}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-bold transition ${
              activeFilter === "DPPS"
                ? "bg-indigo-600 text-white shadow-sm shadow-indigo-500/20"
                : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
            }`}
          >
            <FileText className="w-3.5 h-3.5" />
            <span>DPPs</span>
            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-indigo-100 dark:bg-indigo-900/60 text-indigo-800 dark:text-indigo-200 font-mono">
              {dpps.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveFilter("TESTS")}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-bold transition ${
              activeFilter === "TESTS"
                ? "bg-emerald-600 text-white shadow-sm shadow-emerald-500/20"
                : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
            }`}
          >
            <HelpCircle className="w-3.5 h-3.5" />
            <span>Chapter Tests</span>
            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-900/60 text-emerald-800 dark:text-emerald-200 font-mono">
              {tests.length}
            </span>
          </button>
        </div>
      </div>

      {/* Unified Timeline Item List */}
      <div className="space-y-3">
        {filteredTimeline.length === 0 ? (
          <div className="bg-white dark:bg-slate-900 border border-dashed border-slate-200 dark:border-slate-800 rounded-3xl p-12 text-center space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center mx-auto">
              <Layers className="w-6 h-6" />
            </div>
            <h3 className="text-base font-bold text-slate-800 dark:text-slate-200">
              No content items found
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md mx-auto">
              Start structuring this chapter by adding live lectures, daily practice problems (DPPs), and chapter assessments.
            </p>
          </div>
        ) : (
          filteredTimeline.map((item) => {
            const isMenuOpen = activeMenuId === item.id;

            return (
              <div
                key={item.id}
                className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 rounded-2xl p-4 sm:p-5 transition-all shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4 group"
              >
                {/* Left: Sequence Number + Icon + Title & Meta */}
                <div className="flex items-start sm:items-center gap-3.5">
                  {/* Sequence Number */}
                  <span className="text-xs font-black font-mono text-slate-400 dark:text-slate-500 w-6 shrink-0 pt-0.5 sm:pt-0">
                    {String(item.itemIndex).padStart(2, "0")}
                  </span>

                  {/* Icon Indicator */}
                  <div
                    className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                      item.type === "LECTURE"
                        ? "bg-blue-50 text-blue-600 dark:bg-blue-950/60 dark:text-blue-400 border border-blue-200/60 dark:border-blue-800"
                        : item.type === "DPP"
                        ? "bg-indigo-50 text-indigo-600 dark:bg-indigo-950/60 dark:text-indigo-400 border border-indigo-200/60 dark:border-indigo-800"
                        : "bg-emerald-50 text-emerald-600 dark:bg-emerald-950/60 dark:text-emerald-400 border border-emerald-200/60 dark:border-emerald-800"
                    }`}
                  >
                    {item.type === "LECTURE" && <Video className="w-5 h-5" />}
                    {item.type === "DPP" && <FileText className="w-5 h-5" />}
                    {item.type === "TEST" && <HelpCircle className="w-5 h-5" />}
                  </div>

                  {/* Title & Metadata */}
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span
                        className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-md ${
                          item.type === "LECTURE"
                            ? "bg-blue-100 text-blue-800 dark:bg-blue-900/60 dark:text-blue-300"
                            : item.type === "DPP"
                            ? "bg-indigo-100 text-indigo-800 dark:bg-indigo-900/60 dark:text-indigo-300"
                            : "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/60 dark:text-emerald-300"
                        }`}
                      >
                        {item.type}
                      </span>

                      <h4 className="text-sm font-bold text-slate-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                        {item.title}
                      </h4>
                    </div>

                    <div className="flex items-center gap-3 text-xs text-slate-500 dark:text-slate-400 flex-wrap">
                      {item.dateStr && (
                        <span className="flex items-center gap-1 font-medium">
                          <Calendar className="w-3.5 h-3.5 text-slate-400" />
                          <span>{item.dateStr}</span>
                        </span>
                      )}

                      {item.timeStr && (
                        <span className="flex items-center gap-1 font-medium">
                          <Clock className="w-3.5 h-3.5 text-slate-400" />
                          <span>{item.timeStr}</span>
                        </span>
                      )}

                      {item.durationMin && (
                        <span className="font-mono text-[11px]">
                          {item.durationMin} min
                        </span>
                      )}

                      {item.subtitle && (
                        <span className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">
                          &bull; {item.subtitle}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Right: Primary Action Buttons + Three Dot Menu */}
                <div className="flex items-center gap-2 sm:self-center pl-9 sm:pl-0">
                  {/* Context-Sensitive Primary Buttons */}
                  {item.type === "LECTURE" && item.lectureData && (
                    <>
                      <Link
                        href={`/team/live-class/${item.lectureData?.id || item.id}`}
                        className="px-3.5 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold flex items-center gap-1.5 shadow-sm shadow-blue-500/20 transition"
                      >
                        <Play className="w-3.5 h-3.5 fill-white" />
                        <span>Start Class</span>
                      </Link>

                      {item.lectureData.slidesUrl ? (
                        <a
                          href={item.lectureData.slidesUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-semibold flex items-center gap-1.5 transition"
                          title="View attached class notes"
                        >
                          <FileText className="w-3.5 h-3.5 text-blue-600" />
                          <span>Notes</span>
                        </a>
                      ) : (
                        <button
                          type="button"
                          onClick={() => {
                            setNotesModalLecture(item.lectureData!);
                            setNotesUrl("");
                          }}
                          className="px-3 py-1.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer"
                          title="Attach PDF Notes"
                        >
                          <FileUp className="w-3.5 h-3.5" />
                          <span>+ Notes</span>
                        </button>
                      )}
                    </>
                  )}

                  {item.type === "DPP" && item.dppData && (
                    <Link
                      href={`/team/dpp/${item.dppData.id}/author`}
                      className="px-3.5 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold flex items-center gap-1.5 shadow-sm shadow-indigo-500/20 transition"
                    >
                      <Layers className="w-3.5 h-3.5" />
                      <span>Manage Questions ({item.dppData._count?.questions || 0})</span>
                    </Link>
                  )}

                  {item.type === "TEST" && item.testData && (
                    <Link
                      href={`/team/tests/${item.testData.id}/author`}
                      className="px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center gap-1.5 shadow-sm shadow-emerald-500/20 transition"
                    >
                      <HelpCircle className="w-3.5 h-3.5" />
                      <span>Manage Questions</span>
                    </Link>
                  )}

                  {/* Three Dot Action Dropdown */}
                  {canEdit && (
                    <div className="relative">
                      <button
                        type="button"
                        onClick={() =>
                          setActiveMenuId((cur) => (cur === item.id ? null : item.id))
                        }
                        className="w-8 h-8 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-center text-slate-500 transition cursor-pointer"
                        title="More options"
                      >
                        <MoreVertical className="w-4 h-4" />
                      </button>

                      {isMenuOpen && (
                        <>
                          <div
                            className="fixed inset-0 z-20"
                            onClick={() => setActiveMenuId(null)}
                          />
                          <div className="absolute right-0 top-10 z-30 w-52 bg-white dark:bg-slate-900 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-800 p-1.5 space-y-1">
                            {/* Lecture Actions */}
                            {item.type === "LECTURE" && item.lectureData && (
                              <>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setActiveMenuId(null);
                                    const lec = item.lectureData!;
                                    setEditingLecture(lec);
                                    setLecTitle(lec.title);
                                    setLecScheduledDate(
                                      lec.scheduledDate
                                        ? new Date(lec.scheduledDate).toISOString().split("T")[0] || ""
                                        : new Date().toISOString().split("T")[0] || ""
                                    );
                                    setLecStartTime(lec.startTime || "10:00");
                                    setLecDurationMin(lec.durationMin || 60);
                                    setLecLanguage(lec.language || "Hindi");
                                    setFormError("");
                                  }}
                                  className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition text-left cursor-pointer"
                                >
                                  <Edit2 className="w-3.5 h-3.5 text-blue-600" />
                                  <span>Edit Lecture</span>
                                </button>

                                <button
                                  type="button"
                                  onClick={() => {
                                    setActiveMenuId(null);
                                    setNotesModalLecture(item.lectureData!);
                                    setNotesUrl(item.lectureData!.slidesUrl || "");
                                    setFormError("");
                                  }}
                                  className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition text-left cursor-pointer"
                                >
                                  <FileUp className="w-3.5 h-3.5 text-purple-600" />
                                  <span>Attach Notes PDF</span>
                                </button>

                                <Link
                                  href={`/team/live-class/${item.lectureData?.id || item.id}`}
                                  className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition text-left"
                                >
                                  <Play className="w-3.5 h-3.5 text-blue-600" />
                                  <span>Open Live Studio</span>
                                </Link>
                              </>
                            )}

                            {/* DPP Actions */}
                            {item.type === "DPP" && item.dppData && (
                              <>
                                <Link
                                  href={`/team/dpp/${item.dppData.id}/author`}
                                  className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition text-left"
                                >
                                  <Layers className="w-3.5 h-3.5 text-indigo-600" />
                                  <span>Author Questions</span>
                                </Link>

                                <Link
                                  href={`/team/dpp/${item.dppData.id}`}
                                  className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition text-left"
                                >
                                  <FileText className="w-3.5 h-3.5 text-slate-500" />
                                  <span>DPP Overview</span>
                                </Link>

                                <button
                                  type="button"
                                  onClick={() => {
                                    setActiveMenuId(null);
                                    const d = item.dppData!;
                                    setEditingDpp(d);
                                    setDppName(d.name);
                                    setDppLevel(d.level || 1);
                                    setDppDifficulty((d.difficulty as any) || "MEDIUM");
                                    setDppTimeMin(d.estimatedTimeMin || 30);
                                    setDppCorrect(d.correctMarks || 4);
                                    setDppIncorrect(d.incorrectMarks || -1);
                                    setFormError("");
                                  }}
                                  className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition text-left cursor-pointer"
                                >
                                  <Edit2 className="w-3.5 h-3.5 text-indigo-600" />
                                  <span>Edit DPP Settings</span>
                                </button>
                              </>
                            )}

                            {/* Test Actions */}
                            {item.type === "TEST" && item.testData && (
                              <>
                                <Link
                                  href={`/team/tests/${item.testData.id}/author`}
                                  className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition text-left"
                                >
                                  <Layers className="w-3.5 h-3.5 text-emerald-600" />
                                  <span>Author Questions</span>
                                </Link>

                                <Link
                                  href={`/team/tests/${item.testData.id}`}
                                  className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition text-left"
                                >
                                  <HelpCircle className="w-3.5 h-3.5 text-slate-500" />
                                  <span>Test Submissions &amp; Stats</span>
                                </Link>

                                <button
                                  type="button"
                                  onClick={() => {
                                    setActiveMenuId(null);
                                    const t = item.testData!;
                                    setEditingTest(t);
                                    setTestName(t.name);
                                    setTestDurationMin(t.durationMin || 60);
                                    setTestCorrect(t.correctMarks || 4);
                                    setTestIncorrect(t.incorrectMarks || -1);
                                    setTestExamType(t.examType || "NEET");
                                    setFormError("");
                                  }}
                                  className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition text-left cursor-pointer"
                                >
                                  <Edit2 className="w-3.5 h-3.5 text-emerald-600" />
                                  <span>Edit Test Settings</span>
                                </button>
                              </>
                            )}

                            {/* Delete Action */}
                            <button
                              type="button"
                              onClick={() => {
                                setActiveMenuId(null);
                                setItemToDelete({
                                  type: item.type,
                                  id: item.type === "LECTURE" ? item.lectureData!.id : item.type === "DPP" ? item.dppData!.id : item.testData!.id,
                                  title: item.title,
                                });
                              }}
                              className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/50 transition text-left cursor-pointer border-t border-slate-100 dark:border-slate-800 pt-1.5"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                              <span>Delete {item.type.toLowerCase()}</span>
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* MODALS */}

      {/* 1. Add / Edit Lecture Modal */}
      {(showAddLectureModal || editingLecture) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-lg w-full p-6 sm:p-8 shadow-2xl border border-slate-200 dark:border-slate-800 space-y-6">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-2xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center font-bold">
                  <Video className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white">
                    {editingLecture ? "Edit Scheduled Lecture" : "Schedule New Lecture"}
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Configure class timing, language, and curriculum position.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setShowAddLectureModal(false);
                  setEditingLecture(null);
                }}
                className="w-8 h-8 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-center text-slate-400"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {formError && (
              <div className="p-3 bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 text-xs rounded-xl flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{formError}</span>
              </div>
            )}

            <form
              onSubmit={editingLecture ? handleUpdateLecture : handleCreateLecture}
              className="space-y-4 text-xs"
            >
              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Lecture Title *
                </label>
                <input
                  type="text"
                  value={lecTitle}
                  onChange={(e) => setLecTitle(e.target.value)}
                  placeholder="e.g. Chemical Bonding Lec 01: Octet Rule & Lewis Structure"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:border-blue-500 font-medium"
                  required
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Scheduled Date
                  </label>
                  <input
                    type="date"
                    value={lecScheduledDate}
                    onChange={(e) => setLecScheduledDate(e.target.value)}
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:border-blue-500 font-medium"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Class Time (IST)
                  </label>
                  <input
                    type="time"
                    value={lecStartTime}
                    onChange={(e) => setLecStartTime(e.target.value)}
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:border-blue-500 font-medium"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Duration (Minutes)
                  </label>
                  <input
                    type="number"
                    min={15}
                    max={360}
                    value={lecDurationMin}
                    onChange={(e) => setLecDurationMin(Number(e.target.value))}
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:border-blue-500 font-medium"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Delivery Medium
                  </label>
                  <select
                    value={lecLanguage}
                    onChange={(e) => setLecLanguage(e.target.value)}
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:border-blue-500 font-medium"
                  >
                    <option value="Hinglish">Hinglish</option>
                    <option value="Hindi">Hindi</option>
                    <option value="English">English</option>
                  </select>
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => {
                    setShowAddLectureModal(false);
                    setEditingLecture(null);
                  }}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold shadow-md shadow-blue-500/20 transition disabled:opacity-50"
                >
                  {submitting
                    ? "Saving..."
                    : editingLecture
                    ? "Update Lecture"
                    : "Schedule Lecture"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 2. Attach Class Notes Modal */}
      {notesModalLecture && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-md w-full p-6 sm:p-8 shadow-2xl border border-slate-200 dark:border-slate-800 space-y-5">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-2xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center font-bold">
                  <FileUp className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white">
                    Attach Class Notes PDF
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {notesModalLecture.title}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setNotesModalLecture(null)}
                className="w-8 h-8 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-center text-slate-400"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {formError && (
              <div className="p-3 bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 text-xs rounded-xl flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{formError}</span>
              </div>
            )}

            <form onSubmit={handleSaveNotes} className="space-y-4 text-xs">
              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                  PDF URL or CDN Document Link
                </label>
                <input
                  type="url"
                  value={notesUrl}
                  onChange={(e) => setNotesUrl(e.target.value)}
                  placeholder="https://cdn.atomicpathshala.com/notes/chem-01.pdf"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:border-blue-500 font-mono text-xs"
                />
                <p className="text-[11px] text-slate-400 mt-1">
                  Students will be able to read and download this PDF directly from their chapter roadmap.
                </p>
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setNotesModalLecture(null)}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold shadow-md shadow-blue-500/20 transition disabled:opacity-50"
                >
                  {submitting ? "Saving..." : "Save Notes PDF"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 3. Add / Edit DPP Modal */}
      {(showAddDppModal || editingDpp) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-lg w-full p-6 sm:p-8 shadow-2xl border border-slate-200 dark:border-slate-800 space-y-6">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-2xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-bold">
                  <FileText className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white">
                    {editingDpp ? "Edit Practice DPP" : "Upload Practice DPP"}
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Define scoring, time limit, and difficulty tier.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setShowAddDppModal(false);
                  setEditingDpp(null);
                }}
                className="w-8 h-8 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-center text-slate-400"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {formError && (
              <div className="p-3 bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 text-xs rounded-xl flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{formError}</span>
              </div>
            )}

            <form
              onSubmit={editingDpp ? handleUpdateDpp : handleCreateDpp}
              className="space-y-4 text-xs"
            >
              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                  DPP Name *
                </label>
                <input
                  type="text"
                  value={dppName}
                  onChange={(e) => setDppName(e.target.value)}
                  placeholder="e.g. DPP 01 — Chemical Bonding Basics"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500 font-medium"
                  required
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Difficulty Level
                  </label>
                  <select
                    value={dppDifficulty}
                    onChange={(e) => setDppDifficulty(e.target.value as any)}
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500 font-medium"
                  >
                    <option value="EASY">Easy (Foundational)</option>
                    <option value="MEDIUM">Medium (NEET Standard)</option>
                    <option value="HARD">Hard (Advanced / Olympiad)</option>
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Estimated Time (Mins)
                  </label>
                  <input
                    type="number"
                    min={5}
                    max={180}
                    value={dppTimeMin}
                    onChange={(e) => setDppTimeMin(Number(e.target.value))}
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500 font-medium"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Correct Marks
                  </label>
                  <input
                    type="number"
                    value={dppCorrect}
                    onChange={(e) => setDppCorrect(Number(e.target.value))}
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500 font-medium"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Negative Marks
                  </label>
                  <input
                    type="number"
                    value={dppIncorrect}
                    onChange={(e) => setDppIncorrect(Number(e.target.value))}
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500 font-medium"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => {
                    setShowAddDppModal(false);
                    setEditingDpp(null);
                  }}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold shadow-md shadow-indigo-500/20 transition disabled:opacity-50"
                >
                  {submitting ? "Saving..." : editingDpp ? "Update DPP" : "Upload DPP"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 4. Add / Edit Test Modal */}
      {(showAddTestModal || editingTest) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-lg w-full p-6 sm:p-8 shadow-2xl border border-slate-200 dark:border-slate-800 space-y-6">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-2xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-bold">
                  <HelpCircle className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white">
                    {editingTest ? "Edit Chapter Assessment" : "Create Chapter Assessment"}
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Setup timed CBT assessment for this chapter.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setShowAddTestModal(false);
                  setEditingTest(null);
                }}
                className="w-8 h-8 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-center text-slate-400"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {formError && (
              <div className="p-3 bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 text-xs rounded-xl flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{formError}</span>
              </div>
            )}

            <form
              onSubmit={editingTest ? handleUpdateTest : handleCreateTest}
              className="space-y-4 text-xs"
            >
              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Assessment Name *
                </label>
                <input
                  type="text"
                  value={testName}
                  onChange={(e) => setTestName(e.target.value)}
                  placeholder="e.g. Chapter Assessment 01 — Full Mastery"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:border-emerald-500 font-medium"
                  required
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Exam Target Pattern
                  </label>
                  <select
                    value={testExamType}
                    onChange={(e) => setTestExamType(e.target.value)}
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:border-emerald-500 font-medium"
                  >
                    <option value="NEET">NEET Pattern</option>
                    <option value="JEE">JEE Main Pattern</option>
                    <option value="BOARD">CBSE / Board Pattern</option>
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Duration (Minutes)
                  </label>
                  <input
                    type="number"
                    min={10}
                    max={300}
                    value={testDurationMin}
                    onChange={(e) => setTestDurationMin(Number(e.target.value))}
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:border-emerald-500 font-medium"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Correct Marks
                  </label>
                  <input
                    type="number"
                    value={testCorrect}
                    onChange={(e) => setTestCorrect(Number(e.target.value))}
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:border-emerald-500 font-medium"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Negative Marks
                  </label>
                  <input
                    type="number"
                    value={testIncorrect}
                    onChange={(e) => setTestIncorrect(Number(e.target.value))}
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:border-emerald-500 font-medium"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => {
                    setShowAddTestModal(false);
                    setEditingTest(null);
                  }}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-md shadow-emerald-500/20 transition disabled:opacity-50"
                >
                  {submitting ? "Saving..." : editingTest ? "Update Test" : "Create Test"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 5. Delete Item Modal */}
      {itemToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-md w-full p-6 sm:p-8 shadow-2xl border border-slate-200 dark:border-slate-800 space-y-5">
            <div className="w-12 h-12 rounded-2xl bg-rose-50 dark:bg-rose-950/60 text-rose-600 flex items-center justify-center mx-auto">
              <Trash2 className="w-6 h-6" />
            </div>

            <div className="text-center space-y-1.5">
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                Delete {itemToDelete.type.toLowerCase()}?
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Are you sure you want to delete <strong className="text-slate-800 dark:text-slate-200">&ldquo;{itemToDelete.title}&rdquo;</strong>? This action cannot be undone.
              </p>
            </div>

            <div className="flex items-center justify-center gap-3 pt-3">
              <button
                type="button"
                onClick={() => setItemToDelete(null)}
                disabled={submitting}
                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                disabled={submitting}
                className="px-5 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold shadow-md shadow-rose-500/20 transition disabled:opacity-50"
              >
                {submitting ? "Deleting..." : "Yes, Delete"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 6. Governance Audit Trail Modal */}
      {showAuditModal && reviews && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs">
          <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-3xl w-full p-6 sm:p-8 shadow-2xl border border-slate-200 dark:border-slate-800 space-y-6 max-h-[88vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-2xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center font-bold">
                  <ShieldCheck className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white">
                    Governance Audit Trail &amp; Traceability Log
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Complete chronological record of all submissions, approvals, rejections &amp; feedback.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowAuditModal(false)}
                className="w-8 h-8 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-center text-slate-400"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <ChapterReviewHistoryTimeline reviews={reviews} />

            <div className="flex justify-end pt-3 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setShowAuditModal(false)}
                className="px-5 py-2 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-xs font-bold transition"
              >
                Close Audit Log
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}