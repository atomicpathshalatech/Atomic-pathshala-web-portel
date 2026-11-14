"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

export type OfficialDocumentType =
  | "JOINING_LETTER"
  | "EXPERIENCE_CERTIFICATE"
  | "RELIEVING_LETTER"
  | "CONTRACT_LETTER";

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
    workLocation?: string;
    assignedBatch?: string | null;
    employmentType?: string;
    lastWorkingDate?: string | Date | null;
  } | null;
  initialType?: OfficialDocumentType;
}

export function EmployeeCertificateModal({
  isOpen,
  onClose,
  employee,
  initialType = "JOINING_LETTER",
}: EmployeeCertificateModalProps) {
  const router = useRouter();

  // Document Category
  const [docType, setDocType] = useState<OfficialDocumentType>(initialType);

  // Loading & Error States
  const [loading, setLoading] = useState(false);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // PDF Preview State
  const [previewBlobUrl, setPreviewBlobUrl] = useState<string | null>(null);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);

  // Success Result State
  const [generatedResult, setGeneratedResult] = useState<any | null>(null);

  // Common Form Fields
  const [issueDate, setIssueDate] = useState(new Date().toISOString().split("T")[0]);
  const [customDesignation, setCustomDesignation] = useState("");
  const [customDepartment, setCustomDepartment] = useState("");
  const [notes, setNotes] = useState("");

  // Category 1: Official Joining Confirmation Fields
  const [reportingAuthority, setReportingAuthority] = useState("Founder & Director");
  const [assignedSubject, setAssignedSubject] = useState("");
  const [assignedBatch, setAssignedBatch] = useState("Comprehensive NEET / JEE Academic Batches");
  const [workLocation, setWorkLocation] = useState("Rampur, Uttar Pradesh, India / Digital Streaming Studio");
  const [workingSchedule, setWorkingSchedule] = useState("Monday to Saturday, Scheduled Live Streaming Sessions");
  const [compensationReference, setCompensationReference] = useState("As per executed Service Agreement / Official Offer Terms");
  const [reportingInstructions, setReportingInstructions] = useState(
    "Please report to the Academic Directorate for schedule orientation, live classroom briefing, and portal credential activation."
  );

  // Category 2: Experience Certificate Fields
  const [tenureStart, setTenureStart] = useState("");
  const [tenureEnd, setTenureEnd] = useState(new Date().toISOString().split("T")[0]);
  const [conductRemarks, setConductRemarks] = useState(
    "Exemplary conduct, academic rigor, pedagogical leadership, and professional dedication."
  );

  // Category 3: Relieving Letter Fields
  const [resignationRef, setResignationRef] = useState("");
  const [relievingDate, setRelievingDate] = useState(new Date().toISOString().split("T")[0]);
  const [handoverStatus, setHandoverStatus] = useState("Completed & Verified");
  const [assetsStatus, setAssetsStatus] = useState("Returned & Deactivated");
  const [settlementStatus, setSettlementStatus] = useState("Settled & Disbursed");

  // Category 4: Contract Letter Fields
  const [engagementType, setEngagementType] = useState("FULL_TIME");
  const [contractEndDate, setContractEndDate] = useState(
    new Date(Date.now() + 365 * 24 * 3600 * 1000).toISOString().split("T")[0]
  );
  const [compensationType, setCompensationType] = useState("MONTHLY_REMUNERATION");
  const [monthlySalary, setMonthlySalary] = useState("45,000");
  const [annualSalary, setAnnualSalary] = useState("");
  const [teachingHoursMonthly, setTeachingHoursMonthly] = useState("70 to 80 Hours");
  const [paymentCycleDay, setPaymentCycleDay] = useState("7th of each month");
  const [noticePeriodDays, setNoticePeriodDays] = useState("60 Days");
  const [specialConditions, setSpecialConditions] = useState(
    "Standard institutional academic benchmarks apply. No special waivers granted."
  );

  // Initialize values when employee changes
  useEffect(() => {
    if (employee) {
      setCustomDesignation(employee.designation || "");
      setCustomDepartment(employee.department || "");
      setAssignedSubject(employee.department || "");
      if (employee.workLocation) setWorkLocation(employee.workLocation);
      if (employee.assignedBatch) setAssignedBatch(employee.assignedBatch);
      if (employee.employmentType) setEngagementType(employee.employmentType);

      const joinStr = employee.dateOfJoining
        ? new Date(employee.dateOfJoining).toISOString().split("T")[0]
        : "";
      setTenureStart(joinStr);

      if (employee.lastWorkingDate) {
        const lastStr = new Date(employee.lastWorkingDate).toISOString().split("T")[0];
        setTenureEnd(lastStr);
        setRelievingDate(lastStr);
      }
    }
    if (initialType) {
      setDocType(initialType);
    }
  }, [employee, initialType]);

  // Clean up blob URL on unmount
  useEffect(() => {
    return () => {
      if (previewBlobUrl) {
        URL.revokeObjectURL(previewBlobUrl);
      }
    };
  }, [previewBlobUrl]);

  if (!isOpen || !employee) return null;

  // Build the complete payload for preview or final issuance
  function buildPayload() {
    return {
      certificateType: docType,
      issueDate,
      customDesignation: customDesignation || undefined,
      customDepartment: customDepartment || undefined,
      notes: notes || undefined,

      // Category 1
      reportingAuthority,
      assignedSubject,
      assignedBatch,
      workLocation,
      reportingInstructions,
      workingSchedule,
      compensationReference,

      // Category 2
      customTenureStart: tenureStart || undefined,
      customTenureEnd: tenureEnd || undefined,
      conductRemarks,

      // Category 3
      resignationReference: resignationRef || undefined,
      relievingEffectiveDate: relievingDate || undefined,
      handoverClearanceStatus: handoverStatus,
      assetsReturnStatus: assetsStatus,
      finalSettlementStatus: settlementStatus,

      // Category 4
      contractEndDate,
      engagementType,
      compensationType,
      monthlySalary,
      annualSalary: annualSalary || undefined,
      teachingHoursMonthly,
      paymentCycleDay,
      noticePeriodDays,
      specialConditions: specialConditions || undefined,
    };
  }

  // Handle PDF Preview (Mandatory step for Contract, recommended for all)
  async function handlePreview() {
    setPreviewLoading(true);
    setError(null);

    try {
      const res = await fetch(`/api/team/employees/${employee?.id}/certificates/preview`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buildPayload()),
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.error || "Failed to generate preview PDF");
      }

      const blob = await res.blob();
      if (previewBlobUrl) {
        URL.revokeObjectURL(previewBlobUrl);
      }
      const newBlobUrl = URL.createObjectURL(blob);
      setPreviewBlobUrl(newBlobUrl);
      setIsPreviewOpen(true);
    } catch (err: any) {
      setError(err.message || "Failed to preview document");
    } finally {
      setPreviewLoading(false);
    }
  }

  // Handle Final Official Issuance & Recording
  async function handleFinalGenerate() {
    setLoading(true);
    setError(null);
    setGeneratedResult(null);

    try {
      const res = await fetch(`/api/team/employees/${employee?.id}/certificates`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buildPayload()),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to generate and issue official document");
      }

      setGeneratedResult(data.data?.certificate || data.certificate);
      setIsPreviewOpen(false);
      router.refresh();
    } catch (err: any) {
      setError(err.message || "Failed to issue document");
    } finally {
      setLoading(false);
    }
  }

  function handleResetAndClose() {
    if (previewBlobUrl) {
      URL.revokeObjectURL(previewBlobUrl);
      setPreviewBlobUrl(null);
    }
    setIsPreviewOpen(false);
    setGeneratedResult(null);
    setError(null);
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/70 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-full max-w-3xl bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col max-h-[92vh]">
        {/* Universal Header */}
        <div className="px-6 py-4 bg-gradient-to-r from-[#102A56] via-[#1456C0] to-[#2878E5] text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center font-bold text-lg">
              {docType === "JOINING_LETTER" && "✉️"}
              {docType === "EXPERIENCE_CERTIFICATE" && "🎓"}
              {docType === "RELIEVING_LETTER" && "📋"}
              {docType === "CONTRACT_LETTER" && "⚖️"}
            </div>
            <div>
              <h2 className="text-base font-black tracking-tight">
                Atomic Pathshala Document Generator
              </h2>
              <p className="text-xs text-blue-100">
                Official Credential for: <strong>{employee.name}</strong> ({employee.employeeId})
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleResetAndClose}
            className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center text-sm font-bold transition-colors"
          >
            ✕
          </button>
        </div>

        {/* 4 PRIMARY CATEGORY TABS */}
        {!generatedResult && (
          <div className="grid grid-cols-2 sm:grid-cols-4 bg-slate-100 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 p-1.5 gap-1 text-xs">
            <button
              type="button"
              onClick={() => {
                setDocType("JOINING_LETTER");
                setIsPreviewOpen(false);
              }}
              className={`py-2 px-2.5 rounded-xl font-bold transition-all text-center flex items-center justify-center gap-1.5 ${
                docType === "JOINING_LETTER"
                  ? "bg-[#1456C0] text-white shadow-sm"
                  : "text-slate-600 dark:text-slate-300 hover:bg-white/60 dark:hover:bg-slate-700/60"
              }`}
            >
              <span>1. Joining Confirmation</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setDocType("EXPERIENCE_CERTIFICATE");
                setIsPreviewOpen(false);
              }}
              className={`py-2 px-2.5 rounded-xl font-bold transition-all text-center flex items-center justify-center gap-1.5 ${
                docType === "EXPERIENCE_CERTIFICATE"
                  ? "bg-[#1456C0] text-white shadow-sm"
                  : "text-slate-600 dark:text-slate-300 hover:bg-white/60 dark:hover:bg-slate-700/60"
              }`}
            >
              <span>2. Experience Certificate</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setDocType("RELIEVING_LETTER");
                setIsPreviewOpen(false);
              }}
              className={`py-2 px-2.5 rounded-xl font-bold transition-all text-center flex items-center justify-center gap-1.5 ${
                docType === "RELIEVING_LETTER"
                  ? "bg-[#1456C0] text-white shadow-sm"
                  : "text-slate-600 dark:text-slate-300 hover:bg-white/60 dark:hover:bg-slate-700/60"
              }`}
            >
              <span>3. Relieving Letter</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setDocType("CONTRACT_LETTER");
                setIsPreviewOpen(false);
              }}
              className={`py-2 px-2.5 rounded-xl font-bold transition-all text-center flex items-center justify-center gap-1.5 ${
                docType === "CONTRACT_LETTER"
                  ? "bg-[#1456C0] text-white shadow-sm"
                  : "text-slate-600 dark:text-slate-300 hover:bg-white/60 dark:hover:bg-slate-700/60"
              }`}
            >
              <span>4. Contract Letter</span>
            </button>
          </div>
        )}

        {/* BODY AREA */}
        {generatedResult ? (
          /* SUCCESS VIEW */
          <div className="p-6 space-y-5 overflow-y-auto">
            <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 flex items-start gap-3">
              <span className="w-7 h-7 rounded-full bg-emerald-600 text-white flex items-center justify-center font-bold text-sm flex-shrink-0 mt-0.5">
                ✓
              </span>
              <div>
                <p className="font-extrabold text-sm text-emerald-950">
                  Official Document Successfully Issued & Cryptographically Recorded
                </p>
                <p className="text-xs text-emerald-700 mt-0.5">
                  Permanent reference ID, SHA-256 fingerprint, and public QR verification have been registered.
                </p>
              </div>
            </div>

            <div className="bg-slate-50 dark:bg-slate-800/60 p-4 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-2.5 text-xs">
              <div className="flex justify-between items-center">
                <span className="text-slate-500 font-medium">Document Reference:</span>
                <strong className="font-mono text-sm text-[#1456C0] dark:text-blue-400 font-bold">
                  {generatedResult.certificateNumber}
                </strong>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500 font-medium">Category:</span>
                <span className="font-bold text-slate-800 dark:text-slate-200">
                  {generatedResult.certificateType?.replace(/_/g, " ")}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500 font-medium">Authorized Signatory:</span>
                <span className="font-bold text-slate-800 dark:text-slate-200">
                  {generatedResult.issuedBy} (Founder and Director)
                </span>
              </div>
              {generatedResult.pdfHash && (
                <div className="pt-1">
                  <span className="text-slate-500 font-medium block">Cryptographic SHA-256 Hash:</span>
                  <span className="font-mono text-[10px] text-slate-600 dark:text-slate-400 break-all bg-white dark:bg-slate-900 px-2 py-1 rounded block mt-0.5 border border-slate-200 dark:border-slate-800">
                    {generatedResult.pdfHash}
                  </span>
                </div>
              )}
            </div>

            <div className="space-y-2.5 pt-2">
              <a
                href={generatedResult.pdfUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full py-3 px-4 rounded-xl bg-[#1456C0] hover:bg-[#102A56] text-white text-xs font-bold shadow-md transition-all flex items-center justify-center gap-2"
              >
                <span>Download Official Executed PDF</span>
                <span>↓</span>
              </a>

              <a
                href={`/verify/cert/${generatedResult.certificateNumber}`}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full py-2.5 px-4 rounded-xl border border-slate-300 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-800 dark:text-slate-200 text-xs font-bold transition-all flex items-center justify-center gap-2"
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
                Done / Return to Employee Management
              </button>
            </div>
          </div>
        ) : isPreviewOpen && previewBlobUrl ? (
          /* CONTRACT PDF PREVIEW VIEW (MANDATORY APPROVAL STEP) */
          <div className="p-4 sm:p-6 space-y-4 flex flex-col flex-1 overflow-hidden">
            <div className="p-3 bg-blue-50 dark:bg-blue-950/40 rounded-xl text-xs text-blue-900 dark:text-blue-300 border border-blue-200 dark:border-blue-900 flex items-center justify-between">
              <div>
                <strong>Mandatory Review & Approval Step:</strong> Please inspect the complete rendered PDF preview below. Verify clauses, names, compensation terms, and page layout before final approval.
              </div>
              <button
                type="button"
                onClick={() => setIsPreviewOpen(false)}
                className="text-xs font-bold text-blue-700 dark:text-blue-400 underline ml-3 flex-shrink-0"
              >
                Back to Edit
              </button>
            </div>

            <div className="flex-1 w-full border border-slate-300 dark:border-slate-700 rounded-2xl overflow-hidden bg-slate-200 dark:bg-slate-800 min-h-[350px]">
              <iframe
                src={`${previewBlobUrl}#toolbar=0`}
                className="w-full h-full min-h-[380px]"
                title="Document PDF Preview"
              />
            </div>

            <div className="pt-3 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={() => setIsPreviewOpen(false)}
                className="px-4 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 text-xs font-bold hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                ← Back to Edit Fields
              </button>

              <button
                type="button"
                onClick={handleFinalGenerate}
                disabled={loading}
                className="px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black shadow-lg transition-all flex items-center gap-2"
              >
                {loading ? (
                  <>
                    <span className="animate-spin text-sm">↻</span>
                    <span>Issuing & Registering...</span>
                  </>
                ) : (
                  <>
                    <span>Approve & Issue Official {docType === "CONTRACT_LETTER" ? "Contract" : "Document"}</span>
                    <span>✓</span>
                  </>
                )}
              </button>
            </div>
          </div>
        ) : (
          /* FORM VIEW */
          <div className="p-5 sm:p-6 space-y-4 overflow-y-auto flex-1">
            {error && (
              <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold">
                {error}
              </div>
            )}

            {/* Basic Information Bar */}
            <div className="p-3 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
              <div>
                <span className="text-slate-400 block text-[10px] uppercase font-bold">Candidate</span>
                <span className="font-bold text-slate-800 dark:text-slate-200">{employee.name}</span>
              </div>
              <div>
                <span className="text-slate-400 block text-[10px] uppercase font-bold">Employee ID</span>
                <span className="font-mono font-bold text-slate-800 dark:text-slate-200">{employee.employeeId}</span>
              </div>
              <div>
                <span className="text-slate-400 block text-[10px] uppercase font-bold">Designation</span>
                <span className="font-semibold text-slate-800 dark:text-slate-200">{customDesignation || employee.designation}</span>
              </div>
              <div>
                <span className="text-slate-400 block text-[10px] uppercase font-bold">Department</span>
                <span className="font-semibold text-slate-800 dark:text-slate-200">{customDepartment || employee.department}</span>
              </div>
            </div>

            {/* CATEGORY 1: OFFICIAL JOINING CONFIRMATION FORM */}
            {docType === "JOINING_LETTER" && (
              <div className="space-y-3.5 animate-in fade-in duration-150">
                <div className="border-b border-slate-200 dark:border-slate-700 pb-1">
                  <h3 className="text-xs font-bold text-[#1456C0] uppercase tracking-wider">
                    Official Joining Confirmation Parameters
                  </h3>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  <div>
                    <label className="block text-slate-600 dark:text-slate-400 font-semibold mb-1">
                      Assigned Subject / Specialization
                    </label>
                    <input
                      type="text"
                      value={assignedSubject}
                      onChange={(e) => setAssignedSubject(e.target.value)}
                      placeholder="e.g. Physics / Physical Chemistry"
                      className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-600 dark:text-slate-400 font-semibold mb-1">
                      Assigned Batches
                    </label>
                    <input
                      type="text"
                      value={assignedBatch}
                      onChange={(e) => setAssignedBatch(e.target.value)}
                      placeholder="e.g. Comprehensive NEET / JEE Batches"
                      className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-600 dark:text-slate-400 font-semibold mb-1">
                      Work Location
                    </label>
                    <input
                      type="text"
                      value={workLocation}
                      onChange={(e) => setWorkLocation(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-600 dark:text-slate-400 font-semibold mb-1">
                      Reporting Authority
                    </label>
                    <input
                      type="text"
                      value={reportingAuthority}
                      onChange={(e) => setReportingAuthority(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-600 dark:text-slate-400 font-semibold mb-1">
                      Working Schedule
                    </label>
                    <input
                      type="text"
                      value={workingSchedule}
                      onChange={(e) => setWorkingSchedule(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-600 dark:text-slate-400 font-semibold mb-1">
                      Remuneration Reference
                    </label>
                    <input
                      type="text"
                      value={compensationReference}
                      onChange={(e) => setCompensationReference(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-slate-600 dark:text-slate-400 font-semibold mb-1 text-xs">
                    Reporting Instructions & Orientation Note
                  </label>
                  <textarea
                    rows={2}
                    value={reportingInstructions}
                    onChange={(e) => setReportingInstructions(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-xs"
                  />
                </div>
              </div>
            )}

            {/* CATEGORY 2: EXPERIENCE CERTIFICATE FORM */}
            {docType === "EXPERIENCE_CERTIFICATE" && (
              <div className="space-y-3.5 animate-in fade-in duration-150">
                <div className="border-b border-slate-200 dark:border-slate-700 pb-1">
                  <h3 className="text-xs font-bold text-[#1456C0] uppercase tracking-wider">
                    Experience Certificate Parameters
                  </h3>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  <div>
                    <label className="block text-slate-600 dark:text-slate-400 font-semibold mb-1">
                      Tenure Start Date (Joining Date)
                    </label>
                    <input
                      type="date"
                      value={tenureStart}
                      onChange={(e) => setTenureStart(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-600 dark:text-slate-400 font-semibold mb-1">
                      Relieving / Tenure End Date
                    </label>
                    <input
                      type="date"
                      value={tenureEnd}
                      onChange={(e) => setTenureEnd(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-slate-600 dark:text-slate-400 font-semibold mb-1 text-xs">
                    Professional Conduct & Academic Contribution Statement
                  </label>
                  <textarea
                    rows={2}
                    value={conductRemarks}
                    onChange={(e) => setConductRemarks(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-xs"
                  />
                </div>
              </div>
            )}

            {/* CATEGORY 3: RELIEVING LETTER FORM */}
            {docType === "RELIEVING_LETTER" && (
              <div className="space-y-3.5 animate-in fade-in duration-150">
                <div className="border-b border-slate-200 dark:border-slate-700 pb-1">
                  <h3 className="text-xs font-bold text-[#1456C0] uppercase tracking-wider">
                    Relieving & Clearance Record Parameters
                  </h3>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  <div>
                    <label className="block text-slate-600 dark:text-slate-400 font-semibold mb-1">
                      Resignation / Separation Reference
                    </label>
                    <input
                      type="text"
                      value={resignationRef}
                      onChange={(e) => setResignationRef(e.target.value)}
                      placeholder="e.g. Formal resignation letter dated 15 Jan 2026"
                      className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-600 dark:text-slate-400 font-semibold mb-1">
                      Relieving Effective Date
                    </label>
                    <input
                      type="date"
                      value={relievingDate}
                      onChange={(e) => setRelievingDate(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-600 dark:text-slate-400 font-semibold mb-1">
                      Academic Handover Clearance Status
                    </label>
                    <select
                      value={handoverStatus}
                      onChange={(e) => setHandoverStatus(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                    >
                      <option value="Completed & Verified">Completed & Verified</option>
                      <option value="In Progress">In Progress</option>
                      <option value="Pending Handover">Pending Handover</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-slate-600 dark:text-slate-400 font-semibold mb-1">
                      Institutional Assets Return Status
                    </label>
                    <select
                      value={assetsStatus}
                      onChange={(e) => setAssetsStatus(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                    >
                      <option value="Returned & Deactivated">Returned & Deactivated</option>
                      <option value="Pending Asset Return">Pending Asset Return</option>
                      <option value="Not Applicable">Not Applicable</option>
                    </select>
                  </div>

                  <div className="sm:col-span-2">
                    <label className="block text-slate-600 dark:text-slate-400 font-semibold mb-1">
                      Final Financial Settlement Status
                    </label>
                    <select
                      value={settlementStatus}
                      onChange={(e) => setSettlementStatus(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                    >
                      <option value="Settled & Disbursed">Settled & Disbursed</option>
                      <option value="In Process per Billing Cycle">In Process per Billing Cycle</option>
                      <option value="Pending Administrative Review">Pending Administrative Review</option>
                    </select>
                  </div>
                </div>
              </div>
            )}

            {/* CATEGORY 4: CONTRACT LETTER FORM */}
            {docType === "CONTRACT_LETTER" && (
              <div className="space-y-3.5 animate-in fade-in duration-150">
                <div className="border-b border-slate-200 dark:border-slate-700 pb-1 flex items-center justify-between">
                  <h3 className="text-xs font-bold text-[#1456C0] uppercase tracking-wider">
                    Educator / Consultant Service Agreement Parameters
                  </h3>
                  <span className="text-[10px] bg-blue-100 text-[#1456C0] px-2 py-0.5 rounded font-bold">
                    Multi-page Legal Agreement
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  <div>
                    <label className="block text-slate-600 dark:text-slate-400 font-semibold mb-1">
                      Engagement Nature
                    </label>
                    <select
                      value={engagementType}
                      onChange={(e) => setEngagementType(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-bold"
                    >
                      <option value="FULL_TIME">Full-Time Faculty (Exclusive during term)</option>
                      <option value="PART_TIME">Part-Time Faculty</option>
                      <option value="CONSULTANT">Academic Consultant / Independent Expert</option>
                      <option value="GUEST_FACULTY">Guest Faculty</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-slate-600 dark:text-slate-400 font-semibold mb-1">
                      Agreement Expiry Date
                    </label>
                    <input
                      type="date"
                      value={contractEndDate}
                      onChange={(e) => setContractEndDate(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-600 dark:text-slate-400 font-semibold mb-1">
                      Monthly Remuneration (INR)
                    </label>
                    <input
                      type="text"
                      value={monthlySalary}
                      onChange={(e) => setMonthlySalary(e.target.value)}
                      placeholder="e.g. 45,000"
                      className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-600 dark:text-slate-400 font-semibold mb-1">
                      Teaching Hours Monthly
                    </label>
                    <input
                      type="text"
                      value={teachingHoursMonthly}
                      onChange={(e) => setTeachingHoursMonthly(e.target.value)}
                      placeholder="e.g. 70 to 80 Hours"
                      className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-600 dark:text-slate-400 font-semibold mb-1">
                      Disbursement Day
                    </label>
                    <input
                      type="text"
                      value={paymentCycleDay}
                      onChange={(e) => setPaymentCycleDay(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-600 dark:text-slate-400 font-semibold mb-1">
                      Termination Notice Period
                    </label>
                    <input
                      type="text"
                      value={noticePeriodDays}
                      onChange={(e) => setNoticePeriodDays(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-slate-600 dark:text-slate-400 font-semibold mb-1 text-xs">
                    Special Conditions (Annexure C)
                  </label>
                  <input
                    type="text"
                    value={specialConditions}
                    onChange={(e) => setSpecialConditions(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-xs"
                  />
                </div>
              </div>
            )}

            {/* Official Authority Guarantee Badge */}
            <div className="p-3 bg-amber-50 dark:bg-amber-950/30 rounded-xl text-[11px] text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-900/50 flex items-center justify-between">
              <div>
                <strong>Official Identity:</strong> Digitally signed by <strong>Firoz Ali, Founder & Director</strong> &bull; ATOMIC PATHSHALA EDUCATION.
              </div>
              <span className="text-[10px] font-bold text-amber-900 dark:text-amber-200 bg-amber-200/50 px-2 py-0.5 rounded">
                Royal Blue &amp; White Design
              </span>
            </div>

            {/* Action Buttons */}
            <div className="pt-3 border-t border-slate-200 dark:border-slate-800 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={handleResetAndClose}
                disabled={loading || previewLoading}
                className="px-4 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 text-xs font-bold hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                Cancel
              </button>

              {/* Preview Button (Mandatory for Contract, available for all) */}
              <button
                type="button"
                onClick={handlePreview}
                disabled={previewLoading || loading}
                className="px-4 py-2.5 rounded-xl border border-[#1456C0] text-[#1456C0] hover:bg-blue-50 dark:hover:bg-blue-950/40 text-xs font-bold transition-all flex items-center gap-1.5"
              >
                {previewLoading ? (
                  <>
                    <span className="animate-spin text-sm">↻</span>
                    <span>Rendering Preview...</span>
                  </>
                ) : (
                  <>
                    <span>👁️ Preview {docType === "CONTRACT_LETTER" ? "Contract PDF" : "Document"}</span>
                  </>
                )}
              </button>

              {/* Direct Generate Button */}
              <button
                type="button"
                onClick={handleFinalGenerate}
                disabled={loading || previewLoading}
                className="px-6 py-2.5 rounded-xl bg-[#1456C0] hover:bg-[#102A56] text-white text-xs font-bold shadow-lg transition-all flex items-center gap-2"
              >
                {loading ? (
                  <>
                    <span className="animate-spin text-sm">↻</span>
                    <span>Generating & Signing PDF...</span>
                  </>
                ) : (
                  <span>Issue & Sign Official Document</span>
                )}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
