"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

/** Mistake Book: "I've understood this" → moves the question to Solved (and back). */
export function MistakeSolveButton({ mistakeKey, solved }: { mistakeKey: string; solved: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  async function toggle() {
    setBusy(true);
    try {
      const res = await fetch("/api/mistakes/resolve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: mistakeKey, solved: !solved }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok || !body.success) throw new Error(body.error || "Could not save — try again.");
      setDone(true);
      toast.success(solved ? "Moved back to review." : "Great! Moved to Solved.");
      router.refresh();
    } catch (err: any) {
      toast.error(err?.message || "Could not save — try again.");
    } finally {
      setBusy(false);
    }
  }

  if (done) return null;
  return solved ? (
    <button
      type="button"
      onClick={toggle}
      disabled={busy}
      className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-600 text-xs font-bold text-slate-700 dark:text-slate-200 disabled:opacity-60"
    >
      <span className="material-symbols-outlined text-[16px]">undo</span>
      Review again
    </button>
  ) : (
    <button
      type="button"
      onClick={toggle}
      disabled={busy}
      className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold disabled:opacity-60"
    >
      <span className="material-symbols-outlined text-[16px]">{busy ? "progress_activity" : "task_alt"}</span>
      I understood it — mark solved
    </button>
  );
}
