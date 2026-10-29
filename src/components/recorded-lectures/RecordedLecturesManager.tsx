"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { formatBytes } from "./VideoUploadPanel";

type Row = {
  id: string;
  title: string;
  status: "DRAFT" | "PUBLISHED";
  language: string;
  chapter: string;
  subject: string;
  teacher: string;
  batch: { id: string; name: string } | null;
  uploadStatus: string | null;
  sizeBytes: number;
  durationSec: number | null;
  lectureNumber: number | null;
  archived: boolean;
  summary: "NONE" | "PUBLISHED" | "OUTDATED";
  updatedAt: string;
};

type Storage = { ready: boolean; problems: string[]; maxBytes: number };

const UPLOAD_LABEL: Record<string, { text: string; cls: string }> = {
  PENDING: { text: "No video yet", cls: "text-slate-500" },
  UPLOADING: { text: "Uploading / unfinished", cls: "text-amber-700 dark:text-amber-300" },
  VERIFYING: { text: "Verifying", cls: "text-blue-700 dark:text-blue-300" },
  READY: { text: "Video ready", cls: "text-emerald-700 dark:text-emerald-300" },
  FAILED: { text: "Upload failed", cls: "text-rose-700 dark:text-rose-300" },
  ABORTED: { text: "Upload cancelled", cls: "text-slate-500" },
};

export function StorageBanner({ storage }: { storage: Storage | undefined }) {
  if (!storage || storage.ready) return null;
  return (
    <div role="alert" className="rounded-2xl border border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-950/40 p-4 text-sm text-amber-900 dark:text-amber-200 space-y-1">
      <p className="font-bold flex items-center gap-2">
        <span className="material-symbols-outlined text-lg">cloud_off</span>
        Recorded-lecture storage is not set up — uploads are turned off.
      </p>
      <ul className="list-disc pl-5 text-xs">
        {storage.problems.map((p) => (
          <li key={p}>{p}</li>
        ))}
      </ul>
      <p className="text-xs">Recorded lectures use their own Cloudflare R2 account (RECORDED_R2_* settings). The main storage is never used for them.</p>
    </div>
  );
}

