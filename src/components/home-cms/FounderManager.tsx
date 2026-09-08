"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

export type FounderData = {
  name: string;
  designation: string;
  photoUrl: string | null;
  mobilePhotoUrl: string | null;
  shortBio: string;
  biography: string;
  education: string;
  experience: string;
  teachingPhilosophy: string;
  vision: string;
  founderMessage: string;
  socialLinks: { label: string; url: string }[];
  isActive: boolean;
  seoTitle: string | null;
  metaDescription: string | null;
  ogImageUrl: string | null;
  canonicalUrl: string | null;
};

const FIELD =
  "w-full rounded-xl border border-outline-variant/40 bg-surface px-3.5 py-2.5 font-body-md text-body-md text-on-surface focus:outline-none focus:ring-2 focus:ring-primary";
const LABEL = "block font-label-md text-label-md text-on-surface mb-1.5";

function ImageField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string | null;
  onChange: (url: string | null) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  async function upload(file: File) {
    setBusy(true);
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch("/api/admin/media", { method: "POST", body: form });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error ?? "Upload failed.");
      onChange(json.data.asset.url as string);
      toast.success("Image uploaded");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Upload failed.");
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <div>
      <span className={LABEL}>{label}</span>
      <div className="flex items-center gap-3">
        <div className="w-16 h-16 rounded-xl border border-outline-variant/40 bg-surface-container-low overflow-hidden shrink-0 flex items-center justify-center">
          {value ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={value} alt="" className="w-full h-full object-cover" />
          ) : (
            <span className="material-symbols-outlined text-on-surface-variant">image</span>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={busy}
            className="rounded-lg bg-primary text-on-primary font-label-sm text-label-sm px-3 py-1.5 disabled:opacity-60"
          >
            {busy ? "Uploading…" : value ? "Replace" : "Upload"}
          </button>
          {value && (
            <button
              type="button"
              onClick={() => onChange(null)}
              className="rounded-lg border border-outline-variant/50 text-on-surface-variant font-label-sm text-label-sm px-3 py-1.5"
            >
              Remove
            </button>
          )}
        </div>
        <input
          ref={inputRef}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) upload(f);
          }}
        />
      </div>
    </div>
  );
}

