"use client";

import { useEffect, useState, useCallback } from "react";

type Item = {
  id: string;
  specialDate: string;
  title: string;
  content: string;
  isActive: boolean;
  targetClass: string | null;
  targetExam: string | null;
  targetBoard: string | null;
};

const BLANK = { specialDate: "", title: "", content: "", targetClass: "", targetExam: "", targetBoard: "" };

export function TodaySpecialConsole() {
  const [items, setItems] = useState<Item[]>([]);
  const [creating, setCreating] = useState(false);
  const [draft, setDraft] = useState(BLANK);

  const load = useCallback(async () => {
    const res = await fetch("/api/team/communication/today-special");
    const json = await res.json();
    if (json.success) setItems(json.data.items);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function create() {
    const res = await fetch("/api/team/communication/today-special", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(draft),
    });
    const json = await res.json();
    if (!json.success) {
      alert(json.error);
      return;
    }
    setCreating(false);
    setDraft(BLANK);
    load();
  }

  async function toggleActive(it: Item) {
    await fetch(`/api/team/communication/today-special/${it.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: !it.isActive }),
    });
    load();
  }

  async function remove(it: Item) {
    if (!confirm(`Remove "${it.title}"?`)) return;
    await fetch(`/api/team/communication/today-special/${it.id}`, { method: "DELETE" });
    load();
  }

  return (
    <div className="space-y-3">
      <button onClick={() => setCreating(true)} className="px-3 py-1.5 text-sm font-semibold rounded-lg bg-primary text-white">+ New Today Special</button>

      <div className="space-y-2">
        {items.map((it) => (
          <div key={it.id} className="rounded-xl border border-slate-200 dark:border-slate-700 p-4 flex items-start justify-between gap-3">
            <div>
              <div className="font-semibold text-sm">{it.title} <span className="text-xs text-slate-400 font-normal">({it.specialDate})</span></div>
              <p className="text-xs text-slate-500 mt-1 line-clamp-2">{it.content}</p>
              <div className="text-[10px] text-slate-400 mt-1">
                Targets: {[it.targetClass && `Class ${it.targetClass}`, it.targetExam, it.targetBoard].filter(Boolean).join(", ") || "All eligible students"}
              </div>
            </div>
            <div className="flex flex-col gap-1 text-xs shrink-0">
              <button onClick={() => toggleActive(it)} className="px-2 py-1 rounded-lg border border-slate-300 dark:border-slate-700">{it.isActive ? "Deactivate" : "Activate"}</button>
              <button onClick={() => remove(it)} className="px-2 py-1 rounded-lg border border-rose-300 text-rose-600">Remove</button>
            </div>
          </div>
        ))}
        {items.length === 0 && <div className="text-sm text-slate-400 py-6 text-center">No Today Specials configured.</div>}
      </div>

      {creating && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-lg rounded-2xl bg-white dark:bg-slate-900 p-5 max-h-[85vh] overflow-y-auto">
            <h3 className="font-bold mb-3">New Today Special</h3>
            <label className="text-xs text-slate-500">Date (MM-DD)</label>
            <input value={draft.specialDate} onChange={(e) => setDraft({ ...draft, specialDate: e.target.value })} placeholder="09-15" className="w-full mb-2 px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900" />
            <label className="text-xs text-slate-500">Title</label>
            <input value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} className="w-full mb-2 px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900" />
            <label className="text-xs text-slate-500">Content</label>
            <textarea value={draft.content} onChange={(e) => setDraft({ ...draft, content: e.target.value })} rows={4} className="w-full mb-2 px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900" />
            <div className="grid grid-cols-3 gap-2 mb-3">
              <input value={draft.targetClass} onChange={(e) => setDraft({ ...draft, targetClass: e.target.value })} placeholder="Class (optional)" className="px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900" />
              <input value={draft.targetExam} onChange={(e) => setDraft({ ...draft, targetExam: e.target.value })} placeholder="Exam (optional)" className="px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900" />
              <input value={draft.targetBoard} onChange={(e) => setDraft({ ...draft, targetBoard: e.target.value })} placeholder="Board (optional)" className="px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900" />
            </div>
            <div className="flex justify-end gap-2">
              <button onClick={() => setCreating(false)} className="px-3 py-1.5 text-sm rounded-lg border border-slate-300 dark:border-slate-700">Cancel</button>
              <button onClick={create} className="px-3 py-1.5 text-sm rounded-lg bg-primary text-white">Save</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
