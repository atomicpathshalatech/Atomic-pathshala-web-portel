"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

type CreativeType = "BATCH" | "TEST_SERIES" | "CHAPTER" | "LECTURE" | "LECTURE_START_SLIDE";

/** The manual "[Regenerate Creative]" action (spec section 15) — always
 * available alongside automatic regeneration, for the case an admin wants
 * to force a fresh render right now (e.g. right after changing a template/
 * background elsewhere). */
export function RegenerateCreativeButton({ type, entityId, force = true }: { type: CreativeType; entityId: string; force?: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function regenerate() {
    setBusy(true);
    try {
      const res = await fetch("/api/team/creatives/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type, entityId, force }),
      });
      const json = await res.json();
      if (!json.success) {
        toast.error(json.error || "Could not regenerate the creative.");
        return;
      }
      toast.success(json.data.skipped ? "Already up to date." : "Creative regenerated.");
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      type="button"
      onClick={regenerate}
      disabled={busy}
      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-50"
    >
      <span className="material-symbols-outlined text-sm">{busy ? "progress_activity" : "refresh"}</span>
      {busy ? "Regenerating…" : "Regenerate Creative"}
    </button>
  );
}
