"use client";

import React, { useState, useEffect, useRef } from "react";
import {
  Smartphone,
  PhoneCall,
  PhoneOff,
  Clock,
  ShieldCheck,
  CheckCircle2,
  Calendar,
  X,
  User,
  AlertCircle,
  Wifi,
  Battery,
  SimCard,
} from "lucide-react";
import { toast } from "sonner";
import { CrmLead } from "./types";

interface CallingDeviceItem {
  id: string;
  deviceName: string;
  isOnline: boolean;
  batteryLevel?: number;
  networkType?: string;
  sim1Carrier?: string;
  sim2Carrier?: string;
  assignedUser?: { id: string; name: string };
  isAssignedToCurrentUser?: boolean;
}

interface SimCallingModalProps {
  lead: CrmLead | null;
  isOpen: boolean;
  onClose: () => void;
  onCallLogged?: (leadId: string) => void;
}

export function SimCallingModal({
  lead,
  isOpen,
  onClose,
  onCallLogged,
}: SimCallingModalProps) {
  const [devices, setDevices] = useState<CallingDeviceItem[]>([]);
  const [loadingDevices, setLoadingDevices] = useState(false);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>("");
  const [preferredSim, setPreferredSim] = useState<"DEFAULT" | "SIM_1" | "SIM_2">("DEFAULT");

  // Call lifecycle state
  const [callingState, setCallingState] = useState<"IDLE" | "SENDING" | "DELIVERED" | "CALLING" | "ENDED">("IDLE");
  const [activeRequestId, setActiveRequestId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Disposition state
  const [callDuration, setCallDuration] = useState(0);
  const [callOutcome, setCallOutcome] = useState("CONNECTED");
  const [callRemarks, setCallRemarks] = useState("");
  const [nextFollowUpAt, setNextFollowUpAt] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (isOpen) {
      fetchDevices();
      setCallingState("IDLE");
      setActiveRequestId(null);
      setErrorMessage(null);
      setCallDuration(0);
      setCallRemarks("");
      setCallOutcome("CONNECTED");
      setNextFollowUpAt("");
    } else {
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
    }
    return () => {
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
    };
  }, [isOpen, lead?.id]);

  async function fetchDevices() {
    setLoadingDevices(true);
    try {
      const res = await fetch("/api/calling/devices");
      const json = await res.json();
      if (json.success && json.data?.devices) {
        setDevices(json.data.devices);
        // Default to first online device
        const onlineDevice = json.data.devices.find((d: CallingDeviceItem) => d.isOnline);
        if (onlineDevice) {
          setSelectedDeviceId(onlineDevice.id);
        } else if (json.data.devices.length > 0) {
          setSelectedDeviceId(json.data.devices[0].id);
        }
      }
    } catch {
      toast.error("Failed to load paired calling devices");
    } finally {
      setLoadingDevices(false);
    }
  }

  async function handleInitiateSimCall() {
    if (!lead || !selectedDeviceId) return;
    setCallingState("SENDING");
    setErrorMessage(null);

    try {
      const res = await fetch("/api/calling/request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          leadId: lead.id,
          studentPhone: lead.phone,
          deviceId: selectedDeviceId,
          preferredSim,
        }),
      });

      const data = await res.json();
      if (data.success && data.data?.requestId) {
        setActiveRequestId(data.data.requestId);
        setCallingState("DELIVERED");
        toast.success("Calling request sent to Android device!");
        startPollingRequestStatus(data.data.requestId);
      } else {
        setCallingState("IDLE");
        setErrorMessage(data.error || "Failed to initiate call on mobile device");
        toast.error(data.error || "Failed to trigger call");
      }
    } catch (err: any) {
      setCallingState("IDLE");
      setErrorMessage("Network error reaching calling service");
      toast.error("Network error");
    }
  }

  function startPollingRequestStatus(requestId: string) {
    if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);

    pollIntervalRef.current = setInterval(async () => {
      try {
        const res = await fetch(`/api/calling/request/${requestId}`);
        const data = await res.json();
        if (data.success && data.data?.request) {
          const req = data.data.request;
          if (req.status === "CALLING") {
            setCallingState("CALLING");
          } else if (req.status === "COMPLETED" || req.status === "FAILED") {
            setCallingState("ENDED");
            if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
            if (req.sessions && req.sessions[0]) {
              setCallDuration(req.sessions[0].durationSeconds || 60);
            }
          }
        }
      } catch {
        // Polling retry
      }
    }, 2000);
  }

  async function handleSaveDisposition(e: React.FormEvent) {
    e.preventDefault();
    if (!lead || !activeRequestId) return;
    setIsSubmitting(true);
    try {
      const res = await fetch(`/api/calling/request/${activeRequestId}/event`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: "COMPLETED",
          durationSeconds: Math.max(callDuration, 10),
          outcome: callOutcome,
          remarks: callRemarks,
        }),
      });

      const data = await res.json();
      if (data.success) {
        toast.success("Call record and remarks saved to CRM lead!");
        onCallLogged?.(lead.id);
        onClose();
      } else {
        toast.error(data.error || "Failed to save call disposition");
      }
    } catch {
      toast.error("Network error saving call record");
    } finally {
      setIsSubmitting(false);
    }
  }

  if (!isOpen || !lead) return null;

  const currentDevice = devices.find((d) => d.id === selectedDeviceId);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-surface border border-outline-variant/30 rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="p-5 border-b border-outline-variant/20 bg-surface-container-lowest flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-emerald-600/10 text-emerald-600 flex items-center justify-center">
              <Smartphone className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-on-surface">SIM-Based Cellular Calling</h2>
              <p className="text-[11px] text-on-surface-variant">Cellular call placed via paired Android handset</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-on-surface-variant hover:bg-surface-container transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Lead Summary */}
        <div className="p-4 bg-surface-container-low border-b border-outline-variant/15 flex items-center justify-between text-xs">
          <div>
            <p className="font-bold text-on-surface flex items-center gap-1.5 text-sm">
              <User className="w-3.5 h-3.5 text-primary" /> {lead.name}
            </p>
            <p className="text-on-surface-variant mt-0.5">
              Course: {lead.preferredCourse || "NEET UG"} • {lead.city || "India"}
            </p>
          </div>
          <div className="font-mono text-sm font-bold text-blue-600 bg-surface px-3 py-1.5 rounded-xl border border-outline-variant/30">
            {lead.phone}
          </div>
        </div>

        {/* Body Canvas */}
        <div className="p-6 space-y-5">
          {callingState === "IDLE" && (
            <div className="space-y-4">
              {/* Device Selector */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-on-surface flex items-center justify-between">
                  <span>Select Calling Mobile Handset:</span>
                  <span className="text-[11px] text-on-surface-variant">
                    {devices.filter((d) => d.isOnline).length} Handset(s) Online
                  </span>
                </label>
                {loadingDevices ? (
                  <div className="p-3 text-xs text-on-surface-variant bg-surface-container rounded-xl animate-pulse">
                    Loading paired Android handsets...
                  </div>
                ) : devices.length === 0 ? (
                  <div className="p-4 rounded-2xl border border-amber-500/30 bg-amber-500/10 text-amber-800 dark:text-amber-300 text-xs flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                    <span>No paired Android devices found. Please pair a handset first from Device Management.</span>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {devices.map((d) => (
                      <div
                        key={d.id}
                        onClick={() => setSelectedDeviceId(d.id)}
                        className={`p-3 rounded-2xl border cursor-pointer transition flex items-center justify-between ${
                          selectedDeviceId === d.id
                            ? "border-blue-600 bg-blue-50/50 dark:bg-blue-950/20"
                            : "border-outline-variant/30 hover:bg-surface-container"
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <div
                            className={`w-3 h-3 rounded-full ${
                              d.isOnline ? "bg-emerald-500 shadow-sm shadow-emerald-500" : "bg-slate-400"
                            }`}
                          />
                          <div>
                            <p className="text-xs font-bold text-on-surface">{d.deviceName}</p>
                            <p className="text-[11px] text-on-surface-variant">
                              {d.sim1Carrier || "SIM 1"} {d.sim2Carrier ? `• ${d.sim2Carrier}` : ""}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 text-[11px] text-on-surface-variant font-mono">
                          {d.batteryLevel !== undefined && (
                            <span className="flex items-center gap-1">
                              <Battery className="w-3.5 h-3.5 text-slate-500" /> {d.batteryLevel}%
                            </span>
                          )}
                          <span
                            className={`px-2 py-0.5 rounded-full font-bold text-[10px] ${
                              d.isOnline
                                ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300"
                                : "bg-slate-100 text-slate-600"
                            }`}
                          >
                            {d.isOnline ? "ONLINE" : "OFFLINE"}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* SIM Slot Preference */}
              {currentDevice && (
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-on-surface">Choose Cellular SIM Slot:</label>
                  <div className="grid grid-cols-3 gap-2">
                    <button
                      type="button"
                      onClick={() => setPreferredSim("DEFAULT")}
                      className={`py-2 px-3 rounded-xl border text-xs font-medium transition ${
                        preferredSim === "DEFAULT"
                          ? "bg-blue-600 text-white border-blue-600 shadow-sm"
                          : "border-outline-variant/30 text-on-surface hover:bg-surface-container"
                      }`}
                    >
                      Default SIM
                    </button>
                    <button
                      type="button"
                      onClick={() => setPreferredSim("SIM_1")}
                      className={`py-2 px-3 rounded-xl border text-xs font-medium transition ${
                        preferredSim === "SIM_1"
                          ? "bg-blue-600 text-white border-blue-600 shadow-sm"
                          : "border-outline-variant/30 text-on-surface hover:bg-surface-container"
                      }`}
                    >
                      SIM 1 ({currentDevice.sim1Carrier || "Slot 1"})
                    </button>
                    <button
                      type="button"
                      onClick={() => setPreferredSim("SIM_2")}
                      className={`py-2 px-3 rounded-xl border text-xs font-medium transition ${
                        preferredSim === "SIM_2"
                          ? "bg-blue-600 text-white border-blue-600 shadow-sm"
                          : "border-outline-variant/30 text-on-surface hover:bg-surface-container"
                      }`}
                    >
                      SIM 2 ({currentDevice.sim2Carrier || "Slot 2"})
                    </button>
                  </div>
                </div>
              )}

              {errorMessage && (
                <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-600 text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{errorMessage}</span>
                </div>
              )}

              <button
                type="button"
                onClick={handleInitiateSimCall}
                disabled={!selectedDeviceId || devices.length === 0}
                className="w-full py-3.5 px-6 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm flex items-center justify-center gap-2 shadow-lg shadow-emerald-600/20 disabled:opacity-50 transition active:scale-[0.98]"
              >
                <PhoneCall className="w-4 h-4" /> Trigger Call on Mobile SIM
              </button>
            </div>
          )}

          {(callingState === "SENDING" || callingState === "DELIVERED" || callingState === "CALLING") && (
            <div className="py-6 text-center space-y-4">
              <div className="w-20 h-20 rounded-full bg-emerald-500/10 border-2 border-emerald-500 text-emerald-600 flex items-center justify-center mx-auto animate-pulse">
                <PhoneCall className="w-9 h-9 animate-bounce" />
              </div>

              <div>
                <p className="text-base font-bold text-on-surface">
                  {callingState === "SENDING"
                    ? "Dispatching request to Android handset..."
                    : callingState === "DELIVERED"
                    ? "Received by Android handset! Dialing..."
                    : "Call active on physical SIM!"}
                </p>
                <p className="text-xs text-on-surface-variant mt-1">
                  Target: <strong>{lead.phone}</strong> via {currentDevice?.deviceName}
                </p>
              </div>

              <div className="p-3 bg-surface-container rounded-2xl border border-outline-variant/20 text-xs text-left max-w-sm mx-auto space-y-1">
                <div className="flex items-center justify-between text-on-surface-variant">
                  <span>Push Channel:</span>
                  <span className="font-semibold text-emerald-600">FCM High-Priority</span>
                </div>
                <div className="flex items-center justify-between text-on-surface-variant">
                  <span>Selected Line:</span>
                  <span className="font-semibold text-on-surface">{preferredSim}</span>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setCallingState("ENDED")}
                className="py-2.5 px-6 rounded-xl bg-slate-800 hover:bg-slate-900 text-white text-xs font-semibold"
              >
                Call Finished? Log Outcome
              </button>
            </div>
          )}

          {callingState === "ENDED" && (
            <form onSubmit={handleSaveDisposition} className="space-y-4 text-left">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-on-surface block">
                  Call Disposition / Student Outcome *
                </label>
                <select
                  value={callOutcome}
                  onChange={(e) => setCallOutcome(e.target.value)}
                  className="w-full text-xs p-2.5 rounded-xl border border-outline-variant/30 bg-surface focus:outline-none focus:ring-2 focus:ring-primary/20"
                >
                  <option value="CONNECTED">Connected — Interested</option>
                  <option value="HIGHLY_INTERESTED">Highly Interested — Admission Expected</option>
                  <option value="CALL_BACK_LATER">Call Back Later / Parent Busy</option>
                  <option value="DEMO_SCHEDULED">Demo Class Scheduled</option>
                  <option value="COUNSELLING_SCHEDULED">Academic Counselling Booked</option>
                  <option value="NOT_ANSWERED">Not Answered / Ringing</option>
                  <option value="BUSY">Line Busy</option>
                  <option value="SWITCHED_OFF">Switched Off</option>
                  <option value="NOT_INTERESTED">Not Interested</option>
                  <option value="INVALID_NUMBER">Invalid Number</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-on-surface block">
                  Discussion Remarks & Follow-up Notes
                </label>
                <textarea
                  value={callRemarks}
                  onChange={(e) => setCallRemarks(e.target.value)}
                  placeholder="Record summary of discussion from mobile call..."
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
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex-1 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold flex items-center justify-center gap-1.5 shadow-md shadow-blue-600/20 disabled:opacity-50 transition"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  {isSubmitting ? "Saving..." : "Save Call & Update CRM"}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
