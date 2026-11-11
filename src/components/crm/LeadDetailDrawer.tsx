"use client";

import React, { useState, useEffect } from "react";
import { toast } from "sonner";
import {
  X,
  Phone,
  MessageCircle,
  Calendar,
  UserCheck,
  Sparkles,
  Clock,
  BookOpen,
  DollarSign,
  AlertTriangle,
  Send,
  CheckCircle2,
  PhoneCall,
  GraduationCap,
  ShieldCheck,
} from "lucide-react";
import type { CrmLead, CounsellorOption, CourseOption, BatchOption } from "./types";
import { InbuiltTelecallerModal } from "./InbuiltTelecallerModal";

interface LeadDetailDrawerProps {
  leadId: string | null;
  onClose: () => void;
  onLeadUpdated: () => void;
  counselors: CounsellorOption[];
  courses: CourseOption[];
  batches: BatchOption[];
}

export function LeadDetailDrawer({
  leadId,
  onClose,
  onLeadUpdated,
  counselors,
  courses,
  batches,
}: LeadDetailDrawerProps) {
  const [lead, setLead] = useState<any | null>(null);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<
    "overview" | "timeline" | "call" | "counselling" | "admission" | "ai"
  >("overview");
  const [isTelecallerOpen, setIsTelecallerOpen] = useState(false);

  // Call form state
  const [callOutcome, setCallOutcome] = useState("CONNECTED");
  const [callDuration, setCallDuration] = useState(180);
  const [callNotes, setCallNotes] = useState("");
  const [callNextFollowUp, setCallNextFollowUp] = useState("");

  // Counselling form state
  const [counsellingDate, setCounsellingDate] = useState("");
  const [counsellingMode, setCounsellingMode] = useState("PHONE");
  const [counsellingNotes, setCounsellingNotes] = useState("");

  // Admission form state
  const [admissionBatchId, setAdmissionBatchId] = useState("");
  const [courseFee, setCourseFee] = useState(35000);
  const [discount, setDiscount] = useState(5000);
  const [paymentTxId, setPaymentTxId] = useState("");

  // AI assistant state
  const [aiLoading, setAiLoading] = useState(false);
  const [aiInsight, setAiInsight] = useState<string | null>(null);

  // Status updating
  const [updatingStatus, setUpdatingStatus] = useState(false);

  useEffect(() => {
    if (!leadId) {
      setLead(null);
      return;
    }
    fetchLeadDetail(leadId);
  }, [leadId]);

  async function fetchLeadDetail(id: string) {
    setLoading(true);
    try {
      const res = await fetch(`/api/crm/leads/${id}`);
      const json = await res.json();
      if (json.success && json.data.lead) {
        setLead(json.data.lead);
        if (json.data.lead.targetBatchId) {
          setAdmissionBatchId(json.data.lead.targetBatchId);
        } else if (batches.length > 0) {
          setAdmissionBatchId(batches[0].id);
        }
      } else {
        toast.error(json.error || "Could not load lead details");
      }
    } catch {
      toast.error("Network error loading lead");
    } finally {
      setLoading(false);
    }
  }

  async function handleStatusChange(newStatus: string) {
    if (!lead) return;
    setUpdatingStatus(true);
    try {
      const res = await fetch(`/api/crm/leads/${lead.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      const json = await res.json();
      if (json.success) {
        toast.success(`Status updated to ${newStatus}`);
        setLead((prev: any) => ({ ...prev, status: newStatus }));
        onLeadUpdated();
      } else {
        toast.error(json.error || "Update failed");
      }
    } catch {
      toast.error("Network error");
    } finally {
      setUpdatingStatus(false);
    }
  }

  async function handleAssignUser(userId: string) {
    if (!lead) return;
    try {
      const res = await fetch(`/api/crm/leads/${lead.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ assignedUserId: userId || null }),
      });
      const json = await res.json();
      if (json.success) {
        toast.success("Counsellor assigned");
        fetchLeadDetail(lead.id);
        onLeadUpdated();
      }
    } catch {
      toast.error("Assignment error");
    }
  }

  async function handleLogCall(e: React.FormEvent) {
    e.preventDefault();
    if (!lead) return;
    try {
      const res = await fetch("/api/crm/calls", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          leadId: lead.id,
          direction: "OUTBOUND",
          durationSeconds: Number(callDuration),
          outcome: callOutcome,
          notes: callNotes,
          nextFollowUpAt: callNextFollowUp ? new Date(callNextFollowUp).toISOString() : undefined,
        }),
      });
      const json = await res.json();
      if (json.success) {
        toast.success("Call recorded successfully");
        setCallNotes("");
        fetchLeadDetail(lead.id);
        onLeadUpdated();
        setActiveTab("timeline");
      } else {
        toast.error(json.error || "Failed to log call");
      }
    } catch {
      toast.error("Error logging call");
    }
  }

  async function handleScheduleCounselling(e: React.FormEvent) {
    e.preventDefault();
    if (!lead || !counsellingDate) return;
    try {
      const res = await fetch("/api/crm/counselling", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          leadId: lead.id,
          scheduledAt: new Date(counsellingDate).toISOString(),
          mode: counsellingMode,
          notes: counsellingNotes,
        }),
      });
      const json = await res.json();
      if (json.success) {
        toast.success("Counselling session scheduled!");
        setCounsellingNotes("");
        fetchLeadDetail(lead.id);
        onLeadUpdated();
        setActiveTab("timeline");
      } else {
        toast.error(json.error || "Failed to schedule");
      }
    } catch {
      toast.error("Error scheduling session");
    }
  }

  async function handleEnrollAdmission(e: React.FormEvent) {
    e.preventDefault();
    if (!lead || !admissionBatchId) {
      toast.error("Please select a batch to enroll the student into");
      return;
    }
    try {
      const res = await fetch("/api/crm/admissions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          leadId: lead.id,
          batchId: admissionBatchId,
          courseFee: Number(courseFee),
          discount: Number(discount),
          finalAmount: Number(courseFee) - Number(discount),
          paymentTransactionId: paymentTxId || "OFFLINE_PAYMENT",
        }),
      });
      const json = await res.json();
      if (json.success) {
        toast.success("Student successfully enrolled into LMS batch!");
        fetchLeadDetail(lead.id);
        onLeadUpdated();
        setActiveTab("overview");
      } else {
        toast.error(json.error || "Admission failed");
      }
    } catch {
      toast.error("Error completing admission");
    }
  }

  async function handleAiAction(action: "summarize" | "suggest_reply" | "predict_conversion") {
    if (!lead) return;
    setAiLoading(true);
    setAiInsight(null);
    try {
      const res = await fetch("/api/crm/ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ leadId: lead.id, action }),
      });
      const json = await res.json();
      if (json.success) {
        setAiInsight(json.data.insight);
      } else {
        toast.error(json.error || "AI analysis failed");
      }
    } catch {
      toast.error("Error reaching AI service");
    } finally {
      setAiLoading(false);
    }
  }

  async function handleMerge(duplicateId: string) {
    if (!lead) return;
    if (!confirm("Are you sure you want to merge this duplicate lead into the primary profile?")) return;
    try {
      const res = await fetch("/api/crm/leads/merge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ primaryLeadId: lead.id, duplicateLeadId: duplicateId }),
      });
      const json = await res.json();
      if (json.success) {
        toast.success("Duplicate lead merged!");
        fetchLeadDetail(lead.id);
        onLeadUpdated();
      }
    } catch {
      toast.error("Error merging leads");
    }
  }

  if (!leadId) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-hidden bg-black/40 backdrop-blur-sm flex justify-end">
      <div className="w-full max-w-2xl bg-surface h-full shadow-2xl flex flex-col animate-in slide-in-from-right duration-200 border-l border-outline-variant/20">
        {/* Header */}
        <div className="p-5 border-b border-outline-variant/20 flex items-start justify-between bg-surface-container-low">
          {loading || !lead ? (
            <div className="animate-pulse space-y-2">
              <div className="h-6 w-48 bg-outline-variant/20 rounded"></div>
              <div className="h-4 w-32 bg-outline-variant/20 rounded"></div>
            </div>
          ) : (
            <div className="space-y-1">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-xl font-bold text-on-surface">{lead.name}</h2>
                <span className="text-xs font-mono font-semibold px-2 py-0.5 rounded bg-primary/10 text-primary">
                  {lead.leadCode}
                </span>
                <span
                  className={`text-xs px-2.5 py-0.5 rounded-full font-bold uppercase ${
                    lead.priority === "HOT"
                      ? "bg-red-500/15 text-red-600 border border-red-200"
                      : lead.priority === "WARM"
                      ? "bg-amber-500/15 text-amber-700 border border-amber-200"
                      : "bg-slate-200 text-slate-700"
                  }`}
                >
                  {lead.priority}
                </span>
                <span className="text-xs px-2 py-0.5 rounded bg-blue-100 text-blue-800 font-semibold">
                  Score: {lead.score}/100
                </span>
                {lead.isConverted && (
                  <span className="text-xs px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-bold flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5" /> Enrolled
                  </span>
                )}
              </div>
              <p className="text-xs text-on-surface-variant flex items-center gap-3">
                <span>{lead.phone}</span>
                {lead.email && <span>· {lead.email}</span>}
                <span>· {lead.source}</span>
              </p>
            </div>
          )}

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-on-surface-variant hover:bg-surface-container-high transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Quick Action Bar */}
        {lead && (
          <div className="px-5 py-3 bg-surface-container flex items-center justify-between gap-3 border-b border-outline-variant/20 flex-wrap">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setIsTelecallerOpen(true)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-semibold hover:bg-blue-700 shadow-sm transition active:scale-95"
                title="Inbuilt Virtual Telecaller Call"
              >
                <PhoneCall className="w-3.5 h-3.5" /> Call (Telecaller Line)
              </button>
              <a
                href={`https://wa.me/${lead.cleanPhone}?text=${encodeURIComponent(
                  `Namaste ${lead.name}! Atomic Pathshala se counsellor connect kar rahe hain.`
                )}`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 text-white rounded-lg text-xs font-medium hover:bg-emerald-700 transition"
              >
                <MessageCircle className="w-3.5 h-3.5" /> WhatsApp
              </a>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs font-medium text-on-surface-variant">Stage:</span>
              <select
                value={lead.status}
                disabled={updatingStatus}
                onChange={(e) => handleStatusChange(e.target.value)}
                className="text-xs font-semibold px-2 py-1.5 rounded-lg border border-outline-variant/30 bg-surface text-on-surface focus:outline-none focus:ring-1 focus:ring-primary"
              >
                <option value="NEW_LEAD">New Lead</option>
                <option value="FIRST_CALL_PENDING">First Call Pending</option>
                <option value="CONTACTED">Contacted</option>
                <option value="INTERESTED">Interested</option>
                <option value="HIGHLY_INTERESTED">Highly Interested</option>
                <option value="COUNSELLING_SCHEDULED">Counselling Scheduled</option>
                <option value="COUNSELLING_COMPLETED">Counselling Completed</option>
                <option value="DEMO_SCHEDULED">Demo Scheduled</option>
                <option value="DEMO_ATTENDED">Demo Attended</option>
                <option value="PAYMENT_PENDING">Payment Pending</option>
                <option value="ADMISSION_CONFIRMED">Admission Confirmed</option>
                <option value="ENROLLED">Enrolled (LMS)</option>
                <option value="NOT_INTERESTED">Not Interested</option>
                <option value="LOST">Lost</option>
                <option value="DUPLICATE">Duplicate</option>
              </select>
            </div>
          </div>
        )}

        {/* Tab Navigation */}
        <div className="flex border-b border-outline-variant/20 px-5 gap-4 overflow-x-auto bg-surface">
          {[
            { id: "overview", label: "Overview", icon: BookOpen },
            { id: "timeline", label: "Timeline", icon: Clock },
            { id: "call", label: "Log Call", icon: PhoneCall },
            { id: "counselling", label: "Counselling", icon: Calendar },
            { id: "admission", label: "LMS Admission", icon: GraduationCap },
            { id: "ai", label: "AI Assistant", icon: Sparkles },
          ].map((tab) => {
            const Icon = tab.icon;
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`py-3 text-xs font-semibold flex items-center gap-1.5 border-b-2 transition whitespace-nowrap ${
                  active
                    ? "border-primary text-primary"
                    : "border-transparent text-on-surface-variant hover:text-on-surface"
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Body Content */}
        <div className="flex-1 overflow-y-auto p-5 space-y-6">
          {loading && (
            <div className="flex justify-center items-center py-20 text-on-surface-variant text-sm">
              Loading lead profile...
            </div>
          )}

          {!loading && lead && (
            <>
              {/* TAB 1: OVERVIEW */}
              {activeTab === "overview" && (
                <div className="space-y-6">
                  {/* Duplicate warning if applicable */}
                  {lead.duplicateOf && (
                    <div className="p-3 bg-amber-500/10 border border-amber-300 rounded-xl flex items-center justify-between text-xs text-amber-900">
                      <div className="flex items-center gap-2">
                        <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0" />
                        <span>
                          Duplicate detected of <b>{lead.duplicateOf.leadCode}</b> ({lead.duplicateOf.name})
                        </span>
                      </div>
                      <button
                        onClick={() => handleMerge(lead.id)}
                        className="px-2 py-1 bg-amber-600 text-white rounded font-medium hover:bg-amber-700"
                      >
                        Merge
                      </button>
                    </div>
                  )}

                  {/* Academic Profile */}
                  <div className="border border-outline-variant/20 rounded-xl p-4 bg-surface-container-lowest space-y-3">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-on-surface-variant flex items-center gap-2">
                      <GraduationCap className="w-4 h-4 text-primary" /> Academic Profile
                    </h3>
                    <div className="grid grid-cols-2 gap-3 text-xs">
                      <div>
                        <span className="text-on-surface-variant">Target Exam:</span>
                        <p className="font-semibold text-on-surface">{lead.targetExam || "NEET"}</p>
                      </div>
                      <div>
                        <span className="text-on-surface-variant">Class:</span>
                        <p className="font-semibold text-on-surface">{lead.studentClass || "Class 12"}</p>
                      </div>
                      <div>
                        <span className="text-on-surface-variant">Target Year:</span>
                        <p className="font-semibold text-on-surface">{lead.targetYear || 2026}</p>
                      </div>
                      <div>
                        <span className="text-on-surface-variant">Preferred Medium:</span>
                        <p className="font-semibold text-on-surface">{lead.medium || "Hindi/English"}</p>
                      </div>
                      <div>
                        <span className="text-on-surface-variant">Board:</span>
                        <p className="font-semibold text-on-surface">{lead.board || "CBSE"}</p>
                      </div>
                      <div>
                        <span className="text-on-surface-variant">School / College:</span>
                        <p className="font-semibold text-on-surface">{lead.school || "Not Specified"}</p>
                      </div>
                    </div>
                  </div>

                  {/* Student & Parent Info */}
                  <div className="border border-outline-variant/20 rounded-xl p-4 bg-surface-container-lowest space-y-3">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-on-surface-variant flex items-center gap-2">
                      <UserCheck className="w-4 h-4 text-primary" /> Personal & Parent Details
                    </h3>
                    <div className="grid grid-cols-2 gap-3 text-xs">
                      <div>
                        <span className="text-on-surface-variant">Father&apos;s Name:</span>
                        <p className="font-semibold text-on-surface">{lead.fatherName || "—"}</p>
                      </div>
                      <div>
                        <span className="text-on-surface-variant">Mother&apos;s Name:</span>
                        <p className="font-semibold text-on-surface">{lead.motherName || "—"}</p>
                      </div>
                      <div>
                        <span className="text-on-surface-variant">City:</span>
                        <p className="font-semibold text-on-surface">{lead.city || "—"}</p>
                      </div>
                      <div>
                        <span className="text-on-surface-variant">State:</span>
                        <p className="font-semibold text-on-surface">{lead.state || "—"}</p>
                      </div>
                      <div>
                        <span className="text-on-surface-variant">Expected Budget:</span>
                        <p className="font-semibold text-on-surface">
                          {lead.expectedBudget ? `₹${lead.expectedBudget.toLocaleString("en-IN")}` : "Flexible"}
                        </p>
                      </div>
                      <div>
                        <span className="text-on-surface-variant">Assigned Counsellor:</span>
                        <select
                          value={lead.assignedUserId || ""}
                          onChange={(e) => handleAssignUser(e.target.value)}
                          className="mt-1 block w-full text-xs p-1.5 rounded border border-outline-variant/30 bg-surface text-on-surface"
                        >
                          <option value="">Unassigned</option>
                          {counselors.map((c) => (
                            <option key={c.id} value={c.id}>
                              {c.name} ({c.role})
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                  </div>

                  {/* Campaign & Acquisition Info */}
                  <div className="border border-outline-variant/20 rounded-xl p-4 bg-surface-container-lowest space-y-3">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-on-surface-variant flex items-center gap-2">
                      <DollarSign className="w-4 h-4 text-primary" /> Marketing & Attribution
                    </h3>
                    <div className="grid grid-cols-2 gap-3 text-xs">
                      <div>
                        <span className="text-on-surface-variant">Source:</span>
                        <p className="font-semibold text-on-surface">{lead.source}</p>
                      </div>
                      <div>
                        <span className="text-on-surface-variant">Campaign:</span>
                        <p className="font-semibold text-on-surface">
                          {lead.campaign?.name || lead.campaignName || "Direct / Organic"}
                        </p>
                      </div>
                      <div>
                        <span className="text-on-surface-variant">Created On:</span>
                        <p className="font-semibold text-on-surface">
                          {new Date(lead.createdAt).toLocaleString("en-IN")}
                        </p>
                      </div>
                      <div>
                        <span className="text-on-surface-variant">Last Contacted:</span>
                        <p className="font-semibold text-on-surface">
                          {lead.lastContactedAt
                            ? new Date(lead.lastContactedAt).toLocaleString("en-IN")
                            : "Never"}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 2: TIMELINE */}
              {activeTab === "timeline" && (
                <div className="space-y-4">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-on-surface-variant">
                    Activity & Communication History
                  </h3>
                  {lead.activities?.length === 0 ? (
                    <p className="text-xs text-on-surface-variant text-center py-8">No activity logged yet.</p>
                  ) : (
                    <div className="relative pl-6 space-y-6 before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-outline-variant/20">
                      {lead.activities?.map((act: any) => (
                        <div key={act.id} className="relative group">
                          <div className="absolute -left-6 top-1 w-3 h-3 rounded-full bg-primary ring-4 ring-surface" />
                          <div className="bg-surface-container-lowest p-3 rounded-xl border border-outline-variant/20 space-y-1">
                            <div className="flex items-center justify-between text-xs">
                              <span className="font-bold text-on-surface">{act.title}</span>
                              <span className="text-[10px] text-on-surface-variant">
                                {new Date(act.createdAt).toLocaleString("en-IN")}
                              </span>
                            </div>
                            {act.description && (
                              <p className="text-xs text-on-surface-variant leading-relaxed">
                                {act.description}
                              </p>
                            )}
                            {act.performedBy && (
                              <p className="text-[10px] text-primary">By: {act.performedBy.name}</p>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* TAB 3: LOG CALL */}
              {activeTab === "call" && (
                <form onSubmit={handleLogCall} className="space-y-4">
                  <div className="border border-outline-variant/20 p-4 rounded-xl bg-surface-container-lowest space-y-3">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-on-surface">Record Call Outcome</h3>

                    <div>
                      <label className="text-xs font-medium text-on-surface-variant block mb-1">
                        Call Disposition / Outcome
                      </label>
                      <select
                        value={callOutcome}
                        onChange={(e) => setCallOutcome(e.target.value)}
                        className="w-full text-xs p-2 rounded-lg border border-outline-variant/30 bg-surface"
                      >
                        <option value="CONNECTED">Connected — Interested</option>
                        <option value="CALL_BACK_LATER">Call Back Later / Busy</option>
                        <option value="NOT_ANSWERED">Not Answered / Ringing</option>
                        <option value="BUSY">Busy</option>
                        <option value="SWITCHED_OFF">Switched Off</option>
                        <option value="INVALID_NUMBER">Invalid Number</option>
                        <option value="NOT_INTERESTED">Explicitly Not Interested</option>
                        <option value="ADMISSION_CONFIRMED">Admission Confirmed</option>
                      </select>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-xs font-medium text-on-surface-variant block mb-1">
                          Call Duration (seconds)
                        </label>
                        <input
                          type="number"
                          value={callDuration}
                          onChange={(e) => setCallDuration(Number(e.target.value))}
                          className="w-full text-xs p-2 rounded-lg border border-outline-variant/30 bg-surface"
                          min="0"
                        />
                      </div>
                      <div>
                        <label className="text-xs font-medium text-on-surface-variant block mb-1">
                          Next Follow-up Date & Time
                        </label>
                        <input
                          type="datetime-local"
                          value={callNextFollowUp}
                          onChange={(e) => setCallNextFollowUp(e.target.value)}
                          className="w-full text-xs p-2 rounded-lg border border-outline-variant/30 bg-surface"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="text-xs font-medium text-on-surface-variant block mb-1">
                        Call Notes & Discussion Summary
                      </label>
                      <textarea
                        rows={3}
                        value={callNotes}
                        onChange={(e) => setCallNotes(e.target.value)}
                        placeholder="Discussed batch schedule, syllabus coverage, fees objection..."
                        className="w-full text-xs p-2 rounded-lg border border-outline-variant/30 bg-surface"
                        required
                      />
                    </div>

                    <button
                      type="submit"
                      className="w-full py-2 bg-blue-600 text-white font-medium text-xs rounded-lg hover:bg-blue-700 transition"
                    >
                      Save Call Record & Update Lead
                    </button>
                  </div>
                </form>
              )}

              {/* TAB 4: SCHEDULING COUNSELLING */}
              {activeTab === "counselling" && (
                <form onSubmit={handleScheduleCounselling} className="space-y-4">
                  <div className="border border-outline-variant/20 p-4 rounded-xl bg-surface-container-lowest space-y-3">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-on-surface">
                      Schedule 1-on-1 Academic Counselling
                    </h3>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-xs font-medium text-on-surface-variant block mb-1">
                          Meeting Date & Time
                        </label>
                        <input
                          type="datetime-local"
                          value={counsellingDate}
                          onChange={(e) => setCounsellingDate(e.target.value)}
                          className="w-full text-xs p-2 rounded-lg border border-outline-variant/30 bg-surface"
                          required
                        />
                      </div>
                      <div>
                        <label className="text-xs font-medium text-on-surface-variant block mb-1">
                          Meeting Mode
                        </label>
                        <select
                          value={counsellingMode}
                          onChange={(e) => setCounsellingMode(e.target.value)}
                          className="w-full text-xs p-2 rounded-lg border border-outline-variant/30 bg-surface"
                        >
                          <option value="PHONE">Phone Call</option>
                          <option value="GOOGLE_MEET">Google Meet</option>
                          <option value="ZOOM">Zoom</option>
                          <option value="OFFLINE">Offline Centre Visit</option>
                        </select>
                      </div>
                    </div>

                    <div>
                      <label className="text-xs font-medium text-on-surface-variant block mb-1">
                        Counselling Preparation Notes
                      </label>
                      <textarea
                        rows={3}
                        value={counsellingNotes}
                        onChange={(e) => setCounsellingNotes(e.target.value)}
                        placeholder="Focus on NEET Physics weakness, explain mentor doubt-solving sessions..."
                        className="w-full text-xs p-2 rounded-lg border border-outline-variant/30 bg-surface"
                      />
                    </div>

                    <button
                      type="submit"
                      className="w-full py-2 bg-emerald-600 text-white font-medium text-xs rounded-lg hover:bg-emerald-700 transition"
                    >
                      Schedule Counselling & Notify Student
                    </button>
                  </div>
                </form>
              )}

              {/* TAB 5: LMS ADMISSION CONVERSION */}
              {activeTab === "admission" && (
                <form onSubmit={handleEnrollAdmission} className="space-y-4">
                  <div className="border border-outline-variant/20 p-4 rounded-xl bg-surface-container-lowest space-y-3">
                    <div className="flex items-center justify-between">
                      <h3 className="text-xs font-bold uppercase tracking-wider text-on-surface">
                        Complete LMS Student Enrollment
                      </h3>
                      <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 font-bold">
                        Zero Duplication Guarantee
                      </span>
                    </div>

                    <div>
                      <label className="text-xs font-medium text-on-surface-variant block mb-1">
                        Select Target Batch
                      </label>
                      <select
                        value={admissionBatchId}
                        onChange={(e) => setAdmissionBatchId(e.target.value)}
                        className="w-full text-xs p-2 rounded-lg border border-outline-variant/30 bg-surface font-semibold"
                        required
                      >
                        <option value="">-- Choose Active Batch --</option>
                        {batches.map((b) => (
                          <option key={b.id} value={b.id}>
                            {b.name} ({b.code}) — {b.status}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-xs font-medium text-on-surface-variant block mb-1">
                          Course Fee (₹)
                        </label>
                        <input
                          type="number"
                          value={courseFee}
                          onChange={(e) => setCourseFee(Number(e.target.value))}
                          className="w-full text-xs p-2 rounded-lg border border-outline-variant/30 bg-surface"
                        />
                      </div>
                      <div>
                        <label className="text-xs font-medium text-on-surface-variant block mb-1">
                          Scholarship / Discount (₹)
                        </label>
                        <input
                          type="number"
                          value={discount}
                          onChange={(e) => setDiscount(Number(e.target.value))}
                          className="w-full text-xs p-2 rounded-lg border border-outline-variant/30 bg-surface"
                        />
                      </div>
                    </div>

                    <div className="p-3 bg-surface-container rounded-lg flex items-center justify-between text-xs">
                      <span className="text-on-surface-variant font-medium">Final Payable Amount:</span>
                      <span className="text-base font-bold text-primary">
                        ₹{Math.max(0, courseFee - discount).toLocaleString("en-IN")}
                      </span>
                    </div>

                    <div>
                      <label className="text-xs font-medium text-on-surface-variant block mb-1">
                        Payment Transaction ID / Reference
                      </label>
                      <input
                        type="text"
                        value={paymentTxId}
                        onChange={(e) => setPaymentTxId(e.target.value)}
                        placeholder="e.g. pay_Nsd9821hjk / CASH_RECEIPT_102"
                        className="w-full text-xs p-2 rounded-lg border border-outline-variant/30 bg-surface font-mono"
                      />
                    </div>

                    <button
                      type="submit"
                      className="w-full py-2.5 bg-primary text-white font-bold text-xs rounded-lg hover:bg-primary/90 transition shadow-sm flex items-center justify-center gap-2"
                    >
                      <CheckCircle2 className="w-4 h-4" />
                      Confirm Admission & Activate LMS Access
                    </button>
                  </div>
                </form>
              )}

              {/* TAB 6: AI CRM ASSISTANT */}
              {activeTab === "ai" && (
                <div className="space-y-4">
                  <div className="border border-outline-variant/20 p-4 rounded-xl bg-surface-container-lowest space-y-3">
                    <div className="flex items-center gap-2 text-primary font-bold text-xs">
                      <Sparkles className="w-4 h-4" /> AI CRM Insights Engine
                    </div>
                    <p className="text-xs text-on-surface-variant">
                      Generate instant lead analysis, intent summarization, and customized WhatsApp reply templates using verified student academic profile data.
                    </p>

                    <div className="flex flex-wrap gap-2 pt-2">
                      <button
                        onClick={() => handleAiAction("summarize")}
                        disabled={aiLoading}
                        className="px-3 py-1.5 bg-primary/10 text-primary rounded-lg text-xs font-semibold hover:bg-primary/20 transition disabled:opacity-50"
                      >
                        Intent Summary
                      </button>
                      <button
                        onClick={() => handleAiAction("suggest_reply")}
                        disabled={aiLoading}
                        className="px-3 py-1.5 bg-emerald-600/10 text-emerald-700 rounded-lg text-xs font-semibold hover:bg-emerald-600/20 transition disabled:opacity-50"
                      >
                        WhatsApp Reply Draft
                      </button>
                      <button
                        onClick={() => handleAiAction("predict_conversion")}
                        disabled={aiLoading}
                        className="px-3 py-1.5 bg-purple-600/10 text-purple-700 rounded-lg text-xs font-semibold hover:bg-purple-600/20 transition disabled:opacity-50"
                      >
                        Conversion Drivers
                      </button>
                    </div>

                    {aiLoading && (
                      <div className="py-6 text-center text-xs text-on-surface-variant flex items-center justify-center gap-2">
                        <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                        Generating AI recommendation...
                      </div>
                    )}

                    {aiInsight && !aiLoading && (
                      <div className="p-4 bg-surface-container rounded-xl border border-outline-variant/30 space-y-2 mt-3">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-bold uppercase tracking-wider text-primary">
                            Generated Insight
                          </span>
                          <button
                            onClick={() => {
                              navigator.clipboard.writeText(aiInsight);
                              toast.success("Copied to clipboard!");
                            }}
                            className="text-[10px] text-blue-600 hover:underline"
                          >
                            Copy Text
                          </button>
                        </div>
                        <p className="text-xs text-on-surface leading-relaxed whitespace-pre-line font-sans">
                          {aiInsight}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {lead && (
        <InbuiltTelecallerModal
          lead={lead}
          isOpen={isTelecallerOpen}
          onClose={() => setIsTelecallerOpen(false)}
          onCallLogged={() => fetchLeadDetail(lead.id)}
        />
      )}
    </div>
  );
}
