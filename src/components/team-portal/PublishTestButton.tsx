"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function PublishTestButton({ testId }: { testId: string }) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function publish() {
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`/api/team/tests/${testId}/publish`, { method: "POST" });
      const json = await res.json();
      if (!res.ok || !json.success) {
        setError(json.error ?? "Could not publish this test.");
        return;
      }
      router.refresh();
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex flex-col items-end gap-1.5 shrink-0">
      <button
        type="button"
        disabled={submitting}
        onClick={publish}
        className="flex items-center gap-2 bg-primary text-on-primary px-5 py-2.5 rounded-xl font-label-md hover:opacity-90 active:scale-[0.99] transition-all disabled:opacity-60 disabled:cursor-not-allowed"
      >
        <span className="material-symbols-outlined text-lg">publish</span>
        {submitting ? "Publishing..." : "Publish Test"}
      </button>
      {error && (
        <div className="bg-error-container/40 border border-error/20 rounded-xl px-3 py-1.5">
          <p className="text-label-sm font-label-sm text-error">{error}</p>
        </div>
      )}
    </div>
  );
}
