"use client";

import { useState } from "react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

type BillingCycle = "MONTHLY" | "QUARTERLY" | "HALF_YEARLY" | "ANNUAL";
type Plan = "BASIC" | "PRO";

const CYCLES: BillingCycle[] = ["MONTHLY", "QUARTERLY", "HALF_YEARLY", "ANNUAL"];
const CYCLE_LABELS: Record<BillingCycle, string> = {
  MONTHLY: "Monthly",
  QUARTERLY: "Quarterly (3 mo)",
  HALF_YEARLY: "Half-yearly (6 mo)",
  ANNUAL: "Annual (12 mo)",
};
const PLANS: Plan[] = ["BASIC", "PRO"];

export function PlanPricingEditor({
  initialPricing,
}: {
  initialPricing: Record<Plan, Record<BillingCycle, number>>;
}) {
  const router = useRouter();
  const [pricing, setPricing] = useState(initialPricing);
  const [saving, setSaving] = useState(false);

  function setValue(plan: Plan, cycle: BillingCycle, value: number) {
    setPricing((prev) => ({ ...prev, [plan]: { ...prev[plan], [cycle]: value } }));
  }

  async function save() {
    setSaving(true);
    try {
      const entries = PLANS.flatMap((plan) =>
        CYCLES.map((billingCycle) => ({ plan, billingCycle, amount: pricing[plan][billingCycle] }))
      );
      const res = await fetch("/api/team/subscriptions/pricing", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ entries }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Could not save pricing");
      toast.success("Pricing updated — applies to new checkouts and future renewals");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="glass-card rounded-xl p-stack-md space-y-4">
      <p className="text-label-sm font-label-sm text-on-surface-variant">
        A price change only affects new checkouts and future renewal cycles — students already
        on a plan keep their current period's amount until it renews.
      </p>

      <div className="overflow-x-auto">
        <table className="w-full text-left">
          <thead>
            <tr>
              <th className="p-2 font-label-sm text-label-sm text-on-surface-variant">Billing cycle</th>
              {PLANS.map((plan) => (
                <th key={plan} className="p-2 font-label-sm text-label-sm text-on-surface-variant">
                  {plan}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {CYCLES.map((cycle) => (
              <tr key={cycle} className="border-t border-outline-variant/20">
                <td className="p-2 font-body-md text-body-md">{CYCLE_LABELS[cycle]}</td>
                {PLANS.map((plan) => (
                  <td key={plan} className="p-2">
                    <div className="flex items-center gap-1">
                      <span className="text-on-surface-variant">₹</span>
                      <input
                        type="number"
                        min={0}
                        value={pricing[plan][cycle]}
                        onChange={(e) => setValue(plan, cycle, Number(e.target.value))}
                        className="w-28 px-3 py-2 rounded-lg border border-outline-variant/40 bg-surface font-body-md text-body-md"
                      />
                    </div>
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <button
        onClick={save}
        disabled={saving}
        className="px-5 py-2.5 rounded-lg bg-primary text-on-primary font-label-md text-label-md hover:opacity-90 disabled:opacity-50"
      >
        {saving ? "Saving…" : "Save pricing"}
      </button>
    </div>
  );
}
