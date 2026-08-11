"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

type Rule = {
  id: string;
  name: string;
  description: string | null;
  deductionType: "FIXED_AMOUNT" | "PERCENT_OF_PAYOUT";
  deductionValue: number;
  isActive: boolean;
};

export function PenaltyRuleManager({ rules }: { rules: Rule[] }) {
  const router = useRouter();
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [deductionType, setDeductionType] = useState<Rule["deductionType"]>("FIXED_AMOUNT");
  const [deductionValue, setDeductionValue] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  async function createRule() {
    setSubmitting(true);
    try {
      const res = await fetch("/api/team/penalty-rules", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, description, deductionType, deductionValue, isActive: true }),
      });
      const body = await res.json();
      if (!res.ok || !body.success) {
        toast.error(body.error ?? "Could not create rule");
        return;
      }
      toast.success("Rule created");
      setCreating(false);
      setName("");
      setDescription("");
      setDeductionValue("");
      router.refresh();
    } catch {
      toast.error("Something went wrong");
    } finally {
      setSubmitting(false);
    }
  }

  async function toggleActive(rule: Rule) {
    setTogglingId(rule.id);
    try {
      const res = await fetch(`/api/team/penalty-rules/${rule.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !rule.isActive }),
      });
      const body = await res.json();
      if (!res.ok || !body.success) {
        toast.error(body.error ?? "Could not update rule");
        return;
      }
      router.refresh();
    } catch {
      toast.error("Something went wrong");
    } finally {
      setTogglingId(null);
    }
  }

  return (
    <div className="space-y-3">
      <div className="glass-card rounded-xl divide-y divide-outline-variant/20">
        {rules.length === 0 && (
          <p className="p-stack-md text-on-surface-variant font-body-md">No rules defined yet.</p>
        )}
        {rules.map((rule) => (
          <div key={rule.id} className="p-stack-md flex items-center justify-between gap-4">
            <div className="min-w-0">
              <div className="font-label-lg text-label-lg text-on-surface">{rule.name}</div>
              {rule.description && (
                <div className="text-label-sm text-on-surface-variant mt-0.5">{rule.description}</div>
              )}
              <div className="text-label-sm text-on-surface-variant mt-0.5">
                {rule.deductionType === "FIXED_AMOUNT" ? `₹${rule.deductionValue}` : `${rule.deductionValue}%`}
              </div>
            </div>
            <button
              type="button"
              disabled={togglingId === rule.id}
              onClick={() => toggleActive(rule)}
              className={`font-label-sm text-label-sm px-3 py-1.5 rounded-full shrink-0 transition-colors ${
                rule.isActive ? "bg-tertiary/10 text-tertiary hover:bg-tertiary/20" : "bg-outline-variant/20 text-on-surface-variant hover:bg-outline-variant/30"
              }`}
            >
              {rule.isActive ? "Active" : "Inactive"}
            </button>
          </div>
        ))}
      </div>

      {creating ? (
        <div className="glass-card rounded-xl p-stack-md space-y-3">
          <input
            placeholder="Rule name (e.g. Late doubt resolution)"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full rounded-lg border border-outline-variant bg-surface-container-lowest py-2 px-3 text-body-sm outline-none focus:ring-2 focus:ring-primary/30"
          />
          <textarea
            placeholder="Description (optional)"
            rows={2}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="w-full rounded-lg border border-outline-variant bg-surface-container-lowest py-2 px-3 text-body-sm outline-none focus:ring-2 focus:ring-primary/30"
          />
          <div className="flex gap-2">
            <select
              value={deductionType}
              onChange={(e) => setDeductionType(e.target.value as Rule["deductionType"])}
              className="rounded-lg border border-outline-variant bg-surface-container-lowest py-2 px-3 text-body-sm outline-none focus:ring-2 focus:ring-primary/30"
            >
              <option value="FIXED_AMOUNT">Fixed Amount (₹)</option>
              <option value="PERCENT_OF_PAYOUT">Percent of Payout (%)</option>
            </select>
            <input
              type="number"
              placeholder="Value"
              value={deductionValue}
              onChange={(e) => setDeductionValue(e.target.value)}
              className="flex-1 rounded-lg border border-outline-variant bg-surface-container-lowest py-2 px-3 text-body-sm outline-none focus:ring-2 focus:ring-primary/30"
            />
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              disabled={submitting || !name.trim() || !deductionValue}
              onClick={createRule}
              className="bg-primary text-on-primary font-label-md text-label-md px-4 py-2 rounded-lg hover:opacity-90 transition-all disabled:opacity-60"
            >
              {submitting ? "Saving..." : "Create Rule"}
            </button>
            <button
              type="button"
              onClick={() => setCreating(false)}
              className="font-label-md text-label-md px-4 py-2 rounded-lg border border-outline-variant hover:bg-surface-container-high transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setCreating(true)}
          className="font-label-md text-label-md px-4 py-2 rounded-lg border border-dashed border-outline-variant hover:bg-surface-container-high transition-colors"
        >
          + Add Rule
        </button>
      )}
    </div>
  );
}
