"use client";

import { useState } from "react";

type Brand = { tagline: string; youtubeUrl: string; telegramUrl: string; websiteUrl: string };

const FIELDS: { key: keyof Brand; label: string; placeholder: string; hint: string }[] = [
  { key: "youtubeUrl", label: "YouTube channel link", placeholder: "https://youtube.com/@atomicpathshala", hint: "Printed as a QR code" },
  { key: "telegramUrl", label: "Telegram channel link", placeholder: "https://t.me/atomicpathshala", hint: "Printed as a QR code" },
  { key: "websiteUrl", label: "Website", placeholder: "https://atomicpathshala.in", hint: "Clickable link + QR code" },
  { key: "tagline", label: "Tagline", placeholder: "Concept · Practice · Selection", hint: "Under the logo" },
];

/** Admin-only: the links printed on every DPP PDF front page. */
export function DppBrandSettingsButton() {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<Brand | null>(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  async function openDialog() {
    setOpen(true);
    setMessage(null);
    try {
      const res = await fetch("/api/team/dpp/brand");
      const body = await res.json();
      if (body?.success) setForm(body.data.brand);
      else setMessage({ ok: false, text: body?.error ?? "Could not load the links." });
    } catch {
      setMessage({ ok: false, text: "Could not load the links." });
    }
  }

  async function save() {
    if (!form) return;
    setSaving(true);
    setMessage(null);
    try {
      const res = await fetch("/api/team/dpp/brand", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const body = await res.json();
      if (!res.ok || !body?.success) {
        setMessage({ ok: false, text: body?.error ?? "Could not save." });
        return;
      }
      setForm(body.data.brand);
      setMessage({ ok: true, text: "Saved — every DPP PDF downloaded from now on uses these links." });
    } catch {
      setMessage({ ok: false, text: "Could not save. Check your connection." });
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={openDialog}
        className="h-9 px-3 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 inline-flex items-center gap-1.5"
        title="YouTube / Telegram / website links on the DPP PDF front page"
      >
        <span className="material-symbols-outlined text-[16px]">qr_code_2</span>
        PDF Links
      </button>
      {open && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={() => setOpen(false)}>
          <div
            className="w-full max-w-lg rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 p-5 space-y-4 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div>
              <h3 className="text-base font-black text-slate-900 dark:text-white">DPP PDF front page links</h3>
              <p className="text-xs text-slate-500 mt-0.5">Shown on the front page of every DPP PDF. Leave a link empty to hide it.</p>
            </div>
            {!form ? (
              <p className="text-sm text-slate-500">{message?.text ?? "Loading…"}</p>
            ) : (
              <div className="space-y-3">
                {FIELDS.map((f) => (
                  <label key={f.key} className="block">
                    <span className="flex justify-between text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
                      {f.label}
                      <span className="font-normal text-slate-400">{f.hint}</span>
                    </span>
                    <input
                      className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-orange-400/40"
                      placeholder={f.placeholder}
                      value={form[f.key]}
                      onChange={(e) => setForm({ ...form, [f.key]: e.target.value })}
                    />
                  </label>
                ))}
              </div>
            )}
            {message && form && (
              <p className={`text-xs font-semibold ${message.ok ? "text-emerald-600" : "text-red-600"}`}>{message.text}</p>
            )}
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setOpen(false)} className="h-9 px-4 rounded-lg text-sm font-semibold text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800">
                Close
              </button>
              <button
                type="button"
                onClick={save}
                disabled={!form || saving}
                className="h-9 px-4 rounded-lg bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-sm font-bold disabled:opacity-50"
              >
                {saving ? "Saving…" : "Save links"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
