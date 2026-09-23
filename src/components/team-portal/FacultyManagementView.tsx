"use client";

import React, { useState } from "react";
import { FacultyCard, type FacultyTeacherItem } from "./FacultyCard";
import { TeacherTrackingTab } from "./TeacherTrackingTab";

export function FacultyManagementView({
  teachers,
  canDelete,
}: {
  teachers: FacultyTeacherItem[];
  canDelete: boolean;
}) {
  const [activeTab, setActiveTab] = useState<"directory" | "tracking">("directory");

  return (
    <div className="space-y-6">
      {/* Tab Switcher Header */}
      <div className="flex items-center gap-2 border-b border-slate-200 dark:border-slate-800 pb-2">
        <button
          type="button"
          onClick={() => setActiveTab("directory")}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition ${
            activeTab === "directory"
              ? "bg-[#031635] text-white shadow-sm"
              : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
          }`}
        >
          <span className="material-symbols-outlined text-base">badge</span>
          <span>Faculty Directory ({teachers.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("tracking")}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition ${
            activeTab === "tracking"
              ? "bg-[#031635] text-white shadow-sm"
              : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
          }`}
        >
          <span className="material-symbols-outlined text-base">monitoring</span>
          <span>Attendance &amp; Teaching Watch Time</span>
        </button>
      </div>

      {activeTab === "directory" ? (
        teachers.length === 0 ? (
          <div className="glass-card rounded-2xl p-12 text-center text-on-surface-variant font-body-md">
            No educators onboarded yet.
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-gutter">
            {teachers.map((t) => (
              <FacultyCard key={t.id} teacher={t} canDelete={canDelete} />
            ))}
          </div>
        )
      ) : (
        <TeacherTrackingTab />
      )}
    </div>
  );
}
