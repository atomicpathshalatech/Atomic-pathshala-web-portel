"use client";

import { useState } from "react";
import { toast } from "sonner";

type Settings = {
  logoUrl: string | null;
  description: string | null;
  copyrightText: string | null;
  contactPhone: string | null;
  contactEmail: string | null;
  address: string | null;
};
type Link = { id: string; label: string; url: string };
type Column = { id: string; title: string; links: Link[] };

export function FooterManager({ initialSettings, initialColumns }: { initialSettings: Settings; initialColumns: Column[] }) {
  const [settings, setSettings] = useState(initialSettings);
  const [savingSettings, setSavingSettings] = useState(false);
  const [columns, setColumns] = useState(initialColumns);
  const [newColumnTitle, setNewColumnTitle] = useState("");
  const [linkDrafts, setLinkDrafts] = useState<Record<string, { label: string; url: string }>>({});

  async function saveSettings(e: React.FormEvent) {
    e.preventDefault();
    setSavingSettings(true);
    try {
      const res = await fetch("/api/admin/footer/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings),
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error ?? "Could not save.");
      toast.success("Footer settings saved");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not save.");
    } finally {
      setSavingSettings(false);
    }
  }

  async function addColumn(e: React.FormEvent) {
    e.preventDefault();
    if (!newColumnTitle.trim()) return;
    try {
      const res = await fetch("/api/admin/footer/columns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: newColumnTitle.trim() }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error);
      setColumns((prev) => [...prev, { ...json.data.column, links: [] }]);
      setNewColumnTitle("");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not add column.");
    }
  }

  async function removeColumn(id: string) {
    try {
      await fetch(`/api/admin/footer/columns/${id}`, { method: "DELETE" });
      setColumns((prev) => prev.filter((c) => c.id !== id));
    } catch {
      toast.error("Could not delete column.");
    }
  }

  async function addLink(columnId: string) {
    const draft = linkDrafts[columnId];
    if (!draft?.label || !draft?.url) return;
    try {
      const res = await fetch("/api/admin/footer/links", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ columnId, label: draft.label, url: draft.url }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error);
      setColumns((prev) => prev.map((c) => (c.id === columnId ? { ...c, links: [...c.links, json.data.link] } : c)));
      setLinkDrafts((prev) => ({ ...prev, [columnId]: { label: "", url: "" } }));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not add link.");
    }
  }

  async function removeLink(columnId: string, linkId: string) {
    try {
      await fetch(`/api/admin/footer/links/${linkId}`, { method: "DELETE" });
      setColumns((prev) => prev.map((c) => (c.id === columnId ? { ...c, links: c.links.filter((l) => l.id !== linkId) } : c)));
    } catch {
      toast.error("Could not delete link.");
    }
  }

  return (
    <div className="space-y-stack-md">
      <form onSubmit={saveSettings} className="glass-card rounded-2xl p-6 space-y-3">
        <p className="font-label-lg text-label-lg text-on-surface">Contact & Branding</p>
        <input value={settings.logoUrl ?? ""} onChange={(e) => setSettings({ ...settings, logoUrl: e.target.value })} placeholder="Logo URL" className="w-full rounded-lg border border-outline-variant/40 bg-surface px-3 py-2 text-body-md" />
        <textarea value={settings.description ?? ""} onChange={(e) => setSettings({ ...settings, description: e.target.value })} rows={2} placeholder="Short description" className="w-full rounded-lg border border-outline-variant/40 bg-surface px-3 py-2 text-body-md" />
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <input value={settings.contactPhone ?? ""} onChange={(e) => setSettings({ ...settings, contactPhone: e.target.value })} placeholder="Phone" className="w-full rounded-lg border border-outline-variant/40 bg-surface px-3 py-2 text-body-md" />
          <input value={settings.contactEmail ?? ""} onChange={(e) => setSettings({ ...settings, contactEmail: e.target.value })} placeholder="Email" className="w-full rounded-lg border border-outline-variant/40 bg-surface px-3 py-2 text-body-md" />
          <input value={settings.address ?? ""} onChange={(e) => setSettings({ ...settings, address: e.target.value })} placeholder="Address" className="w-full rounded-lg border border-outline-variant/40 bg-surface px-3 py-2 text-body-md" />
        </div>
        <input value={settings.copyrightText ?? ""} onChange={(e) => setSettings({ ...settings, copyrightText: e.target.value })} placeholder="Copyright text" className="w-full rounded-lg border border-outline-variant/40 bg-surface px-3 py-2 text-body-md" />
        <button type="submit" disabled={savingSettings} className="bg-primary text-on-primary px-5 py-2.5 rounded-xl text-label-md disabled:opacity-60">
          {savingSettings ? "Saving…" : "Save Settings"}
        </button>
      </form>

      <form onSubmit={addColumn} className="flex gap-2">
        <input value={newColumnTitle} onChange={(e) => setNewColumnTitle(e.target.value)} placeholder="New column title (e.g. Company)" className="flex-1 rounded-lg border border-outline-variant/40 bg-surface px-3 py-2 text-body-md" />
        <button type="submit" className="px-4 py-2 rounded-lg text-label-md bg-surface-container-high text-on-surface hover:bg-primary/10 hover:text-primary">
          Add Column
        </button>
      </form>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-gutter">
        {columns.map((col) => (
          <div key={col.id} className="glass-card rounded-2xl p-5 space-y-3">
            <div className="flex items-center justify-between">
              <p className="font-label-lg text-label-lg text-on-surface">{col.title}</p>
              <button onClick={() => removeColumn(col.id)} className="text-label-sm text-error hover:underline">Delete column</button>
            </div>
            <ul className="space-y-1">
              {col.links.map((l) => (
                <li key={l.id} className="flex items-center justify-between text-label-sm">
                  <span className="text-on-surface-variant">{l.label} → {l.url}</span>
                  <button onClick={() => removeLink(col.id, l.id)} className="text-error hover:underline">Remove</button>
                </li>
              ))}
            </ul>
            <div className="flex gap-2">
              <input
                value={linkDrafts[col.id]?.label ?? ""}
                onChange={(e) => setLinkDrafts((prev) => ({ ...prev, [col.id]: { label: e.target.value, url: prev[col.id]?.url ?? "" } }))}
                placeholder="Label"
                className="flex-1 rounded-lg border border-outline-variant/40 bg-surface px-2 py-1.5 text-label-sm"
              />
              <input
                value={linkDrafts[col.id]?.url ?? ""}
                onChange={(e) => setLinkDrafts((prev) => ({ ...prev, [col.id]: { label: prev[col.id]?.label ?? "", url: e.target.value } }))}
                placeholder="URL"
                className="flex-1 rounded-lg border border-outline-variant/40 bg-surface px-2 py-1.5 text-label-sm"
              />
              <button onClick={() => addLink(col.id)} className="text-label-sm text-primary hover:underline shrink-0">Add</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
