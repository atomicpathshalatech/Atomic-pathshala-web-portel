"use client";

import { useState, useMemo } from "react";
import Link from "next/link";

export type TestListItem = {
  id: string;
  title: string;
  subject: string;
  batchName: string;
  durationMin: number;
  questionCount: number;
  startsAt: string;
  endsAt: string;
  statusLabel: string;
  tone: string;
  canAttempt: boolean;
  canResume: boolean;
  canViewResult: boolean;
  isClosed: boolean;
  score?: number | null;
};

const TABS = ["All", "Physics", "Chemistry", "Biology", "Full Mock Tests"];

export function StudentTestListClient({ tests }: { tests: TestListItem[] }) {
  const [selectedTab, setSelectedTab] = useState("All");

  const filteredTests = useMemo(() => {
    if (selectedTab === "All") return tests;
    if (selectedTab === "Full Mock Tests") {
      return tests.filter(
        (t) =>
          t.title.toLowerCase().includes("mock") ||
          t.title.toLowerCase().includes("full") ||
          t.title.toLowerCase().includes("fst") ||
          t.subject.toLowerCase().includes("general")
      );
    }
    return tests.filter((t) => t.subject.toLowerCase() === selectedTab.toLowerCase());
  }, [tests, selectedTab]);

  return (
    <div className="space-y-6">
      {/* Subject Filter Tabs */}
      <div className="flex items-center gap-1.5 overflow-x-auto bg-surface-container-high/40 p-1.5 rounded-2xl w-fit border border-outline-variant/20">
        {TABS.map((tab) => (
          <button
            key={tab}
            type="button"
            onClick={() => setSelectedTab(tab)}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
              selectedTab === tab
                ? "bg-primary text-on-primary shadow-sm"
                : "text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high"
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {filteredTests.length === 0 ? (
        <div className="glass-card rounded-3xl p-12 text-center text-on-surface-variant space-y-2 border border-dashed border-outline-variant/30">
          <span className="material-symbols-outlined text-4xl text-primary opacity-60">quiz</span>
          <h3 className="font-bold text-sm text-on-surface">No Tests Found</h3>
          <p className="text-xs text-on-surface-variant">
            There are no {selectedTab !== "All" ? selectedTab : ""} tests scheduled in your active batches right now.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {filteredTests.map((t) => (
            <div
              key={t.id}
              className="glass-card rounded-2xl p-5 md:p-6 border border-outline-variant/30 hover:border-primary/40 transition-all flex flex-col md:flex-row md:items-center justify-between gap-5 shadow-sm"
            >
              <div className="space-y-2 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className={`text-[10px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full ${t.tone}`}
                  >
                    {t.statusLabel}
                  </span>
                  <span className="text-xs font-semibold text-primary">{t.subject} &middot;</span>
                  <span className="text-xs text-on-surface-variant">{t.batchName}</span>
                </div>

                <h3 className="font-headline-md text-base md:text-lg font-bold text-on-surface">
                  {t.title}
                </h3>

                <div className="flex flex-wrap items-center gap-4 text-xs text-on-surface-variant">
                  <span className="flex items-center gap-1">
                    <span className="material-symbols-outlined text-base text-primary">assignment</span>
                    {t.questionCount} Questions
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="material-symbols-outlined text-base text-primary">timer</span>
                    {t.durationMin} Mins
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="material-symbols-outlined text-base text-primary">calendar_today</span>
                    {new Date(t.startsAt).toLocaleDateString("en-IN", { day: "numeric", month: "short" })} &middot;{" "}
                    {new Date(t.startsAt).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit", hour12: true })}
                  </span>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-2.5 shrink-0 flex-wrap">
                {t.canAttempt || t.canResume ? (
                  <Link
                    href={`/tests/${t.id}/attempt`}
                    className="px-6 py-2.5 bg-primary text-on-primary font-bold text-xs rounded-xl shadow hover:opacity-90 active:scale-95 transition-all flex items-center gap-1.5"
                  >
                    <span className="material-symbols-outlined text-base">play_arrow</span>
                    {t.canResume ? "Resume Test" : "Start Test"}
                  </Link>
                ) : t.canViewResult ? (
                  <div className="flex items-center gap-2">
                    <Link
                      href={`/tests/${t.id}/result`}
                      className="px-5 py-2.5 bg-primary/10 border border-primary/30 text-primary font-bold text-xs rounded-xl hover:bg-primary/20 transition-all flex items-center gap-1"
                    >
                      <span className="material-symbols-outlined text-base">analytics</span>
                      Scorecard &amp; Solutions
                    </Link>
                    <Link
                      href={`/tests/${t.id}/attempt`}
                      className="px-4 py-2.5 border border-outline-variant text-xs font-semibold rounded-xl hover:bg-surface-container-high transition-colors"
                    >
                      Review
                    </Link>
                  </div>
                ) : (
                  <button
                    disabled
                    className="px-5 py-2.5 bg-surface-container-high text-on-surface-variant text-xs font-semibold rounded-xl opacity-60 cursor-not-allowed"
                  >
                    {t.isClosed ? "Test Closed" : "Opens Soon"}
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
