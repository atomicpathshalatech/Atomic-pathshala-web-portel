"use client";

import { useCallback, useEffect, useState } from "react";
import { uploadFileToR2 } from "@/lib/storage/upload-client";

type Platform = "windows" | "android";
type Release = { version: string; fileName: string; sizeBytes: number | null; publishedAt: string | null; notes: string | null } | null;

const META: Record<Platform, { title: string; icon: string; ext: string; hint: string }> = {
  android: {
    title: "Android App (.apk)",
    icon: "android",
    ext: ".apk",
    hint: "GitHub → Actions → “Android APK” → Run workflow. बनने के बाद नीचे “Artifacts” से ZIP डाउनलोड करें, उसके अंदर की .apk यहाँ अपलोड करें।",
  },
  windows: {
    title: "Windows App (.exe)",
    icon: "desktop_windows",
    ext: ".exe",
    hint: "desktop/teacher में `npm run dist` से बना Atomic-Pathshala-Setup-<version>.exe यहाँ अपलोड करें। (publish-release स्क्रिप्ट से डाला गया वर्ज़न भी यहीं दिखता है।)",
  },
};

const mb = (b: number | null) => (b ? `${(b / (1024 * 1024)).toFixed(1)} MB` : "—");

/** App Releases — publish new Windows / Android builds for the Download App window. */
export function AppReleasesManager() {
  const [current, setCurrent] = useState<Record<Platform, Release> | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/team/apps/releases", { cache: "no-store" });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || "Could not load");
      setCurrent(json.data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load");
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="mx-auto max-w-4xl space-y-5">
      <div>
        <h1 className="text-2xl font-black text-on-surface">App Releases</h1>
        <p className="text-sm text-on-surface-variant">
          Students और team “Download App” से जो ऐप डाउनलोड करते हैं, उसका नया वर्ज़न यहाँ से पब्लिश करें। एक ही ऐप सबके लिए है — जो लॉगिन करेगा, उसका अपना पोर्टल खुलेगा।
        </p>
      </div>
      {error && <p className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}
      <div className="grid gap-4 md:grid-cols-2">
        {(["android", "windows"] as Platform[]).map((p) => (
          <PlatformCard key={p} platform={p} release={current?.[p] ?? null} loading={!current && !error} onPublished={load} />
        ))}
      </div>
    </div>
  );
}

function PlatformCard({ platform, release, loading, onPublished }: { platform: Platform; release: Release; loading: boolean; onPublished: () => void }) {
  const meta = META[platform];
  const [file, setFile] = useState<File | null>(null);
  const [version, setVersion] = useState("");
  const [notes, setNotes] = useState("");
  const [progress, setProgress] = useState<number | null>(null);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  const publish = async () => {
    if (!file || !version.trim()) return;
    if (!file.name.toLowerCase().endsWith(meta.ext)) {
      setMessage({ ok: false, text: `कृपया ${meta.ext} फ़ाइल चुनें।` });
      return;
    }
    setMessage(null);
    setProgress(0);
    try {
      const uploaded = await uploadFileToR2(file, {
        prefix: "exports",
        fileType: "DOCUMENT",
        subPath: `apps/${platform}`,
        visibility: "PUBLIC",
        onProgress: setProgress,
      });
      const res = await fetch("/api/team/apps/releases", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ platform, fileAssetId: uploaded.fileAssetId, version: version.trim(), notes: notes.trim() || undefined }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok) throw new Error(json?.error || "Publish failed");
      setMessage({ ok: true, text: `v${version.trim()} पब्लिश हो गया — अब सबको यही डाउनलोड होगा।` });
      setFile(null);
      setVersion("");
      setNotes("");
      onPublished();
    } catch (e) {
      setMessage({ ok: false, text: e instanceof Error ? e.message : "Publish failed" });
    } finally {
      setProgress(null);
    }
  };

  return (
    <div className="space-y-3 rounded-2xl border border-outline-variant/30 bg-surface p-4">
      <div className="flex items-center gap-2.5">
        <span className="material-symbols-outlined text-2xl text-primary">{meta.icon}</span>
        <h2 className="text-base font-bold text-on-surface">{meta.title}</h2>
      </div>

      <div className="rounded-xl bg-surface-container-low p-3 text-xs text-on-surface-variant">
        {loading ? (
          "Loading…"
        ) : release ? (
          <>
            <p>
              Current: <b className="text-on-surface">v{release.version}</b> · {mb(release.sizeBytes)}
            </p>
            <p className="truncate">{release.fileName}</p>
            {release.publishedAt && <p>Published: {new Date(release.publishedAt).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })}</p>}
          </>
        ) : (
          "अभी कोई वर्ज़न पब्लिश नहीं हुआ है।"
        )}
      </div>

      <p className="text-[11px] text-on-surface-variant">{meta.hint}</p>

      <input
        type="file"
        accept={meta.ext}
        onChange={(e) => setFile(e.target.files?.[0] ?? null)}
        className="block w-full text-xs file:mr-3 file:rounded-lg file:border-0 file:bg-primary file:px-3 file:py-1.5 file:text-white"
      />
      <input
        value={version}
        onChange={(e) => setVersion(e.target.value)}
        placeholder="Version, e.g. 1.0.3"
        className="w-full rounded-lg border border-outline-variant/40 bg-transparent px-3 py-2 text-sm"
      />
      <input
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        placeholder="What's new (optional)"
        maxLength={500}
        className="w-full rounded-lg border border-outline-variant/40 bg-transparent px-3 py-2 text-sm"
      />

      {progress !== null && (
        <div className="h-2 overflow-hidden rounded-full bg-surface-container-high">
          <div className="h-full bg-primary transition-all" style={{ width: `${progress}%` }} />
        </div>
      )}
      {message && <p className={`text-xs font-semibold ${message.ok ? "text-emerald-600" : "text-red-600"}`}>{message.text}</p>}

      <button
        type="button"
        onClick={publish}
        disabled={!file || !version.trim() || progress !== null}
        className="w-full rounded-xl bg-primary px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50"
      >
        {progress !== null ? `Uploading… ${progress}%` : "Upload & Publish"}
      </button>
    </div>
  );
}
