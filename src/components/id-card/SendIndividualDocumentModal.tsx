"use client";

import React, { useState, useEffect, useTransition } from "react";
import { useRouter } from "next/navigation";

export type IndividualDocType =
  | "ID_CARD"
  | "JOINING_LETTER"
  | "EXPERIENCE_CERTIFICATE"
  | "RELIEVING_LETTER"
  | "CONTRACT_LETTER"
  | "CUSTOM_EMAIL";

export interface RecipientProfile {
  id: string; // User ID
  name: string;
  email: string;
  phone?: string | null;
  photoUrl?: string | null;
  employeeCode?: string | null;
  designation?: string | null;
  department?: string | null;
  joiningDate?: string | null;
  kind?: "TEAM" | "STUDENT";
}

interface SendIndividualDocumentModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultKind?: "TEAM" | "STUDENT";
  initialRecipient?: RecipientProfile | null;
}

export function SendIndividualDocumentModal({
  isOpen,
  onClose,
  defaultKind = "TEAM",
  initialRecipient = null,
}: SendIndividualDocumentModalProps) {
  const router = useRouter();
  const [, startTransition] = useTransition();

  // Mode and recipient selection
  const [kind, setKind] = useState<"TEAM" | "STUDENT">(defaultKind);
  const [recipient, setRecipient] = useState<RecipientProfile | null>(initialRecipient);

  // Search state when choosing a recipient
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<RecipientProfile[]>([]);
  const [searching, setSearching] = useState(false);

  // Document configuration
  const [docType, setDocType] = useState<IndividualDocType>("ID_CARD");
  const [channel, setChannel] = useState<"email" | "whatsapp">("email");

  // Form Fields
  const [joiningDate, setJoiningDate] = useState("");
  const [designation, setDesignation] = useState("");
  const [department, setDepartment] = useState("Academic");
  const [workLocation, setWorkLocation] = useState("Kota Campus / Head Office");
  const [reportingAuthority, setReportingAuthority] = useState("Director of Academics, Atomic Pathshala");
  const [assignedSubject, setAssignedSubject] = useState("");
  const [assignedBatch, setAssignedBatch] = useState("NEET / JEE Dropper & Foundation");
  const [monthlySalary, setMonthlySalary] = useState("₹50,000 / month");
  const [annualSalary, setAnnualSalary] = useState("₹6,00,000 / annum");
  const [tenureStart, setTenureStart] = useState("");
  const [tenureEnd, setTenureEnd] = useState("");
  const [relievingDate, setRelievingDate] = useState("");
  const [noticePeriodDays, setNoticePeriodDays] = useState("30");
  const [conductRemarks, setConductRemarks] = useState("Exemplary conduct, sincere dedication, and strong pedagogical ethics.");
  const [specialConditions, setSpecialConditions] = useState("");
  const [customSubject, setCustomSubject] = useState("");
  const [customMessage, setCustomMessage] = useState("");

  // Sending & Preview states
  const [sending, setSending] = useState(false);
  const [previewing, setPreviewing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successResult, setSuccessResult] = useState<{ message: string; channel: string } | null>(null);

  // Reset or initialize when opened
  useEffect(() => {
    if (isOpen) {
      setError(null);
      setSuccessResult(null);
      if (initialRecipient) {
        setRecipient(initialRecipient);
        setKind(initialRecipient.kind || defaultKind);
        setDesignation(initialRecipient.designation || "");
        setDepartment(initialRecipient.department || "Academic");
        setJoiningDate(initialRecipient.joiningDate || "");
        setTenureStart(initialRecipient.joiningDate || "");
      } else {
        setRecipient(null);
        setKind(defaultKind);
      }
    }
  }, [isOpen, initialRecipient, defaultKind]);

  // Sync recipient details to form when recipient changes
  useEffect(() => {
    if (recipient) {
      if (recipient.designation) setDesignation(recipient.designation);
      if (recipient.department) setDepartment(recipient.department);
      if (recipient.joiningDate) {
        setJoiningDate(recipient.joiningDate);
        setTenureStart(recipient.joiningDate);
      }
    }
  }, [recipient]);

  // Live recipient search
  useEffect(() => {
    if (!isOpen || recipient) return;
    const timer = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await fetch(`/api/team/id-cards/search-recipients?kind=${kind.toLowerCase()}&q=${encodeURIComponent(searchQuery)}`);
        const json = await res.json();
        if (json.success && json.data?.recipients) {
          setSearchResults(json.data.recipients);
        }
      } catch {
        // search failure silent
      } finally {
        setSearching(false);
      }
    }, 250);
    return () => clearTimeout(timer);
  }, [isOpen, recipient, kind, searchQuery]);

  if (!isOpen) return null;

  const buildPayload = () => {
    if (!recipient) return null;
    return {
      userId: recipient.id,
      kind,
      documentType: docType,
      channel,
      customSubject: customSubject || undefined,
      customMessage: customMessage || undefined,
      joiningDate: joiningDate || undefined,
      designation: designation || undefined,
      department: department || undefined,
      workLocation: workLocation || undefined,
      reportingAuthority: reportingAuthority || undefined,
      assignedSubject: assignedSubject || undefined,
      assignedBatch: assignedBatch || undefined,
      tenureStart: tenureStart || undefined,
      tenureEnd: tenureEnd || undefined,
      relievingDate: relievingDate || undefined,
      noticePeriodDays: noticePeriodDays || undefined,
      conductRemarks: conductRemarks || undefined,
      monthlySalary: monthlySalary || undefined,
      annualSalary: annualSalary || undefined,
      specialConditions: specialConditions || undefined,
    };
  };

  const handlePreview = async () => {
    const payload = buildPayload();
    if (!payload) {
      setError("Please select a recipient first.");
      return;
    }

    setPreviewing(true);
    setError(null);

    try {
      const res = await fetch("/api/team/id-cards/send-document/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => null);
        throw new Error(errJson?.error || "Failed to generate document preview.");
      }

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      window.open(url, "_blank");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Error generating preview");
    } finally {
      setPreviewing(false);
    }
  };

  const handleSend = async () => {
    const payload = buildPayload();
    if (!payload) {
      setError("Please select a recipient first.");
      return;
    }

    setSending(true);
    setError(null);
    setSuccessResult(null);

    try {
      const res = await fetch("/api/team/id-cards/send-document", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.success) {
        throw new Error(json?.error || "Failed to send document.");
      }

      setSuccessResult({
        message: json.data?.message || "Document dispatched successfully!",
        channel,
      });

      startTransition(() => {
        router.refresh();
      });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to dispatch document");
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
      <div className="relative w-full max-w-3xl bg-surface rounded-2xl shadow-2xl border border-outline-variant/30 flex flex-col max-h-[92vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-outline-variant/20 bg-surface-container-high/30">
          <div>
            <h2 className="text-lg font-black text-on-surface flex items-center gap-2">
              <span className="material-symbols-outlined text-[#0f3a9e] text-2xl">mark_email_read</span>
              Send Document / Email to Individual
            </h2>
            <p className="text-xs text-on-surface-variant">
              Dispatch official ID card, joining letter, contract, experience letter or custom notice directly.
            </p>
          </div>
          <button
            onClick={onClose}
            type="button"
            className="w-8 h-8 rounded-full flex items-center justify-center text-on-surface-variant hover:bg-surface-container hover:text-on-surface transition"
          >
            <span className="material-symbols-outlined text-lg">close</span>
          </button>
        </div>

        {/* Body Content */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">
          {error && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800 flex items-center gap-2">
              <span className="material-symbols-outlined text-rose-600 text-sm">error</span>
              <span>{error}</span>
            </div>
          )}

          {successResult ? (
            <div className="p-6 bg-emerald-50 border border-emerald-200 rounded-2xl text-center space-y-3">
              <div className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center mx-auto">
                <span className="material-symbols-outlined text-2xl">check_circle</span>
              </div>
              <h3 className="text-base font-bold text-emerald-900">Dispatched Successfully</h3>
              <p className="text-sm text-emerald-800">{successResult.message}</p>
              <div className="pt-2 flex justify-center gap-3">
                <button
                  type="button"
                  onClick={() => setSuccessResult(null)}
                  className="px-4 py-2 rounded-xl text-xs font-bold border border-emerald-300 text-emerald-900 hover:bg-emerald-100/50"
                >
                  Send Another Document
                </button>
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 rounded-xl text-xs font-bold bg-[#0f3a9e] text-white hover:bg-[#0f3a9e]/90"
                >
                  Done
                </button>
              </div>
            </div>
          ) : (
            <>
              {/* Step 1: Select Recipient */}
              <div className="space-y-3">
                <label className="text-xs font-bold uppercase tracking-wider text-on-surface-variant flex items-center justify-between">
                  <span>1. Recipient Information</span>
                  {!initialRecipient && recipient && (
                    <button
                      type="button"
                      onClick={() => setRecipient(null)}
                      className="text-[#0f3a9e] text-xs font-semibold hover:underline normal-case"
                    >
                      Change Recipient
                    </button>
                  )}
                </label>

                {recipient ? (
                  <div className="p-3.5 bg-surface-container-high/40 rounded-xl border border-outline-variant/30 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      {recipient.photoUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={recipient.photoUrl} alt="" className="w-11 h-13 rounded-lg object-cover border border-outline-variant/40" />
                      ) : (
                        <div className="w-11 h-13 rounded-lg bg-primary/10 text-primary flex items-center justify-center font-bold text-base">
                          {recipient.name?.[0]?.toUpperCase() || "U"}
                        </div>
                      )}
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="font-bold text-sm text-on-surface">{recipient.name}</p>
                          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-surface-container text-on-surface-variant">
                            {recipient.employeeCode || (kind === "TEAM" ? "Team Member" : "Student")}
                          </span>
                        </div>
                        <p className="text-xs text-on-surface-variant">{recipient.email} {recipient.phone ? `· ${recipient.phone}` : ""}</p>
                        {recipient.designation && (
                          <p className="text-[11px] text-[#0f3a9e] font-medium mt-0.5">{recipient.designation}</p>
                        )}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3 p-4 bg-surface-container-high/20 rounded-xl border border-outline-variant/30">
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setKind("TEAM");
                          setSearchResults([]);
                        }}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                          kind === "TEAM" ? "bg-[#0f3a9e] text-white" : "border border-outline-variant text-on-surface"
                        }`}
                      >
                        Team Member
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setKind("STUDENT");
                          setSearchResults([]);
                        }}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                          kind === "STUDENT" ? "bg-[#0f3a9e] text-white" : "border border-outline-variant text-on-surface"
                        }`}
                      >
                        Student
                      </button>
                    </div>

                    <div className="relative">
                      <input
                        type="text"
                        placeholder={`Search ${kind === "TEAM" ? "team member by name, email or phone" : "student by name, email or enrollment no."}...`}
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full px-3.5 py-2.5 rounded-xl border border-outline-variant bg-surface text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                      />
                      {searching && (
                        <div className="absolute right-3 top-2.5">
                          <span className="inline-block w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin"></span>
                        </div>
                      )}
                    </div>

                    {searchResults.length > 0 && (
                      <div className="max-h-48 overflow-y-auto divide-y divide-outline-variant/20 border border-outline-variant/30 rounded-xl bg-surface">
                        {searchResults.map((item) => (
                          <div
                            key={item.id}
                            onClick={() => setRecipient(item)}
                            className="p-2.5 hover:bg-surface-container flex items-center justify-between cursor-pointer transition"
                          >
                            <div className="flex items-center gap-2.5">
                              {item.photoUrl ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img src={item.photoUrl} alt="" className="w-8 h-10 rounded object-cover border" />
                              ) : (
                                <div className="w-8 h-10 rounded bg-surface-container-highest text-on-surface-variant flex items-center justify-center font-bold text-xs">
                                  {item.name[0]}
                                </div>
                              )}
                              <div>
                                <p className="text-xs font-bold text-on-surface">{item.name}</p>
                                <p className="text-[11px] text-on-surface-variant">{item.email}</p>
                              </div>
                            </div>
                            <span className="text-[11px] font-bold text-[#0f3a9e] bg-[#0f3a9e]/10 px-2 py-0.5 rounded">
                              {item.employeeCode || "Select"}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Step 2: Document Type */}
              <div className="space-y-2">
                <label className="text-xs font-bold uppercase tracking-wider text-on-surface-variant">
                  2. Choose Document to Send
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {[
                    { type: "ID_CARD" as const, label: "Digital ID Card", icon: "badge" },
                    { type: "JOINING_LETTER" as const, label: "Joining Letter (AP-JLC)", icon: "assignment_turned_in" },
                    { type: "CONTRACT_LETTER" as const, label: "Service Agreement / Contract", icon: "handshake" },
                    { type: "EXPERIENCE_CERTIFICATE" as const, label: "Experience Certificate", icon: "workspace_premium" },
                    { type: "RELIEVING_LETTER" as const, label: "Relieving Letter", icon: "logout" },
                    { type: "CUSTOM_EMAIL" as const, label: "Custom Email / Notice", icon: "mail" },
                  ].map((doc) => {
                    const isSelected = docType === doc.type;
                    return (
                      <button
                        key={doc.type}
                        type="button"
                        onClick={() => setDocType(doc.type)}
                        className={`flex flex-col items-center justify-center text-center p-3 rounded-xl border text-xs font-bold transition gap-1.5 ${
                          isSelected
                            ? "bg-[#0f3a9e]/10 border-[#0f3a9e] text-[#0f3a9e]"
                            : "border-outline-variant/30 hover:bg-surface-container text-on-surface"
                        }`}
                      >
                        <span className="material-symbols-outlined text-xl">{doc.icon}</span>
                        <span>{doc.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Step 3: Channel Selection */}
              <div className="space-y-2">
                <label className="text-xs font-bold uppercase tracking-wider text-on-surface-variant">
                  3. Delivery Channel
                </label>
                <div className="flex items-center gap-3">
                  <label
                    className={`flex items-center gap-2 px-3 py-2 rounded-xl border text-xs font-bold cursor-pointer transition ${
                      channel === "email" ? "bg-primary/10 border-primary text-primary" : "border-outline-variant text-on-surface"
                    }`}
                  >
                    <input
                      type="radio"
                      name="channel"
                      value="email"
                      checked={channel === "email"}
                      onChange={() => setChannel("email")}
                      className="sr-only"
                    />
                    <span className="material-symbols-outlined text-base">outgoing_mail</span>
                    Email with Attached Official PDF
                  </label>
                  <label
                    className={`flex items-center gap-2 px-3 py-2 rounded-xl border text-xs font-bold cursor-pointer transition ${
                      channel === "whatsapp" ? "bg-emerald-50 border-emerald-500 text-emerald-800" : "border-outline-variant text-on-surface"
                    }`}
                  >
                    <input
                      type="radio"
                      name="channel"
                      value="whatsapp"
                      checked={channel === "whatsapp"}
                      onChange={() => setChannel("whatsapp")}
                      className="sr-only"
                    />
                    <span className="material-symbols-outlined text-base">chat</span>
                    WhatsApp Message with Doc Link
                  </label>
                </div>
              </div>

              {/* Step 4: Configurable Document Details */}
              <div className="space-y-4 pt-2 border-t border-outline-variant/20">
                <label className="text-xs font-bold uppercase tracking-wider text-on-surface-variant">
                  4. Document & Message Customization
                </label>

                {docType === "JOINING_LETTER" && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                    <div>
                      <label className="font-semibold text-on-surface">Official Designation</label>
                      <input
                        type="text"
                        value={designation}
                        onChange={(e) => setDesignation(e.target.value)}
                        placeholder="e.g. Senior Faculty - Biology"
                        className="mt-1 w-full px-3 py-2 rounded-lg border border-outline-variant bg-surface"
                      />
                    </div>
                    <div>
                      <label className="font-semibold text-on-surface">Department</label>
                      <input
                        type="text"
                        value={department}
                        onChange={(e) => setDepartment(e.target.value)}
                        placeholder="Academic"
                        className="mt-1 w-full px-3 py-2 rounded-lg border border-outline-variant bg-surface"
                      />
                    </div>
                    <div>
                      <label className="font-semibold text-on-surface">Date of Joining</label>
                      <input
                        type="date"
                        value={joiningDate}
                        onChange={(e) => setJoiningDate(e.target.value)}
                        className="mt-1 w-full px-3 py-2 rounded-lg border border-outline-variant bg-surface"
                      />
                    </div>
                    <div>
                      <label className="font-semibold text-on-surface">Work Location</label>
                      <input
                        type="text"
                        value={workLocation}
                        onChange={(e) => setWorkLocation(e.target.value)}
                        placeholder="Kota Campus / Head Office"
                        className="mt-1 w-full px-3 py-2 rounded-lg border border-outline-variant bg-surface"
                      />
                    </div>
                    <div>
                      <label className="font-semibold text-on-surface">Monthly Salary / Compensation</label>
                      <input
                        type="text"
                        value={monthlySalary}
                        onChange={(e) => setMonthlySalary(e.target.value)}
                        placeholder="₹50,000 / month"
                        className="mt-1 w-full px-3 py-2 rounded-lg border border-outline-variant bg-surface"
                      />
                    </div>
                    <div>
                      <label className="font-semibold text-on-surface">Reporting Authority</label>
                      <input
                        type="text"
                        value={reportingAuthority}
                        onChange={(e) => setReportingAuthority(e.target.value)}
                        placeholder="Director of Academics"
                        className="mt-1 w-full px-3 py-2 rounded-lg border border-outline-variant bg-surface"
                      />
                    </div>
                  </div>
                )}

                {docType === "CONTRACT_LETTER" && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                    <div>
                      <label className="font-semibold text-on-surface">Role / Position</label>
                      <input
                        type="text"
                        value={designation}
                        onChange={(e) => setDesignation(e.target.value)}
                        placeholder="Senior Faculty"
                        className="mt-1 w-full px-3 py-2 rounded-lg border border-outline-variant bg-surface"
                      />
                    </div>
                    <div>
                      <label className="font-semibold text-on-surface">Monthly Retainer / Salary</label>
                      <input
                        type="text"
                        value={monthlySalary}
                        onChange={(e) => setMonthlySalary(e.target.value)}
                        placeholder="₹50,000 / month"
                        className="mt-1 w-full px-3 py-2 rounded-lg border border-outline-variant bg-surface"
                      />
                    </div>
                    <div>
                      <label className="font-semibold text-on-surface">Annual CTC</label>
                      <input
                        type="text"
                        value={annualSalary}
                        onChange={(e) => setAnnualSalary(e.target.value)}
                        placeholder="₹6,00,000 / annum"
                        className="mt-1 w-full px-3 py-2 rounded-lg border border-outline-variant bg-surface"
                      />
                    </div>
                    <div>
                      <label className="font-semibold text-on-surface">Notice Period (Days)</label>
                      <input
                        type="text"
                        value={noticePeriodDays}
                        onChange={(e) => setNoticePeriodDays(e.target.value)}
                        placeholder="30"
                        className="mt-1 w-full px-3 py-2 rounded-lg border border-outline-variant bg-surface"
                      />
                    </div>
                    <div>
                      <label className="font-semibold text-on-surface">Tenure Start Date</label>
                      <input
                        type="date"
                        value={tenureStart}
                        onChange={(e) => setTenureStart(e.target.value)}
                        className="mt-1 w-full px-3 py-2 rounded-lg border border-outline-variant bg-surface"
                      />
                    </div>
                    <div>
                      <label className="font-semibold text-on-surface">Tenure End Date (Optional)</label>
                      <input
                        type="date"
                        value={tenureEnd}
                        onChange={(e) => setTenureEnd(e.target.value)}
                        className="mt-1 w-full px-3 py-2 rounded-lg border border-outline-variant bg-surface"
                      />
                    </div>
                  </div>
                )}

                {docType === "EXPERIENCE_CERTIFICATE" && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                    <div>
                      <label className="font-semibold text-on-surface">Designation Served</label>
                      <input
                        type="text"
                        value={designation}
                        onChange={(e) => setDesignation(e.target.value)}
                        placeholder="Senior Faculty"
                        className="mt-1 w-full px-3 py-2 rounded-lg border border-outline-variant bg-surface"
                      />
                    </div>
                    <div>
                      <label className="font-semibold text-on-surface">Department</label>
                      <input
                        type="text"
                        value={department}
                        onChange={(e) => setDepartment(e.target.value)}
                        placeholder="Academic"
                        className="mt-1 w-full px-3 py-2 rounded-lg border border-outline-variant bg-surface"
                      />
                    </div>
                    <div>
                      <label className="font-semibold text-on-surface">Start Date (Joining)</label>
                      <input
                        type="date"
                        value={tenureStart}
                        onChange={(e) => setTenureStart(e.target.value)}
                        className="mt-1 w-full px-3 py-2 rounded-lg border border-outline-variant bg-surface"
                      />
                    </div>
                    <div>
                      <label className="font-semibold text-on-surface">End Date (Relieving)</label>
                      <input
                        type="date"
                        value={tenureEnd}
                        onChange={(e) => setTenureEnd(e.target.value)}
                        className="mt-1 w-full px-3 py-2 rounded-lg border border-outline-variant bg-surface"
                      />
                    </div>
                    <div className="sm:col-span-2">
                      <label className="font-semibold text-on-surface">Conduct & Character Evaluation</label>
                      <input
                        type="text"
                        value={conductRemarks}
                        onChange={(e) => setConductRemarks(e.target.value)}
                        className="mt-1 w-full px-3 py-2 rounded-lg border border-outline-variant bg-surface"
                      />
                    </div>
                  </div>
                )}

                {docType === "RELIEVING_LETTER" && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                    <div>
                      <label className="font-semibold text-on-surface">Designation</label>
                      <input
                        type="text"
                        value={designation}
                        onChange={(e) => setDesignation(e.target.value)}
                        placeholder="Faculty"
                        className="mt-1 w-full px-3 py-2 rounded-lg border border-outline-variant bg-surface"
                      />
                    </div>
                    <div>
                      <label className="font-semibold text-on-surface">Effective Relieving Date</label>
                      <input
                        type="date"
                        value={relievingDate}
                        onChange={(e) => setRelievingDate(e.target.value)}
                        className="mt-1 w-full px-3 py-2 rounded-lg border border-outline-variant bg-surface"
                      />
                    </div>
                  </div>
                )}

                {docType === "CUSTOM_EMAIL" && (
                  <div className="space-y-3 text-xs">
                    <div>
                      <label className="font-semibold text-on-surface">Email Subject</label>
                      <input
                        type="text"
                        value={customSubject}
                        onChange={(e) => setCustomSubject(e.target.value)}
                        placeholder="Important Notice from Atomic Pathshala Administration"
                        className="mt-1 w-full px-3 py-2 rounded-lg border border-outline-variant bg-surface"
                      />
                    </div>
                    <div>
                      <label className="font-semibold text-on-surface">Email Message</label>
                      <textarea
                        rows={4}
                        value={customMessage}
                        onChange={(e) => setCustomMessage(e.target.value)}
                        placeholder="Write your custom message or notification here..."
                        className="mt-1 w-full px-3 py-2 rounded-lg border border-outline-variant bg-surface"
                      />
                    </div>
                  </div>
                )}

                {docType === "ID_CARD" && (
                  <p className="text-xs text-on-surface-variant bg-surface-container/50 p-3 rounded-lg border border-outline-variant/20">
                    The verified digital ID card for this {kind === "TEAM" ? "team member" : "student"} will be generated with full photo, signature, QR authentication code, and sent directly via {channel === "email" ? "official email attachment" : "WhatsApp link"}.
                  </p>
                )}
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        {!successResult && (
          <div className="flex items-center justify-between px-6 py-4 border-t border-outline-variant/20 bg-surface-container-high/30">
            <button
              type="button"
              onClick={onClose}
              disabled={sending || previewing}
              className="px-4 py-2 rounded-xl text-xs font-bold text-on-surface-variant hover:bg-surface-container"
            >
              Cancel
            </button>

            <div className="flex items-center gap-2">
              {docType !== "CUSTOM_EMAIL" && (
                <button
                  type="button"
                  onClick={handlePreview}
                  disabled={!recipient || previewing || sending}
                  className="px-4 py-2 rounded-xl text-xs font-bold border border-outline-variant hover:bg-surface-container flex items-center gap-1.5 transition disabled:opacity-50"
                >
                  {previewing ? (
                    <>
                      <span className="w-3.5 h-3.5 border-2 border-primary border-t-transparent rounded-full animate-spin"></span>
                      Generating...
                    </>
                  ) : (
                    <>
                      <span className="material-symbols-outlined text-sm">visibility</span>
                      Preview PDF
                    </>
                  )}
                </button>
              )}

              <button
                type="button"
                onClick={handleSend}
                disabled={!recipient || sending || previewing}
                className="px-5 py-2 rounded-xl text-xs font-bold bg-[#0f3a9e] text-white hover:bg-[#0f3a9e]/90 flex items-center gap-1.5 shadow-sm transition disabled:opacity-50"
              >
                {sending ? (
                  <>
                    <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                    Sending...
                  </>
                ) : (
                  <>
                    <span className="material-symbols-outlined text-sm">send</span>
                    Send Now
                  </>
                )}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
