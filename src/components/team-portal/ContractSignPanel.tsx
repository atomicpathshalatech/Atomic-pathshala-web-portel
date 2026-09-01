"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

export function ContractSignPanel({
  contractId,
  isOwner = true,
}: {
  contractId: string;
  isOwner?: boolean;
}) {
  const router = useRouter();
  const [signedName, setSignedName] = useState("");
  const [agreeTerms, setAgreeTerms] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  async function handleSign() {
    if (!agreeTerms) {
      toast.error("Please acknowledge and check the consent box before signing.");
      return;
    }
    if (signedName.trim().length < 2) {
      toast.error("Please enter your legal signature name.");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch(`/api/team/contracts/${contractId}/sign`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          signedName: signedName.trim(),
          agreeTerms: true,
        }),
      });
      const body = await res.json();
      if (!res.ok || !body.success) {
        toast.error(body.error ?? "Could not record signature.");
        return;
      }
      toast.success("Agreement electronically signed and locked!");
      router.refresh();
    } catch {
      toast.error("Network error. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="glass-card p-6 rounded-3xl space-y-5 border-2 border-primary/30 shadow-xl bg-gradient-to-br from-primary/5 via-surface to-surface">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-2xl bg-primary text-on-primary flex items-center justify-center font-bold">
          <span className="material-symbols-outlined text-xl">draw</span>
        </div>
        <div>
          <h3 className="font-bold text-sm text-on-surface">
            {isOwner ? "Educator Electronic Signature" : "Authorized Signatory Countersignature"}
          </h3>
          <p className="text-xs text-on-surface-variant">
            Secure verifiable e-signature pursuant to the Information Technology Act, 2000.
          </p>
        </div>
      </div>

      <div className="space-y-3">
        <div className="space-y-1.5">
          <label className="font-label-md text-xs font-bold text-on-surface">
            Type Full Legal Name (Electronic Signature)
          </label>
          <input
            value={signedName}
            onChange={(e) => setSignedName(e.target.value)}
            placeholder="e.g. Firoz Ali"
            className="w-full rounded-2xl border border-outline-variant/40 bg-surface-container-lowest py-3 px-4 text-base outline-none focus:ring-2 focus:ring-primary font-serif italic text-primary font-bold"
          />
        </div>

        <label className="flex items-start gap-2.5 cursor-pointer pt-1">
          <input
            type="checkbox"
            checked={agreeTerms}
            onChange={(e) => setAgreeTerms(e.target.checked)}
            className="mt-0.5 w-4 h-4 rounded border-outline-variant text-primary focus:ring-primary shrink-0"
          />
          <span className="text-xs text-on-surface leading-relaxed">
            I confirm that I have read, understood, and unconditionally agree to all terms, clauses, and annexures of this Plus Educator Agreement.
          </span>
        </label>
      </div>

      <div className="flex items-center justify-between pt-2 border-t border-outline-variant/20">
        <span className="text-[11px] text-on-surface-variant font-mono">
          IP &amp; UTC timestamp will be recorded in the audit trail.
        </span>
        <button
          type="button"
          disabled={submitting || !agreeTerms || signedName.trim().length < 2}
          onClick={handleSign}
          className="px-6 py-2.5 bg-primary text-on-primary font-bold text-xs rounded-xl shadow-lg hover:opacity-90 active:scale-95 transition-all disabled:opacity-50 flex items-center gap-2"
        >
          <span className="material-symbols-outlined text-sm">check_circle</span>
          {submitting ? "Signing..." : "Execute & Sign Agreement"}
        </button>
      </div>
    </div>
  );
}
