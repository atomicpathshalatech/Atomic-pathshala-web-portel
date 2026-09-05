"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  ArrowLeft,
  Calendar,
  Play,
  Zap,
  HelpCircle,
  Clock,
  Radio,
  Star,
  Share2,
  MoreVertical,
  Edit2,
  Trash2,
  MessageSquare,
  CheckCircle2,
  FileText,
  ShieldCheck,
  Bell,
} from "lucide-react";
import { TeacherChapterNoticeBoard } from "./TeacherChapterNoticeBoard";

export interface TeacherChapterHeaderProps {
  chapterId: string;
  chapterCode?: string | null;
  chapterTitle: string;
  subjectTitle: string;
  courseTitle: string;
  medium: string;
  status: string;
  description?: string | null;
  teacherName: string;
  teacherPhoto?: string | null;
  totalLectures: number;
  totalDpps: number;
  totalTests: number;
  totalQuestions: number;
  totalDurationMin: number;
  dateRangeStr?: string;
  canEdit: boolean;
  onDeleteClick?: () => void;
}

export function TeacherChapterHeader({
  chapterId,
  chapterCode,
  chapterTitle,
  subjectTitle,
  courseTitle,
  medium,
  status,
  description,
  teacherName,
  teacherPhoto,
  totalLectures,
  totalDpps,
  totalTests,
  totalQuestions,
  totalDurationMin,
  dateRangeStr,
  canEdit,
  onDeleteClick,
}: TeacherChapterHeaderProps) {
  const router = useRouter();
  const [showFullDesc, setShowFullDesc] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [noticeBoardOpen, setNoticeBoardOpen] = useState(false);
  const [noticeCount, setNoticeCount] = useState<number>(0);

  // Fetch notice count for badge
  useEffect(() => {
    fetch(`/api/chapters/${chapterId}/notices`)
      .then((res) => res.json())
      .then((data) => {
        if (data.success && Array.isArray(data.notices)) {
          setNoticeCount(data.notices.length);
        }
      })
      .catch(() => {});
  }, [chapterId]);

  const isApproved = status === "APPROVED" || status === "PUBLISHED";
  const isUnderReview = status === "UNDER_REVIEW";

  const mediumDisplay =
    medium === "HINDI" ? "Hindi" : medium === "HINGLISH" ? "Hinglish" : "English";

  const totalHours = (totalDurationMin / 60).toFixed(1);

  // Default description text if empty
  const defaultDesc = `NEET 2026 ${subjectTitle} के लिए ${teacherName} सर आपको नए सभी विषय वस्तु से अवगत कराएंगे। हम भारत के सबसे अच्छी टीम के साथ आपको NEET / JEE परीक्षा में प्रवेश का मार्गदर्शन एवं चयन के लिए आपके मार्ग का पाठ प्रशस्त करेंगे।`;
  const descText = description?.trim() || defaultDesc;

  const handleShare = () => {
    if (typeof window !== "undefined") {
      const url = `${window.location.origin}/team/chapters/${chapterId}`;
      navigator.clipboard.writeText(url);
      toast.success("Chapter link copied to clipboard!");
      setMenuOpen(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Main Chapter Card */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-3xl p-6 md:p-8 shadow-sm relative">
        {/* Navigation & Tag Row */}
        <div className="flex items-center justify-between gap-3 mb-6">
          <div className="flex items-center gap-3">
            <Link
              href="/team/chapters"
              className="w-10 h-10 rounded-2xl bg-slate-50 hover:bg-slate-100 dark:bg-slate-800 dark:hover:bg-slate-700 border border-slate-200/80 dark:border-slate-700 flex items-center justify-center text-slate-700 dark:text-slate-300 transition-all shadow-xs"
              title="Back to Chapters list"
            >
              <ArrowLeft className="w-5 h-5" />
            </Link>

            <span className="px-3.5 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-bold border border-slate-200/60 dark:border-slate-700">
              {courseTitle || "Plus courses"}
            </span>

            <span className="px-3 py-1 rounded-xl bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 text-xs font-extrabold uppercase tracking-wide border border-blue-200/60 dark:border-blue-900/40">
              {mediumDisplay}
            </span>
          </div>

          {/* Status Badge */}
          <div className="flex items-center gap-2">
            <span
              className={`px-3.5 py-1.5 rounded-full text-xs font-black uppercase tracking-wider flex items-center gap-1.5 ${
                isApproved
                  ? "bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-300 dark:border-emerald-800"
                  : isUnderReview
                  ? "bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-950/50 dark:text-amber-300 dark:border-amber-800 animate-pulse"
                  : "bg-slate-100 text-slate-700 border border-slate-200 dark:bg-slate-800 dark:text-slate-300"
              }`}
            >
              {isApproved && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />}
              {isUnderReview && <Clock className="w-3.5 h-3.5 text-amber-600" />}
              <span>{isApproved ? "Approved / Active" : status.replaceAll("_", " ")}</span>
            </span>
          </div>
        </div>

        {/* Content Layout: Thumbnail Banner (Left) + Details (Right) */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8 items-start">
          {/* Chapter Thumbnail Poster */}
          <div className="lg:col-span-4">
            <div className="relative aspect-[16/10] sm:aspect-[16/9] w-full rounded-2xl overflow-hidden bg-gradient-to-br from-indigo-100 via-purple-100 to-indigo-200 dark:from-indigo-950 dark:via-purple-950 dark:to-slate-900 border border-indigo-200/80 dark:border-indigo-800/80 shadow-inner flex items-center justify-center p-4">
              {/* Subtle Dotted Matrix Graphic */}
              <div
                className="absolute inset-0 opacity-20 pointer-events-none"
                style={{
                  backgroundImage: "radial-gradient(#6366f1 1.5px, transparent 1.5px)",
                  backgroundSize: "14px 14px",
                }}
              />

              {/* Center Silhouette / Avatar */}
              <div className="relative z-10 flex flex-col items-center justify-center text-center">
                <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-full bg-indigo-500/20 border-2 border-indigo-400/40 flex items-center justify-center text-indigo-700 dark:text-indigo-300 shadow-md">
                  {teacherPhoto ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={teacherPhoto}
                      alt={teacherName}
                      className="w-full h-full rounded-full object-cover"
                    />
                  ) : (
                    <div className="w-14 h-14 rounded-full bg-indigo-600 text-white flex items-center justify-center font-black text-xl shadow-inner">
                      {teacherName.charAt(0).toUpperCase() || "A"}
                    </div>
                  )}
                </div>
                <span className="mt-2 text-xs font-bold text-indigo-900 dark:text-indigo-200">
                  {teacherName}
                </span>
                <span className="text-[10px] text-indigo-600 dark:text-indigo-400 font-medium">
                  {subjectTitle} Expert
                </span>
              </div>
            </div>
          </div>

          {/* Chapter Overview & Metadata */}
          <div className="lg:col-span-8 space-y-4">
            <div>
              <span className="text-xs font-bold text-orange-600 dark:text-orange-400 uppercase tracking-widest block mb-1">
                {subjectTitle} &middot; {chapterCode ? `Chapter ${chapterCode}` : "Course Module"}
              </span>
              <h1 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white tracking-tight leading-snug">
                {chapterTitle}
              </h1>
            </div>

            {/* Description with Read more toggle */}
            <div className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
              <p className={showFullDesc ? "" : "line-clamp-2"}>{descText}</p>
              {descText.length > 120 && (
                <button
                  type="button"
                  onClick={() => setShowFullDesc((v) => !v)}
                  className="text-blue-600 dark:text-blue-400 font-bold hover:underline mt-1 inline-block focus:outline-none cursor-pointer"
                >
                  {showFullDesc ? "Show less" : "Read more"}
                </button>
              )}
            </div>

            {/* Metrics Chips Row */}
            <div className="flex flex-wrap items-center gap-3 pt-2">
              {/* Date Range Chip */}
              <div className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-300">
                <Calendar className="w-4 h-4 text-blue-600 shrink-0" />
                <span>{dateRangeStr || "Active Academic Schedule"}</span>
              </div>

              {/* Lessons Count Chip */}
              <div className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-300">
                <Play className="w-4 h-4 text-purple-600 fill-purple-600 shrink-0" />
                <span>
                  {totalLectures} lesson{totalLectures === 1 ? "" : "s"}
                </span>
              </div>

              {/* Practices & DPPs Count Chip */}
              <div className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-300">
                <Zap className="w-4 h-4 text-amber-500 fill-amber-500 shrink-0" />
                <span>
                  {totalDpps} practice{totalDpps === 1 ? "" : "s"}{" "}
                  {totalQuestions > 0 ? `• ${totalQuestions} questions` : ""}
                </span>
              </div>

              {/* Tests Chip */}
              {totalTests > 0 && (
                <div className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-300">
                  <HelpCircle className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>
                    {totalTests} test{totalTests === 1 ? "" : "s"}
                  </span>
                </div>
              )}
            </div>

            {/* Action Bar (Discussion Forum + Notice Board + Share + Three-Dot Menu) */}
            <div className="flex flex-wrap items-center gap-3 pt-3 border-t border-slate-100 dark:border-slate-800">
              <Link
                href="/team/guru"
                className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-extrabold shadow-md shadow-blue-500/20 transition-all flex items-center gap-2"
              >
                <MessageSquare className="w-4 h-4" />
                <span>Discussion Forum</span>
              </Link>

              {/* Chapter Notice Board Button */}
              <button
                type="button"
                onClick={() => setNoticeBoardOpen(true)}
                className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-slate-950 text-xs font-black shadow-md shadow-amber-500/20 transition-all flex items-center gap-2 cursor-pointer"
              >
                <Bell className="w-4 h-4 text-slate-950 fill-slate-950" />
                <span>Notice Board</span>
                {noticeCount > 0 && (
                  <span className="px-1.5 py-0.5 rounded-full bg-slate-950 text-amber-300 text-[10px] font-black">
                    {noticeCount}
                  </span>
                )}
              </button>

              <button
                type="button"
                onClick={handleShare}
                className="w-10 h-10 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 flex items-center justify-center text-slate-600 dark:text-slate-300 transition-colors cursor-pointer"
                title="Share Chapter Link"
              >
                <Share2 className="w-4 h-4" />
              </button>

              {/* Three-Dot Dropdown Menu */}
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setMenuOpen((v) => !v)}
                  className="w-10 h-10 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 flex items-center justify-center text-slate-600 dark:text-slate-300 transition-colors cursor-pointer"
                  title="More actions"
                >
                  <MoreVertical className="w-4 h-4" />
                </button>

                {menuOpen && (
                  <div className="absolute left-0 sm:right-0 sm:left-auto top-12 w-52 bg-white dark:bg-slate-900 rounded-2xl shadow-xl border border-slate-200/80 dark:border-slate-800 py-1.5 z-30 animate-in fade-in zoom-in-95">
                    {canEdit && (
                      <Link
                        href={`/team/chapters/${chapterId}/edit`}
                        onClick={() => setMenuOpen(false)}
                        className="flex items-center gap-2.5 px-4 py-2.5 text-xs font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 hover:text-slate-900 transition"
                      >
                        <Edit2 className="w-4 h-4 text-blue-500" />
                        <span>Edit Chapter Details</span>
                      </Link>
                    )}

                    <button
                      type="button"
                      onClick={handleShare}
                      className="w-full flex items-center gap-2.5 px-4 py-2.5 text-xs font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 hover:text-slate-900 transition text-left cursor-pointer"
                    >
                      <Share2 className="w-4 h-4 text-indigo-500" />
                      <span>Share Chapter Link</span>
                    </button>

                    {canEdit && onDeleteClick && (
                      <button
                        type="button"
                        onClick={() => {
                          setMenuOpen(false);
                          onDeleteClick();
                        }}
                        className="w-full flex items-center gap-2.5 px-4 py-2.5 text-xs font-bold text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition text-left cursor-pointer border-t border-slate-100 dark:border-slate-800"
                      >
                        <Trash2 className="w-4 h-4 text-rose-500" />
                        <span>Delete Chapter</span>
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Statistics Cards Row (Matching Reference) */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* Hours Taught Card */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-3xl p-5 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider block">
              Hours taught
            </span>
            <span className="text-2xl font-black text-slate-900 dark:text-white font-mono mt-1 block">
              {totalHours} / {Math.max(Number(totalHours), 15)}h
            </span>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200/80 dark:border-emerald-800 text-emerald-600 flex items-center justify-center">
            <Clock className="w-6 h-6" />
          </div>
        </div>

        {/* Watch Minutes Card */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-3xl p-5 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider block">
              Watch minutes
            </span>
            <span className="text-2xl font-black text-slate-900 dark:text-white font-mono mt-1 block">
              {totalDurationMin * 12}
            </span>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-rose-50 dark:bg-rose-950/60 border border-rose-200/80 dark:border-rose-800 text-rose-600 flex items-center justify-center">
            <Radio className="w-6 h-6" />
          </div>
        </div>

        {/* Rating Card */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-3xl p-5 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider block">
              Rating
            </span>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-2xl font-black text-slate-900 dark:text-white font-mono">5.0</span>
              <span className="text-xs text-slate-400 font-medium">(24 ratings)</span>
            </div>
            <span className="text-[11px] font-bold text-blue-600 dark:text-blue-400 uppercase tracking-wider mt-1 block hover:underline cursor-pointer">
              VIEW DETAILS
            </span>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-amber-50 dark:bg-amber-950/60 border border-amber-200/80 dark:border-amber-800 text-amber-500 flex items-center justify-center">
            <Star className="w-6 h-6 fill-amber-500" />
          </div>
        </div>
      </div>

      {/* Chapter Notice Board Modal */}
      <TeacherChapterNoticeBoard
        chapterId={chapterId}
        chapterTitle={chapterTitle}
        isOpen={noticeBoardOpen}
        onClose={() => setNoticeBoardOpen(false)}
        canEdit={canEdit}
        onNoticeCountChange={setNoticeCount}
      />
    </div>
  );
}
