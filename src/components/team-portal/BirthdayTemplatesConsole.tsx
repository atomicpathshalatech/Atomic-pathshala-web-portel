"use client";

import { useEffect, useState, useCallback } from "react";

type Template = { id: string; name: string; category: string; board: string | null; messageText: string; isActive: boolean; priority: number };

const CATEGORIES = ["FOUNDATION9", "CLASS10", "CLASS11", "CLASS12", "NEET", "JEE", "BOARD", "GENERAL"];

export function BirthdayTemplatesConsole() {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [editing, setEditing] = useState<Template | null>(null);
  const [creating, setCreating] = useState(false);
  const [draft, setDraft] = useState({ name: "", category: "GENERAL", board: "", messageText: "" });

  const load = useCallback(async () => {
    const res = await fetch("/api/team/communication/birthday/templates");
    const json = await res.json();
    if (json.success) setTemplates(json.data.templates);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function save() {
    if (!editing) return;
    await fetch(`/api/team/communication/birthday/templates/${editing.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: editing.name, messageText: editing.messageText, isActive: editing.isActive }),
    });
    setEditing(null);
    load();
  }

  async function create() {
    await fetch("/api/team/communication/birthday/templates", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...draft, board: draft.board || undefined }),
    });
    setCreating(false);
    setDraft({ name: "", category: "GENERAL", board: "", messageText: "" });
    load();
  }

  async function remove(t: Template) {
    if (!confirm(`Remove "${t.name}"?`)) return;
    await fetch(`/api/team/communication/birthday/templates/${t.id}`, { method: "DELETE" });
    load();
  }

  return (
    <div className="space-y-3">
      <button onClick={() => setCreating(true)} className="px-3 py-1.5 text-sm font-semibold rounded-lg bg-primary text-white">+ New Template</button>

      <div className="grid sm:grid-cols-2 gap-3">
        {templates.map((t) => (
          <div key={t.id} className="rounded-xl border border-slate-200 dark:border-slate-700 p-4">
            <div className="flex items-start justify-between gap-2">
              <div>
                <div className="font-semibold text-sm">{t.name}</div>
                <div className="text-xs text-slate-500">{t.category}{t.board ? ` · ${t.board}` : ""}</div>
              </div>
              <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${t.isActive ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300" : "bg-slate-100 text-slate-500 dark:bg-slate-800"}`}>
                {t.isActive ? "Active" : "Inactive"}
              </span>
            </div>
            <p className="mt-2 text-xs text-slate-500 line-clamp-3 whitespace-pre-line">{t.messageText}</p>
            <div className="mt-3 flex gap-2 text-xs">
              <button onClick={() => setEditing(t)} className="px-2 py-1 rounded-lg border border-slate-300 dark:border-slate-700">Edit</button>
              <button onClick={() => remove(t)} className="px-2 py-1 rounded-lg border border-rose-300 text-rose-600">Remove</button>
            </div>
          </div>
        ))}
      </div>

      {(editing || creating) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-lg rounded-2xl bg-white dark:bg-slate-900 p-5 max-h-[85vh] overflow-y-auto">
            <h3 className="font-bold mb-3">{editing ? `Edit: ${editing.name}` : "New Birthday Template"}</h3>
            {creating && (
              <>
                <label className="text-xs text-slate-500">Category</label>
                <select value={draft.category} onChange={(e) => setDraft({ ...draft, category: e.target.value })} className="w-full mb-2 px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900">
                  {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
                <label className="text-xs text-slate-500">Board (optional)</label>
                <input value={draft.board} onChange={(e) => setDraft({ ...draft, board: e.target.value })} placeholder="e.g. CBSE" className="w-full mb-2 px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900" />
              </>
            )}
            <label className="text-xs text-slate-500">Name</label>
            <input
              value={editing ? editing.name : draft.name}
              onChange={(e) => (editing ? setEditing({ ...editing, name: e.target.value }) : setDraft({ ...draft, name: e.target.value }))}
              className="w-full mb-2 px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900"
            />
            <label className="text-xs text-slate-500">Message</label>
            <textarea
              value={editing ? editing.messageText : draft.messageText}
              onChange={(e) => (editing ? setEditing({ ...editing, messageText: e.target.value }) : setDraft({ ...draft, messageText: e.target.value }))}
              rows={10}
              className="w-full mb-3 px-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900"
            />
            <div className="flex justify-end gap-2">
              <button onClick={() => { setEditing(null); setCreating(false); }} className="px-3 py-1.5 text-sm rounded-lg border border-slate-300 dark:border-slate-700">Cancel</button>
              <button onClick={editing ? save : create} className="px-3 py-1.5 text-sm rounded-lg bg-primary text-white">Save</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
