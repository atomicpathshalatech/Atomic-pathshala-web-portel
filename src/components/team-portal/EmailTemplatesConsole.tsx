"use client";

import { useEffect, useState, useCallback } from "react";

type Template = {
  id: string;
  key: string;
  name: string;
  category: string;
  subject: string;
  bodyHtml: string;
  variables: string[];
  isActive: boolean;
  isSystem: boolean;
};

export function EmailTemplatesConsole() {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [editing, setEditing] = useState<Template | null>(null);
  const [preview, setPreview] = useState<{ subject: string; html: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch("/api/team/communication/templates");
    const json = await res.json();
    if (json.success) setTemplates(json.data.templates);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function save() {
    if (!editing) return;
    setBusy(true);
    await fetch(`/api/team/communication/templates/${editing.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: editing.name, subject: editing.subject, bodyHtml: editing.bodyHtml, isActive: editing.isActive }),
    });
    setBusy(false);
    setEditing(null);
    load();
  }

  async function toggleActive(t: Template) {
    await fetch(`/api/team/communication/templates/${t.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: !t.isActive }),
    });
    load();
  }

  async function duplicate(t: Template) {
    await fetch(`/api/team/communication/templates/${t.id}?action=duplicate`, { method: "POST" });
    load();
  }

  async function doPreview(t: Template) {
    const res = await fetch(`/api/team/communication/templates/${t.id}`, { method: "POST" });
    const json = await res.json();
    if (json.success) setPreview(json.data);
  }

  async function remove(t: Template) {
    if (!confirm(t.isSystem ? `Deactivate "${t.name}"? (default templates are archived, not deleted)` : `Delete "${t.name}"?`)) return;
    await fetch(`/api/team/communication/templates/${t.id}`, { method: "DELETE" });
    load();
  }

  return (
    <div className="space-y-3">
      <div className="grid sm:grid-cols-2 gap-3">
        {templates.map((t) => (
          <div key={t.id} className="rounded-xl border border-slate-200 dark:border-slate-700 p-4">
            <div className="flex items-start justify-between gap-2">
              <div>
                <div className="font-semibold text-slate-900 dark:text-white text-sm">{t.name}</div>
                <div className="text-xs text-slate-500">{t.category} · {t.key}</div>
              </div>
              <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${t.isActive ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300" : "bg-slate-100 text-slate-500 dark:bg-slate-800"}`}>
                {t.isActive ? "Active" : "Inactive"}
              </span>
            </div>
            <div className="mt-2 text-xs text-slate-500 truncate">{t.subject}</div>
            <div className="mt-1 flex flex-wrap gap-1">
              {t.variables.slice(0, 6).map((v) => (
                <code key={v} className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">{`{{${v}}}`}</code>
              ))}
            </div>
            <div className="mt-3 flex flex-wrap gap-2 text-xs">
              <button onClick={() => setEditing(t)} className="px-2 py-1 rounded-lg border border-slate-300 dark:border-slate-700">Edit</button>
              <button onClick={() => doPreview(t)} className="px-2 py-1 rounded-lg border border-slate-300 dark:border-slate-700">Preview</button>
              <button onClick={() => duplicate(t)} className="px-2 py-1 rounded-lg border border-slate-300 dark:border-slate-700">Duplicate</button>
              <button onClick={() => toggleActive(t)} className="px-2 py-1 rounded-lg border border-slate-300 dark:border-slate-700">
                {t.isActive ? "Deactivate" : "Activate"}
              </button>
              <button onClick={() => remove(t)} className="px-2 py-1 rounded-lg border border-rose-300 text-rose-600">
                {t.isSystem ? "Archive" : "Delete"}
              </button>
            </div>
          </div>
        ))}
      </div>

      {editing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-lg rounded-2xl bg-white dark:bg-slate-900 p-5 max-h-[85vh] overflow-y-auto">
            <h3 className="font-bold mb-3">Edit: {editing.name}</h3>
            <label className="text-xs text-slate-500">Name</label>
            <input value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} className="w-full mb-2 px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900" />
            <label className="text-xs text-slate-500">Subject</label>
            <input value={editing.subject} onChange={(e) => setEditing({ ...editing, subject: e.target.value })} className="w-full mb-2 px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900" />
            <label className="text-xs text-slate-500">Body (HTML)</label>
            <textarea value={editing.bodyHtml} onChange={(e) => setEditing({ ...editing, bodyHtml: e.target.value })} rows={10} className="w-full mb-3 px-3 py-2 text-xs font-mono rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900" />
            <div className="flex justify-end gap-2">
              <button onClick={() => setEditing(null)} className="px-3 py-1.5 text-sm rounded-lg border border-slate-300 dark:border-slate-700">Cancel</button>
              <button onClick={save} disabled={busy} className="px-3 py-1.5 text-sm rounded-lg bg-primary text-white disabled:opacity-40">Save</button>
            </div>
          </div>
        </div>
      )}

      {preview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setPreview(null)}>
          <div className="w-full max-w-lg rounded-2xl bg-white dark:bg-slate-900 p-5 max-h-[85vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="text-xs text-slate-500 mb-1">Subject</div>
            <div className="font-semibold mb-3">{preview.subject}</div>
            <div className="text-xs text-slate-500 mb-1">Body</div>
            <div className="border border-slate-200 dark:border-slate-700 rounded-xl p-3 text-sm" dangerouslySetInnerHTML={{ __html: preview.html }} />
          </div>
        </div>
      )}
    </div>
  );
}
