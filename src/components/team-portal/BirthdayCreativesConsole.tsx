"use client";

import { useEffect, useState, useCallback, useRef } from "react";

type Creative = { id: string; name: string; category: string; imageUrl: string; isActive: boolean; usageCount: number };

const CATEGORIES = ["FOUNDATION9", "CLASS10", "CLASS11", "CLASS12", "NEET", "JEE", "BOARD", "GENERAL"];

export function BirthdayCreativesConsole() {
  const [creatives, setCreatives] = useState<Creative[]>([]);
  const [category, setCategory] = useState("GENERAL");
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    const res = await fetch("/api/team/communication/birthday/creatives");
    const json = await res.json();
    if (json.success) setCreatives(json.data.creatives);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const form = new FormData();
      form.append("file", file);
      const uploadRes = await fetch("/api/upload", { method: "POST", body: form });
      const uploadJson = await uploadRes.json();
      if (!uploadJson.success) {
        alert(uploadJson.error || "Upload failed.");
        return;
      }
      await fetch("/api/team/communication/birthday/creatives", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: file.name, category, imageUrl: uploadJson.data.url }),
      });
      await load();
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function toggleActive(c: Creative) {
    await fetch(`/api/team/communication/birthday/creatives/${c.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: !c.isActive }),
    });
    load();
  }

  async function remove(c: Creative) {
    if (!confirm(`Remove "${c.name}"?`)) return;
    await fetch(`/api/team/communication/birthday/creatives/${c.id}`, { method: "DELETE" });
    load();
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <select value={category} onChange={(e) => setCategory(e.target.value)} className="px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900">
          {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        <input ref={fileRef} type="file" accept="image/*" onChange={handleUpload} disabled={uploading} className="text-sm" />
        {uploading && <span className="text-xs text-slate-400">Uploading…</span>}
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {creatives.map((c) => (
          <div key={c.id} className="rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={c.imageUrl} alt={c.name} className="w-full h-28 object-cover" />
            <div className="p-2">
              <div className="text-xs font-semibold truncate">{c.name}</div>
              <div className="text-[10px] text-slate-500">{c.category} · used {c.usageCount}×</div>
              <div className="mt-1 flex gap-1">
                <button onClick={() => toggleActive(c)} className="text-[10px] px-1.5 py-0.5 rounded border border-slate-300 dark:border-slate-700">
                  {c.isActive ? "Deactivate" : "Activate"}
                </button>
                <button onClick={() => remove(c)} className="text-[10px] px-1.5 py-0.5 rounded border border-rose-300 text-rose-600">Remove</button>
              </div>
            </div>
          </div>
        ))}
        {creatives.length === 0 && <div className="col-span-full text-sm text-slate-400 py-6 text-center">No creatives uploaded yet.</div>}
      </div>
    </div>
  );
}
