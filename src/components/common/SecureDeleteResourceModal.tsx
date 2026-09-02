"use client";

import React, { useState } from "react";
import { toast } from "sonner";
import { AlertTriangle, Trash2, Lock, ShieldAlert } from "lucide-react";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  resourceId: string;
  resourceTitle: string;
  resourceType: string;
  onDeleted?: () => void;
}

export function SecureDeleteResourceModal({
  isOpen,
  onClose,
  resourceId,
  resourceTitle,
  resourceType,
  onDeleted,
}: Props) {
  const [confirmInput, setConfirmInput] = useState("");
  const [reason, setReason] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState("");

  if (!isOpen) return null;

  const isMatch = confirmInput.trim().toUpperCase() === resourceId.trim().toUpperCase();

  const handleDelete = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isMatch) {
      setError(`Please type the exact Resource ID: '${resourceId}'`);
      return;
    }

    setDeleting(true);
    setError("");

    try {
      const res = await fetch("/api/team/resources/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          resourceId: resourceId.trim().toUpperCase(),
          confirmResourceId: confirmInput.trim().toUpperCase(),
          reason: reason.trim() || "User confirmed deletion",
        }),
      });

      const json = await res.json();
      if (!json.success) {
        setError(json.error || "Failed to delete resource.");
        return;
      }

      toast.success(`Resource ${resourceId} permanently deleted.`);
      onClose();
      if (onDeleted) onDeleted();
    } catch {
      setError("Network error during secure deletion.");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
      <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-4 animate-in fade-in zoom-in-95 border border-rose-100">
        {/* Warning Header */}
        <div className="flex items-start gap-3.5 pb-3 border-b border-rose-100">
          <div className="w-10 h-10 rounded-2xl bg-rose-50 border border-rose-200 text-rose-600 flex items-center justify-center shrink-0">
            <ShieldAlert className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-extrabold text-slate-900">Secure Resource Deletion</h3>
            <p className="text-xs text-rose-600 font-medium mt-0.5">
              Strict confirmation required. One-click deletion is disabled.
            </p>
          </div>
        </div>

        {/* Resource Details */}
        <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 space-y-1 text-xs">
          <div className="flex items-center justify-between">
            <span className="text-slate-500 font-bold uppercase text-[10px]">{resourceType}</span>
            <span className="font-mono font-bold text-rose-700 bg-rose-50 px-2 py-0.5 rounded border border-rose-200">
              {resourceId}
            </span>
          </div>
          <p className="font-bold text-slate-900 line-clamp-2">{resourceTitle}</p>
        </div>

        <form onSubmit={handleDelete} className="space-y-4">
          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-slate-700">
              Type <span className="font-mono font-black text-rose-600 select-all">{resourceId}</span> to confirm:
            </label>
            <input
              type="text"
              required
              autoFocus
              placeholder={`Type ${resourceId} here...`}
              value={confirmInput}
              onChange={(e) => {
                setConfirmInput(e.target.value);
                setError("");
              }}
              className="w-full bg-slate-50 border border-slate-300 focus:border-rose-500 px-3.5 py-2.5 rounded-xl font-mono text-xs text-slate-900 uppercase tracking-wider outline-none"
            />
          </div>

          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-slate-700">Reason for Deletion (Optional):</label>
            <input
              type="text"
              placeholder="e.g. Duplicate question, Outdated syllabus..."
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 focus:border-rose-500 px-3 py-2 rounded-xl text-xs text-slate-900 outline-none"
            />
          </div>

          {error && <p className="text-xs font-bold text-rose-600 bg-rose-50 p-2.5 rounded-xl">{error}</p>}

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-bold text-slate-500 hover:text-slate-800"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!isMatch || deleting}
              className="px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-extrabold text-xs shadow-md shadow-rose-500/20 transition disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1.5"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>{deleting ? "Deleting..." : "Permanently Delete"}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
