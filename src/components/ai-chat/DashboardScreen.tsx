"use client";

import {
  AlertTriangle,
  ArrowLeft,
  Award,
  BookOpen,
  CheckCircle2,
  Flame,
  Sparkles,
  Target,
  TrendingUp,
  Trophy,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useAiChatUser } from "@/components/ai-chat/AiChatUserContext";

interface HeatmapCell {
  date: string;
  count: number;
  level: number;
}

interface SubjectConfidence {
  subject: string;
  confidence: number;
  attempts: number;
}

interface DashboardStats {
  xp: number;
  level: number;
  xpIntoLevel: number;
  xpForNextLevel: number;
  currentStreak: number;
  longestStreak: number;
  accuracy: number | null;
  consistency: number;
  healthScore: number;
  heatmap: HeatmapCell[];
  subjectConfidence: SubjectConfidence[];
  weakChapters: string[];
  strongChapters: string[];
  favoriteSubject: string | null;
}

const HEATMAP_COLORS = [
  "bg-slate-100 dark:bg-slate-800",
  "bg-orange-200 dark:bg-orange-950",
  "bg-orange-400 dark:bg-orange-700",
  "bg-atomic-orange",
];

function confidenceColor(value: number) {
  if (value < 50) return { text: "text-red-500", bar: "bg-red-500", bg: "bg-red-50 dark:bg-red-950/20" };
  if (value < 75) return { text: "text-amber-500", bar: "bg-amber-500", bg: "bg-amber-50 dark:bg-amber-950/20" };
  return { text: "text-emerald-500", bar: "bg-emerald-500", bg: "bg-emerald-50 dark:bg-emerald-950/20" };
}

