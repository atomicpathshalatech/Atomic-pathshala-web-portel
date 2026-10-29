"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

/** Before a scheduled recorded lecture: when it starts, a countdown, and the page opens the class at the time. */
export function PremiereCountdown({ startsAt }: { startsAt: string }) {
  const router = useRouter();
  const start = new Date(startsAt).getTime();
  const [left, setLeft] = useState(() => Math.max(0, start - Date.now()));

  useEffect(() => {
    const t = setInterval(() => {
      const ms = Math.max(0, start - Date.now());
      setLeft(ms);
      if (ms === 0) {
        clearInterval(t);
        router.refresh();
      }
    }, 1000);
    return () => clearInterval(t);
  }, [start, router]);

  const s = Math.floor(left / 1000);
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const p = (n: number) => String(n).padStart(2, "0");
  const when = new Date(startsAt).toLocaleString("en-IN", { timeZone: "Asia/Kolkata", weekday: "short", day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });

  return (
    <div className="relative w-full aspect-video bg-gradient-to-br from-slate-900 to-blue-950 rounded-2xl overflow-hidden flex flex-col items-center justify-center gap-3 text-center px-6">
      <span className="material-symbols-outlined text-white/70 text-5xl">event</span>
      <p className="text-white/80 text-sm font-semibold">This class starts on {when}</p>
      <p className="text-white text-3xl sm:text-5xl font-black tabular-nums">
        {d > 0 ? `${d}d ` : ""}
        {p(h)}:{p(m)}:{p(sec)}
      </p>
      <p className="text-white/60 text-xs max-w-sm">It plays live at that time, like a live class. Stay on this page — it opens by itself.</p>
    </div>
  );
}
