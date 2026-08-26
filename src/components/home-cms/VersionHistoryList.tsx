"use client";

import { useState } from "react";
import { toast } from "sonner";

type VersionRow = {
  id: string;
  versionNumber: number;
  note: string | null;
  publishedAt: string;
  unpublishedAt: string | null;
  publishedByName: string;
};

export function VersionHistoryList({ versions, canRestore }: { versions: VersionRow[]; canRestore: boolean }) {
  const [restoringId, setRestoringId] = useState<string | null>(null);

  async function restore(id: string, versionNumber: number) {
    if (!confirm(`Restore version ${versionNumber}? This becomes the new draft and is published immediately.`)) return;
    setRestoringId(id);
    try {
      const res = await fetch(`/api/admin/homepage/restore/${id}`, { method: "POST" });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error ?? "Could not restore this version.");
      toast.success(`Restored as version ${json.data.version.versionNumber}. Reload the builder to see it.`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not restore this version.");
    } finally {
      setRestoringId(null);
    }
  }

  const liveId = versions.find((v) => !v.unpublishedAt)?.id;

  return (
    <div className="glass-card rounded-2xl divide-y divide-outline-variant/20">
      {versions.length === 0 && (
        <p className="p-8 text-center text-on-surface-variant font-body-md">No versions published yet.</p>
      )}
      {versions.map((v) => (
        <div key={v.id} className="p-5 flex items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <p className="font-label-lg text-label-lg text-on-surface">Version {v.versionNumber}</p>
              {v.id === liveId && (
                <span className="text-[10px] bg-green-500/10 text-green-700 px-2 py-0.5 rounded-full font-bold uppercase tracking-wide">
                  Live
                </span>
              )}
              {v.unpublishedAt && (
                <span className="text-[10px] bg-surface-container-high px-2 py-0.5 rounded-full font-bold uppercase tracking-wide text-on-surface-variant">
                  Unpublished
                </span>
              )}
            </div>
            {v.note && <p className="text-label-sm text-on-surface-variant">{v.note}</p>}
            <p className="text-label-sm text-on-surface-variant">
              {v.publishedByName} ·{" "}
              {new Date(v.publishedAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit" })}
            </p>
          </div>
          {canRestore && v.id !== liveId && (
            <button
              onClick={() => restore(v.id, v.versionNumber)}
              disabled={restoringId === v.id}
              className="text-label-sm text-primary hover:underline shrink-0 disabled:opacity-60"
            >
              {restoringId === v.id ? "Restoring…" : "Restore"}
            </button>
          )}
        </div>
      ))}
    </div>
  );
}
