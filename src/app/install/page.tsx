"use client";

import { useEffect, useState } from "react";
import { isNativeApp } from "@/lib/platform";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

type Mode = "loading" | "installed" | "prompt" | "manual" | "native";

/**
 * A shareable "install Atomic Pathshala" page. Uses the browser's real install
 * prompt where available; otherwise shows the exact manual steps (spec
 * §18) — never a fake success.
 */
export default function InstallPage() {
  const [mode, setMode] = useState<Mode>("loading");
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [isIOS, setIsIOS] = useState(false);

  useEffect(() => {
    if (isNativeApp()) {
      setMode("native");
      return;
    }
    const standalone =
      window.matchMedia?.("(display-mode: standalone)").matches ||
      (window.navigator as unknown as { standalone?: boolean }).standalone === true;
    if (standalone) {
      setMode("installed");
      return;
    }
    setIsIOS(/iphone|ipad|ipod/i.test(navigator.userAgent));

    const onBip = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
      setMode("prompt");
    };
    window.addEventListener("beforeinstallprompt", onBip);
    const onInstalled = () => setMode("installed");
    window.addEventListener("appinstalled", onInstalled);

    // If the event never fires within a moment, fall back to manual steps.
    const t = setTimeout(() => {
      setMode((m) => (m === "loading" ? "manual" : m));
    }, 1500);

    return () => {
      window.removeEventListener("beforeinstallprompt", onBip);
      window.removeEventListener("appinstalled", onInstalled);
      clearTimeout(t);
    };
  }, []);

  async function doInstall() {
    if (!deferred) return;
    await deferred.prompt();
    const { outcome } = await deferred.userChoice;
    setDeferred(null);
    if (outcome === "accepted") setMode("installed");
    else setMode("manual");
  }

  return (
    <main className="mx-auto flex min-h-[100dvh] max-w-md flex-col items-center justify-center gap-5 p-6 text-center">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/icons/icon-192.png" alt="Atomic Pathshala" width={80} height={80} className="rounded-2xl shadow" />
      <div>
        <h1 className="text-xl font-black text-slate-900">Install Atomic Pathshala</h1>
        <p className="mt-1 text-sm text-slate-500">
          Add Atomic Pathshala to your home screen — faster access to classes, tests and doubts. No Play Store, no APK.
        </p>
      </div>

      {mode === "loading" && <p className="text-sm text-slate-400">Checking…</p>}

      {mode === "native" && (
        <p className="rounded-xl bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700">
          You&apos;re already in the Atomic Pathshala app.
        </p>
      )}

      {mode === "installed" && (
        <p className="rounded-xl bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700">
          Atomic Pathshala is installed. Open it from your home screen.
        </p>
      )}

      {mode === "prompt" && (
        <button
          type="button"
          onClick={doInstall}
          className="w-full rounded-xl bg-blue-600 py-3 text-sm font-bold text-white hover:bg-blue-700"
        >
          Install App
        </button>
      )}

      {mode === "manual" && (
        <div className="w-full rounded-xl border border-slate-200 bg-white p-4 text-left text-sm text-slate-600">
          <p className="font-bold text-slate-900">To install Atomic Pathshala:</p>
          {isIOS ? (
            <ol className="mt-2 list-decimal space-y-1 pl-5">
              <li>Open this page in Safari.</li>
              <li>
                Tap the <b>Share</b> button.
              </li>
              <li>
                Choose <b>Add to Home Screen</b>.
              </li>
            </ol>
          ) : (
            <ol className="mt-2 list-decimal space-y-1 pl-5">
              <li>Open the Chrome menu (⋮, top-right).</li>
              <li>
                Tap <b>Add to Home screen</b> / <b>Install app</b>.
              </li>
              <li>Confirm. Atomic Pathshala appears on your home screen.</li>
            </ol>
          )}
        </div>
      )}

      <a href="/dashboard" className="text-xs font-semibold text-blue-600">
        Continue in the browser
      </a>
    </main>
  );
}
