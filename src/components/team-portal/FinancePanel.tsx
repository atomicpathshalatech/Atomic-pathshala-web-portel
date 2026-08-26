"use client";

import { useState } from "react";
import { toast } from "sonner";

type Payment = {
  id: string;
  studentName: string;
  amount: number;
  status: "PENDING" | "SUCCESS" | "FAILED";
  method: string;
  invoiceNumber: string | null;
  couponCode: string | null;
  refundedAmount: number;
  createdAt: string;
};

const STATUS_STYLE: Record<string, string> = {
  SUCCESS: "bg-primary/10 text-primary",
  PENDING: "bg-secondary/10 text-secondary",
  FAILED: "bg-error/10 text-error",
};

export function FinancePanel({
  canRefund,
  initialPayments,
}: {
  canRefund: boolean;
  initialPayments: Payment[];
}) {
  const [payments, setPayments] = useState(initialPayments);
  const [refundingId, setRefundingId] = useState<string | null>(null);
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function openRefund(p: Payment) {
    setRefundingId(p.id);
    setAmount(String(p.amount - p.refundedAmount));
    setReason("");
    setError(null);
  }

  async function submitRefund(e: React.FormEvent, payment: Payment) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch(`/api/team/finance/payments/${payment.id}/refund`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount: Number(amount), reason: reason || undefined }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        setError(json.error ?? "Could not process this refund.");
        return;
      }
      const refund = json.data.refund;
      setPayments((prev) =>
        prev.map((p) =>
          p.id === payment.id
            ? {
                ...p,
                refundedAmount:
                  refund.status === "SUCCESS" ? p.refundedAmount + refund.amount : p.refundedAmount,
              }
            : p
        )
      );
      toast.success(
        refund.status === "SUCCESS" ? "Refund processed." : "Refund submitted — check status shortly."
      );
      setRefundingId(null);
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  if (payments.length === 0) {
    return (
      <div className="glass-card rounded-2xl p-12 text-center text-on-surface-variant font-body-md">
        No payments yet.
      </div>
    );
  }

  return (
    <div className="glass-card rounded-2xl divide-y divide-outline-variant/20">
      {payments.map((p) => {
        const refundable = p.status === "SUCCESS" && p.amount - p.refundedAmount > 0;
        return (
          <div key={p.id} className="p-5 space-y-3">
            <div className="flex items-center justify-between gap-4">
              <div className="min-w-0">
                <p className="font-label-md text-label-md text-on-surface">
                  {p.studentName} — ₹{p.amount.toLocaleString("en-IN")}
                  {p.couponCode && (
                    <span className="text-label-sm text-on-surface-variant"> · {p.couponCode}</span>
                  )}
                </p>
                <p className="text-label-sm text-on-surface-variant mt-0.5">
                  {new Date(p.createdAt).toLocaleDateString("en-IN", {
                    day: "numeric",
                    month: "short",
                    year: "numeric",
                  })}
                  {p.invoiceNumber && <> · {p.invoiceNumber}</>} · {p.method === "RAZORPAY" ? "Razorpay" : "Offline"}
                </p>
                {p.refundedAmount > 0 && (
                  <p className="text-label-sm text-error mt-0.5">
                    ₹{p.refundedAmount.toLocaleString("en-IN")} refunded
                  </p>
                )}
              </div>
              <div className="flex items-center gap-3 shrink-0">
                <span
                  className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded ${
                    STATUS_STYLE[p.status] ?? "bg-surface-container text-on-surface-variant"
                  }`}
                >
                  {p.status}
                </span>
                {canRefund && refundable && refundingId !== p.id && (
                  <button
                    type="button"
                    onClick={() => openRefund(p)}
                    className="text-label-md text-primary hover:underline"
                  >
                    Refund
                  </button>
                )}
              </div>
            </div>

            {refundingId === p.id && (
              <form
                onSubmit={(e) => submitRefund(e, p)}
                className="bg-surface-container-lowest rounded-xl p-4 space-y-3"
              >
                {error && <p className="text-label-sm text-error bg-error/10 rounded-lg py-2 px-3">{error}</p>}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <label className="font-label-md text-label-md text-on-surface">Amount (₹)</label>
                    <input
                      type="number"
                      required
                      min={1}
                      max={p.amount - p.refundedAmount}
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                      className="w-full rounded-xl border border-outline-variant/40 bg-surface px-4 py-2.5 font-body-md text-body-md outline-none focus:ring-2 focus:ring-primary"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="font-label-md text-label-md text-on-surface">Reason (optional)</label>
                    <input
                      type="text"
                      value={reason}
                      onChange={(e) => setReason(e.target.value)}
                      className="w-full rounded-xl border border-outline-variant/40 bg-surface px-4 py-2.5 font-body-md text-body-md outline-none focus:ring-2 focus:ring-primary"
                    />
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <button
                    type="submit"
                    disabled={submitting}
                    className="bg-primary text-on-primary font-label-md text-label-md px-6 py-2.5 rounded-xl hover:opacity-90 disabled:opacity-60"
                  >
                    {submitting ? "Processing…" : "Confirm refund"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setRefundingId(null)}
                    className="text-label-md text-on-surface-variant hover:underline"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            )}
          </div>
        );
      })}
    </div>
  );
}
