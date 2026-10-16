"use client";

import { useEffect, useState } from "react";
import { isNativeApp } from "@/lib/platform";

type ReleaseInfo = { version: string; sizeBytes: number | null; publishedAt: string | null; notes: string | null } | null;

const sizeLabel = (b: number | null) => (b ? `${(b / (1024 * 1024)).toFixed(0)} MB` : null);

/**
 * "Download App" — the Atomic Pathshala Windows and Android apps. It is one
 * app for everyone: whoever signs in gets their own portal (students the
 * student portal, the team the team portal), so students and team see the
 * same two downloads.
 */
export function DownloadAppsModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const [releases, setReleases] = useState<{ windows: ReleaseInfo; android: ReleaseInfo } | null>(null);
  const [inAndroidApp, setInAndroidApp] = useState(false);
  const [inWindowsApp, setInWindowsApp] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    setInAndroidApp(isNativeApp());
    setInWindowsApp(typeof window !== "undefined" && "atomicDesktop" in window);
    let cancelled = false;
    fetch("/api/apps/releases", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => {
        if (!cancelled && j?.data) setReleases(j.data);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const win = releases?.windows ?? null;
  const android = releases?.android ?? null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm" onClick={onClose}>
      <div
        className="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-3xl border border-slate-200 bg-white text-slate-800 shadow-2xl dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-slate-100 p-5 dark:border-slate-800">
          <div className="flex items-center gap-3">
            <img src="/icon.png" alt="" className="h-11 w-11 rounded-2xl border border-slate-200 bg-white object-cover dark:border-slate-700" />
            <div>
              <h3 className="text-lg font-extrabold">Atomic Pathshala App</h3>
              <p className="text-xs text-slate-500">एक ही ऐप सबके लिए — जो लॉगिन करेगा, उसका अपना पोर्टल खुलेगा।</p>
            </div>
          </div>
          <button type="button" onClick={onClose} className="flex h-8 w-8 items-center justify-center rounded-full text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800" aria-label="Close">
            <span className="material-symbols-outlined text-lg">close</span>
          </button>
        </div>

        <div className="grid gap-4 overflow-y-auto p-5 sm:grid-cols-2">
          {/* Windows */}
          <div className="flex flex-col rounded-2xl border border-slate-200 p-4 dark:border-slate-700">
            <div className="flex items-center gap-2.5">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-sky-50 text-sky-600 dark:bg-sky-950">
                <span className="material-symbols-outlined">desktop_windows</span>
              </span>
              <div>
                <p className="text-sm font-bold">Windows App</p>
                <p className="text-[11px] text-slate-500">
                  Windows 10 / 11 (64-bit){win?.version ? ` · v${win.version}` : ""}
                  {sizeLabel(win?.sizeBytes ?? null) ? ` · ${sizeLabel(win!.sizeBytes)}` : ""}
                </p>
              </div>
            </div>
            <ol className="mt-3 flex-1 list-decimal space-y-1 pl-4 text-xs text-slate-600 dark:text-slate-300">
              <li>नीचे <b>Download (.exe)</b> दबाएँ।</li>
              <li>फ़ाइल पर डबल-क्लिक करें — ऐप अपने आप इंस्टॉल होकर खुल जाएगा, डेस्कटॉप पर <b>Atomic Pathshala</b> आइकॉन बन जाएगा।</li>
              <li>अपनी आईडी/पासवर्ड से लॉगिन करें।</li>
              <li>
                “Windows protected your PC” दिखे तो <b>More info → Run anyway</b>। ब्राउज़र “uncommon download” बोले तो <b>Keep</b>।
              </li>
            </ol>
            <p className="mt-2 text-[11px] text-slate-500">नए वर्ज़न ऐप अपने आप ले लेता है।</p>
            {inWindowsApp ? (
              <p className="mt-3 rounded-xl bg-emerald-50 px-3 py-2 text-center text-xs font-bold text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">आप यही ऐप चला रहे हैं</p>
            ) : (
              <a
                href="/api/apps/download/windows"
                className="mt-3 flex items-center justify-center gap-2 rounded-xl bg-sky-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-sky-700"
              >
                <span className="material-symbols-outlined text-lg">download</span>
                Download (.exe)
              </a>
            )}
          </div>

          {/* Android */}
          <div className="flex flex-col rounded-2xl border border-slate-200 p-4 dark:border-slate-700">
            <div className="flex items-center gap-2.5">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600 dark:bg-emerald-950">
                <span className="material-symbols-outlined">android</span>
              </span>
              <div>
                <p className="text-sm font-bold">Android App</p>
                <p className="text-[11px] text-slate-500">
                  Android 7+{android?.version ? ` · v${android.version}` : ""}
                  {sizeLabel(android?.sizeBytes ?? null) ? ` · ${sizeLabel(android!.sizeBytes)}` : ""}
                </p>
              </div>
            </div>
            <ol className="mt-3 flex-1 list-decimal space-y-1 pl-4 text-xs text-slate-600 dark:text-slate-300">
              <li>मोबाइल में यही पेज खोलकर <b>Download (.apk)</b> दबाएँ।</li>
              <li>डाउनलोड हुई फ़ाइल खोलें। फ़ोन पूछे तो <b>Settings → Allow from this source</b> चालू करें।</li>
              <li><b>Install</b> दबाएँ, फिर ऐप खोलकर अपनी आईडी/पासवर्ड से लॉगिन करें।</li>
              <li>“Play Protect” पूछे तो <b>Install anyway</b> चुनें।</li>
            </ol>
            {android?.notes && <p className="mt-2 text-[11px] text-slate-500">{android.notes}</p>}
            {inAndroidApp ? (
              <p className="mt-3 rounded-xl bg-emerald-50 px-3 py-2 text-center text-xs font-bold text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">आप यही ऐप चला रहे हैं</p>
            ) : releases && !android ? (
              <p className="mt-3 rounded-xl bg-slate-100 px-3 py-2 text-center text-xs font-bold text-slate-500 dark:bg-slate-800">जल्द आ रहा है</p>
            ) : (
              <a
                href="/api/apps/download/android"
                className="mt-3 flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-emerald-700"
              >
                <span className="material-symbols-outlined text-lg">download</span>
                Download (.apk)
              </a>
            )}
          </div>
        </div>

        <p className="border-t border-slate-100 px-5 py-3 text-[11px] text-slate-500 dark:border-slate-800">
          ऐप हमेशा इसी बटन से डाउनलोड करें — WhatsApp पर भेजी गई फ़ाइल न खोलें।
        </p>
      </div>
    </div>
  );
}
