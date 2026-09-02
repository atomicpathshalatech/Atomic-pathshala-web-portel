"use client";

import React, { useState } from "react";
import { toast } from "sonner";
import {
  Search,
  Download,
  FileText,
  Video,
  HelpCircle,
  Clock,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  History,
  FileDown,
  Layers,
  Sparkles,
} from "lucide-react";

interface AuditLogItem {
  id: string;
  resourceId: string;
  resourceType: string;
  action: string;
  result: string;
  createdAt: string | Date;
  userName?: string | null;
  user?: { id: string; name: string | null; email: string | null } | null;
}

export function DownloadCenterClient({ initialLogs }: { initialLogs: AuditLogItem[] }) {
  const [resourceIdInput, setResourceIdInput] = useState("");
  const [searching, setSearching] = useState(false);
  const [resource, setResource] = useState<any | null>(null);
  const [searchError, setSearchError] = useState("");
  const [downloading, setDownloading] = useState(false);
  const [logs, setLogs] = useState<AuditLogItem[]>(initialLogs);

  const handleLookup = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const cleanId = resourceIdInput.trim().toUpperCase();
    if (!cleanId) return;

    setSearching(true);
    setSearchError("");
    setResource(null);

    try {
      const res = await fetch(`/api/team/resources/${encodeURIComponent(cleanId)}`);
      const json = await res.json();
      if (!json.success) {
        setSearchError(json.error || `Resource '${cleanId}' not found.`);
        return;
      }
      setResource(json.data.resource);
    } catch {
      setSearchError("Network error while resolving Resource ID.");
    } finally {
      setSearching(false);
    }
  };

  const handleDownload = async () => {
    if (!resource) return;

    setDownloading(true);
    try {
      const res = await fetch("/api/team/resources/download", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ resourceId: resource.resourceId }),
      });

      const json = await res.json();
      if (!json.success) {
        toast.error(json.error || "Failed to download resource.");
        return;
      }

      toast.success(`Download started for ${resource.title}`);
      if (json.data.downloadUrl) {
        window.open(json.data.downloadUrl, "_blank");
      }

      // Refresh Audit Log
      fetchLogs();
    } catch {
      toast.error("Network error during secure download.");
    } finally {
      setDownloading(false);
    }
  };

  const fetchLogs = async () => {
    try {
      const res = await fetch("/api/team/resources/audit-logs");
      const json = await res.json();
      if (json.success) {
        setLogs(json.data.logs);
      }
    } catch {}
  };

  return (
    <div className="space-y-8 max-w-6xl mx-auto">
      {/* 1. HERO SEARCH SECTION */}
      <div className="bg-gradient-to-br from-blue-700 via-indigo-700 to-slate-900 rounded-3xl p-8 text-white shadow-xl relative overflow-hidden">
        <div className="relative z-10 max-w-2xl space-y-4">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 border border-white/20 text-xs font-bold backdrop-blur-sm">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
            <span>Centralized Platform Resource ID &amp; Download Center</span>
          </div>

          <h2 className="text-2xl sm:text-3xl font-black tracking-tight">
            Lookup &amp; Securely Download Any Platform Resource
          </h2>

          <p className="text-xs sm:text-sm text-blue-100 leading-relaxed">
            Enter any valid Resource ID (e.g. <span className="font-mono font-bold text-yellow-300">TST-XXXXXX</span>, <span className="font-mono font-bold text-yellow-300">DPP-XXXXXX</span>, <span className="font-mono font-bold text-yellow-300">QST-XXXXXX</span>, <span className="font-mono font-bold text-yellow-300">LEC-XXXXXX</span>, or <span className="font-mono font-bold text-yellow-300">PDF-XXXXXX</span>) to verify its details and download the verified file.
          </p>

          <form onSubmit={handleLookup} className="flex gap-2 pt-2">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-slate-400 absolute left-4 top-3.5" />
              <input
                type="text"
                required
                placeholder="Enter Resource ID (e.g. TST-58912, DPP-10923)..."
                value={resourceIdInput}
                onChange={(e) => {
                  setResourceIdInput(e.target.value);
                  setSearchError("");
                }}
                className="w-full pl-11 pr-4 py-3 bg-white text-slate-900 font-mono font-bold text-sm rounded-2xl shadow-inner outline-none focus:ring-2 focus:ring-blue-400 uppercase tracking-wider"
              />
            </div>
            <button
              type="submit"
              disabled={searching}
              className="px-6 py-3 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs sm:text-sm rounded-2xl shadow-lg transition active:scale-95 disabled:opacity-50"
            >
              {searching ? "Verifying..." : "Verify & Lookup"}
            </button>
          </form>

          {searchError && (
            <p className="text-xs font-bold text-rose-300 bg-rose-950/60 border border-rose-500/40 p-3 rounded-xl flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
              <span>{searchError}</span>
            </p>
          )}
        </div>
      </div>

      {/* 2. RESOURCE PREVIEW & VERIFICATION CARD */}
      {resource && (
        <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-md space-y-4 animate-in fade-in zoom-in-95">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-blue-50 border border-blue-200 text-blue-600 flex items-center justify-center font-bold shrink-0">
                {resource.type === "TEST" || resource.type === "DPP" ? (
                  <FileText className="w-6 h-6" />
                ) : resource.type === "LECTURE" || resource.type === "VIDEO" ? (
                  <Video className="w-6 h-6" />
                ) : (
                  <FileDown className="w-6 h-6" />
                )}
              </div>

              <div>
                <div className="flex items-center gap-2">
                  <span className="font-mono font-black text-blue-700 bg-blue-50 border border-blue-200 px-2.5 py-0.5 rounded-lg text-xs">
                    {resource.resourceId}
                  </span>
                  <span className="font-bold text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full bg-slate-100 text-slate-700">
                    {resource.type}
                  </span>
                  {resource.isDeleted && (
                    <span className="font-bold text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full bg-rose-100 text-rose-700">
                      DELETED / ARCHIVED
                    </span>
                  )}
                </div>
                <h3 className="text-base font-extrabold text-slate-900 mt-1">{resource.title}</h3>
              </div>
            </div>

            <div>
              {resource.isDeleted ? (
                <button
                  type="button"
                  disabled
                  className="px-5 py-2.5 rounded-2xl bg-slate-200 text-slate-400 font-bold text-xs cursor-not-allowed"
                >
                  Resource Deleted
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleDownload}
                  disabled={downloading}
                  className="px-6 py-3 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-xs sm:text-sm shadow-md shadow-emerald-500/20 transition flex items-center gap-2 active:scale-95 disabled:opacity-50"
                >
                  <Download className="w-4 h-4" />
                  <span>{downloading ? "Preparing Download..." : "Secure Download"}</span>
                </button>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs text-slate-600 pt-1">
            <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
              <span className="text-[10px] font-bold text-slate-400 block uppercase">Subject / Scope</span>
              <span className="font-bold text-slate-800">{resource.subject || "General"}</span>
            </div>

            <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
              <span className="text-[10px] font-bold text-slate-400 block uppercase">Format / Type</span>
              <span className="font-bold text-slate-800">{resource.format || "PDF"}</span>
            </div>

            <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
              <span className="text-[10px] font-bold text-slate-400 block uppercase">Created By</span>
              <span className="font-bold text-slate-800">{resource.createdBy?.name || "Academic Team"}</span>
            </div>

            <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
              <span className="text-[10px] font-bold text-slate-400 block uppercase">Registered Date</span>
              <span className="font-bold text-slate-800">
                {new Date(resource.createdAt).toLocaleDateString("en-IN")}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* 3. AUDIT LOGS FOR DOWNLOADS & DELETIONS */}
      <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <History className="w-5 h-5 text-blue-600" />
            <h3 className="text-base font-extrabold text-slate-900">Resource Download &amp; Security Audit Logs</h3>
          </div>
          <span className="text-xs text-slate-500 font-medium">Real-time immutable tracking</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
              <tr>
                <th className="px-4 py-3">Resource ID</th>
                <th className="px-4 py-3">Type</th>
                <th className="px-4 py-3">User</th>
                <th className="px-4 py-3">Action</th>
                <th className="px-4 py-3">Result</th>
                <th className="px-4 py-3 text-right">Timestamp</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {logs.map((log) => (
                <tr key={log.id} className="hover:bg-slate-50/60 transition">
                  <td className="px-4 py-3 font-mono font-bold text-blue-700">{log.resourceId}</td>
                  <td className="px-4 py-3 font-bold text-slate-700">{log.resourceType}</td>
                  <td className="px-4 py-3 text-slate-800">{log.userName || log.user?.name || "User"}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        log.action === "DOWNLOAD"
                          ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                          : log.action === "DELETE"
                          ? "bg-rose-50 text-rose-700 border border-rose-200"
                          : "bg-amber-50 text-amber-700 border border-amber-200"
                      }`}
                    >
                      {log.action}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`font-bold ${
                        log.result === "SUCCESS" ? "text-emerald-600" : "text-rose-600"
                      }`}
                    >
                      {log.result}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right text-slate-500">
                    {new Date(log.createdAt).toLocaleString("en-IN")}
                  </td>
                </tr>
              ))}

              {logs.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-slate-400">
                    No resource download or delete events logged yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
