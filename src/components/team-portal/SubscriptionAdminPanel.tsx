"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

type BillingCycle = "MONTHLY" | "QUARTERLY" | "HALF_YEARLY" | "ANNUAL";
type Plan = "BASIC" | "PRO";

const DEFAULT_DAYS: Record<BillingCycle, number> = {
  MONTHLY: 30,
  QUARTERLY: 90,
  HALF_YEARLY: 182,
  ANNUAL: 365,
};

export function SubscriptionAdminPanel({
  studentId,
  hasActiveOrTrial,
}: {
  studentId: string;
  hasActiveOrTrial: boolean;
}) {
  const router = useRouter();
  const [plan, setPlan] = useState<Plan>("BASIC");
  const [billingCycle, setBillingCycle] = useState<BillingCycle>("MONTHLY");
  const [periodDays, setPeriodDays] = useState(DEFAULT_DAYS.MONTHLY);
  const [amount, setAmount] = useState(0);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  async function grant() {
    setBusy(true);
    try {
      const res = await fetch(`/api/team/subscriptions/${studentId}/grant`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan, billingCycle, periodDays, amount, note: note || undefined }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Could not grant subscription");
      toast.success(`${plan} plan granted for ${periodDays} days`);
      setNote("");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  }

  async function revoke() {
    if (!confirm("Immediately revoke this student's subscription access?")) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/team/subscriptions/${studentId}/revoke`, { method: "POST" });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Could not revoke subscription");
      toast.success("Access revoked");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="glass-card rounded-xl p-stack-md space-y-4">
      <h2 className="font-label-lg text-label-lg text-on-surface">
        Manually grant / extend (offline payment)
      </h2>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <label className="flex flex-col gap-1 text-label-sm font-label-sm text-on-surface-variant">
          Plan
          <select
            value={plan}
            onChange={(e) => setPlan(e.target.value as Plan)}
            className="px-3 py-2 rounded-lg border border-outline-variant/40 bg-surface font-body-md text-body-md"
          >
            <option value="BASIC">Basic</option>
            <option value="PRO">Pro</option>
          </select>
        </label>

        <label className="flex flex-col gap-1 text-label-sm font-label-sm text-on-surface-variant">
          Billing cycle
          <select
            value={billingCycle}
            onChange={(e) => {
              const cycle = e.target.value as BillingCycle;
              setBillingCycle(cycle);
              setPeriodDays(DEFAULT_DAYS[cycle]);
            }}
            className="px-3 py-2 rounded-lg border border-outline-variant/40 bg-surface font-body-md text-body-md"
          >
            <option value="MONTHLY">Monthly</option>
            <option value="QUARTERLY">Quarterly</option>
            <option value="HALF_YEARLY">Half-yearly</option>
            <option value="ANNUAL">Annual</option>
          </select>
        </label>

        <label className="flex flex-col gap-1 text-label-sm font-label-sm text-on-surface-variant">
          Period (days)
          <input
            type="number"
            min={1}
            value={periodDays}
            onChange={(e) => setPeriodDays(Number(e.target.value))}
            className="px-3 py-2 rounded-lg border border-outline-variant/40 bg-surface font-body-md text-body-md"
          />
        </label>

        <label className="flex flex-col gap-1 text-label-sm font-label-sm text-on-surface-variant">
          Amount received (₹)
          <input
            type="number"
            min={0}
            value={amount}
            onChange={(e) => setAmount(Number(e.target.value))}
            className="px-3 py-2 rounded-lg border border-outline-variant/40 bg-surface font-body-md text-body-md"
          />
        </label>
      </div>

      <label className="flex flex-col gap-1 text-label-sm font-label-sm text-on-surface-variant">
        Note (e.g. receipt number, mode of payment)
        <input
          type="text"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Cash receipt #1234"
          className="px-3 py-2 rounded-lg border border-outline-variant/40 bg-surface font-body-md text-body-md"
        />
      </label>

      <div className="flex flex-wrap gap-3">
        <button
          onClick={grant}
          disabled={busy}
          className="px-5 py-2.5 rounded-lg bg-primary text-on-primary font-label-md text-label-md hover:opacity-90 disabled:opacity-50"
        >
          {busy ? "Saving…" : "Grant / extend"}
        </button>
        {hasActiveOrTrial && (
          <button
            onClick={revoke}
            disabled={busy}
            className="px-5 py-2.5 rounded-lg bg-error/10 text-error font-label-md text-label-md hover:bg-error/20 disabled:opacity-50"
          >
            Revoke access
          </button>
        )}
      </div>
    </div>
  );
}
