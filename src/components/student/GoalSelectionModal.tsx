"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

export type GoalOption = {
  id: string;
  name: string;
  badge?: string;
  stream: string;
  classes: string;
  batchInfo?: string;
  iconBg: string;
  iconColor: string;
  iconSvg: React.ReactNode;
};

const GOALS: GoalOption[] = [
  {
    id: "NEET",
    name: "NEET",
    badge: "Current Target",
    stream: "Medical UG Entrance",
    classes: "Class 11 & 12 • Medical UG Entrance",
    batchInfo: "NEET 2026 Batch • Complete Syllabus",
    iconBg: "bg-orange-500",
    iconColor: "text-white",
    iconSvg: (
      <svg className="w-5 h-5 fill-none stroke-current stroke-[2]" viewBox="0 0 24 24">
        <path d="M4.5 12a7.5 7.5 0 0015 0m-15 0a7.5 7.5 0 1115 0m-15 0H3m16.5 0H21m-1.5 0H12m0 0v7.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    id: "JEE (Main & Adv)",
    name: "JEE (Main & Adv)",
    badge: "Engineering",
    stream: "Engineering Entrance",
    classes: "Class 11 & 12 • PCM Stream",
    batchInfo: "JEE 2026 Batch • Physics & Maths Intensive",
    iconBg: "bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-100 dark:border-indigo-900/60",
    iconColor: "text-indigo-600 dark:text-indigo-400",
    iconSvg: (
      <svg className="w-5 h-5 fill-none stroke-current stroke-[2]" viewBox="0 0 24 24">
        <path d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    id: "CBSE Class 12",
    name: "CBSE Class 12",
    badge: "Boards",
    stream: "Board Examination",
    classes: "Science (PCB / PCM) • 2025-26",
    batchInfo: "NCERT Chapterwise Mastery & Sample Papers",
    iconBg: "bg-purple-50 dark:bg-purple-950/60 border border-purple-100 dark:border-purple-900/60",
    iconColor: "text-purple-600 dark:text-purple-400",
    iconSvg: (
      <svg className="w-5 h-5 fill-none stroke-current stroke-[2]" viewBox="0 0 24 24">
        <path d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    id: "Foundation & Olympiad",
    name: "Foundation & Olympiad",
    badge: "Junior Science",
    stream: "Foundation Stage",
    classes: "Class 9 & 10 • NTSE / NSEJS / KVPY",
    batchInfo: "Advanced Concept Foundation & Problem Solving",
    iconBg: "bg-amber-50 dark:bg-amber-950/60 border border-amber-200/70 dark:border-amber-900/60",
    iconColor: "text-amber-600 dark:text-amber-400",
    iconSvg: (
      <svg className="w-5 h-5 fill-none stroke-current stroke-[2]" viewBox="0 0 24 24">
        <path d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    id: "CUET (UG)",
    name: "CUET (UG)",
    badge: "Central Univ",
    stream: "University Entrance",
    classes: "Domain Subjects + General Aptitude Test",
    batchInfo: "NCERT Speed Drills & Section Practice",
    iconBg: "bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-100 dark:border-emerald-900/60",
    iconColor: "text-emerald-600 dark:text-emerald-400",
    iconSvg: (
      <svg className="w-5 h-5 fill-none stroke-current stroke-[2]" viewBox="0 0 24 24">
        <path d="M12 14l9-5-9-5-9 5 9 5zm0 0l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0012 20.055a11.952 11.952 0 00-6.824-2.998 12.078 12.078 0 01.665-6.479L12 14zm-4 6v-7.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
];

export function GoalSelectionModal({
  currentGoal,
  isOpen,
  onClose,
  onGoalChanged,
}: {
  currentGoal: string;
  isOpen: boolean;
  onClose: () => void;
  onGoalChanged?: (newGoal: string) => void;
}) {
  const router = useRouter();
  const [selectedGoal, setSelectedGoal] = useState<string>(currentGoal || "NEET");
  const [search, setSearch] = useState("");
  const [saving, setSaving] = useState(false);

  if (!isOpen) return null;

  const filteredGoals = GOALS.filter(
    (g) =>
      g.name.toLowerCase().includes(search.toLowerCase()) ||
      g.stream.toLowerCase().includes(search.toLowerCase()) ||
      g.classes.toLowerCase().includes(search.toLowerCase())
  );

  async function handleConfirmSwitch() {
    if (selectedGoal === currentGoal) {
      onClose();
      return;
    }

    setSaving(true);
    try {
      const res = await fetch("/api/student/goal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetExam: selectedGoal }),
      });
      const data = await res.json();

      if (res.ok && data.success) {
        toast.success(`Active goal switched to ${selectedGoal}!`);
        if (onGoalChanged) onGoalChanged(selectedGoal);
        onClose();
        router.refresh();
      } else {
        toast.error(data.message || "Failed to switch goal");
      }
    } catch (err) {
      toast.error("Failed to update goal. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-goal-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in duration-200"
    >
      <div className="bg-white dark:bg-slate-900 rounded-[28px] border border-slate-200/80 dark:border-slate-800 shadow-2xl flex flex-col max-h-[90vh] w-full max-w-md overflow-hidden relative">
        {/* Drag Handle Indicator */}
        <div className="pt-3 pb-1 flex justify-center items-center">
          <div className="w-10 h-1 bg-slate-300 dark:bg-slate-700 rounded-full" />
        </div>

        {/* Modal Header */}
        <div className="px-6 pt-1 pb-3 flex items-start justify-between border-b border-slate-100 dark:border-slate-800">
          <div>
            <h2
              className="text-base font-extrabold text-slate-900 dark:text-white tracking-tight flex items-center gap-1.5"
              id="modal-goal-title"
            >
              <span>Select Your Goal</span>
              <span className="px-1.5 py-0.5 rounded text-[9.5px] font-bold bg-orange-100 text-orange-700 dark:bg-orange-950/60 dark:text-orange-400 uppercase tracking-wide">
                Active
              </span>
            </h2>
            <p className="text-xs text-slate-400 mt-0.5 font-medium">
              Choose your target exam or academic stream
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close modal"
            className="w-7 h-7 rounded-full bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-500 flex items-center justify-center transition-colors"
          >
            <svg className="w-4 h-4 stroke-[2.2]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path d="M6 18L18 6M6 6l12 12" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        </div>

        {/* Search / Filter Input Bar */}
        <div className="px-6 pt-3 pb-1">
          <div className="relative flex items-center">
            <svg
              className="w-4 h-4 text-slate-400 absolute left-3.5 pointer-events-none"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
              />
            </svg>
            <input
              type="text"
              placeholder="Search exams or goals..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-slate-100/80 dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700 text-xs text-slate-800 dark:text-slate-100 placeholder-slate-400 rounded-xl pl-9 pr-3 py-2.5 focus:outline-none focus:border-orange-500 focus:bg-white dark:focus:bg-slate-900 transition-all font-medium"
            />
          </div>
        </div>

        {/* Scrollable Goal Option Cards */}
        <div className="px-6 py-3 space-y-2.5 overflow-y-auto max-h-[360px]">
          {filteredGoals.map((g) => {
            const isSelected = selectedGoal.toLowerCase() === g.id.toLowerCase() || (selectedGoal.toLowerCase().includes("neet") && g.id === "NEET");

            return (
              <div
                key={g.id}
                onClick={() => setSelectedGoal(g.id)}
                className={`relative flex items-center justify-between p-3.5 rounded-2xl border transition-all cursor-pointer ${
                  isSelected
                    ? "border-2 border-orange-500 bg-orange-50/50 dark:bg-orange-950/30 shadow-xs"
                    : "border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-slate-300 dark:hover:border-slate-700 hover:bg-slate-50/70"
                }`}
              >
                <div className="flex items-center space-x-3 min-w-0">
                  <div
                    className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 shadow-sm ${
                      isSelected ? "bg-orange-500 text-white" : `${g.iconBg} ${g.iconColor}`
                    }`}
                  >
                    {g.iconSvg}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center space-x-1.5 flex-wrap">
                      <span className="text-sm font-extrabold text-slate-900 dark:text-white">
                        {g.name}
                      </span>
                      {isSelected && (
                        <span className="px-1.5 py-0.5 rounded text-[9.5px] font-bold bg-orange-100 text-orange-700 dark:bg-orange-900/60 dark:text-orange-300">
                          Selected
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 font-medium truncate">
                      {g.classes}
                    </p>
                    {g.batchInfo && (
                      <span className="text-[10px] font-semibold text-orange-600 dark:text-orange-400 inline-block mt-0.5 truncate">
                        {g.batchInfo}
                      </span>
                    )}
                  </div>
                </div>

                {/* Radio Checked Icon */}
                <div
                  className={`w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 transition-all ${
                    isSelected
                      ? "bg-orange-500 text-white shadow-xs ring-2 ring-orange-200 dark:ring-orange-900"
                      : "border border-slate-300 dark:border-slate-600"
                  }`}
                >
                  {isSelected && (
                    <svg className="w-3 h-3 stroke-[3]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Bottom Actions Container */}
        <div className="px-6 pt-3 pb-5 bg-slate-50/90 dark:bg-slate-800/80 border-t border-slate-100 dark:border-slate-800 flex flex-col gap-2">
          <button
            type="button"
            disabled={saving}
            onClick={handleConfirmSwitch}
            className="w-full bg-slate-900 hover:bg-slate-800 dark:bg-orange-500 dark:hover:bg-orange-600 text-white font-bold text-xs py-3 px-4 rounded-xl flex items-center justify-center space-x-1.5 shadow-md shadow-slate-900/10 transition-all disabled:opacity-60"
          >
            <span>{saving ? "Switching Goal..." : "Confirm & Switch Goal"}</span>
            <svg className="w-3.5 h-3.5 stroke-[2.5]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}
