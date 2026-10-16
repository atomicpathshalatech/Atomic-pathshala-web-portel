"use client";

import { useState } from "react";

/**
 * Team | Student switch in the header. A team member (with the
 * "student.view_as" permission) opens the student portal — as a student
 * sees it — without signing in again, and comes back the same way.
 */
export function PortalSwitch({ current }: { current: "team" | "student" }) {
  const [busy, setBusy] = useState(false);

  const go = async (to: "team" | "student") => {
    if (to === current || busy) return;
    setBusy(true);
    try {
      const res = await fetch("/api/portal/switch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ to }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok) throw new Error(json?.error || "Could not switch");
      window.location.href = json?.data?.redirect || (to === "student" ? "/dashboard" : "/team");
    } catch (e) {
      alert(e instanceof Error ? e.message : "Could not switch");
      setBusy(false);
    }
  };

  const btn = (to: "team" | "student", label: string, icon: string) => (
    <button
      type="button"
      onClick={() => go(to)}
      disabled={busy}
      aria-pressed={current === to}
      className={`flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-bold transition ${
        current === to ? "bg-blue-600 text-white shadow-sm" : "text-slate-600 hover:text-blue-700 dark:text-slate-300"
      }`}
    >
      <span className="material-symbols-outlined text-[15px]">{icon}</span>
      <span className="hidden sm:inline">{label}</span>
    </button>
  );

  return (
    <div className="flex items-center rounded-full border border-slate-200 bg-slate-50 p-0.5 dark:border-slate-700 dark:bg-slate-800" title="Switch between Team and Student view">
      {btn("team", "Team", "badge")}
      {btn("student", "Student", "school")}
    </div>
  );
}