export function RecordedLecturesManager() {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [canManage, setCanManage] = useState(false);
  const [storage, setStorage] = useState<Storage | undefined>();
  const [error, setError] = useState<string | null>(null);
  const [state, setState] = useState("active");
  const [q, setQ] = useState("");
  const [batchId, setBatchId] = useState("");
  const [batches, setBatches] = useState<{ id: string; name: string }[]>([]);

  const load = useCallback(async () => {
    setError(null);
    const sp = new URLSearchParams();
    if (state !== "active") sp.set("state", state);
    if (q.trim()) sp.set("q", q.trim());
    if (batchId) sp.set("batchId", batchId);
    try {
      const res = await fetch(`/api/team/recorded-lectures?${sp}`, { cache: "no-store" });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error || "Could not load recorded lectures.");
      setRows(json.data.lectures);
      setCanManage(json.data.canManage);
      setStorage(json.data.storage);
    } catch (err) {
      setError((err as Error).message);
      setRows([]);
    }
  }, [state, q, batchId]);

  useEffect(() => {
    const t = setTimeout(load, 250);
    return () => clearTimeout(t);
  }, [load]);

  useEffect(() => {
    if (!canManage) return;
    fetch("/api/team/recorded-lectures/options", { cache: "no-store" })
      .then((r) => r.json())
      .then((j) => j.success && setBatches(j.data.batches))
      .catch(() => null);
  }, [canManage]);

  return (
    <div className="space-y-6 max-w-6xl">
      <header className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-black text-slate-900 dark:text-white">Recorded Lectures</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            {canManage
              ? "Upload recorded lectures, organise them by batch, subject and chapter, and publish them to students."
              : "Your recorded lectures — write the About and approve the lecture summary students see."}
          </p>
        </div>
        {canManage && (
          <Link
            href="/team/recorded-lectures/new"
            aria-disabled={storage && !storage.ready}
            className={`inline-flex items-center justify-center gap-1.5 rounded-lg px-4 py-2 text-sm font-bold text-white ${storage && !storage.ready ? "bg-slate-400 pointer-events-none" : "bg-blue-600 hover:bg-blue-700"}`}
          >
            <span className="material-symbols-outlined text-base">video_call</span>
            Upload recorded lecture
          </Link>
        )}
      </header>

      {canManage && <StorageBanner storage={storage} />}

      <div className="flex flex-col sm:flex-row gap-3 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-3">
        <label className="flex-1 min-w-0">
          <span className="sr-only">Search</span>
          <input
            id="rl-search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search by title"
            className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-sm"
          />
        </label>
        {canManage && (
          <label>
            <span className="sr-only">Batch</span>
            <select id="rl-batch" value={batchId} onChange={(e) => setBatchId(e.target.value)} className="w-full sm:w-56 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-sm">
              <option value="">All batches</option>
              {batches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          </label>
        )}
        <label>
          <span className="sr-only">State</span>
          <select id="rl-state" value={state} onChange={(e) => setState(e.target.value)} className="w-full sm:w-44 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-sm">
            <option value="active">Drafts & published</option>
            <option value="draft">Drafts</option>
            <option value="published">Published</option>
            <option value="archived">Archived</option>
          </select>
        </label>
      </div>

      {error && <p className="text-sm text-rose-600">{error}</p>}

      {rows === null ? (
        <div className="space-y-2">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-16 rounded-2xl bg-slate-100 dark:bg-slate-800 animate-pulse" />
          ))}
        </div>
      ) : rows.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 dark:border-slate-700 p-10 text-center text-sm text-slate-500">
          {canManage ? "No recorded lectures here yet. Upload the first one." : "You have no recorded lectures yet."}
        </div>
      ) : (
        <ul className="space-y-2">
          {rows.map((r) => {
            const up = UPLOAD_LABEL[r.uploadStatus ?? "PENDING"] ?? UPLOAD_LABEL.PENDING!;
            return (
              <li key={r.id}>
                <Link
                  href={`/team/recorded-lectures/${r.id}`}
                  className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-4 py-3 hover:border-blue-300 dark:hover:border-blue-700 transition"
                >
                  <div className="min-w-0 flex-1">
                    <p className="font-bold text-slate-900 dark:text-white truncate">
                      {r.lectureNumber ? `L${String(r.lectureNumber).padStart(2, "0")} · ` : ""}
                      {r.title}
                    </p>
                    <p className="text-xs text-slate-500 truncate">
                      {[r.batch?.name, r.subject, r.chapter, r.teacher].filter(Boolean).join(" › ")}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 text-xs shrink-0">
                    <span className={`font-semibold ${up.cls}`}>{up.text}</span>
                    {r.sizeBytes > 0 && <span className="text-slate-400 font-mono">{formatBytes(r.sizeBytes)}</span>}
                    <span
                      className={`rounded-full px-2 py-0.5 font-bold ${
                        r.archived
                          ? "bg-slate-200 text-slate-600 dark:bg-slate-800"
                          : r.status === "PUBLISHED"
                            ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300"
                            : "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200"
                      }`}
                    >
                      {r.archived ? "Archived" : r.status === "PUBLISHED" ? "Published" : "Draft"}
                    </span>
                    <span
                      className={`rounded-full px-2 py-0.5 font-bold ${
                        r.summary === "PUBLISHED"
                          ? "bg-blue-50 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300"
                          : r.summary === "OUTDATED"
                            ? "bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300"
                            : "bg-slate-100 text-slate-500 dark:bg-slate-800"
                      }`}
                    >
                      {r.summary === "PUBLISHED" ? "Summary live" : r.summary === "OUTDATED" ? "Summary outdated" : "No summary"}
                    </span>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
