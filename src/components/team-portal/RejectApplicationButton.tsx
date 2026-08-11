"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

export function RejectApplicationButton({ teacherId }: { teacherId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function submit() {
    setSubmitting(true);
    try {
      const res = await fetch(`/api/team/onboarding/${teacherId}/reject`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason }),
      });
      const body = await res.json();
      if (!res.ok || !body.success) {
        toast.error(body.error ?? "Could not reject application");
        return;
      }
      toast.success("Application rejected");
      router.push("/team/onboarding");
      router.refresh();
    } catch {
      toast.error("Something went wrong");
    } finally {
      setSubmitting(false);
    }
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="font-label-md text-label-md px-4 py-2 rounded-lg bg-error/10 text-error hover:bg-error/20 transition-colors"
      >
        Reject Application
      </button>
    );
  }

  return (
    <div className="glass-card p-stack-md rounded-xl space-y-3 max-w-md">
      <label className="font-label-md text-label-md text-on-surface">Reason for rejection</label>
      <textarea
        autoFocus
        rows={3}
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        className="w-full rounded-lg border border-outline-variant bg-surface-container-lowest py-2 px-3 text-body-sm outline-none focus:ring-2 focus:ring-error/30"
      />
      <div className="flex gap-2">
        <button
          type="button"
          disabled={submitting || reason.trim().length < 3}
          onClick={submit}
          className="font-label-md text-label-md px-4 py-2 rounded-lg bg-error text-on-error hover:opacity-90 transition-colors disabled:opacity-50"
        >
          Confirm Rejection
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="font-label-md text-label-md px-4 py-2 rounded-lg border border-outline-variant hover:bg-surface-container-high transition-colors"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
