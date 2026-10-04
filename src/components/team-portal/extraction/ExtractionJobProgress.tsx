"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/** While a job is PROCESSING: shows its step and refreshes the page every few seconds. */
export function ExtractionJobProgress({ progress, step }: { progress: number; step: string | null }) {
  const router = useRouter();
  useEffect(() => {
    const t = setInterval(() => router.refresh(), 4000);
    return () => clearInterval(t);
  }, [router]);
  return (
    <div className="rounded-2xl border border-blue-200 bg-blue-50 p-4 dark:border-blue-900 dark:bg-blue-950/40">
      <div className="flex items-center justify-between gap-3 text-sm font-semibold text-blue-800 dark:text-blue-200">
        <span className="flex items-center gap-2">
          <span className="h-3 w-3 animate-spin rounded-full border-2 border-blue-300 border-t-blue-700" />
          {step || "Extracting questions..."}
        </span>
        <span>{progress}%</span>
      </div>
      <div className="mt-2 h-2 overflow-hidden rounded-full bg-blue-100 dark:bg-blue-900">
        <div className="h-full rounded-full bg-blue-600 transition-all" style={{ width: `${Math.max(3, Math.min(100, progress))}%` }} />
      </div>
      <p className="mt-2 text-xs text-blue-700/80 dark:text-blue-300/80">Big papers take a few minutes. You can leave this page — the job keeps running.</p>
    </div>
  );
}
