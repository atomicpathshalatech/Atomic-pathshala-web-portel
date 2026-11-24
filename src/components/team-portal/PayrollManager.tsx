"use client";

import React, { useState } from "react";
import {
  Calendar,
  Users,
  CheckCircle,
  Clock,
  ArrowRight,
  FileText,
  Download,
  AlertCircle,
  Play,
} from "lucide-react";
import Link from "next/link";

interface PayrollManagerProps {
  initialRuns: any[];
  canPrepare: boolean;
  canApprove: boolean;
  canDisburse: boolean;
}

export function PayrollManager({
  initialRuns,
  canPrepare,
  canApprove,
  canDisburse,
}: PayrollManagerProps) {
  const [runs, setRuns] = useState(initialRuns);
  const [selectedRun, setSelectedRun] = useState<any>(initialRuns[0] || null);
  const [monthInput, setMonthInput] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  });
  const [isProcessing, setIsProcessing] = useState(false);

  const handleCalculatePayroll = async () => {
    setIsProcessing(true);
    try {
      const res = await fetch("/api/team/payroll", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ payrollMonth: monthInput }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error?.message || "Failed to calculate payroll");

      const updatedRuns = [
        data.data.run,
        ...runs.filter((r) => r.payrollMonth !== data.data.run.payrollMonth),
      ];
      setRuns(updatedRuns);
      setSelectedRun(data.data.run);
      alert(`Payroll successfully calculated for ${monthInput}`);
    } catch (err: any) {
      alert(err.message);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleApprove = async (runId: string) => {
    if (!confirm("Confirm approval of this payroll run? This locks calculations for disbursement.")) return;
    setIsProcessing(true);
    try {
      const res = await fetch(`/api/team/payroll/${runId}/approve`, {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error?.message || "Approval failed");

      setRuns(runs.map((r) => (r.id === runId ? { ...r, status: "APPROVED" } : r)));
      if (selectedRun?.id === runId) setSelectedRun({ ...selectedRun, status: "APPROVED" });
      alert("Payroll run approved!");
    } catch (err: any) {
      alert(err.message);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDisburse = async (runId: string) => {
    const ref = prompt("Enter bank payout reference / UTR for batch transfer:", "BANK_BATCH_" + Date.now());
    if (!ref) return;

    setIsProcessing(true);
    try {
      const res = await fetch(`/api/team/payroll/${runId}/disburse`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ paymentReference: ref }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error?.message || "Disbursement failed");

      setRuns(runs.map((r) => (r.id === runId ? { ...r, status: "PAID" } : r)));
      if (selectedRun?.id === runId) setSelectedRun({ ...selectedRun, status: "PAID" });
      alert("Payroll marked as paid and logged into the financial ledger!");
    } catch (err: any) {
      alert(err.message);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">HR & Faculty Payroll</h1>
          <p className="text-sm text-slate-500 mt-1">
            Automated monthly calculation, Maker-Checker sign-off, bank payouts, and payslips
          </p>
        </div>

        {canPrepare && (
          <div className="flex items-center gap-2">
            <input
              type="month"
              value={monthInput}
              onChange={(e) => setMonthInput(e.target.value)}
              className="px-3 py-1.5 border border-slate-300 rounded-lg text-sm"
            />
            <button
              onClick={handleCalculatePayroll}
              disabled={isProcessing}
              className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-medium transition-colors"
            >
              <Play className="w-4 h-4" /> Calculate Payroll
            </button>
          </div>
        )}
      </div>

      {/* Main Grid: Runs List on Left, Active Run Details on Right */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Payroll Runs History */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm space-y-3">
          <h2 className="text-sm font-bold text-slate-700 uppercase tracking-wider px-2">
            Payroll Cycles
          </h2>
          <div className="space-y-2">
            {runs.map((r: any) => (
              <button
                key={r.id}
                onClick={() => setSelectedRun(r)}
                className={`w-full text-left p-3 rounded-lg border transition-all ${
                  selectedRun?.id === r.id
                    ? "border-indigo-600 bg-indigo-50/50 shadow-sm"
                    : "border-slate-200 hover:bg-slate-50"
                }`}
              >
                <div className="flex justify-between items-start">
                  <div>
                    <p className="font-bold text-slate-900 text-sm">{r.title}</p>
                    <p className="text-xs text-slate-500 mt-0.5">
                      {r.totalEmployees} employees | {r.items?.length || 0} payslips
                    </p>
                  </div>
                  <span
                    className={`px-2 py-0.5 rounded text-xs font-semibold ${
                      r.status === "PAID"
                        ? "bg-emerald-100 text-emerald-800"
                        : r.status === "APPROVED"
                        ? "bg-blue-100 text-blue-800"
                        : "bg-amber-100 text-amber-800"
                    }`}
                  >
                    {r.status}
                  </span>
                </div>
                <div className="mt-2 pt-2 border-t border-slate-200 flex justify-between items-center text-xs">
                  <span className="text-slate-500">Net Payable:</span>
                  <span className="font-mono font-bold text-slate-900">
                    ₹{Number(r.totalNet).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                  </span>
                </div>
              </button>
            ))}
            {runs.length === 0 && (
              <p className="text-xs text-slate-400 text-center py-6">
                No payroll runs calculated yet. Select a month above to calculate.
              </p>
            )}
          </div>
        </div>

        {/* Right Column: Selected Run Detail & Employee Payslips */}
        <div className="lg:col-span-2 space-y-6">
          {selectedRun ? (
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
              {/* Run Summary Banner */}
              <div className="p-6 border-b border-slate-200 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-slate-50/50">
                <div>
                  <div className="flex items-center gap-3">
                    <h2 className="text-xl font-bold text-slate-900">{selectedRun.title}</h2>
                    <span
                      className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${
                        selectedRun.status === "PAID"
                          ? "bg-emerald-100 text-emerald-800"
                          : selectedRun.status === "APPROVED"
                          ? "bg-blue-100 text-blue-800"
                          : "bg-amber-100 text-amber-800"
                      }`}
                    >
                      {selectedRun.status}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 mt-1">
                    Gross: ₹{Number(selectedRun.totalGross).toLocaleString("en-IN")} | Deductions: ₹
                    {Number(selectedRun.totalDeductions).toLocaleString("en-IN")} | Net: ₹
                    {Number(selectedRun.totalNet).toLocaleString("en-IN")}
                  </p>
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                  <a
                    href={`/api/team/payroll/${selectedRun.id}/export`}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 rounded-lg text-xs font-medium"
                  >
                    <Download className="w-3.5 h-3.5" /> Bank CSV Export
                  </a>

                  {canApprove && selectedRun.status === "CALCULATED" && (
                    <button
                      onClick={() => handleApprove(selectedRun.id)}
                      disabled={isProcessing}
                      className="inline-flex items-center gap-1 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-medium"
                    >
                      <CheckCircle className="w-3.5 h-3.5" /> Approve Run
                    </button>
                  )}

                  {canDisburse && selectedRun.status === "APPROVED" && (
                    <button
                      onClick={() => handleDisburse(selectedRun.id)}
                      disabled={isProcessing}
                      className="inline-flex items-center gap-1 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-medium"
                    >
                      <CheckCircle className="w-3.5 h-3.5" /> Mark Disbursed
                    </button>
                  )}
                </div>
              </div>

              {/* Employee Line Items Table */}
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-slate-500 border-b border-slate-200 uppercase font-semibold">
                    <tr>
                      <th className="py-3 px-4">Employee</th>
                      <th className="py-3 px-4">Mode & Days</th>
                      <th className="py-3 px-4 text-right">Gross (₹)</th>
                      <th className="py-3 px-4 text-right">Deductions (₹)</th>
                      <th className="py-3 px-4 text-right">Net Pay (₹)</th>
                      <th className="py-3 px-4">Bank A/C</th>
                      <th className="py-3 px-4 text-right">Payslip</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {selectedRun.items?.map((item: any) => (
                      <tr key={item.id} className="hover:bg-slate-50/50">
                        <td className="py-3 px-4">
                          <p className="font-semibold text-slate-900">{item.employee?.name}</p>
                          <p className="text-slate-500 font-mono text-[10px]">
                            {item.employee?.employeeId} | {item.employee?.designation}
                          </p>
                        </td>
                        <td className="py-3 px-4">
                          <p className="text-slate-700 font-medium">{item.paymentMode}</p>
                          <p className="text-slate-500 text-[10px]">
                            Present: {Number(item.presentDays)}d | Leave: {Number(item.unpaidLeaves)}d
                          </p>
                        </td>
                        <td className="py-3 px-4 text-right font-mono">
                          ₹{Number(item.grossPay).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                        </td>
                        <td className="py-3 px-4 text-right font-mono text-red-600">
                          -₹{Number(item.totalDeductions).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                        </td>
                        <td className="py-3 px-4 text-right font-mono font-bold text-slate-900">
                          ₹{Number(item.netPayable).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                        </td>
                        <td className="py-3 px-4 font-mono text-[11px] text-slate-600">
                          {item.bankAccountNumberMasked || "••••••••4589"}
                        </td>
                        <td className="py-3 px-4 text-right">
                          <Link
                            href={`/team/payroll/payslips/${item.id}`}
                            className="inline-flex items-center gap-1 text-indigo-600 hover:text-indigo-800 font-semibold"
                          >
                            <FileText className="w-3.5 h-3.5" /> View
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <div className="bg-white p-12 rounded-xl border border-slate-200 text-center text-slate-500">
              Select or calculate a payroll run to inspect itemized breakdowns.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
