"use client";

import { useEffect, useState } from "react";

type BrandProfile = {
  id: string;
  name: string;
  logoUrl: string | null;
  primaryColor: string | null;
  secondaryColor: string | null;
  fontFamily: string | null;
  websiteUrl: string | null;
  tagline: string | null;
  isDefault: boolean;
};

const EMPTY_FORM = {
  name: "",
  logoUrl: "",
  primaryColor: "#1A73E8",
  secondaryColor: "#0B57D0",
  fontFamily: "",
  websiteUrl: "",
  tagline: "",
  isDefault: false,
};

export function BrandProfileManager() {
  const [profiles, setProfiles] = useState<BrandProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  async function load() {
    setLoading(true);
    const res = await fetch("/api/team/brand-profiles");
    const body = await res.json();
    if (body.success) setProfiles(body.data.profiles);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  function startEdit(p: BrandProfile) {
    setEditingId(p.id);
    setForm({
      name: p.name,
      logoUrl: p.logoUrl ?? "",
      primaryColor: p.primaryColor ?? "#1A73E8",
      secondaryColor: p.secondaryColor ?? "#0B57D0",
      fontFamily: p.fontFamily ?? "",
      websiteUrl: p.websiteUrl ?? "",
      tagline: p.tagline ?? "",
      isDefault: p.isDefault,
    });
  }

  function startNew() {
    setEditingId("new");
    setForm(EMPTY_FORM);
  }

  async function save() {
    if (!form.name.trim()) {
      setError("Name is required.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const url = editingId && editingId !== "new" ? `/api/team/brand-profiles/${editingId}` : "/api/team/brand-profiles";
      const res = await fetch(url, {
        method: editingId && editingId !== "new" ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const body = await res.json();
      if (!body.success) {
        setError(body.error ?? "Could not save this brand profile.");
      } else {
        setEditingId(null);
        await load();
      }
    } catch {
      setError("Network connection error. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  async function remove(id: string) {
    setError(null);
    const res = await fetch(`/api/team/brand-profiles/${id}`, { method: "DELETE" });
    const body = await res.json();
    if (!body.success) {
      setError(body.error ?? "Could not delete this brand profile.");
      return;
    }
    await load();
  }

  return (
    <div className="space-y-stack-lg max-w-3xl">
      <div className="flex items-center justify-between">
        <h1 className="font-headline-lg text-headline-lg text-on-surface">Brand Profiles</h1>
        <button
          type="button"
          onClick={startNew}
          className="bg-primary text-on-primary rounded-full px-5 py-2.5 font-label-md text-label-md hover:opacity-90 transition-opacity"
        >
          New Brand Profile
        </button>
      </div>

      {error && <p className="text-label-sm text-error">{error}</p>}

      {editingId && (
        <div className="glass-card rounded-2xl p-6 space-y-3">
          <input
            type="text"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            placeholder="Name (e.g. Atomic Pathshala — NEET)"
            className="w-full rounded-lg border border-outline-variant/40 px-3 py-2 text-label-md bg-surface-container-lowest"
          />
          <input
            type="text"
            value={form.logoUrl}
            onChange={(e) => setForm({ ...form, logoUrl: e.target.value })}
            placeholder="Logo URL"
            className="w-full rounded-lg border border-outline-variant/40 px-3 py-2 text-label-md bg-surface-container-lowest"
          />
          <div className="grid grid-cols-2 gap-3">
            <label className="flex items-center gap-2 text-label-sm text-on-surface-variant">
              Primary
              <input type="color" value={form.primaryColor} onChange={(e) => setForm({ ...form, primaryColor: e.target.value })} />
            </label>
            <label className="flex items-center gap-2 text-label-sm text-on-surface-variant">
              Secondary
              <input type="color" value={form.secondaryColor} onChange={(e) => setForm({ ...form, secondaryColor: e.target.value })} />
            </label>
          </div>
          <input
            type="text"
            value={form.websiteUrl}
            onChange={(e) => setForm({ ...form, websiteUrl: e.target.value })}
            placeholder="Website URL"
            className="w-full rounded-lg border border-outline-variant/40 px-3 py-2 text-label-md bg-surface-container-lowest"
          />
          <input
            type="text"
            value={form.tagline}
            onChange={(e) => setForm({ ...form, tagline: e.target.value })}
            placeholder="Tagline"
            className="w-full rounded-lg border border-outline-variant/40 px-3 py-2 text-label-md bg-surface-container-lowest"
          />
          <label className="flex items-center gap-2 text-label-sm text-on-surface-variant">
            <input type="checkbox" checked={form.isDefault} onChange={(e) => setForm({ ...form, isDefault: e.target.checked })} />
            Default brand profile
          </label>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={save}
              disabled={saving}
              className="bg-primary text-on-primary rounded-full px-5 py-2 font-label-sm text-label-sm disabled:opacity-60"
            >
              {saving ? "Saving…" : "Save"}
            </button>
            <button type="button" onClick={() => setEditingId(null)} className="text-label-sm text-on-surface-variant px-3">
              Cancel
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <p className="text-label-sm text-on-surface-variant">Loading…</p>
      ) : profiles.length === 0 ? (
        <div className="glass-card rounded-2xl p-8 text-center text-on-surface-variant font-body-md">
          No brand profiles yet.
        </div>
      ) : (
        <ul className="space-y-2">
          {profiles.map((p) => (
            <li key={p.id} className="glass-card rounded-xl p-4 flex items-center gap-4">
              <span
                className="w-8 h-8 rounded-lg shrink-0"
                style={{ backgroundColor: p.primaryColor ?? "#1A73E8" }}
              />
              <div className="min-w-0 flex-1">
                <p className="font-label-md text-label-md text-on-surface truncate">
                  {p.name} {p.isDefault && <span className="text-[10px] text-primary uppercase font-bold ml-1">Default</span>}
                </p>
                <p className="text-label-sm text-on-surface-variant truncate">{p.tagline ?? p.websiteUrl ?? "—"}</p>
              </div>
              <button type="button" onClick={() => startEdit(p)} className="text-label-sm text-primary hover:underline shrink-0">
                Edit
              </button>
              <button type="button" onClick={() => remove(p.id)} className="text-label-sm text-red-500 hover:underline shrink-0">
                Delete
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
