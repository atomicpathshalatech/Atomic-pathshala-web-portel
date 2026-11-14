"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";

interface EmployeeCertificateModalProps {
  isOpen: boolean;
  onClose: () => void;
  employee: {
    id: string;
    employeeId: string;
    name: string;
    designation: string;
    department: string;
    dateOfJoining: string | Date;
  } | null;
}

export function EmployeeCertificateModal({
  isOpen,
  onClose,
  employee,
}: EmployeeCertificateModalProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [generatedResult, setGeneratedResult] = useState<any | null>(null);

  const [certificateType, setCertificateType] = useState<
    "EXPERIENCE_CERTIFICATE" | "EMPLOYMENT_VERIFICATION" | "RELIEVING_LETTER" | "JOINING_LETTER"
  >("EXPERIENCE_CERTIFICATE");
  const [endDate, setEndDate] = useState(new Date().toISOString().split("T")[0]);
  const [conductRemarks, setConductRemarks] = useState("Exemplary conduct and professional dedication");
  const [notes, setNotes] = useState("");

  if (!isOpen || !employee) return null;

  async function handleGenerate(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setGeneratedResult(null);

    try {
      const res = await fetch(`/api/team/employees/${employee?.id}/certificates`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          certificateType,
          customTenureEnd:
            certificateType === "EXPERIENCE_CERTIFICATE" || certificateType === "RELIEVING_LETTER"
              ? endDate
              : undefined,
          conductRemarks,
          notes: notes || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to generate certificate");
      }

      setGeneratedResult(data.data?.certificate || data.certificate);
      router.refresh();
    } catch (err: any) {
      setError(err.message || "Failed to issue certificate");
    } finally {
      setLoading(false);
    }
  }

  function handleResetAndClose() {
    setGeneratedResult(null);
    setError(null);
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-full max-w-xl bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-6 py-5 bg-gradient-to-r from-[#0a2463] to-[#1e3a8a] text-white flex items-center justify-between">
          <div>
            <h2 className="text-base font-black tracking-tight">Issue Official Certificate</h2>
            <p className="text-xs text-blue-200 mt-0.5">
              Issued to: {employee.name} ({employee.employeeId})
            </p>
          </div>
          <button
            type="button"
            onClick={handleResetAndClose}
            className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center text-sm font-bold transition-colors"
          >
            ✕
          </button>
        </div>

        {generatedResult ? (
          /* SUCCESS VIEW */
          <div className="p-6 space-y-5 overflow-y-auto">
            <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 flex items-start gap-3">
              <span className="w-7 h-7 rounded-full bg-emerald-600 text-white flex items-center justify-center font-bold text-sm flex-shrink-0 mt-0.5">
                ✓
              </span>
              <div>
                <p className="font-extrabold text-sm text-emerald-950">
                  Certificate Successfully Generated & Signed
                </p>
                <p className="text-xs text-emerald-700 mt-0.5">
                  Official reference number and cryptographic QR code have been permanently registered.
                </p>
              </div>
            </div>

            <div className="bg-slate-50 dark:bg-slate-800/60 p-4 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-500 font-medium">Certificate Number:</span>
                <strong className="font-mono text-slate-900 dark:text-white font-bold">
                  {generatedResult.certificateNumber}
                </strong>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500 font-medium">Type:</span>
                <span className="font-bold text-slate-800 dark:text-slate-200">
                  {generatedResult.certificateType?.replace(/_/g, " ")}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500 font-medium">Issued By:</span>
                <span className="font-bold text-slate-800 dark:text-slate-200">
                  {generatedResult.issuedBy} ({generatedResult.issuedByDesignation})
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500 font-medium">Verification Token:</span>
                <span className="font-mono text-[10px] text-slate-600 dark:text-slate-400">
                  {generatedResult.verificationToken}
                </span>
              </div>
            </div>

            <div className="space-y-2">
              <a
                href={generatedResult.pdfUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full py-3 px-4 rounded-xl bg-[#0a2463] hover:bg-[#0f3a9e] text-white text-xs font-bold shadow-md transition-colors flex items-center justify-center gap-2"
              >
                <span>Download Official Certificate PDF</span>
                <span>↓</span>
              </a>

              <a
                href={`/verify/cert/${generatedResult.certificateNumber}`}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full py-2.5 px-4 rounded-xl border border-slate-300 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-800 dark:text-slate-200 text-xs font-bold transition-colors flex items-center justify-center gap-2"
              >
                <span>Open Public Verification Page</span>
                <span>↗</span>
              </a>
            </div>

            <div className="pt-2 text-center">
              <button
                type="button"
                onClick={handleResetAndClose}
                className="text-xs text-slate-500 hover:text-slate-800 font-semibold"
              >
                Done / Close
              </button>
            </div>
          </div>
        ) : (
          /* FORM VIEW */
          <form onSubmit={handleGenerate} className="p-6 space-y-4 overflow-y-auto flex-1">
            {error && (
              <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold">
                {error}
              </div>
            )}

            {/* Certificate Type */}
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                Certificate Type <span className="text-rose-500">*</span>
              </label>
              <select
                value={certificateType}
                onChange={(e) => setCertificateType(e.target.value as any)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-600 font-semibold"
              >
                <option value="EXPERIENCE_CERTIFICATE">Experience Certificate (AP-EXP-YYYY-XXXX)</option>
                <option value="EMPLOYMENT_VERIFICATION">Employment Verification Certificate (AP-EVC-YYYY-XXXX)</option>
                <option value="RELIEVING_LETTER">Relieving Letter & Service Record (AP-REL-YYYY-XXXX)</option>
                <option value="JOINING_LETTER">Official Joining Confirmation (AP-JLC-YYYY-XXXX)</option>
              </select>
            </div>

            {/* End Date (if relevant) */}
            {(certificateType === "EXPERIENCE_CERTIFICATE" || certificateType === "RELIEVING_LETTER") && (
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                  Relieving / Service End Date
                </label>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-600"
                />
              </div>
            )}

            {/* Conduct / Remarks */}
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                Official Conduct Assessment / Remarks
              </label>
              <input
                type="text"
                value={conductRemarks}
                onChange={(e) => setConductRemarks(e.target.value)}
                placeholder="e.g. Exemplary conduct and dedication"
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-600"
              />
            </div>

            {/* Additional Notes */}
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                Internal Administrative Notes (Optional)
              </label>
              <input
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Optional notes for internal HR records"
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-600"
              />
            </div>

            <div className="p-3 bg-amber-50 dark:bg-amber-950/30 rounded-xl text-[11px] text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-900/50">
              <strong>Official Identity:</strong> This document will be digitally signed under the authority of <strong>Firoz Ali, Founder and Director</strong> of <strong>ATOMIC PATHSHALA EDUCATION</strong>.
            </div>

            {/* Actions */}
            <div className="pt-4 border-t border-slate-200 dark:border-slate-800 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={handleResetAndClose}
                disabled={loading}
                className="px-4 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 text-xs font-bold hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading}
                className="px-6 py-2.5 rounded-xl bg-[#0a2463] hover:bg-[#0f3a9e] text-white text-xs font-bold shadow-lg transition-colors flex items-center gap-2"
              >
                {loading ? (
                  <>
                    <span className="animate-spin text-sm">↻</span>
                    <span>Issuing & Signing PDF...</span>
                  </>
                ) : (
                  <span>Generate Official Certificate</span>
                )}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
