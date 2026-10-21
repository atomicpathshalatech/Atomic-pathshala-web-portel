"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import {
  Bell,
  Calendar,
  Clock,
  Send,
  Eye,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Mail,
  MessageSquare,
  Smartphone,
  ExternalLink,
  ChevronRight,
  Sparkles,
  Info,
  AlertTriangle,
  KeyRound,
} from "lucide-react";

export function TomorrowScheduleAutomationCard() {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [targetDay, setTargetDay] = useState<"tomorrow" | "today">("tomorrow");

  // Modal State
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [previewTab, setPreviewTab] = useState<"whatsapp" | "email" | "sms" | "classes">("whatsapp");

  // Triggering State
  const [triggering, setTriggering] = useState(false);
  const [triggerResult, setTriggerResult] = useState<any>(null);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [testingMe, setTestingMe] = useState(false);

  const fetchPreview = async (day: "tomorrow" | "today" = targetDay) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/team/communication/schedule-digest/preview?targetDay=${day}`);
      const json = await res.json();
      if (res.ok && json.success) {
        setData(json.data);
      } else {
        setError(json.error || "Failed to fetch schedule preview");
      }
    } catch (err: any) {
      setError(err.message || "Network error loading preview");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPreview(targetDay);
  }, [targetDay]);

  const handleSendTestToMe = async () => {
    setTestingMe(true);
    setTriggerResult(null);
    try {
      const res = await fetch("/api/team/communication/schedule-digest/trigger", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "send_test", targetDay }),
      });
      const json = await res.json();
      if (res.ok && json.success) {
        alert(
          `Test message dispatched to your account! Email status: ${json.results?.email?.delivered ? "Delivered" : "Queued/Check Resend"}, WhatsApp: ${json.results?.whatsapp?.queued ? "Queued" : "Check Provider Key"}`
        );
      } else {
        alert(json.error || "Failed to send test message");
      }
    } catch (err: any) {
      alert(err.message || "Failed to send test");
    } finally {
      setTestingMe(false);
    }
  };

  const handleTriggerSendAll = async () => {
    setTriggering(true);
    setTriggerResult(null);
    try {
      const res = await fetch("/api/team/communication/schedule-digest/trigger", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "send_all", targetDay, force: true }),
      });
      const json = await res.json();
      if (res.ok && json.success) {
        setTriggerResult(json.result);
        setShowConfirmModal(false);
        fetchPreview();
      } else {
        alert(json.error || "Failed to trigger schedule dispatch");
      }
    } catch (err: any) {
      alert(err.message || "Execution error");
    } finally {
      setTriggering(false);
    }
  };

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 dark:border-slate-800 pb-5">
        <div className="flex items-start gap-3.5">
          <div className="p-3 bg-gradient-to-br from-indigo-500 to-emerald-600 text-white rounded-xl shadow-sm">
            <Bell className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                Class Schedule Notifications Automation
              </h2>
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-400">
                <Sparkles className="w-3 h-3" /> 10:00 PM Nightly Cron Active
              </span>
            </div>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
              Sends consolidated class notifications (Email, WhatsApp & SMS Fallback) with chapter, lecture, educator & clickable watch links to every enrolled student.
            </p>
          </div>
        </div>

        {/* Day Mode Toggle & Actions */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Target Day Selector */}
          <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-xl text-xs font-semibold">
            <button
              onClick={() => setTargetDay("tomorrow")}
              className={`px-3 py-1.5 rounded-lg transition-colors ${
                targetDay === "tomorrow"
                  ? "bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm"
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900"
              }`}
            >
              Tomorrow (10 PM)
            </button>
            <button
              onClick={() => setTargetDay("today")}
              className={`px-3 py-1.5 rounded-lg transition-colors ${
                targetDay === "today"
                  ? "bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm"
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900"
              }`}
            >
              Today's Schedule
            </button>
          </div>

          <button
            onClick={() => fetchPreview(targetDay)}
            disabled={loading}
            className="p-2 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-xl text-slate-600 dark:text-slate-300 transition-colors"
            title="Refresh schedule data"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          </button>
          <button
            onClick={() => setShowPreviewModal(true)}
            className="flex items-center gap-1.5 px-3.5 py-2 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-200 transition-colors shadow-sm"
          >
            <Eye className="w-4 h-4 text-slate-500" /> Preview
          </button>
          <button
            onClick={handleSendTestToMe}
            disabled={testingMe}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-slate-800 dark:bg-slate-700 hover:bg-slate-700 text-white rounded-xl text-xs font-semibold transition-colors shadow-sm"
          >
            <Send className="w-3.5 h-3.5" />
            {testingMe ? "Sending..." : "Test to Me"}
          </button>
          <button
            onClick={() => setShowConfirmModal(true)}
            disabled={data?.totalClasses === 0}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold transition-colors shadow-sm text-white ${
              data?.totalClasses === 0
                ? "bg-slate-400 cursor-not-allowed"
                : "bg-emerald-600 hover:bg-emerald-500"
            }`}
          >
            <Send className="w-3.5 h-3.5" /> Send to Students Now
          </button>
        </div>
      </div>

      {/* WhatsApp Configuration Warning if API Key is missing */}
      {data?.channelStatus && !data.channelStatus.whatsapp?.configured && (
        <div className="p-4 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 rounded-xl flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
          <div className="text-xs">
            <p className="font-semibold text-amber-900 dark:text-amber-200">
              WhatsApp Provider API Key is not yet configured
            </p>
            <p className="text-amber-700 dark:text-amber-300 mt-0.5">
              To send real WhatsApp messages directly to students' phone numbers, please go to the{" "}
              <strong>Automation Settings</strong> tab and enter your Interakt / Meta WhatsApp API key.
            </p>
          </div>
        </div>
      )}

      {/* Trigger Result Banner */}
      {triggerResult && (
        <div className="p-4 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 rounded-xl flex items-start gap-3">
          <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
          <div className="text-sm">
            <p className="font-semibold text-emerald-900 dark:text-emerald-200">
              Schedule Broadcast Successfully Dispatched for {triggerResult.dateStr}!
            </p>
            <p className="text-emerald-700 dark:text-emerald-400 text-xs mt-1">
              Total Students: <strong>{triggerResult.totalStudents}</strong> • Emails Sent:{" "}
              <strong>{triggerResult.emailsSent}</strong> • WhatsApp Queued:{" "}
              <strong>{triggerResult.whatsAppQueued}</strong> • SMS Sent:{" "}
              <strong>{triggerResult.smsSent}</strong>
            </p>
          </div>
        </div>
      )}

      {/* Live Status Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {/* Next Scheduled Run */}
        <div className="bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800 rounded-xl p-4">
          <div className="flex items-center justify-between text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1">
            <span>AUTOMATION CRON</span>
            <Clock className="w-4 h-4 text-indigo-500" />
          </div>
          <div className="text-xl font-bold text-slate-900 dark:text-white">
            10:00 PM IST
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Runs nightly (16:30 UTC Vercel Cron)
          </p>
        </div>

        {/* Selected Target Date */}
        <div className="bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800 rounded-xl p-4">
          <div className="flex items-center justify-between text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1">
            <span>TARGET DATE</span>
            <Calendar className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="text-base font-bold text-slate-900 dark:text-white truncate">
            {data?.dateFormatted || "Loading..."}
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Mode: {data?.targetDayLabel || "Tomorrow"}
          </p>
        </div>

        {/* Classes Scheduled */}
        <div className="bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800 rounded-xl p-4">
          <div className="flex items-center justify-between text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1">
            <span>CLASSES SCHEDULED</span>
            <Bell className="w-4 h-4 text-amber-500" />
          </div>
          <div className="text-2xl font-bold text-slate-900 dark:text-white">
            {data?.totalClasses ?? (loading ? "..." : 0)}
          </div>
          <p className="text-xs text-slate-500 mt-1">
            In database for {targetDay}
          </p>
        </div>

        {/* Enrolled Students */}
        <div className="bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800 rounded-xl p-4">
          <div className="flex items-center justify-between text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1">
            <span>STUDENTS TO NOTIFY</span>
            <MessageSquare className="w-4 h-4 text-blue-500" />
          </div>
          <div className="text-2xl font-bold text-slate-900 dark:text-white">
            {data?.totalStudents ?? (loading ? "..." : 0)}
          </div>
          <p className="text-xs text-slate-500 mt-1">
            {data?.emailRecipientsCount ?? 0} Email • {data?.phoneRecipientsCount ?? 0} Phone
          </p>
        </div>
      </div>

      {/* Multi-Channel Delivery Channels Pipeline */}
      <div className="bg-gradient-to-r from-slate-50 via-slate-50 to-slate-100 dark:from-slate-800/40 dark:via-slate-800/30 dark:to-slate-800/60 border border-slate-200 dark:border-slate-800 rounded-xl p-4">
        <h3 className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-3">
          Multi-Channel Delivery Guarantee
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {/* Channel 1: Email */}
          <div className="flex items-center gap-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-3">
            <div className="p-2 bg-emerald-50 dark:bg-emerald-950 text-emerald-600 rounded-lg">
              <Mail className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-bold text-slate-900 dark:text-white">1. Email (Resend)</span>
                <span className={`w-2 h-2 rounded-full ${data?.channelStatus?.email?.configured ? "bg-emerald-500" : "bg-amber-500"}`}></span>
              </div>
              <p className="text-[11px] text-slate-500">
                {data?.channelStatus?.email?.configured ? "Active (noreply@atomicpathshala.in)" : "Configured"}
              </p>
            </div>
          </div>

          {/* Channel 2: WhatsApp */}
          <div className="flex items-center gap-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-3">
            <div className="p-2 bg-green-50 dark:bg-green-950 text-green-600 rounded-lg">
              <MessageSquare className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-bold text-slate-900 dark:text-white">2. WhatsApp Message</span>
                <span className={`w-2 h-2 rounded-full ${data?.channelStatus?.whatsapp?.configured ? "bg-green-500" : "bg-amber-500"}`}></span>
              </div>
              <p className="text-[11px] text-slate-500">
                {data?.channelStatus?.whatsapp?.configured ? "Active" : "Add API Key in Settings"}
              </p>
            </div>
          </div>

          {/* Channel 3: SMS Fallback */}
          <div className="flex items-center gap-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-3">
            <div className="p-2 bg-blue-50 dark:bg-blue-950 text-blue-600 rounded-lg">
              <Smartphone className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-bold text-slate-900 dark:text-white">3. SMS Text Message</span>
                <span className="w-2 h-2 rounded-full bg-blue-500"></span>
              </div>
              <p className="text-[11px] text-slate-500">
                Automatic fallback for students
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Scheduled Classes List */}
      {data?.schedules?.length > 0 ? (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">
              Scheduled Classes ({data.schedules.length}) for {data.dateFormatted}
            </h3>
            <span className="text-xs text-slate-500 font-semibold text-emerald-600 dark:text-emerald-400">
              Ready to send to {data.totalStudents} enrolled student(s)
            </span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {data.schedules.map((s: any) => (
              <div
                key={s.id}
                className="bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 rounded-xl p-3.5 space-y-2"
              >
                <div className="flex items-center justify-between">
                  <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-400 uppercase">
                    {s.subject || "Academic"}
                  </span>
                  <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">
                    ⏰ {new Date(s.startsAt).toLocaleTimeString("en-IN", { timeZone: "Asia/Kolkata", hour: "2-digit", minute: "2-digit" })}
                  </span>
                </div>
                <div>
                  <h4 className="text-sm font-bold text-slate-900 dark:text-white line-clamp-1">
                    {s.lectureTitle || s.title}
                  </h4>
                  <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5 line-clamp-1">
                    📖 Chapter: {s.chapterTitle || "General"}
                  </p>
                </div>
                <div className="flex items-center justify-between text-xs text-slate-500 pt-1 border-t border-slate-200 dark:border-slate-700/60">
                  <span>👨‍🏫 {s.teacherName || "Faculty"}</span>
                  <span className="text-[11px] text-slate-400 truncate max-w-[140px]">{s.batchName}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="text-center py-8 border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-xl p-6">
          <Calendar className="w-8 h-8 text-slate-400 mx-auto mb-2" />
          <p className="text-sm font-bold text-slate-700 dark:text-slate-200">
            No classes scheduled for {targetDay} yet ({data?.dateFormatted || "Selected Date"})
          </p>
          <p className="text-xs text-slate-500 max-w-md mx-auto mt-1 mb-4">
            Messages are sent when classes are scheduled in the batch timetable. Since 0 classes are scheduled right now, no schedule messages were sent.
          </p>
          <div className="flex items-center justify-center gap-3">
            <Link
              href="/team/batches"
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-semibold shadow-sm inline-flex items-center gap-1.5"
            >
              Go to Batches to Schedule Classes <ChevronRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      )}

      {/* Confirmation Modal to Trigger Send to Students Now */}
      {showConfirmModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center gap-3 text-amber-600 dark:text-amber-400">
              <AlertCircle className="w-6 h-6" />
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                Send {data?.targetDayLabel || "Tomorrow"}'s Schedule Now?
              </h3>
            </div>
            <p className="text-sm text-slate-600 dark:text-slate-300">
              This will immediately send the schedule digest for{" "}
              <strong>{data?.dateFormatted || "target date"}</strong> to all{" "}
              <strong>{data?.totalStudents || 0} active students</strong> via Email, WhatsApp, and SMS Fallback.
            </p>
            <div className="bg-slate-50 dark:bg-slate-800 p-3 rounded-xl text-xs space-y-1 text-slate-600 dark:text-slate-400">
              <div>• Total classes: <strong>{data?.totalClasses || 0}</strong></div>
              <div>• Email recipients: <strong>{data?.emailRecipientsCount || 0}</strong></div>
              <div>• Phone recipients: <strong>{data?.phoneRecipientsCount || 0}</strong></div>
            </div>
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={() => setShowConfirmModal(false)}
                disabled={triggering}
                className="px-4 py-2 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-200"
              >
                Cancel
              </button>
              <button
                onClick={handleTriggerSendAll}
                disabled={triggering}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 shadow-sm"
              >
                {triggering ? "Dispatching..." : "Yes, Dispatch Now"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Preview Modal */}
      {showPreviewModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-3xl w-full max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
            {/* Modal Header */}
            <div className="p-5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <div>
                <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                  Schedule Digest Preview ({data?.dateFormatted || "Schedule"})
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Sample formatted message generated for student
                </p>
              </div>
              <button
                onClick={() => setShowPreviewModal(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                ✕
              </button>
            </div>

            {/* Modal Subtabs */}
            <div className="flex border-b border-slate-200 dark:border-slate-800 px-5 pt-3 gap-2 bg-slate-50 dark:bg-slate-900/50">
              <button
                onClick={() => setPreviewTab("whatsapp")}
                className={`flex items-center gap-1.5 pb-3 px-3 text-xs font-bold border-b-2 transition-colors ${
                  previewTab === "whatsapp"
                    ? "border-green-600 text-green-700 dark:text-green-400"
                    : "border-transparent text-slate-500 hover:text-slate-900"
                }`}
              >
                <MessageSquare className="w-4 h-4" /> WhatsApp Chat
              </button>
              <button
                onClick={() => setPreviewTab("email")}
                className={`flex items-center gap-1.5 pb-3 px-3 text-xs font-bold border-b-2 transition-colors ${
                  previewTab === "email"
                    ? "border-emerald-600 text-emerald-700 dark:text-emerald-400"
                    : "border-transparent text-slate-500 hover:text-slate-900"
                }`}
              >
                <Mail className="w-4 h-4" /> Email HTML
              </button>
              <button
                onClick={() => setPreviewTab("sms")}
                className={`flex items-center gap-1.5 pb-3 px-3 text-xs font-bold border-b-2 transition-colors ${
                  previewTab === "sms"
                    ? "border-blue-600 text-blue-700 dark:text-blue-400"
                    : "border-transparent text-slate-500 hover:text-slate-900"
                }`}
              >
                <Smartphone className="w-4 h-4" /> SMS Fallback
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto flex-1">
              {previewTab === "whatsapp" && (
                <div className="bg-[#efeae2] dark:bg-slate-950 p-4 rounded-xl font-mono text-xs text-slate-800 dark:text-slate-200 whitespace-pre-wrap leading-relaxed shadow-inner max-w-lg mx-auto border border-emerald-900/10">
                  {data?.sampleWhatsApp || "No classes scheduled yet to generate preview"}
                </div>
              )}

              {previewTab === "email" && (
                <div className="border border-slate-200 rounded-xl overflow-hidden shadow-sm">
                  {data?.sampleEmailHtml ? (
                    <iframe
                      srcDoc={data.sampleEmailHtml}
                      title="Email Preview"
                      className="w-full h-[450px] border-0"
                    />
                  ) : (
                    <p className="p-6 text-sm text-slate-500 text-center">No classes scheduled yet to generate email preview</p>
                  )}
                </div>
              )}

              {previewTab === "sms" && (
                <div className="bg-slate-100 dark:bg-slate-800 p-4 rounded-xl font-mono text-xs text-slate-800 dark:text-slate-200 whitespace-pre-wrap leading-relaxed max-w-lg mx-auto">
                  {data?.sampleSms || "No SMS preview available"}
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-slate-200 dark:border-slate-800 flex items-center justify-end gap-2 bg-slate-50 dark:bg-slate-900/50">
              <button
                onClick={() => setShowPreviewModal(false)}
                className="px-4 py-2 border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-200"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
