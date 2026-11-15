"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

interface UpcomingTestWaitingRoomProps {
  testId: string;
  testTitle: string;
  openTime: string;
  durationMin: number;
  totalQuestions: number;
  targetExam?: string;
  batchName?: string;
  instructions?: string | null;
}

export function UpcomingTestWaitingRoom({
  testId,
  testTitle,
  openTime,
  durationMin,
  totalQuestions,
  targetExam = "NEET UG",
  batchName,
  instructions,
}: UpcomingTestWaitingRoomProps) {
  const router = useRouter();
  const targetDate = new Date(openTime);

  const [timeLeft, setTimeLeft] = useState<{
    hours: number;
    minutes: number;
    seconds: number;
    totalSec: number;
  }>({ hours: 0, minutes: 0, seconds: 0, totalSec: 1 });

  const [isLive, setIsLive] = useState(false);

  useEffect(() => {
    const calc = () => {
      const now = new Date();
      const diffMs = targetDate.getTime() - now.getTime();
      if (diffMs <= 0) {
        setIsLive(true);
        setTimeLeft({ hours: 0, minutes: 0, seconds: 0, totalSec: 0 });
        return;
      }
      const totalSec = Math.floor(diffMs / 1000);
      const hours = Math.floor(totalSec / 3600);
      const minutes = Math.floor((totalSec % 3600) / 60);
      const seconds = totalSec % 60;
      setTimeLeft({ hours, minutes, seconds, totalSec });
    };

    calc();
    const interval = setInterval(calc, 1000);
    return () => clearInterval(interval);
  }, [openTime]);

  const formattedTime = targetDate.toLocaleString("en-IN", {
    timeZone: "Asia/Kolkata",
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });

  return (
    <div className="min-h-screen bg-[#f8fafc] dark:bg-slate-950 flex flex-col justify-between p-4 sm:p-6 lg:p-8 font-sans">
      <div className="max-w-3xl mx-auto w-full my-auto space-y-6">
        {/* Navigation Bar */}
        <div className="flex items-center justify-between">
          <Link
            href="/schedule"
            className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-slate-800 dark:hover:text-white transition"
          >
            <span className="material-symbols-outlined text-sm">arrow_back</span>
            <span>Back to My Schedule</span>
          </Link>
          <span className="px-3 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-200 dark:border-amber-800 flex items-center gap-1">
            <span className="material-symbols-outlined text-xs">schedule</span>
            <span>Scheduled Test</span>
          </span>
        </div>

        {/* Hero Card */}
        <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-6 sm:p-10 shadow-xl text-center space-y-6">
          <div className="w-16 h-16 rounded-2xl bg-blue-100 dark:bg-blue-950 text-blue-600 dark:text-blue-400 mx-auto flex items-center justify-center shadow-lg shadow-blue-500/10">
            <span className="material-symbols-outlined text-3xl">timer</span>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-center gap-2">
              <span className="px-2.5 py-0.5 rounded-md bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 text-[11px] font-bold uppercase">
                {targetExam}
              </span>
              {batchName && (
                <span className="text-xs text-slate-400 font-medium">
                  • {batchName}
                </span>
              )}
            </div>
            <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white">
              {testTitle}
            </h1>
            <p className="text-xs sm:text-sm text-slate-500">
              Starts at <strong className="text-slate-800 dark:text-slate-200">{formattedTime}</strong>
            </p>
          </div>

          {/* Countdown Clock Display */}
          {!isLive ? (
            <div className="p-4 sm:p-6 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800 max-w-md mx-auto">
              <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-3">
                Exam Unlocks In
              </p>
              <div className="grid grid-cols-3 gap-3">
                <div className="p-3 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700">
                  <div className="font-mono font-black text-2xl sm:text-3xl text-slate-900 dark:text-white">
                    {String(timeLeft.hours).padStart(2, "0")}
                  </div>
                  <div className="text-[10px] font-bold text-slate-400 uppercase mt-0.5">Hours</div>
                </div>
                <div className="p-3 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700">
                  <div className="font-mono font-black text-2xl sm:text-3xl text-slate-900 dark:text-white">
                    {String(timeLeft.minutes).padStart(2, "0")}
                  </div>
                  <div className="text-[10px] font-bold text-slate-400 uppercase mt-0.5">Minutes</div>
                </div>
                <div className="p-3 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700">
                  <div className="font-mono font-black text-2xl sm:text-3xl text-blue-600">
                    {String(timeLeft.seconds).padStart(2, "0")}
                  </div>
                  <div className="text-[10px] font-bold text-slate-400 uppercase mt-0.5">Seconds</div>
                </div>
              </div>
            </div>
          ) : (
            <div className="p-5 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200 text-sm font-bold animate-pulse">
              ✓ The scheduled start time has arrived! You can now start the exam.
            </div>
          )}

          {/* Test Metadata Badges */}
          <div className="grid grid-cols-3 gap-3 text-center max-w-md mx-auto pt-2">
            <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800">
              <span className="block text-slate-400 text-[10px] uppercase font-bold">Duration</span>
              <span className="font-black text-xs sm:text-sm text-slate-800 dark:text-slate-100">{durationMin} Mins</span>
            </div>
            <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800">
              <span className="block text-slate-400 text-[10px] uppercase font-bold">Questions</span>
              <span className="font-black text-xs sm:text-sm text-slate-800 dark:text-slate-100">{totalQuestions}</span>
            </div>
            <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800">
              <span className="block text-slate-400 text-[10px] uppercase font-bold">Total Marks</span>
              <span className="font-black text-xs sm:text-sm text-slate-800 dark:text-slate-100">{totalQuestions * 4}</span>
            </div>
          </div>

          {/* Action Button */}
          <div className="pt-2 max-w-md mx-auto">
            {isLive ? (
              <button
                type="button"
                onClick={() => router.refresh()}
                className="w-full py-4 rounded-2xl bg-violet-600 hover:bg-violet-700 text-white font-black text-base shadow-xl shadow-violet-500/25 transition active:scale-95 flex items-center justify-center gap-2"
              >
                <span className="material-symbols-outlined text-lg">play_arrow</span>
                <span>Start Test Now</span>
              </button>
            ) : (
              <button
                type="button"
                disabled
                className="w-full py-4 rounded-2xl bg-slate-200 dark:bg-slate-800 text-slate-400 dark:text-slate-500 font-bold text-xs sm:text-sm cursor-not-allowed flex items-center justify-center gap-2"
              >
                <span className="material-symbols-outlined text-sm">lock</span>
                <span>Unlocks at {formattedTime}</span>
              </button>
            )}
          </div>
        </div>

        {/* Quick Instructions Card */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 text-xs text-slate-600 dark:text-slate-300 space-y-2.5">
          <h3 className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
            <span className="material-symbols-outlined text-sm text-blue-600">info</span>
            <span>Important Guidelines</span>
          </h3>
          <ul className="list-disc pl-5 space-y-1 text-slate-500 dark:text-slate-400 leading-relaxed">
            <li>Ensure a stable internet connection before the exam unlocks.</li>
            <li>Each correct answer earns <strong>+4 marks</strong>; each incorrect answer deducts <strong>-1 mark</strong>.</li>
            <li>Once started, the exam countdown will run on the server. You can scroll through all questions and mark for review.</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