export function FounderManager({ initial }: { initial: FounderData }) {
  const router = useRouter();
  const [f, setF] = useState<FounderData>(initial);
  const [saving, setSaving] = useState(false);

  const set = <K extends keyof FounderData>(key: K, value: FounderData[K]) =>
    setF((prev) => ({ ...prev, [key]: value }));

  async function save() {
    setSaving(true);
    try {
      const res = await fetch("/api/admin/founder", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...f,
          socialLinks: f.socialLinks.filter((s) => s.label.trim() && s.url.trim()),
          photoUrl: f.photoUrl ?? "",
          mobilePhotoUrl: f.mobilePhotoUrl ?? "",
          seoTitle: f.seoTitle ?? "",
          metaDescription: f.metaDescription ?? "",
          ogImageUrl: f.ogImageUrl ?? "",
          canonicalUrl: f.canonicalUrl ?? "",
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error ?? "Save failed.");
      toast.success("Saved — homepage and /about-founder updated");
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Save failed.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="glass-card rounded-2xl p-5 flex flex-wrap items-center justify-between gap-4">
        <label className="flex items-center gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={f.isActive}
            onChange={(e) => set("isActive", e.target.checked)}
            className="w-5 h-5 accent-primary"
          />
          <span className="font-label-md text-label-md text-on-surface">
            Show the Founder section on the public site
          </span>
        </label>
        <button
          type="button"
          onClick={save}
          disabled={saving}
          className="rounded-xl bg-primary text-on-primary font-label-md text-label-md px-6 py-2.5 disabled:opacity-60"
        >
          {saving ? "Saving…" : "Save"}
        </button>
      </div>

      <section className="glass-card rounded-2xl p-5 space-y-4">
        <h2 className="font-headline-md text-headline-md text-on-surface">Profile</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className={LABEL} htmlFor="f-name">Founder name</label>
            <input id="f-name" className={FIELD} value={f.name} onChange={(e) => set("name", e.target.value)} />
          </div>
          <div>
            <label className={LABEL} htmlFor="f-desig">Designation</label>
            <input id="f-desig" className={FIELD} value={f.designation} onChange={(e) => set("designation", e.target.value)} placeholder="e.g. Founder & Chemistry Educator" />
          </div>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <ImageField label="Profile photo" value={f.photoUrl} onChange={(u) => set("photoUrl", u)} />
          <ImageField label="Mobile photo (optional)" value={f.mobilePhotoUrl} onChange={(u) => set("mobilePhotoUrl", u)} />
        </div>
        <div>
          <label className={LABEL} htmlFor="f-short">Short bio (homepage teaser)</label>
          <textarea id="f-short" rows={2} className={FIELD} value={f.shortBio} onChange={(e) => set("shortBio", e.target.value)} />
        </div>
        <div>
          <label className={LABEL} htmlFor="f-bio">Detailed biography (/about-founder page)</label>
          <textarea id="f-bio" rows={8} className={FIELD} value={f.biography} onChange={(e) => set("biography", e.target.value)} placeholder="One paragraph per line. Plain text." />
        </div>
      </section>

      <section className="glass-card rounded-2xl p-5 space-y-4">
        <h2 className="font-headline-md text-headline-md text-on-surface">Background</h2>
        {([
          ["education", "Educational / professional background"],
          ["experience", "Teaching experience"],
          ["teachingPhilosophy", "Teaching philosophy"],
          ["vision", "Vision for Atomic Pathshala"],
          ["founderMessage", "Founder message"],
        ] as const).map(([key, label]) => (
          <div key={key}>
            <label className={LABEL} htmlFor={`f-${key}`}>{label}</label>
            <textarea
              id={`f-${key}`}
              rows={3}
              className={FIELD}
              value={f[key] as string}
              onChange={(e) => set(key, e.target.value as FounderData[typeof key])}
            />
          </div>
        ))}
      </section>

      <section className="glass-card rounded-2xl p-5 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-headline-md text-headline-md text-on-surface">Profile links (optional)</h2>
          <button
            type="button"
            onClick={() => set("socialLinks", [...f.socialLinks, { label: "", url: "" }])}
            className="rounded-lg border border-outline-variant/50 text-primary font-label-sm text-label-sm px-3 py-1.5"
          >
            + Add link
          </button>
        </div>
        <p className="font-body-md text-body-md text-on-surface-variant">
          Only real, verified profiles (LinkedIn, YouTube, etc.).
        </p>
        {f.socialLinks.map((s, i) => (
          <div key={i} className="flex flex-wrap gap-2">
            <input
              className={`${FIELD} sm:max-w-[180px]`}
              placeholder="Label"
              value={s.label}
              onChange={(e) => {
                const next = [...f.socialLinks];
                next[i] = { ...next[i]!, label: e.target.value };
                set("socialLinks", next);
              }}
            />
            <input
              className={`${FIELD} flex-1 min-w-[200px]`}
              placeholder="https://…"
              value={s.url}
              onChange={(e) => {
                const next = [...f.socialLinks];
                next[i] = { ...next[i]!, url: e.target.value };
                set("socialLinks", next);
              }}
            />
            <button
              type="button"
              onClick={() => set("socialLinks", f.socialLinks.filter((_, j) => j !== i))}
              className="rounded-lg border border-outline-variant/50 text-on-surface-variant px-3"
              aria-label="Remove link"
            >
              <span className="material-symbols-outlined text-lg align-middle">delete</span>
            </button>
          </div>
        ))}
      </section>

      <section className="glass-card rounded-2xl p-5 space-y-4">
        <h2 className="font-headline-md text-headline-md text-on-surface">SEO — /about-founder page</h2>
        <div>
          <label className={LABEL} htmlFor="f-seotitle">SEO title</label>
          <input id="f-seotitle" className={FIELD} value={f.seoTitle ?? ""} onChange={(e) => set("seoTitle", e.target.value)} placeholder="e.g. [Name] — Founder of Atomic Pathshala" />
        </div>
        <div>
          <label className={LABEL} htmlFor="f-metadesc">Meta description</label>
          <textarea id="f-metadesc" rows={2} className={FIELD} value={f.metaDescription ?? ""} onChange={(e) => set("metaDescription", e.target.value)} />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <ImageField label="Social share image (OG)" value={f.ogImageUrl} onChange={(u) => set("ogImageUrl", u)} />
          <div>
            <label className={LABEL} htmlFor="f-canon">Canonical URL (optional)</label>
            <input id="f-canon" className={FIELD} value={f.canonicalUrl ?? ""} onChange={(e) => set("canonicalUrl", e.target.value)} placeholder="https://…/about-founder" />
          </div>
        </div>
      </section>

      <div className="flex justify-end">
        <button
          type="button"
          onClick={save}
          disabled={saving}
          className="rounded-xl bg-primary text-on-primary font-label-md text-label-md px-6 py-2.5 disabled:opacity-60"
        >
          {saving ? "Saving…" : "Save"}
        </button>
      </div>
    </div>
  );
}
