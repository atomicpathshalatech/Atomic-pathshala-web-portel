"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

export function QuestionStatusActions({
  questionId,
  currentStatus,
}: {
  questionId: string;
  currentStatus: string;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function updateStatus(status: "VERIFIED" | "FLAGGED") {
    setLoading(true);
    try {
      const res = await fetch(`/api/team/questions/${questionId}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      const body = await res.json();
      if (!res.ok || !body.success) {
        toast.error(body.error ?? "Could not update status");
        return;
      }
      toast.success(status === "VERIFIED" ? "Marked as verified" : "Flagged for review");
      router.refresh();
    } catch {
      toast.error("Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      {currentStatus !== "VERIFIED" && (
        <button
          disabled={loading}
          onClick={() => updateStatus("VERIFIED")}
          className="p-1 hover:text-tertiary disabled:opacity-50"
          title="Mark as Verified"
        >
          <span className="material-symbols-outlined">check_circle</span>
        </button>
      )}
      {currentStatus !== "FLAGGED" && (
        <button
          disabled={loading}
          onClick={() => updateStatus("FLAGGED")}
          className="p-1 hover:text-error disabled:opacity-50"
          title="Flag for review"
        >
          <span className="material-symbols-outlined">flag</span>
        </button>
      )}
    </>
  );
}
