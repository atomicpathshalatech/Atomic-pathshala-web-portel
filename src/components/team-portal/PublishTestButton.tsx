"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { PublishGateModal } from "@/components/test-audit/PublishGateModal";

export function PublishTestButton({ testId }: { testId: string }) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showGateModal, setShowGateModal] = useState(false);
  const [criticalCount, setCriticalCount] = useState(1);

  async function publish() {
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`/api/team/tests/${testId}/publish`, { method: "POST" });
      const json = await res.json();
      if (!res.ok || !json.success) {
        if (res.status === 422 || (json.error && String(json.error).includes("critical quality"))) {
          setCriticalCount(json.criticalIssuesCount || 1);
          setShowGateModal(true);
          setError(json.error);
          return;
        }
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
        className="flex items-center gap-2 bg-blue-600 text-white px-5 py-2.5 rounded-xl text-xs font-semibold hover:bg-blue-700 active:scale-[0.99] transition-all disabled:opacity-60 disabled:cursor-not-allowed shadow-sm"
      >
        <span className="material-symbols-outlined text-base">publish</span>
        {submitting ? "Publishing..." : "Publish Test"}
      </button>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl px-3 py-1.5 flex items-center gap-2">
          <p className="text-[11px] font-medium text-red-700">{error}</p>
          {showGateModal && (
            <button
              type="button"
              onClick={() => setShowGateModal(true)}
              className="text-[11px] font-bold text-red-800 underline hover:text-red-950 shrink-0"
            >
              Review / Override
            </button>
          )}
        </div>
      )}

      {showGateModal && (
        <PublishGateModal
          testId={testId}
          criticalIssuesCount={criticalCount}
          onClose={() => setShowGateModal(false)}
          onOverridden={() => {
            setShowGateModal(false);
            publish();
          }}
        />
      )}
    </div>
  );
}
