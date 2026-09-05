"use client";

import React, { useState } from "react";
import {
  Bell,
  Pin,
  AlertCircle,
  Megaphone,
  BookOpen,
  FileCheck,
  Calendar,
  User,
  Sparkles,
} from "lucide-react";

export interface StudentNoticeItem {
  id: string;
  chapterId: string;
  title: string;
  content: string;
  category: "ANNOUNCEMENT" | "IMPORTANT" | "EXAM" | "HOMEWORK" | "GENERAL" | string;
  isPinned: boolean;
  authorName: string;
  authorRole: string;
  createdAt: string | Date;
}

const CATEGORY_CONFIG: Record<
  string,
  { label: string; icon: any; badgeBg: string; textColor: string; borderColor: string }
> = {
  ANNOUNCEMENT: {
    label: "Announcement",
    icon: Megaphone,
    badgeBg: "bg-blue-50 dark:bg-blue-950/60",
    textColor: "text-blue-700 dark:text-blue-300",
    borderColor: "border-blue-200 dark:border-blue-800",
  },
  IMPORTANT: {
    label: "Important Alert",
    icon: AlertCircle,
    badgeBg: "bg-rose-50 dark:bg-rose-950/60",
    textColor: "text-rose-700 dark:text-rose-300",
    borderColor: "border-rose-200 dark:border-rose-800",
  },
  EXAM: {
    label: "Test / Exam Update",
    icon: FileCheck,
    badgeBg: "bg-purple-50 dark:bg-purple-950/60",
    textColor: "text-purple-700 dark:text-purple-300",
    borderColor: "border-purple-200 dark:border-purple-800",
  },
  HOMEWORK: {
    label: "Homework & DPP",
    icon: BookOpen,
    badgeBg: "bg-amber-50 dark:bg-amber-950/60",
    textColor: "text-amber-700 dark:text-amber-300",
    borderColor: "border-amber-200 dark:border-amber-800",
  },
  GENERAL: {
    label: "General Notice",
    icon: Bell,
    badgeBg: "bg-slate-100 dark:bg-slate-800",
    textColor: "text-slate-700 dark:text-slate-300",
    borderColor: "border-slate-200 dark:border-slate-700",
  },
};

const DEFAULT_CATEGORY = {
  label: "General Notice",
  icon: Bell,
  badgeBg: "bg-slate-100 dark:bg-slate-800",
  textColor: "text-slate-700 dark:text-slate-300",
  borderColor: "border-slate-200 dark:border-slate-700",
};

interface StudentChapterNoticeBoardProps {
  notices: StudentNoticeItem[];
  chapterTitle: string;
  subjectName: string;
}

