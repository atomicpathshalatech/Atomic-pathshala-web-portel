"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Calendar,
  Clock,
  Share2,
  MoreVertical,
  Edit2,
  Trash2,
  MessageSquare,
  CheckCircle2,
  Bell,
  RefreshCw,
  PlayCircle,
  FileText,
  ClipboardCheck,
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

/**
 * Compact chapter header for the team portal: who teaches it, what it
 * belongs to, what's inside, and the few actions a teacher actually uses.
 */
export function TeacherChapterHeader({
  chapterId,
  chapterCode,
  chapterTitle,
  subjectTitle,
  courseTitle,
  medium,
  status,
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
  const [menuOpen, setMenuOpen] = useState(false);
  const [noticeBoardOpen, setNoticeBoardOpen] = useState(false);
  const [noticeCount, setNoticeCount] = useState<number>(0);
  const [regenerating, setRegenerating] = useState(false);

  useEffect(() => {
    fetch(`/api/chapters/${chapterId}/notices`)
      .then((res) => res.json())
      .then((data) => {
        if (data.success && Array.isArray(data.notices)) setNoticeCount(data.notices.length);
      })
      .catch(() => {});
  }, [chapterId]);

  const isApproved = status === "APPROVED" || status === "PUBLISHED";
  const isUnderReview = status === "UNDER_REVIEW";
  const mediumDisplay = medium === "HINDI" ? "Hindi" : medium === "HINGLISH" ? "Hinglish" : "English";
  const hours = totalDurationMin / 60;

  const handleShare = () => {
    const url = `${window.location.origin}/team/chapters/${chapterId}`;
    navigator.clipboard.writeText(url).then(
      () => toast.success("Chapter link copied"),
      () => toast.error("Could not copy the link")
    );
    setMenuOpen(false);
  };

  const regenerateThumbnail = async () => {
    setMenuOpen(false);
    setRegenerating(true);
    try {
      const res = await fetch("/api/team/creatives/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "CHAPTER", entityId: chapterId, force: true }),
      });
      const json = await res.json();
      if (!json.success) {
        toast.error(json.error || "Could not regenerate the thumbnail.");
        return;
      }
      toast.success("Chapter thumbnail regenerated.");
      router.refresh();
    } catch {
      toast.error("Network error while regenerating the thumbnail.");
    } finally {
      setRegenerating(false);
    }
  };

  const statusPill = isApproved
    ? { label: "Approved", cls: "bg-emerald-50 text-emerald-700 ring-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-300 dark:ring-emerald-900", icon: <CheckCircle2 className="w-3.5 h-3.5" /> }
    : isUnderReview
    ? { label: "Under review", cls: "bg-amber-50 text-amber-700 ring-amber-200 dark:bg-amber-950/50 dark:text-amber-300 dark:ring-amber-900", icon: <Clock className="w-3.5 h-3.5" /> }
    : { label: status.replaceAll("_", " ").toLowerCase(), cls: "bg-slate-100 text-slate-600 ring-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:ring-slate-700", icon: null };

  const facts: { icon: React.ReactNode; text: string }[] = [
    { icon: <PlayCircle className="w-3.5 h-3.5" />, text: `${totalLectures} lecture${totalLectures === 1 ? "" : "s"}` },
    { icon: <FileText className="w-3.5 h-3.5" />, text: `${totalDpps} DPP${totalDpps === 1 ? "" : "s"}${totalQuestions > 0 ? ` · ${totalQuestions} Qs` : ""}` },
    { icon: <ClipboardCheck className="w-3.5 h-3.5" />, text: `${totalTests} test${totalTests === 1 ? "" : "s"}` },
  ];
  if (hours > 0) facts.push({ icon: <Clock className="w-3.5 h-3.5" />, text: `${hours % 1 === 0 ? hours : hours.toFixed(1)} h` });
  if (dateRangeStr) facts.unshift({ icon: <Calendar className="w-3.5 h-3.5" />, text: dateRangeStr });

  const iconBtn =
    "h-9 w-9 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 flex items-center justify-center text-slate-600 dark:text-slate-300 transition";
  const softBtn =
    "h-9 px-3.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-200 transition flex items-center gap-1.5";

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-4 sm:p-5 shadow-sm">
      <div className="flex flex-col lg:flex-row lg:items-center gap-4">
        {/* Teacher + chapter identity */}
        <div className="flex items-center gap-3.5 min-w-0 flex-1">
          <div className="w-14 h-14 rounded-2xl overflow-hidden bg-blue-50 dark:bg-blue-950 ring-1 ring-blue-100 dark:ring-blue-900 shrink-0 flex items-center justify-center">
            {teacherPhoto ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={teacherPhoto} alt={teacherName} className="w-full h-full object-cover object-top" />
            ) : (
              <span className="text-lg font-bold text-blue-700 dark:text-blue-300">{teacherName.charAt(0).toUpperCase() || "A"}</span>
            )}
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap text-[11px] font-semibold text-slate-500 dark:text-slate-400">
              <span className="text-blue-700 dark:text-blue-300">{subjectTitle}</span>
              <span className="text-slate-300 dark:text-slate-600">/</span>
              <span className="truncate max-w-[16rem]">{courseTitle}</span>
              <span className="text-slate-300 dark:text-slate-600">/</span>
              <span>{mediumDisplay}</span>
              {chapterCode && (
                <span className="ml-1 font-mono text-[10px] px-1.5 py-px rounded bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400">#{chapterCode}</span>
              )}
            </div>
            <h1 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-white leading-snug truncate" title={chapterTitle}>
              {chapterTitle}
            </h1>
            <div className="mt-1 flex items-center gap-x-3 gap-y-1 flex-wrap text-xs text-slate-500 dark:text-slate-400">
              <span className="font-medium text-slate-700 dark:text-slate-300">{teacherName}</span>
              {facts.map((f) => (
                <span key={f.text} className="inline-flex items-center gap-1">
                  <span className="text-slate-400">{f.icon}</span>
                  {f.text}
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* Status + actions */}
        <div className="flex items-center gap-2 flex-wrap lg:justify-end shrink-0">
          <span className={`h-7 px-2.5 rounded-full ring-1 text-[11px] font-semibold capitalize inline-flex items-center gap-1 ${statusPill.cls}`}>
            {statusPill.icon}
            {statusPill.label}
          </span>
          <button type="button" onClick={() => setNoticeBoardOpen(true)} className={softBtn}>
            <Bell className="w-3.5 h-3.5 text-amber-500" />
            Notices
            {noticeCount > 0 && (
              <span className="min-w-[18px] h-[18px] px-1 rounded-full bg-amber-500 text-white text-[10px] font-bold flex items-center justify-center">{noticeCount}</span>
            )}
          </button>
          <Link href="/team/messages" className={softBtn}>
            <MessageSquare className="w-3.5 h-3.5 text-blue-600" />
            Discussion
          </Link>
          <button type="button" onClick={handleShare} className={iconBtn} title="Copy chapter link">
            <Share2 className="w-4 h-4" />
          </button>
          <div className="relative">
            <button type="button" onClick={() => setMenuOpen((v) => !v)} className={iconBtn} title="More actions">
              {regenerating ? <RefreshCw className="w-4 h-4 animate-spin" /> : <MoreVertical className="w-4 h-4" />}
            </button>
            {menuOpen && (
              <div className="absolute right-0 top-11 w-52 bg-white dark:bg-slate-900 rounded-xl shadow-xl border border-slate-200/80 dark:border-slate-800 py-1 z-30">
                {canEdit && (
                  <Link
                    href={`/team/chapters/${chapterId}/edit`}
                    onClick={() => setMenuOpen(false)}
                    className="flex items-center gap-2.5 px-3.5 py-2 text-xs font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
                  >
                    <Edit2 className="w-3.5 h-3.5 text-slate-400" />
                    Edit chapter details
                  </Link>
                )}
                {canEdit && (
                  <button
                    type="button"
                    onClick={regenerateThumbnail}
                    className="w-full flex items-center gap-2.5 px-3.5 py-2 text-xs font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 text-left"
                  >
                    <RefreshCw className="w-3.5 h-3.5 text-slate-400" />
                    Regenerate thumbnail
                  </button>
                )}
                <button
                  type="button"
                  onClick={handleShare}
                  className="w-full flex items-center gap-2.5 px-3.5 py-2 text-xs font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 text-left"
                >
                  <Share2 className="w-3.5 h-3.5 text-slate-400" />
                  Copy chapter link
                </button>
                {canEdit && onDeleteClick && (
                  <button
                    type="button"
                    onClick={() => {
                      setMenuOpen(false);
                      onDeleteClick();
                    }}
                    className="w-full flex items-center gap-2.5 px-3.5 py-2 text-xs font-medium text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 text-left border-t border-slate-100 dark:border-slate-800"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    Delete chapter
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

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
