"use client";

import React, { useState } from "react";
import { X, ShieldAlert, AlertTriangle, Lock, Unlock } from "lucide-react";

interface PublishGateModalProps {
  testId: string;
  reportId?: string;
  criticalIssuesCount: number;
  onClose: () => void;
  onOverridden: () => void;
}

export function PublishGateModal({
  testId,
  reportId,
  criticalIssuesCount,
  onClose,
  onOverridden,
}: PublishGateModalProps) {
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleOverride() {
    if (!reason || reason.trim().length < 5) {
      setError("Please provide a thorough justification reason to override the publish gate.");
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const res = await fetch(`/api/team/tests/${testId}/audit/override`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          overridePublish: true,
          reportId,
          reason: reason.trim(),
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error?.message || "Failed to override publish gate.");
      onOverridden();
      onClose();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-lg bg-white rounded-2xl shadow-2xl border border-red-200 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 bg-red-50 border-b border-red-200">
          <div className="flex items-center gap-2.5 text-red-800">
            <ShieldAlert className="w-5 h-5 text-red-600" />
            <h3 className="font-bold text-base">Test Publication Blocked</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-red-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4">
          <div className="p-3.5 rounded-xl bg-red-50/60 border border-red-200 text-xs text-red-900 leading-relaxed">
            <span className="font-bold block mb-1">
              Quality Audit Gate: {criticalIssuesCount} Critical Issue{criticalIssuesCount > 1 ? "s" : ""} Detected
            </span>
            This test cannot be published directly because unresolved critical errors (duplicate questions, missing answer keys, or missing diagrams) exist. Publishing invalid questions degrades student trust and corrupts live test evaluation.
          </div>

          {error && (
            <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-xs flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div className="space-y-2">
            <label className="block text-xs font-semibold text-slate-700">
              Admin Publish Override Justification:
            </label>
            <p className="text-[11px] text-slate-500">
              This action will be permanently recorded in the immutable audit log under your user account.
            </p>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="State why this test must be published despite audit warnings (e.g., Live mock test window starting, verified that diagram is printed on offline question paper booklet)..."
              className="w-full text-xs p-3 rounded-xl border border-slate-300 focus:ring-2 focus:ring-red-500 outline-none resize-none h-24 bg-white"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-200 bg-slate-50 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-medium text-slate-600 hover:bg-slate-200 transition-colors"
          >
            Cancel & Fix Questions
          </button>
          <button
            type="button"
            disabled={loading}
            onClick={handleOverride}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold text-white bg-red-600 hover:bg-red-700 transition-colors shadow-sm disabled:opacity-50"
          >
            <Unlock className="w-3.5 h-3.5" />
            Override & Force Publish
          </button>
        </div>
      </div>
    </div>
  );
}