export function StudentChapterNoticeBoard({
  notices,
  chapterTitle,
  subjectName,
}: StudentChapterNoticeBoardProps) {
  const [activeCategory, setActiveCategory] = useState<string>("ALL");

  const filteredNotices = notices.filter(
    (n) => activeCategory === "ALL" || n.category === activeCategory
  );

  return (
    <div className="space-y-6">
      {/* Notice Board Header Bar */}
      <div className="bg-gradient-to-br from-indigo-900 via-slate-900 to-slate-950 rounded-3xl p-6 text-white shadow-lg border border-indigo-500/20 relative overflow-hidden">
        <div className="absolute top-0 right-0 -mt-8 -mr-8 w-44 h-44 bg-amber-500/10 rounded-full blur-2xl pointer-events-none" />
        <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-amber-400 text-xs font-black uppercase tracking-wider mb-1.5">
              <Bell className="w-4 h-4" />
              <span>Official Chapter Notice Board</span>
              <span className="px-2 py-0.5 rounded-full bg-white/15 text-white text-[10px] font-bold">
                {notices.length} Notice{notices.length === 1 ? "" : "s"}
              </span>
            </div>
            <h2 className="text-xl sm:text-2xl font-black tracking-tight leading-snug">
              {chapterTitle}
            </h2>
            <p className="text-xs text-indigo-200/80 mt-1">
              Important announcements, live lecture reschedules, test alerts, and daily study guidelines from your faculty.
            </p>
          </div>

          <div className="shrink-0 flex items-center gap-2 bg-white/10 px-3.5 py-2 rounded-2xl border border-white/15 backdrop-blur-md">
            <Sparkles className="w-4 h-4 text-amber-300" />
            <span className="text-xs font-bold text-slate-200">{subjectName} Department</span>
          </div>
        </div>
      </div>

      {/* Category Filter Pills */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none text-xs">
        <button
          type="button"
          onClick={() => setActiveCategory("ALL")}
          className={`px-4 py-2 rounded-xl font-bold transition whitespace-nowrap cursor-pointer ${
            activeCategory === "ALL"
              ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900 shadow-sm"
              : "bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:bg-slate-50"
          }`}
        >
          All Notices ({notices.length})
        </button>

        {Object.entries(CATEGORY_CONFIG).map(([key, cfg]) => {
          const count = notices.filter((n) => n.category === key).length;
          if (count === 0 && notices.length > 0) return null;
          const Icon = cfg.icon;
          return (
            <button
              key={key}
              type="button"
              onClick={() => setActiveCategory(key)}
              className={`px-3.5 py-2 rounded-xl font-bold transition whitespace-nowrap flex items-center gap-1.5 cursor-pointer ${
                activeCategory === key
                  ? "bg-indigo-600 text-white shadow-sm"
                  : "bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:bg-slate-50"
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              <span>{cfg.label}</span>
              <span className="text-[10px] opacity-80">({count})</span>
            </button>
          );
        })}
      </div>

      {/* Notices List */}
      {filteredNotices.length === 0 ? (
        <div className="py-16 text-center rounded-3xl border-2 border-dashed border-slate-200 dark:border-slate-800 bg-white/50 dark:bg-slate-900/50 p-8 space-y-3">
          <div className="w-14 h-14 rounded-2xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 mx-auto flex items-center justify-center">
            <Bell className="w-7 h-7" />
          </div>
          <h3 className="text-base font-bold text-slate-800 dark:text-white">
            No Active Notices in This Category
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto">
            Your teachers post revision schedules, test announcements, and important hints here. Check back regularly!
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredNotices.map((notice) => {
            const cfg = CATEGORY_CONFIG[notice.category] || DEFAULT_CATEGORY;
            const Icon = cfg.icon;
            const formattedDate = new Intl.DateTimeFormat("en-IN", {
              day: "numeric",
              month: "short",
              year: "numeric",
              hour: "2-digit",
              minute: "2-digit",
            }).format(new Date(notice.createdAt));

            return (
              <div
                key={notice.id}
                className={`p-5 sm:p-6 rounded-3xl border transition-all ${
                  notice.isPinned
                    ? "bg-gradient-to-br from-amber-50/70 via-white to-amber-50/30 dark:from-amber-950/30 dark:via-slate-900 dark:to-slate-900 border-amber-300 dark:border-amber-700/70 shadow-md ring-1 ring-amber-400/30"
                    : "bg-white dark:bg-slate-900 border-slate-200/90 dark:border-slate-800 shadow-xs hover:border-slate-300 dark:hover:border-slate-700"
                }`}
              >
                {/* Header Row: Category Badge + Pinned + Date */}
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <div className="flex items-center gap-2">
                    {notice.isPinned && (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500 text-slate-950 font-black text-[10px] uppercase tracking-wider shadow-xs">
                        <Pin className="w-3.5 h-3.5 fill-slate-950" />
                        <span>PINNED NOTICE</span>
                      </span>
                    )}

                    <span
                      className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-extrabold border ${cfg.badgeBg} ${cfg.textColor} ${cfg.borderColor}`}
                    >
                      <Icon className="w-3.5 h-3.5" />
                      <span>{cfg.label}</span>
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5 text-xs text-slate-400 font-medium">
                    <Calendar className="w-3.5 h-3.5" />
                    <span>{formattedDate}</span>
                  </div>
                </div>

                {/* Notice Title */}
                <h3 className="text-base sm:text-lg font-black text-slate-900 dark:text-white mt-3 mb-2 leading-snug">
                  {notice.title}
                </h3>

                {/* Notice Content */}
                <div className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 whitespace-pre-line leading-relaxed">
                  {notice.content}
                </div>

                {/* Faculty Author Footer */}
                <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs text-slate-400">
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-full bg-indigo-100 dark:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300 flex items-center justify-center text-[10px] font-black">
                      {notice.authorName.charAt(0).toUpperCase() || "A"}
                    </div>
                    <span className="font-bold text-slate-700 dark:text-slate-300">
                      {notice.authorName}
                    </span>
                    <span className="text-[11px] text-slate-400">
                      &bull; Faculty
                    </span>
                  </div>

                  <span className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/60 px-2.5 py-0.5 rounded-full">
                    Atomic Pathshala Verified
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
