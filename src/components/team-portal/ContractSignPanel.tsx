"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

export function ContractSignPanel({ contractId }: { contractId: string }) {
  const router = useRouter();
  const [signedName, setSignedName] = useState("");
  const [declineOpen, setDeclineOpen] = useState(false);
  const [declineReason, setDeclineReason] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function sign() {
    setSubmitting(true);
    try {
      const res = await fetch(`/api/team/contracts/${contractId}/sign`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ signedName }),
      });
      const body = await res.json();
      if (!res.ok || !body.success) {
        toast.error(body.error ?? "Could not sign contract");
        return;
      }
      toast.success("Contract signed — welcome aboard!");
      router.refresh();
    } catch {
      toast.error("Something went wrong");
    } finally {
      setSubmitting(false);
    }
  }

  async function decline() {
    setSubmitting(true);
    try {
      const res = await fetch(`/api/team/contracts/${contractId}/decline`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ declinedReason: declineReason }),
      });
      const body = await res.json();
      if (!res.ok || !body.success) {
        toast.error(body.error ?? "Could not decline contract");
        return;
      }
      toast.success("Contract declined");
      router.refresh();
    } catch {
      toast.error("Something went wrong");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="glass-card p-stack-lg rounded-xl space-y-4">
      <div className="space-y-1.5">
        <label className="font-label-md text-label-md text-on-surface">
          Type your full legal name to sign
        </label>
        <input
          value={signedName}
          onChange={(e) => setSignedName(e.target.value)}
          placeholder="Full legal name"
          className="w-full rounded-lg border border-outline-variant bg-surface-container-lowest py-2 px-3 text-body-md outline-none focus:ring-2 focus:ring-primary/30 font-serif italic"
        />
        <p className="text-label-sm text-on-surface-variant">
          This acts as your e-signature and will be timestamped and logged.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={submitting || signedName.trim().length < 2}
          onClick={sign}
          className="bg-primary text-on-primary font-label-md text-label-md px-6 py-2.5 rounded-xl hover:opacity-90 transition-all disabled:opacity-60"
        >
          {submitting ? "Submitting..." : "Sign Contract"}
        </button>
        {!declineOpen ? (
          <button
            type="button"
            onClick={() => setDeclineOpen(true)}
            className="font-label-md text-label-md px-6 py-2.5 rounded-xl border border-outline-variant hover:bg-surface-container-high transition-colors"
          >
            Decline
          </button>
        ) : (
          <div className="flex items-center gap-2 flex-1 min-w-[260px]">
            <input
              autoFocus
              value={declineReason}
              onChange={(e) => setDeclineReason(e.target.value)}
              placeholder="Reason for declining"
              className="flex-1 rounded-lg border border-outline-variant bg-surface-container-lowest py-2 px-3 text-body-sm outline-none focus:ring-2 focus:ring-error/30"
            />
            <button
              type="button"
              disabled={submitting || declineReason.trim().length < 3}
              onClick={decline}
              className="font-label-md text-label-md px-4 py-2 rounded-lg bg-error text-on-error hover:opacity-90 transition-colors disabled:opacity-50"
            >
              Confirm
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
