"use client";

import { useEffect, useState, useCallback } from "react";
import { toast } from "sonner";

type Tab = "generated" | "templates" | "backgrounds";

type GeneratedRow = {
  id: string;
  type: string;
  sourceEntityId: string;
  status: string;
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

  const load = useCallback(async () => {
    setLoading(true);
    const [g, t, b] = await Promise.all([
      fetch("/api/team/creatives").then((r) => r.json()),
      fetch("/api/team/creatives/templates").then((r) => r.json()),
      fetch("/api/team/creatives/backgrounds").then((r) => r.json()),
    ]);
    if (g.success) setGenerated(g.data.creatives);
    if (t.success) setTemplates(t.data.templates);
    if (b.success) setBackgrounds(b.data.backgrounds);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

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

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        {(["generated", "templates", "backgrounds"] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-3 py-1.5 rounded-lg text-sm font-semibold border ${tab === t ? "bg-primary text-white border-primary" : "border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-300"}`}
          >
            {t === "generated" ? "Generated Creatives" : t === "templates" ? "Templates" : "Backgrounds"}
          </button>
        ))}
      </div>

      {loading && <div className="text-sm text-slate-400 py-6 text-center">Loading…</div>}

      {!loading && tab === "generated" && (
        <div className="grid sm:grid-cols-3 md:grid-cols-4 gap-3">
          {generated.map((c) => (
            <div key={c.id} className="rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
              <div className="aspect-[16/9] bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
                {c.assetUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={c.assetUrl} alt="" className="w-full h-full object-cover" />
                ) : (
                  <span className="material-symbols-outlined text-slate-400">image</span>
                )}
              </div>
              <div className="p-2 text-xs">
                <div className="font-semibold">{c.type}</div>
                <div className="text-slate-500">{c.template?.name ?? "default"} · {c.background?.name ?? "default"}</div>
                <div className={c.status === "READY" ? "text-emerald-600" : c.status === "FAILED" ? "text-rose-500" : "text-amber-500"}>{c.status}</div>
              </div>
            </div>
          ))}
          {generated.length === 0 && <div className="col-span-full text-sm text-slate-400 py-6 text-center">No creatives generated yet.</div>}
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