export function DashboardScreen() {
  // This route group is already server-gated to a signed-in atomic-ops
  // user, so the source's `if (!user)` sign-in prompt is unreachable here
  // and was dropped.
  const { user } = useAiChatUser();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    fetch("/api/ai-chat/dashboard-stats", { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) throw new Error("Could not load dashboard.");
        return response.json() as Promise<DashboardStats>;
      })
      .then(setStats)
      .catch((caughtError) =>
        setError(caughtError instanceof Error ? caughtError.message : "Could not load dashboard.")
      )
      .finally(() => setLoading(false));
  }, []);

  return (
    <main className="min-h-dvh bg-gradient-to-b from-orange-50/40 to-white dark:from-slate-950 dark:to-atomic-navy">
      <div className="mx-auto max-w-6xl px-4 py-7 sm:px-6">
        <div className="mb-6 flex items-center justify-between gap-4">
          <div>
            <p className="text-sm font-medium text-atomic-orange">Atomic Pathshala</p>
            <h1 className="text-2xl font-bold sm:text-3xl">
              Welcome back{user.name ? `, ${user.name.split(" ")[0]}` : ""} 👋
            </h1>
          </div>
          <Link
            href="/guru"
            className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
            title="Return to chat"
            aria-label="Return to chat"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>
        </div>

        {loading && (
          <div className="flex items-center justify-center py-24">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-atomic-orange border-t-transparent" />
          </div>
        )}

        {error && (
          <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600 dark:border-red-900 dark:bg-red-900/20 dark:text-red-300">
            {error}
          </p>
        )}

        {stats && (
          <div className="space-y-6">
            {/* Top row: XP / Streak / Health */}
            <div className="grid gap-4 lg:grid-cols-3">
              <div className="rounded-2xl border border-white/60 bg-white/70 p-6 shadow-lg shadow-orange-100/50 backdrop-blur-xl dark:border-slate-700/60 dark:bg-slate-900/70">
                <div className="mb-4 flex items-center gap-2">
                  <Trophy className="h-5 w-5 text-atomic-orange" />
                  <h2 className="font-semibold">Level {stats.level}</h2>
                </div>
                <div className="mb-2 flex items-end justify-between text-sm">
                  <span className="text-slate-500">XP Progress</span>
                  <span className="font-mono font-semibold">
                    {stats.xpIntoLevel} / {stats.xpForNextLevel}
                  </span>
                </div>
                <div className="h-2.5 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                  <div
                    className="h-full rounded-full bg-atomic-orange transition-all"
                    style={{ width: `${(stats.xpIntoLevel / stats.xpForNextLevel) * 100}%` }}
                  />
                </div>
                <p className="mt-3 text-xs text-slate-500">Total XP earned: {stats.xp}</p>
              </div>

              <div className="rounded-2xl border border-white/60 bg-white/70 p-6 shadow-lg shadow-orange-100/50 backdrop-blur-xl dark:border-slate-700/60 dark:bg-slate-900/70">
                <div className="mb-4 flex items-center gap-2">
                  <Flame className="h-5 w-5 text-amber-500" />
                  <h2 className="font-semibold">Study Streak</h2>
                </div>
                <p className="font-mono text-4xl font-bold text-atomic-orange">{stats.currentStreak}</p>
                <p className="text-sm text-slate-500">day{stats.currentStreak === 1 ? "" : "s"} in a row</p>
                <p className="mt-3 text-xs text-slate-500">Longest streak: {stats.longestStreak} days</p>
              </div>

              <div className="rounded-2xl border border-white/60 bg-white/70 p-6 shadow-lg shadow-orange-100/50 backdrop-blur-xl dark:border-slate-700/60 dark:bg-slate-900/70">
                <div className="mb-4 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Sparkles className="h-5 w-5 text-atomic-orange" />
                    <h2 className="font-semibold">Health Score</h2>
                  </div>
                  <span className="font-mono text-2xl font-bold text-atomic-orange">{stats.healthScore}</span>
                </div>
                <div className="grid grid-cols-2 gap-3 text-center">
                  <div className="rounded-xl bg-slate-50 py-2 dark:bg-slate-800">
                    <p className="font-mono font-bold">{stats.consistency}%</p>
                    <p className="text-[10px] uppercase text-slate-500">Consistency</p>
                  </div>
                  <div className="rounded-xl bg-slate-50 py-2 dark:bg-slate-800">
                    <p className="font-mono font-bold">{stats.accuracy !== null ? `${stats.accuracy}%` : "—"}</p>
                    <p className="text-[10px] uppercase text-slate-500">Accuracy</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Subject confidence */}
            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-900">
              <div className="mb-5 flex items-center gap-2">
                <Target className="h-5 w-5 text-atomic-orange" />
                <h2 className="font-semibold">Subject Performance</h2>
              </div>
              {stats.subjectConfidence.length === 0 ? (
                <p className="text-sm text-slate-500">
                  No quiz attempts yet. Take a NEET Quiz to see your subject-wise confidence here.
                </p>
              ) : (
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {stats.subjectConfidence.map((item) => {
                    const colors = confidenceColor(item.confidence);
                    return (
                      <div key={item.subject} className={`rounded-xl p-4 ${colors.bg}`}>
                        <div className="mb-2 flex items-center justify-between">
                          <span className="font-semibold">{item.subject}</span>
                          <span className={`font-mono font-bold ${colors.text}`}>{item.confidence}%</span>
                        </div>
                        <div className="h-2 w-full overflow-hidden rounded-full bg-white/60 dark:bg-black/20">
                          <div
                            className={`h-full rounded-full ${colors.bar}`}
                            style={{ width: `${item.confidence}%` }}
                          />
                        </div>
                        <p className="mt-2 text-xs text-slate-500">
                          Based on {item.attempts} attempt{item.attempts === 1 ? "" : "s"}
                        </p>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Weak / Strong chapters */}
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-900">
                <div className="mb-3 flex items-center gap-2 text-red-500">
                  <AlertTriangle className="h-5 w-5" />
                  <h2 className="font-semibold">Chapters to revise</h2>
                </div>
                {stats.weakChapters.length === 0 ? (
                  <p className="text-sm text-slate-500">
                    None marked yet — add weak chapters from Settings to track them here.
                  </p>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {stats.weakChapters.map((chapter) => (
                      <span
                        key={chapter}
                        className="rounded-full bg-red-50 px-3 py-1 text-xs font-medium text-red-600 dark:bg-red-950/20 dark:text-red-300"
                      >
                        {chapter}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-900">
                <div className="mb-3 flex items-center gap-2 text-emerald-600">
                  <CheckCircle2 className="h-5 w-5" />
                  <h2 className="font-semibold">Core strengths</h2>
                </div>
                {stats.strongChapters.length === 0 ? (
                  <p className="text-sm text-slate-500">
                    None marked yet — add strong chapters from Settings to track them here.
                  </p>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {stats.strongChapters.map((chapter) => (
                      <span
                        key={chapter}
                        className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700 dark:bg-emerald-950/20 dark:text-emerald-300"
                      >
                        {chapter}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Heatmap */}
            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-900">
              <div className="mb-4 flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-atomic-orange" />
                <h2 className="font-semibold">Learning Activity (last 90 days)</h2>
              </div>
              <div className="flex flex-wrap gap-1">
                {stats.heatmap.map((cell) => (
                  <div
                    key={cell.date}
                    title={`${cell.date}: ${cell.count} activities`}
                    className={`h-3 w-3 rounded-sm ${HEATMAP_COLORS[cell.level]}`}
                  />
                ))}
              </div>
              <div className="mt-3 flex items-center justify-between text-[10px] uppercase text-slate-400">
                <span>Last 90 days</span>
                <div className="flex items-center gap-1">
                  Less
                  {HEATMAP_COLORS.map((color, index) => (
                    <div key={index} className={`h-3 w-3 rounded-sm ${color}`} />
                  ))}
                  More
                </div>
              </div>
            </div>

            {/* Quick actions */}
            <div className="flex flex-wrap gap-3">
              <Link
                href="/guru"
                className="inline-flex items-center gap-2 rounded-xl bg-atomic-orange px-4 py-2.5 text-sm font-semibold text-white hover:bg-atomic-orange-dark"
              >
                <BookOpen className="h-4 w-4" />
                Ask a doubt
              </Link>
              <Link
                href="/guru/schedule"
                className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-medium hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800"
              >
                <Award className="h-4 w-4" />
                View class schedule
              </Link>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
