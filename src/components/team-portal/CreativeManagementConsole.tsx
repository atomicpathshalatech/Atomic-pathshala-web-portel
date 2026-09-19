"use client";

import { useEffect, useState, useCallback } from "react";
import { toast } from "sonner";

type Tab = "generated" | "templates" | "backgrounds";

type GeneratedRow = {
  id: string;
  type: string;
  sourceEntityId: string;
  status: string;
  errorMessage?: string | null;
  assetUrl: string | null;
  updatedAt: string;
  template: { name: string } | null;
  background: { name: string } | null;
};
type TemplateRow = { id: string; key: string; name: string; type: string; isActive: boolean; isDefault: boolean };
type BackgroundRow = { id: string; name: string; kind: string; isActive: boolean; isDefault: boolean };

export function CreativeManagementConsole() {
  const [tab, setTab] = useState<Tab>("generated");
  const [generated, setGenerated] = useState<GeneratedRow[]>([]);
  const [templates, setTemplates] = useState<TemplateRow[]>([]);
  const [backgrounds, setBackgrounds] = useState<BackgroundRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [regeneratingId, setRegeneratingId] = useState<string | null>(null);
  const [isRegeneratingAll, setIsRegeneratingAll] = useState(false);
  const [regeneratingProgress, setRegeneratingProgress] = useState<{ current: number; total: number } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [g, t, b] = await Promise.all([
        fetch("/api/team/creatives").then((r) => r.json()),
        fetch("/api/team/creatives/templates").then((r) => r.json()),
        fetch("/api/team/creatives/backgrounds").then((r) => r.json()),
      ]);
      if (g.success) setGenerated(g.data.creatives);
      if (t.success) setTemplates(t.data.templates);
      if (b.success) setBackgrounds(b.data.backgrounds);
    } catch {
      toast.error("Failed to load creative console data");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function regenerateCreative(c: GeneratedRow) {
    setRegeneratingId(c.id);
    try {
      const res = await fetch("/api/team/creatives/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: c.type,
          entityId: c.sourceEntityId,
          force: true,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        toast.error(data.error || "Failed to generate creative");
      } else {
        toast.success(`Creative regenerated for ${c.type}!`);
      }
      await load();
    } catch {
      toast.error("Network error while generating creative");
    } finally {
      setRegeneratingId(null);
    }
  }

  async function regenerateAllFailed() {
    const failed = generated.filter((c) => c.status === "FAILED");
    if (failed.length === 0) {
      toast.info("No failed creatives to regenerate");
      return;
    }

    setIsRegeneratingAll(true);
    setRegeneratingProgress({ current: 0, total: failed.length });

    let successCount = 0;
    let failCount = 0;

    for (let i = 0; i < failed.length; i++) {
      const c = failed[i];
      if (!c) continue;
      setRegeneratingProgress({ current: i + 1, total: failed.length });
      try {
        const res = await fetch("/api/team/creatives/generate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            type: c.type,
            entityId: c.sourceEntityId,
            force: true,
          }),
        });
        const data = await res.json();
        if (res.ok && data.success) {
          successCount++;
        } else {
          failCount++;
        }
      } catch {
        failCount++;
      }
    }

    setIsRegeneratingAll(false);
    setRegeneratingProgress(null);
    toast.success(`Regeneration complete: ${successCount} succeeded, ${failCount} failed`);
    await load();
  }

  async function toggleTemplate(id: string, patch: object) {
    await fetch(`/api/team/creatives/templates/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(patch) });
    load();
  }
  async function duplicateTemplate(id: string) {
    await fetch(`/api/team/creatives/templates/${id}?action=duplicate`, { method: "POST" });
    toast.success("Duplicated — activate it once reviewed.");
    load();
  }
  async function toggleBackground(id: string, patch: object) {
    await fetch(`/api/team/creatives/backgrounds/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(patch) });
    load();
  }

  const readyCount = generated.filter((c) => c.status === "READY").length;
  const failedCount = generated.filter((c) => c.status === "FAILED").length;

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex gap-2">
          {(["generated", "templates", "backgrounds"] as Tab[]).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-3 py-1.5 rounded-lg text-sm font-semibold border transition-colors cursor-pointer ${
                tab === t
                  ? "bg-blue-600 text-white border-blue-600 shadow-2xs"
                  : "border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
              }`}
            >
              {t === "generated" ? "Generated Creatives" : t === "templates" ? "Templates" : "Backgrounds"}
            </button>
          ))}
        </div>

        {tab === "generated" && (
          <div className="flex items-center gap-2">
            <div className="text-xs text-slate-500 flex items-center gap-2 mr-1">
              <span className="inline-flex items-center gap-1 font-semibold text-emerald-600">
                <span className="w-2 h-2 rounded-full bg-emerald-500" />
                {readyCount} Ready
              </span>
              <span>&middot;</span>
              <span className="inline-flex items-center gap-1 font-semibold text-rose-500">
                <span className="w-2 h-2 rounded-full bg-rose-500" />
                {failedCount} Failed
              </span>
            </div>

            {failedCount > 0 && (
              <button
                type="button"
                onClick={regenerateAllFailed}
                disabled={isRegeneratingAll}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 transition-all cursor-pointer disabled:opacity-50"
              >
                <span className={`material-symbols-outlined text-[16px] ${isRegeneratingAll ? "animate-spin" : ""}`}>
                  autorenew
                </span>
                <span>
                  {isRegeneratingAll && regeneratingProgress
                    ? `Regenerating (${regeneratingProgress.current}/${regeneratingProgress.total})...`
                    : `Regenerate All Failed (${failedCount})`}
                </span>
              </button>
            )}

            <button
              type="button"
              onClick={load}
              disabled={loading || isRegeneratingAll}
              className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 transition-colors cursor-pointer"
              title="Refresh"
            >
              <span className={`material-symbols-outlined text-[18px] block ${loading ? "animate-spin" : ""}`}>
                refresh
              </span>
            </button>
          </div>
        )}
      </div>

      {loading && <div className="text-sm text-slate-400 py-10 text-center">Loading creatives…</div>}

      {!loading && tab === "generated" && (
        <div className="grid sm:grid-cols-3 md:grid-cols-4 gap-3">
          {generated.map((c) => {
            const isThisRegenerating = regeneratingId === c.id;

            return (
              <div
                key={c.id}
                className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 overflow-hidden flex flex-col justify-between shadow-2xs hover:shadow-xs transition-shadow"
              >
                <div>
                  <div className="aspect-[16/9] bg-slate-100 dark:bg-slate-800 flex items-center justify-center relative overflow-hidden group">
                    {c.assetUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={c.assetUrl} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <div className="flex flex-col items-center justify-center text-slate-400 gap-1">
                        <span className="material-symbols-outlined text-3xl">image</span>
                        <span className="text-[10px] font-medium">No Image</span>
                      </div>
                    )}

                    {c.assetUrl && (
                      <a
                        href={c.assetUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white text-xs font-semibold gap-1"
                      >
                        <span className="material-symbols-outlined text-[18px]">open_in_new</span>
                        <span>View Full</span>
                      </a>
                    )}
                  </div>

                  <div className="p-3 text-xs space-y-1">
                    <div className="flex items-center justify-between gap-1">
                      <span className="font-bold text-slate-800 dark:text-slate-100 truncate">{c.type}</span>
                      <span
                        className={`text-[10px] font-bold px-1.5 py-0.2 rounded-full ${
                          c.status === "READY"
                            ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400"
                            : c.status === "FAILED"
                            ? "bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-400"
                            : "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-400"
                        }`}
                      >
                        {c.status}
                      </span>
                    </div>

                    <div className="text-[11px] text-slate-500 truncate">
                      {c.template?.name ?? "default"} &middot; {c.background?.name ?? "default"}
                    </div>

                    {c.status === "FAILED" && c.errorMessage && (
                      <p className="text-[10px] text-rose-500/90 line-clamp-2 bg-rose-50 dark:bg-rose-950/40 p-1.5 rounded border border-rose-100 dark:border-rose-900/50 mt-1" title={c.errorMessage}>
                        {c.errorMessage}
                      </p>
                    )}
                  </div>
                </div>

                <div className="p-2.5 pt-0 border-t border-slate-100 dark:border-slate-800/80 mt-1">
                  <button
                    type="button"
                    onClick={() => regenerateCreative(c)}
                    disabled={isThisRegenerating || isRegeneratingAll}
                    className={`w-full py-1.5 px-2 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                      c.status === "FAILED"
                        ? "bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 dark:bg-rose-950/50 dark:hover:bg-rose-900/50 dark:border-rose-800 dark:text-rose-300"
                        : "bg-slate-100 hover:bg-slate-200 text-slate-700 dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-slate-200"
                    }`}
                  >
                    <span className={`material-symbols-outlined text-[15px] ${isThisRegenerating ? "animate-spin" : ""}`}>
                      autorenew
                    </span>
                    <span>{isThisRegenerating ? "Generating..." : c.status === "FAILED" ? "Retry / Regenerate" : "Regenerate"}</span>
                  </button>
                </div>
              </div>
            );
          })}
          {generated.length === 0 && (
            <div className="col-span-full text-sm text-slate-400 py-12 text-center border border-dashed rounded-2xl">
              No creatives generated yet.
            </div>
          )}
        </div>
      )}

      {!loading && tab === "templates" && (
        <div className="grid sm:grid-cols-2 gap-3">
          {templates.map((t) => (
            <div key={t.id} className="rounded-xl border border-slate-200 dark:border-slate-700 p-4">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="font-semibold text-sm">{t.name}</div>
                  <div className="text-xs text-slate-500">{t.type} · {t.key}</div>
                </div>
                <div className="flex flex-col items-end gap-1">
                  {t.isDefault && <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300">DEFAULT</span>}
                  <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${t.isActive ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300" : "bg-slate-100 text-slate-500 dark:bg-slate-800"}`}>
                    {t.isActive ? "ACTIVE" : "INACTIVE"}
                  </span>
                </div>
              </div>
              <div className="mt-3 flex flex-wrap gap-2 text-xs">
                <button onClick={() => toggleTemplate(t.id, { isActive: !t.isActive })} className="px-2 py-1 rounded-lg border border-slate-300 dark:border-slate-700">
                  {t.isActive ? "Deactivate" : "Activate"}
                </button>
                {!t.isDefault && (
                  <button onClick={() => toggleTemplate(t.id, { isDefault: true })} className="px-2 py-1 rounded-lg border border-slate-300 dark:border-slate-700">
                    Set Default
                  </button>
                )}
                <button onClick={() => duplicateTemplate(t.id)} className="px-2 py-1 rounded-lg border border-slate-300 dark:border-slate-700">
                  Duplicate
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {!loading && tab === "backgrounds" && (
        <div className="grid sm:grid-cols-3 gap-3">
          {backgrounds.map((b) => (
            <div key={b.id} className="rounded-xl border border-slate-200 dark:border-slate-700 p-4">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="font-semibold text-sm">{b.name}</div>
                  <div className="text-xs text-slate-500">{b.kind}</div>
                </div>
                {b.isDefault && <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300">DEFAULT</span>}
              </div>
              <div className="mt-3 flex gap-2 text-xs">
                <button onClick={() => toggleBackground(b.id, { isActive: !b.isActive })} className="px-2 py-1 rounded-lg border border-slate-300 dark:border-slate-700">
                  {b.isActive ? "Deactivate" : "Activate"}
                </button>
                {!b.isDefault && (
                  <button onClick={() => toggleBackground(b.id, { isDefault: true })} className="px-2 py-1 rounded-lg border border-slate-300 dark:border-slate-700">
                    Set Default
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
