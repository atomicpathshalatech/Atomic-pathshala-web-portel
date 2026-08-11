"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

type Rule = { id: string; name: string; deductionType: string; deductionValue: number };
type TeacherOption = { id: string; name: string };

function currentMonth() {
  return new Date().toISOString().slice(0, 7);
}

export function ApplyPenaltyForm({ rules, teachers }: { rules: Rule[]; teachers: TeacherOption[] }) {
  const router = useRouter();
  const [teacherId, setTeacherId] = useState(teachers[0]?.id ?? "");
  const [ruleId, setRuleId] = useState(rules[0]?.id ?? "");
  const [amount, setAmount] = useState("");
  const [month, setMonth] = useState(currentMonth());
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function submit() {
    if (!teacherId || !ruleId || !amount) return;
    setSubmitting(true);
    try {
      const res = await fetch("/api/team/penalty-records", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ teacherId, ruleId, amount, month, note }),
      });
      const body = await res.json();
      if (!res.ok || !body.success) {
        toast.error(body.error ?? "Could not apply penalty");
        return;
      }
      toast.success("Penalty applied");
      setAmount("");
      setNote("");
      router.refresh();
    } catch {
      toast.error("Something went wrong");
    } finally {
      setSubmitting(false);
    }
  }

  if (teachers.length === 0 || rules.length === 0) {
    return (
      <p className="text-on-surface-variant font-body-sm">
        {rules.length === 0 ? "Create a penalty rule first." : "No active faculty to apply penalties to."}
      </p>
    );
  }

  return (
    <div className="glass-card p-stack-lg rounded-xl space-y-3">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <select
          value={teacherId}
          onChange={(e) => setTeacherId(e.target.value)}
          className="rounded-lg border border-outline-variant bg-surface-container-lowest py-2 px-3 text-body-sm outline-none focus:ring-2 focus:ring-primary/30"
        >
          {teachers.map((t) => (
            <option key={t.id} value={t.id}>{t.name}</option>
          ))}
        </select>
        <select
          value={ruleId}
          onChange={(e) => setRuleId(e.target.value)}
          className="rounded-lg border border-outline-variant bg-surface-container-lowest py-2 px-3 text-body-sm outline-none focus:ring-2 focus:ring-primary/30"
        >
          {rules.map((r) => (
            <option key={r.id} value={r.id}>{r.name}</option>
          ))}
        </select>
        <input
          type="number"
          placeholder="Deduction amount (₹)"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          className="rounded-lg border border-outline-variant bg-surface-container-lowest py-2 px-3 text-body-sm outline-none focus:ring-2 focus:ring-primary/30"
        />
        <input
          type="month"
          value={month}
          onChange={(e) => setMonth(e.target.value)}
          className="rounded-lg border border-outline-variant bg-surface-container-lowest py-2 px-3 text-body-sm outline-none focus:ring-2 focus:ring-primary/30"
        />
      </div>
      <input
        placeholder="Note (optional)"
        value={note}
        onChange={(e) => setNote(e.target.value)}
        className="w-full rounded-lg border border-outline-variant bg-surface-container-lowest py-2 px-3 text-body-sm outline-none focus:ring-2 focus:ring-primary/30"
      />
      <button
        type="button"
        disabled={submitting || !amount}
        onClick={submit}
        className="bg-error text-on-error font-label-md text-label-md px-6 py-2.5 rounded-xl hover:opacity-90 transition-all disabled:opacity-60"
      >
        {submitting ? "Applying..." : "Apply Penalty"}
      </button>
    </div>
  );
}
