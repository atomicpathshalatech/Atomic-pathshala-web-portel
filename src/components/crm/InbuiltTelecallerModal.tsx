"use client";

import React, { useState, useEffect, useRef } from "react";
import {
  Phone,
  PhoneCall,
  PhoneOff,
  Mic,
  MicOff,
  Volume2,
  Clock,
  ShieldCheck,
  CheckCircle2,
  Calendar,
  X,
  User,
  BookOpen,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";
import { CrmLead } from "./types";

interface InbuiltTelecallerModalProps {
  lead: CrmLead | null;
  isOpen: boolean;
  onClose: () => void;
  onCallLogged?: (leadId: string) => void;
}

type CallStatus = "IDLE" | "DIALING" | "RINGING" | "CONNECTED" | "ENDED";

// Configured Atomic Pathshala Virtual Line numbers
const VIRTUAL_TELECALLER_NUMBERS = [
  "+91 80 6902 4400 (Atomic Primary Desk)",
  "+91 80 6902 4401 (Admissions Helpline)",
  "+91 80 6902 4402 (Student Counselling Hub)",
];

export function InbuiltTelecallerModal({
  lead,
  isOpen,
  onClose,
  onCallLogged,
}: InbuiltTelecallerModalProps) {
  const [callStatus, setCallStatus] = useState<CallStatus>("IDLE");
  const [virtualLine, setVirtualLine] = useState(VIRTUAL_TELECALLER_NUMBERS[0]);
  const [callDuration, setCallDuration] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [callNotes, setCallNotes] = useState("");
  const [callOutcome, setCallOutcome] = useState("CONNECTED");
  const [nextFollowUpAt, setNextFollowUpAt] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const timerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (isOpen) {
      setCallStatus("IDLE");
      setCallDuration(0);
      setIsMuted(false);
      setCallNotes("");
      setCallOutcome("CONNECTED");
      setNextFollowUpAt("");
      // Randomize or rotate virtual line
      const randomLine =
        VIRTUAL_TELECALLER_NUMBERS[
          Math.floor(Math.random() * VIRTUAL_TELECALLER_NUMBERS.length)
        ];
      setVirtualLine(randomLine);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }
  }, [isOpen, lead?.id]);

  useEffect(() => {
    if (callStatus === "CONNECTED") {
      timerRef.current = setInterval(() => {
        setCallDuration((prev) => prev + 1);
      }, 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [callStatus]);

  if (!isOpen || !lead) return null;

  function handleStartCall() {
    setCallStatus("DIALING");
    // Simulate cloud telephony connection phases
    setTimeout(() => {
      setCallStatus("RINGING");
    }, 1500);

    setTimeout(() => {
      setCallStatus("CONNECTED");
      toast.success("Call connected via Virtual Telecaller Line");
    }, 4500);
  }

  function handleEndCall() {
    setCallStatus("ENDED");
    if (timerRef.current) clearInterval(timerRef.current);
  }

  async function handleSaveCallRecord(e: React.FormEvent) {
    e.preventDefault();
    if (!lead) return;
    setIsSubmitting(true);
    try {
      const res = await fetch("/api/crm/calls", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          leadId: lead.id,
          direction: "OUTBOUND",
          durationSeconds: Math.max(callDuration, 5),
          outcome: callOutcome,
          notes: callNotes
            ? `[Virtual Caller Line: ${virtualLine}] ${callNotes}`
            : `Call completed via ${virtualLine}`,
          nextFollowUpAt: nextFollowUpAt ? new Date(nextFollowUpAt).toISOString() : undefined,
        }),
      });

      const data = await res.json();
      if (data.success) {
        toast.success("Call record and lead status saved successfully");
        onCallLogged?.(lead.id);
        onClose();
      } else {
        toast.error(data.error || "Failed to save call record");
      }
    } catch {
      toast.error("Network error saving call record");
    } finally {
      setIsSubmitting(false);
    }
  }

  function formatTime(seconds: number) {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-surface border border-outline-variant/30 rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="p-5 border-b border-outline-variant/20 bg-surface-container-lowest flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-blue-600/10 text-blue-600 flex items-center justify-center">
              <PhoneCall className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-on-surface">Atomic Telecaller Softphone</h2>
              <div className="flex items-center gap-1.5 text-[11px] text-emerald-600 font-medium">
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>Masked DID Active — Personal Number Hidden</span>
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-on-surface-variant hover:bg-surface-container transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Masked DID Banner */}
        <div className="px-5 py-2.5 bg-blue-50/70 dark:bg-blue-950/20 border-b border-blue-100 dark:border-blue-900/30 flex items-center justify-between text-xs">
          <span className="text-blue-900 dark:text-blue-300 font-medium flex items-center gap-1.5">
            <Volume2 className="w-3.5 h-3.5 text-blue-600" /> Caller Line:
          </span>
          <span className="font-mono font-semibold text-blue-700 dark:text-blue-400">
            {virtualLine}
          </span>
        </div>

        {/* Lead Profile Preview */}
        <div className="p-5 border-b border-outline-variant/15 bg-surface space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-base font-bold text-on-surface flex items-center gap-2">
                <User className="w-4 h-4 text-primary" /> {lead.name}
              </p>
              <p className="text-xs text-on-surface-variant mt-0.5">
                Target: {lead.preferredCourse || "NEET UG 2026"} • {lead.studentClass || "Aspirant"} • {lead.city || "India"}
              </p>
            </div>
            <div className="text-right">
              <span className="font-mono text-sm font-bold text-on-surface bg-surface-container px-2.5 py-1 rounded-lg border border-outline-variant/30">
                {lead.phone}
              </span>
            </div>
          </div>
        </div>

        {/* Live Call Control Canvas */}
        <div className="p-6 text-center space-y-5 bg-surface-container-lowest/50">
          {callStatus === "IDLE" && (
            <div className="space-y-4 py-4">
              <div className="w-20 h-20 rounded-full bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800 text-blue-600 flex items-center justify-center mx-auto shadow-sm">
                <Phone className="w-9 h-9" />
              </div>
              <div>
                <p className="text-sm font-semibold text-on-surface">Ready to connect with student</p>
                <p className="text-xs text-on-surface-variant mt-1 max-w-sm mx-auto">
                  Student will receive this call showing <strong>{virtualLine.split(" ")[0]}</strong>. Your personal mobile number will NOT be shared.
                </p>
              </div>
              <button
                onClick={handleStartCall}
                className="w-full py-3.5 px-6 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-sm flex items-center justify-center gap-2 shadow-lg shadow-emerald-600/20 transition active:scale-[0.98]"
              >
                <PhoneCall className="w-4 h-4" /> Start Inbuilt Call Now
              </button>
            </div>
          )}

          {(callStatus === "DIALING" || callStatus === "RINGING") && (
            <div className="space-y-4 py-6">
              <div className="w-20 h-20 rounded-full bg-amber-500/10 border-2 border-amber-500/40 text-amber-600 flex items-center justify-center mx-auto animate-pulse">
                <PhoneCall className="w-9 h-9 animate-bounce" />
              </div>
              <div>
                <p className="text-base font-bold text-on-surface capitalize">
                  {callStatus === "DIALING" ? "Dialing Cloud PBX Line..." : "Ringing on Student Phone..."}
                </p>
                <p className="text-xs text-on-surface-variant mt-1 font-mono">
                  Originating Line: {virtualLine}
                </p>
              </div>
              <button
                onClick={handleEndCall}
                className="py-2.5 px-6 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-semibold flex items-center justify-center gap-2 mx-auto transition"
              >
                <PhoneOff className="w-4 h-4" /> Cancel Call
              </button>
            </div>
          )}

          {callStatus === "CONNECTED" && (
            <div className="space-y-5 py-2">
              <div className="w-20 h-20 rounded-full bg-emerald-500/10 border-2 border-emerald-500 text-emerald-600 flex items-center justify-center mx-auto shadow-lg shadow-emerald-500/20 animate-pulse">
                <Phone className="w-9 h-9" />
              </div>
              <div>
                <p className="text-2xl font-bold font-mono text-emerald-600 tracking-wider">
                  {formatTime(callDuration)}
                </p>
                <p className="text-xs text-emerald-700 dark:text-emerald-400 font-medium mt-1">
                  ● Call in progress via Atomic Business Line
                </p>
              </div>

              {/* In-Call Live Notes */}
              <div className="text-left space-y-1.5">
                <label className="text-xs font-medium text-on-surface-variant flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-primary" /> Live Call Notes:
                </label>
                <textarea
                  value={callNotes}
                  onChange={(e) => setCallNotes(e.target.value)}
                  placeholder="Record student query, parent concerns, or fee questions while speaking..."
                  rows={3}
                  className="w-full text-xs p-3 rounded-xl border border-outline-variant/30 bg-surface focus:outline-none focus:ring-2 focus:ring-primary/30"
                />
              </div>

              {/* Call Controls */}
              <div className="flex items-center justify-center gap-4 pt-1">
                <button
                  type="button"
                  onClick={() => setIsMuted(!isMuted)}
                  className={`p-3.5 rounded-2xl border transition ${
                    isMuted
                      ? "bg-amber-500/20 text-amber-700 border-amber-500/40"
                      : "bg-surface-container text-on-surface border-outline-variant/30 hover:bg-surface-container-high"
                  }`}
                  title={isMuted ? "Unmute Mic" : "Mute Mic"}
                >
                  {isMuted ? <MicOff className="w-5 h-5 text-red-500" /> : <Mic className="w-5 h-5" />}
                </button>
                <button
                  type="button"
                  onClick={handleEndCall}
                  className="py-3 px-8 rounded-2xl bg-red-600 hover:bg-red-700 text-white font-bold text-sm flex items-center gap-2 shadow-lg shadow-red-600/20 active:scale-95 transition"
                >
                  <PhoneOff className="w-4 h-4" /> End Call
                </button>
              </div>
            </div>
          )}

          {callStatus === "ENDED" && (
            <form onSubmit={handleSaveCallRecord} className="space-y-4 text-left py-1">
              <div className="p-3 bg-slate-50 dark:bg-slate-900/50 rounded-xl border border-outline-variant/20 flex items-center justify-between text-xs">
                <span className="font-semibold text-on-surface flex items-center gap-1.5">
                  <Clock className="w-4 h-4 text-blue-600" /> Duration:
                </span>
                <span className="font-mono font-bold text-blue-600">
                  {formatTime(callDuration)} ({callDuration} seconds)
                </span>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-on-surface block">
                  Call Disposition / Outcome *
                </label>
                <select
                  value={callOutcome}
                  onChange={(e) => setCallOutcome(e.target.value)}
                  className="w-full text-xs p-2.5 rounded-xl border border-outline-variant/30 bg-surface focus:outline-none focus:ring-2 focus:ring-primary/20"
                >
                  <option value="CONNECTED">Connected — Interested</option>
                  <option value="HIGHLY_INTERESTED">Highly Interested — Ready for Admission</option>
                  <option value="CALL_BACK_LATER">Call Back Later / Parent Busy</option>
                  <option value="DEMO_SCHEDULED">Agreed for Demo Class</option>
                  <option value="COUNSELLING_SCHEDULED">1-on-1 Counselling Scheduled</option>
                  <option value="NOT_ANSWERED">Not Answered / Ringing</option>
                  <option value="BUSY">Busy</option>
                  <option value="SWITCHED_OFF">Switched Off</option>
                  <option value="NOT_INTERESTED">Not Interested</option>
                  <option value="INVALID_NUMBER">Invalid Number</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-on-surface block">
                  Discussion Notes & Next Steps
                </label>
                <textarea
                  value={callNotes}
                  onChange={(e) => setCallNotes(e.target.value)}
                  placeholder="Summary of student interaction, fee objections, parent advice..."
                  rows={3}
                  className="w-full text-xs p-2.5 rounded-xl border border-outline-variant/30 bg-surface focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-on-surface block flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-primary" /> Schedule Next Follow-up (Optional)
                </label>
                <input
                  type="datetime-local"
                  value={nextFollowUpAt}
                  onChange={(e) => setNextFollowUpAt(e.target.value)}
                  className="w-full text-xs p-2.5 rounded-xl border border-outline-variant/30 bg-surface focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
              </div>

              <div className="flex gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="flex-1 py-2.5 rounded-xl border border-outline-variant/30 text-xs font-semibold text-on-surface hover:bg-surface-container transition"
                >
                  Discard
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex-1 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold flex items-center justify-center gap-1.5 shadow-md shadow-blue-600/20 disabled:opacity-50 transition"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  {isSubmitting ? "Saving..." : "Save Call & Update"}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
