"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

type TeacherWithUser = {
  id: string;
  employeeCode: string;
  department: string;
  subjects: string[];
  user: {
    name: string;
    email: string;
    phone: string | null;
  };
};

export function ContractCreatorForm({ teachers }: { teachers: TeacherWithUser[] }) {
  const router = useRouter();
  const [selectedTeacherId, setSelectedTeacherId] = useState(teachers[0]?.id || "");
  const [title, setTitle] = useState("Plus Educator Agreement — 2025/2026");
  const [annualSalary, setAnnualSalary] = useState("INR 6,00,000 /- (Indian Rupees Six Lakhs Only) per annum");
  const [monthlySalary, setMonthlySalary] = useState("INR 50,000 /- (Indian Rupees Fifty Thousand Only) per month");
  const [teachingHoursMonthly, setTeachingHoursMonthly] = useState("70 (Seventy) Hours");
  const [noticePeriodDays, setNoticePeriodDays] = useState("60 (Sixty) Days");
  const [effectiveDate, setEffectiveDate] = useState("03 May, 2025");
  const [contractEndDate, setContractEndDate] = useState("02 May, 2026");
  const [address, setAddress] = useState("Village Ahmadnagar Near Faizganj, Tehseel Tanda, Dist Rampur, Uttar Pradesh");
  const [panNumber, setPanNumber] = useState("DTHPA7342Q");
  const [submitting, setSubmitting] = useState(false);
  const [step, setStep] = useState<"fill" | "preview">("fill");

  const selectedTeacher = teachers.find((t) => t.id === selectedTeacherId);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      const res = await fetch("/api/team/contracts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          teacherId: selectedTeacherId,
          title: `Plus Educator Agreement — ${selectedTeacher?.user.name || "Educator"}`,
          annualSalary,
          monthlySalary,
          teachingHoursMonthly,
          noticePeriodDays,
          effectiveDate,
          contractEndDate,
          address,
          panNumber,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        toast.error(data.error || "Could not generate contract.");
        return;
      }
      toast.success("Contract generated and sent for electronic signature!");
      router.push(`/team/contracts/${data.data.contract.id}`);
      router.refresh();
    } catch {
      toast.error("Network error. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="glass-card rounded-3xl p-6 md:p-8 space-y-6 border border-outline-variant/30 shadow-lg">
      <div className="flex items-center justify-between border-b border-outline-variant/20 pb-4">
        <div className="flex items-center gap-2">
          <span className="w-8 h-8 rounded-full bg-primary text-on-primary flex items-center justify-center font-bold text-sm">
            1
          </span>
          <span className="font-bold text-sm text-on-surface">Auto-Fill &amp; Custom Fields</span>
        </div>
        <div className="flex items-center gap-2">
          <span
            className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm ${
              step === "preview" ? "bg-primary text-on-primary" : "bg-surface-container-high text-on-surface-variant"
            }`}
          >
            2
          </span>
          <span className="font-bold text-sm text-on-surface-variant">Live Contract Review</span>
        </div>
      </div>

      <form onSubmit={handleCreate} className="space-y-6">
        {/* Step 1: Form Fields */}
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="font-label-md text-xs font-bold text-on-surface">Select Educator / Employee</label>
              <select
                value={selectedTeacherId}
                onChange={(e) => setSelectedTeacherId(e.target.value)}
                className="w-full rounded-xl border border-outline-variant/40 bg-surface px-4 py-2.5 text-xs text-on-surface font-semibold outline-none focus:ring-2 focus:ring-primary"
              >
                {teachers.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.user.name} ({t.employeeCode}) — {t.department}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="font-label-md text-xs font-bold text-on-surface">Contract Title</label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full rounded-xl border border-outline-variant/40 bg-surface px-4 py-2.5 text-xs text-on-surface outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="font-label-md text-xs font-bold text-on-surface">Annual Consideration (Gross CTC)</label>
              <input
                type="text"
                value={annualSalary}
                onChange={(e) => setAnnualSalary(e.target.value)}
                className="w-full rounded-xl border border-outline-variant/40 bg-surface px-4 py-2.5 text-xs text-on-surface outline-none focus:ring-2 focus:ring-primary"
              />
            </div>

            <div className="space-y-1.5">
              <label className="font-label-md text-xs font-bold text-on-surface">Monthly Installment Payout</label>
              <input
                type="text"
                value={monthlySalary}
                onChange={(e) => setMonthlySalary(e.target.value)}
                className="w-full rounded-xl border border-outline-variant/40 bg-surface px-4 py-2.5 text-xs text-on-surface outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <label className="font-label-md text-xs font-bold text-on-surface">Monthly Teaching Hours</label>
              <input
                type="text"
                value={teachingHoursMonthly}
                onChange={(e) => setTeachingHoursMonthly(e.target.value)}
                className="w-full rounded-xl border border-outline-variant/40 bg-surface px-4 py-2.5 text-xs text-on-surface outline-none focus:ring-2 focus:ring-primary"
              />
            </div>

            <div className="space-y-1.5">
              <label className="font-label-md text-xs font-bold text-on-surface">Effective Start Date</label>
              <input
                type="text"
                value={effectiveDate}
                onChange={(e) => setEffectiveDate(e.target.value)}
                className="w-full rounded-xl border border-outline-variant/40 bg-surface px-4 py-2.5 text-xs text-on-surface outline-none focus:ring-2 focus:ring-primary"
              />
            </div>

            <div className="space-y-1.5">
              <label className="font-label-md text-xs font-bold text-on-surface">Contract End Date</label>
              <input
                type="text"
                value={contractEndDate}
                onChange={(e) => setContractEndDate(e.target.value)}
                className="w-full rounded-xl border border-outline-variant/40 bg-surface px-4 py-2.5 text-xs text-on-surface outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="font-label-md text-xs font-bold text-on-surface">Educator PAN Number</label>
              <input
                type="text"
                value={panNumber}
                onChange={(e) => setPanNumber(e.target.value)}
                className="w-full rounded-xl border border-outline-variant/40 bg-surface px-4 py-2.5 text-xs text-on-surface outline-none focus:ring-2 focus:ring-primary uppercase font-mono"
              />
            </div>

            <div className="space-y-1.5">
              <label className="font-label-md text-xs font-bold text-on-surface">Notice Period</label>
              <input
                type="text"
                value={noticePeriodDays}
                onChange={(e) => setNoticePeriodDays(e.target.value)}
                className="w-full rounded-xl border border-outline-variant/40 bg-surface px-4 py-2.5 text-xs text-on-surface outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="font-label-md text-xs font-bold text-on-surface">Residential Address for Legal Notices</label>
            <input
              type="text"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              className="w-full rounded-xl border border-outline-variant/40 bg-surface px-4 py-2.5 text-xs text-on-surface outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
        </div>

        {/* Action Controls */}
        <div className="pt-4 border-t border-outline-variant/20 flex items-center justify-end gap-3">
          <button
            type="submit"
            disabled={submitting}
            className="px-8 py-3 bg-primary text-on-primary font-bold text-xs rounded-xl shadow-lg hover:opacity-90 active:scale-95 transition-all flex items-center gap-2"
          >
            <span className="material-symbols-outlined text-sm">send</span>
            {submitting ? "Compiling & Dispatching..." : "Approve & Dispatch Agreement"}
          </button>
        </div>
      </form>
    </div>
  );
}
