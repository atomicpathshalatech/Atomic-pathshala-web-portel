"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { INDIAN_STATE_STAMP_RULES } from "@/lib/agreements/estamp";

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
  
  // Document Type & Engagement Model
  const [documentType, setDocumentType] = useState<"SERVICE_AGREEMENT" | "JOINING_LETTER">("SERVICE_AGREEMENT");
  const [engagementType, setEngagementType] = useState<string>("FULL_TIME");

  // Document Details
  const selectedTeacher = teachers.find((t) => t.id === selectedTeacherId);
  const [title, setTitle] = useState("Educator Service Agreement — 2025/2026");
  const [designation, setDesignation] = useState("Faculty Educator");
  const [subject, setSubject] = useState(selectedTeacher?.department || "Physics");
  
  // Compensation & Deliverables (Annexure A)
  const [compensationType, setCompensationType] = useState("MONTHLY_REMUNERATION");
  const [annualSalary, setAnnualSalary] = useState("INR 7,20,000 /- (Seven Lakhs Twenty Thousand) per annum");
  const [monthlySalary, setMonthlySalary] = useState("INR 60,000 /- (Sixty Thousand) per month");
  const [perLectureRate, setPerLectureRate] = useState("");
  const [perHourRate, setPerHourRate] = useState("");
  const [teachingHoursMonthly, setTeachingHoursMonthly] = useState("70 to 80 Hours");
  const [doubtHoursMonthly, setDoubtHoursMonthly] = useState("15 Hours per month");
  const [noticePeriodDays, setNoticePeriodDays] = useState("60 Days");
  const [effectiveDate, setEffectiveDate] = useState("03 May, 2025");
  const [contractEndDate, setContractEndDate] = useState("02 May, 2026");

  // Academic Assignment (Annexure B)
  const [assignedBatch, setAssignedBatch] = useState("Comprehensive NEET / JEE Batches");
  const [teachingMedium, setTeachingMedium] = useState("English / Bilingual (Hinglish)");
  const [workLocation, setWorkLocation] = useState("Rampur, Uttar Pradesh, India / Digital Streaming Studio");
  const [reportingAuthority, setReportingAuthority] = useState("Founder & Proprietor");
  const [workingSchedule, setWorkingSchedule] = useState("As per official Academic Timetable");
  const [academicSession, setAcademicSession] = useState("2025-2026 Academic Session");

  // Educator Profile Info
  const [address, setAddress] = useState("Rampur, Uttar Pradesh, India");
  const [panNumber, setPanNumber] = useState("DTHPA7342Q");

  // Special Conditions (Annexure C)
  const [specialConditions, setSpecialConditions] = useState("");

  // e-Stamp Attachment (Service Agreement only)
  const [attachStamp, setAttachStamp] = useState(false);
  const [stampState, setStampState] = useState("Uttar Pradesh");
  const [stampCertificateNo, setStampCertificateNo] = useState("");
  const [stampDutyAmount, setStampDutyAmount] = useState("100");
  const [stampIssueDate, setStampIssueDate] = useState(new Date().toISOString().split("T")[0]);

  const [submitting, setSubmitting] = useState(false);

  // Automatically adjust default title when documentType changes
  function handleDocumentTypeChange(type: "SERVICE_AGREEMENT" | "JOINING_LETTER") {
    setDocumentType(type);
    if (type === "JOINING_LETTER") {
      setTitle(`Educator Appointment / Joining Letter — ${selectedTeacher?.user.name || "Educator"}`);
    } else {
      setTitle(`Educator Service Agreement — ${selectedTeacher?.user.name || "Educator"}`);
    }
  }

  function handleStateChange(stateName: string) {
    setStampState(stateName);
    const rule = INDIAN_STATE_STAMP_RULES.find((s) => s.stateName === stateName);
    if (rule) {
      setStampDutyAmount(rule.defaultDutyAmount);
    }
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedTeacherId) {
      toast.error("Please select an educator.");
      return;
    }

    if (documentType === "SERVICE_AGREEMENT" && attachStamp && (!stampCertificateNo.trim() || stampCertificateNo.trim().length < 5)) {
      toast.error("Please enter a valid genuine Government e-Stamp Certificate Number.");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/team/agreements", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          teacherId: selectedTeacherId,
          documentType,
          engagementType,
          title: title || (documentType === "JOINING_LETTER" ? `Educator Appointment Letter — ${selectedTeacher?.user.name}` : `Educator Service Agreement — ${selectedTeacher?.user.name}`),
          designation,
          subject,
          compensationType,
          annualSalary,
          monthlySalary,
          perLectureRate: perLectureRate || undefined,
          perHourRate: perHourRate || undefined,
          teachingHoursMonthly,
          doubtHoursMonthly,
          noticePeriodDays,
          effectiveDate,
          contractEndDate,
          assignedBatch,
          teachingMedium,
          workLocation,
          reportingAuthority,
          workingSchedule,
          academicSession,
          specialConditions: specialConditions || undefined,
          address,
          panNumber,
          stampCertificateNo: documentType === "SERVICE_AGREEMENT" && attachStamp ? stampCertificateNo.trim() : undefined,
          stampDutyAmount: documentType === "SERVICE_AGREEMENT" && attachStamp ? stampDutyAmount.trim() : undefined,
          stampIssuingState: documentType === "SERVICE_AGREEMENT" && attachStamp ? stampState : undefined,
          stampIssueDate: documentType === "SERVICE_AGREEMENT" && attachStamp ? stampIssueDate : undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        toast.error(data.error || "Could not generate document.");
        return;
      }

      toast.success(`${documentType === "JOINING_LETTER" ? "Joining Letter" : "Service Agreement"} generated successfully!`);
      router.push(`/team/contracts/${data.data.agreement.id}`);
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
        <div className="flex items-center gap-3">
          <span className="w-8 h-8 rounded-full bg-primary text-on-primary flex items-center justify-center font-bold text-sm">
            1
          </span>
          <div>
            <h3 className="font-bold text-base text-on-surface">Educator Documentation Generator</h3>
            <p className="text-xs text-on-surface-variant">Generate official Joining Letters &amp; Service Agreements for Atomic Pathshala</p>
          </div>
        </div>
        <div className="text-xs text-on-surface-variant font-mono bg-surface-container px-3 py-1 rounded-full border border-outline-variant/20">
          Rampur, Uttar Pradesh, India
        </div>
      </div>

      <form onSubmit={handleCreate} className="space-y-6">
        {/* Step 1: Select Document Type */}
        <div className="p-4 rounded-2xl bg-surface-container/60 border border-outline-variant/20 space-y-3">
          <label className="text-xs font-bold text-on-surface uppercase tracking-wider block">
            Select Official Document Type
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => handleDocumentTypeChange("SERVICE_AGREEMENT")}
              className={`p-4 rounded-xl border text-left transition-all ${
                documentType === "SERVICE_AGREEMENT"
                  ? "border-primary bg-primary/10 shadow-sm"
                  : "border-outline-variant/40 bg-surface hover:bg-surface-container"
              }`}
            >
              <div className="flex items-center justify-between mb-1">
                <span className="font-bold text-sm text-on-surface">Educator Service Agreement</span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-primary/20 text-primary font-bold">
                  AP-AGR-YYYY-XXXX
                </span>
              </div>
              <p className="text-xs text-on-surface-variant">
                Comprehensive 25-clause bilateral legal agreement covering IP, confidentiality, Annexures A/B/C, and arbitration.
              </p>
            </button>

            <button
              type="button"
              onClick={() => handleDocumentTypeChange("JOINING_LETTER")}
              className={`p-4 rounded-xl border text-left transition-all ${
                documentType === "JOINING_LETTER"
                  ? "border-primary bg-primary/10 shadow-sm"
                  : "border-outline-variant/40 bg-surface hover:bg-surface-container"
              }`}
            >
              <div className="flex items-center justify-between mb-1">
                <span className="font-bold text-sm text-on-surface">Educator Appointment / Joining Letter</span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-secondary/20 text-secondary font-bold">
                  AP-JL-YYYY-XXXX
                </span>
              </div>
              <p className="text-xs text-on-surface-variant">
                Formal corporate appointment letter communicating designation, batches, schedule, and 10 policy acknowledgements.
              </p>
            </button>
          </div>
        </div>

        {/* Step 2: Educator & Engagement Model */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-on-surface">Select Educator / Faculty</label>
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
            <label className="text-xs font-bold text-on-surface">Engagement Model</label>
            <select
              value={engagementType}
              onChange={(e) => setEngagementType(e.target.value)}
              className="w-full rounded-xl border border-outline-variant/40 bg-surface px-4 py-2.5 text-xs text-on-surface outline-none focus:ring-2 focus:ring-primary font-semibold"
            >
              <option value="FULL_TIME">Full-Time Faculty</option>
              <option value="PART_TIME">Part-Time Faculty</option>
              <option value="VISITING_FACULTY">Visiting Faculty</option>
              <option value="INDEPENDENT_CONSULTANT">Independent Consultant</option>
              <option value="GUEST_EDUCATOR">Guest Educator</option>
              <option value="CONTENT_CREATOR">Content Creator / SME</option>
            </select>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-bold text-on-surface">Designation Title</label>
            <input
              type="text"
              value={designation}
              onChange={(e) => setDesignation(e.target.value)}
              placeholder="e.g. Senior NEET Physics Faculty"
              className="w-full rounded-xl border border-outline-variant/40 bg-surface px-4 py-2.5 text-xs text-on-surface outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
        </div>

        {/* Document Title & Subject */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-on-surface">Document Title</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full rounded-xl border border-outline-variant/40 bg-surface px-4 py-2.5 text-xs text-on-surface outline-none focus:ring-2 focus:ring-primary"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-bold text-on-surface">Subject Specialization</label>
            <input
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="e.g. Organic Chemistry, Mechanics, Zoology"
              className="w-full rounded-xl border border-outline-variant/40 bg-surface px-4 py-2.5 text-xs text-on-surface outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
        </div>

        {/* Academic Assignment (Annexure B) */}
        <div className="p-4 rounded-2xl bg-surface-container/40 border border-outline-variant/20 space-y-3">
          <h4 className="text-xs font-bold text-on-surface uppercase tracking-wider">
            Academic Assignment Details (Annexure B)
          </h4>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="space-y-1">
              <label className="text-[11px] font-medium text-on-surface-variant">Assigned Batch(es)</label>
              <input
                type="text"
                value={assignedBatch}
                onChange={(e) => setAssignedBatch(e.target.value)}
                className="w-full rounded-lg border border-outline-variant/40 bg-surface px-3 py-2 text-xs text-on-surface outline-none"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[11px] font-medium text-on-surface-variant">Teaching Medium</label>
              <input
                type="text"
                value={teachingMedium}
                onChange={(e) => setTeachingMedium(e.target.value)}
                className="w-full rounded-lg border border-outline-variant/40 bg-surface px-3 py-2 text-xs text-on-surface outline-none"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[11px] font-medium text-on-surface-variant">Academic Session</label>
              <input
                type="text"
                value={academicSession}
                onChange={(e) => setAcademicSession(e.target.value)}
                className="w-full rounded-lg border border-outline-variant/40 bg-surface px-3 py-2 text-xs text-on-surface outline-none"
              />
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-[11px] font-medium text-on-surface-variant">Work Location</label>
              <input
                type="text"
                value={workLocation}
                onChange={(e) => setWorkLocation(e.target.value)}
                className="w-full rounded-lg border border-outline-variant/40 bg-surface px-3 py-2 text-xs text-on-surface outline-none"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[11px] font-medium text-on-surface-variant">Reporting Authority</label>
              <input
                type="text"
                value={reportingAuthority}
                onChange={(e) => setReportingAuthority(e.target.value)}
                className="w-full rounded-lg border border-outline-variant/40 bg-surface px-3 py-2 text-xs text-on-surface outline-none font-semibold text-primary"
              />
            </div>
          </div>
        </div>

        {/* Compensation & Payment Terms (Annexure A) */}
        <div className="p-4 rounded-2xl bg-surface-container/40 border border-outline-variant/20 space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-bold text-on-surface uppercase tracking-wider">
              Compensation &amp; Payment Model (Annexure A)
            </h4>
            <div className="flex gap-2">
              {["MONTHLY_REMUNERATION", "PER_LECTURE", "PER_HOUR", "REVENUE_SHARING"].map((m) => (
                <button
                  type="button"
                  key={m}
                  onClick={() => setCompensationType(m)}
                  className={`text-[10px] px-2.5 py-1 rounded-full font-bold transition-all ${
                    compensationType === m
                      ? "bg-primary text-on-primary"
                      : "bg-surface text-on-surface-variant border border-outline-variant/30"
                  }`}
                >
                  {m.replace(/_/g, " ")}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-[11px] font-medium text-on-surface-variant">Annual Compensation (CTC)</label>
              <input
                type="text"
                value={annualSalary}
                onChange={(e) => setAnnualSalary(e.target.value)}
                className="w-full rounded-lg border border-outline-variant/40 bg-surface px-3 py-2 text-xs text-on-surface outline-none"
              />
            </div>

            <div className="space-y-1">
              <label className="text-[11px] font-medium text-on-surface-variant">Monthly Remuneration</label>
              <input
                type="text"
                value={monthlySalary}
                onChange={(e) => setMonthlySalary(e.target.value)}
                className="w-full rounded-lg border border-outline-variant/40 bg-surface px-3 py-2 text-xs text-on-surface outline-none font-semibold text-primary"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
            <div className="space-y-1">
              <label className="text-[11px] font-medium text-on-surface-variant">Per Lecture Rate (Optional)</label>
              <input
                type="text"
                value={perLectureRate}
                onChange={(e) => setPerLectureRate(e.target.value)}
                placeholder="e.g. INR 2,500 / lecture"
                className="w-full rounded-lg border border-outline-variant/40 bg-surface px-3 py-2 text-xs text-on-surface outline-none"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[11px] font-medium text-on-surface-variant">Monthly Teaching Hours</label>
              <input
                type="text"
                value={teachingHoursMonthly}
                onChange={(e) => setTeachingHoursMonthly(e.target.value)}
                className="w-full rounded-lg border border-outline-variant/40 bg-surface px-3 py-2 text-xs text-on-surface outline-none"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[11px] font-medium text-on-surface-variant">Doubt Support Hours</label>
              <input
                type="text"
                value={doubtHoursMonthly}
                onChange={(e) => setDoubtHoursMonthly(e.target.value)}
                className="w-full rounded-lg border border-outline-variant/40 bg-surface px-3 py-2 text-xs text-on-surface outline-none"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[11px] font-medium text-on-surface-variant">Notice Period</label>
              <input
                type="text"
                value={noticePeriodDays}
                onChange={(e) => setNoticePeriodDays(e.target.value)}
                className="w-full rounded-lg border border-outline-variant/40 bg-surface px-3 py-2 text-xs text-on-surface outline-none"
              />
            </div>
          </div>
        </div>

        {/* Dates & Educator Details */}
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-on-surface">Effective / Joining Date</label>
            <input
              type="text"
              value={effectiveDate}
              onChange={(e) => setEffectiveDate(e.target.value)}
              className="w-full rounded-xl border border-outline-variant/40 bg-surface px-4 py-2.5 text-xs text-on-surface outline-none"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-bold text-on-surface">Term Expiry Date</label>
            <input
              type="text"
              value={contractEndDate}
              onChange={(e) => setContractEndDate(e.target.value)}
              className="w-full rounded-xl border border-outline-variant/40 bg-surface px-4 py-2.5 text-xs text-on-surface outline-none"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-bold text-on-surface">Educator PAN</label>
            <input
              type="text"
              value={panNumber}
              onChange={(e) => setPanNumber(e.target.value)}
              className="w-full rounded-xl border border-outline-variant/40 bg-surface px-4 py-2.5 text-xs text-on-surface outline-none font-mono"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-bold text-on-surface">Educator Address</label>
            <input
              type="text"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              className="w-full rounded-xl border border-outline-variant/40 bg-surface px-4 py-2.5 text-xs text-on-surface outline-none"
            />
          </div>
        </div>

        {/* Special Conditions (Annexure C) */}
        <div className="space-y-1.5">
          <label className="text-xs font-bold text-on-surface">
            Special Conditions / Mutually Agreed Terms (Annexure C)
          </label>
          <textarea
            value={specialConditions}
            onChange={(e) => setSpecialConditions(e.target.value)}
            rows={2}
            placeholder="Optional custom terms for this specific faculty member (leave blank for standard terms)..."
            className="w-full rounded-xl border border-outline-variant/40 bg-surface px-4 py-2.5 text-xs text-on-surface outline-none focus:ring-2 focus:ring-primary"
          />
        </div>

        {/* e-Stamp Section (Only applicable for Service Agreements) */}
        {documentType === "SERVICE_AGREEMENT" && (
          <div className="p-4 rounded-2xl bg-surface-container/50 border border-outline-variant/20 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  id="attachStamp"
                  checked={attachStamp}
                  onChange={(e) => setAttachStamp(e.target.checked)}
                  className="w-4 h-4 rounded text-primary focus:ring-primary"
                />
                <label htmlFor="attachStamp" className="text-xs font-bold text-on-surface cursor-pointer">
                  Attach Authentic State Government e-Stamp Certificate (Non-Judicial)
                </label>
              </div>
              <span className="text-[10px] text-on-surface-variant font-mono">
                Indian Stamp Act, 1899
              </span>
            </div>

            {attachStamp && (
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 pt-2">
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-on-surface">Issuing State</label>
                  <select
                    value={stampState}
                    onChange={(e) => handleStateChange(e.target.value)}
                    className="w-full rounded-lg border border-outline-variant/40 bg-surface px-3 py-2 text-xs text-on-surface font-semibold outline-none"
                  >
                    {INDIAN_STATE_STAMP_RULES.map((s) => (
                      <option key={s.stateCode} value={s.stateName}>
                        {s.stateName}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-on-surface">Certificate Number</label>
                  <input
                    type="text"
                    value={stampCertificateNo}
                    onChange={(e) => setStampCertificateNo(e.target.value)}
                    placeholder="e.g. IN-UP12345678901234A"
                    className="w-full rounded-lg border border-outline-variant/40 bg-surface px-3 py-2 text-xs text-on-surface font-mono outline-none"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-on-surface">Duty Paid (INR)</label>
                  <input
                    type="text"
                    value={stampDutyAmount}
                    onChange={(e) => setStampDutyAmount(e.target.value)}
                    className="w-full rounded-lg border border-outline-variant/40 bg-surface px-3 py-2 text-xs text-on-surface font-mono outline-none"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-on-surface">Issue Date</label>
                  <input
                    type="date"
                    value={stampIssueDate}
                    onChange={(e) => setStampIssueDate(e.target.value)}
                    className="w-full rounded-lg border border-outline-variant/40 bg-surface px-3 py-2 text-xs text-on-surface outline-none"
                  />
                </div>
              </div>
            )}
          </div>
        )}

        {/* Submit Button */}
        <div className="flex items-center justify-end gap-3 pt-4 border-t border-outline-variant/20">
          <button
            type="submit"
            disabled={submitting}
            className="px-6 py-2.5 rounded-xl bg-primary text-on-primary text-xs font-bold shadow-md hover:bg-primary/90 transition-all disabled:opacity-50"
          >
            {submitting ? "Compiling Document..." : `Generate ${documentType === "JOINING_LETTER" ? "Joining Letter" : "Service Agreement"}`}
          </button>
        </div>
      </form>
    </div>
  );
}
