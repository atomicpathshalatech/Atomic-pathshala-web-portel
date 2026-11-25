"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  getIOSBrowserContext,
  isIOSDevice,
  isIPad,
  isNativeApp,
  isStandalonePwa,
} from "@/lib/platform";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

type PlatformTab = "ios" | "android" | "desktop";
type InstallState = "checking" | "installed" | "native" | "prompt-ready" | "manual";

function IOSShareIcon({ className = "w-5 h-5" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M12 3v12" />
      <path d="m8 7 4-4 4 4" />
      <path d="M4 12v7a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-7" />
    </svg>
  );
}

function IOSAddBoxIcon({ className = "w-5 h-5" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <rect x="3" y="3" width="18" height="18" rx="4" />
      <path d="M12 8v8" />
      <path d="M8 12h8" />
    </svg>
  );
}

const IOS_STEPS = [
  {
    step: 1,
    title: "Open Atomic Pathshala in Safari",
    detail: "Use Apple Safari on your iPhone or iPad. In-app browsers (WhatsApp, Instagram) do not show the Home Screen option.",
    badge: "Safari",
  },
  {
    step: 2,
    title: "Tap the Share button",
    detail: "Tap the Share icon (square with an upward arrow) in Safari's bottom bar (top-right on iPad).",
    icon: "share" as const,
  },
  {
    step: 3,
    title: 'Select "Add to Home Screen"',
    detail: 'Scroll down the Share sheet and tap "Add to Home Screen" with the plus icon.',
    icon: "add" as const,
  },
  {
    step: 4,
    title: 'Tap "Add"',
    detail: 'Confirm the name "Atomic Pathshala" and tap Add in the top-right corner.',
    badge: "Add",
  },
  {
    step: 5,
    title: "Launch from your Home Screen",
    detail: "Open Atomic Pathshala from your Home Screen for a full-screen, app-like experience with push notifications.",
    icon: "app" as const,
  },
];

const BENEFITS = [
  {
    icon: "fullscreen",
    title: "Full-Screen Focus",
    desc: "Opens without Safari bars — distraction-free lectures, tests and notes.",
  },
  {
    icon: "bolt",
    title: "Instant Launch",
    desc: "One tap from your iPhone Home Screen, straight to your study dashboard.",
  },
  {
    icon: "notifications_active",
    title: "Class & Test Alerts",
    desc: "Supports iOS Home Screen push notifications (iOS 16.4+) for live classes & DPPs.",
  },
  {
    icon: "sync",
    title: "Always Up to Date",
    desc: "Updates automatically in the background without interrupting an active test or class.",
  },
];

const FAQS = [
  {
    q: 'I cannot find "Add to Home Screen" on my iPhone',
    a: "Make sure you opened this page in Apple Safari, not inside WhatsApp, Instagram, Telegram, or Chrome. Tap the Safari/compass icon or copy the link and paste it into Safari.",
  },
  {
    q: "Will my courses, progress and login stay synced?",
    a: "Yes. Atomic Pathshala uses your existing student account. Your batches, watch history, DPPs, tests, and Atomic Guru chats sync automatically.",
  },
  {
    q: "How do I receive live class notifications on iPhone?",
    a: "After adding Atomic Pathshala to your Home Screen (iOS 16.4 or newer), open the app from the Home Screen and tap Turn On when prompted for notifications.",
  },
  {
    q: "How do app updates work?",
    a: "New features and fixes are delivered automatically. Updates never force-reload while you are taking a test or attending a live class.",
  },
];

export default function InstallPage() {
  const [installState, setInstallState] = useState<InstallState>("checking");
  const [tab, setTab] = useState<PlatformTab>("ios");
  const [iosContext, setIosContext] = useState<"safari" | "in-app" | "other-browser" | "non-ios">("non-ios");
  const [ipad, setIpad] = useState(false);
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [copied, setCopied] = useState(false);
  const [openFaq, setOpenFaq] = useState<number | null>(0);

  useEffect(() => {
    if (isNativeApp()) {
      setInstallState("native");
      setTab("android");
      return;
    }

    if (isStandalonePwa()) {
      setInstallState("installed");
      setTab(isIOSDevice() ? "ios" : "android");
      return;
    }

    const ios = isIOSDevice();
    setIpad(isIPad());
    setIosContext(getIOSBrowserContext());

    if (ios) {
      setTab("ios");
      setInstallState("manual");
      return;
    }

    const isAndroidUa = /android/i.test(navigator.userAgent || "");
    setTab(isAndroidUa ? "android" : "desktop");

    const onBip = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
      setInstallState("prompt-ready");
    };
    const onInstalled = () => {
      setDeferred(null);
      setInstallState("installed");
    };

    window.addEventListener("beforeinstallprompt", onBip);
    window.addEventListener("appinstalled", onInstalled);

    const timer = setTimeout(() => {
      setInstallState((prev) => (prev === "checking" ? "manual" : prev));
    }, 1200);

    return () => {
      window.removeEventListener("beforeinstallprompt", onBip);
      window.removeEventListener("appinstalled", onInstalled);
      clearTimeout(timer);
    };
  }, []);

  async function handleBrowserInstall() {
    if (!deferred) return;
    await deferred.prompt();
    const { outcome } = await deferred.userChoice;
    setDeferred(null);
    setInstallState(outcome === "accepted" ? "installed" : "manual");
  }

  async function copyCurrentUrl() {
    try {
      const url = `${window.location.origin}/install`;
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      setCopied(false);
    }
  }

  const deviceLabel = ipad ? "iPad" : "iPhone";

  return (
    <div className="min-h-screen-safe bg-slate-50 text-slate-900 pt-[env(safe-area-inset-top)] pb-[calc(2.5rem+env(safe-area-inset-bottom))]">
      {/* Top Bar */}
      <header className="sticky top-0 z-20 border-b border-slate-200/80 bg-white/90 backdrop-blur-xl">
        <div className="mx-auto flex h-14 max-w-3xl items-center justify-between px-4">
          <Link href="/" className="flex items-center gap-2.5 min-h-[44px]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/icons/apple-touch-icon.png"
              alt="Atomic Pathshala"
              width={34}
              height={34}
              className="rounded-xl border border-slate-200/80"
            />
            <div className="leading-tight">
              <span className="block text-sm font-extrabold tracking-tight text-slate-900">
                Atomic Pathshala
              </span>
              <span className="block text-[10px] font-semibold tracking-wide text-slate-500">
                Learn • Explore • Excel
              </span>
            </div>
          </Link>

          <Link
            href="/dashboard"
            className="inline-flex min-h-[40px] items-center gap-1 rounded-xl bg-primary px-3.5 text-xs font-bold text-white shadow-xs transition hover:bg-primary/90 active:scale-[0.98]"
          >
            <span>Open App</span>
            <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-3xl space-y-6 px-4 pt-6">
        {/* Hero Card */}
        <section className="rounded-3xl border border-slate-200/80 bg-white p-5 sm:p-7 shadow-xs">
          <div className="flex flex-col items-center text-center sm:flex-row sm:items-start sm:text-left sm:gap-5">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/icons/apple-touch-icon.png"
              alt="Atomic Pathshala App Icon"
              width={76}
              height={76}
              className="shrink-0 rounded-[20px] border border-slate-200/90 shadow-sm"
            />
            <div className="mt-3 sm:mt-0 flex-1">
              <div className="inline-flex items-center gap-1.5 rounded-full bg-blue-50 px-2.5 py-0.5 text-[11px] font-bold text-primary">
                <span className="material-symbols-outlined text-[14px]">verified</span>
                Official Student App
              </div>
              <h1 className="mt-2 text-2xl font-extrabold tracking-tight text-slate-900 sm:text-3xl">
                Install Atomic Pathshala
              </h1>
              <p className="mt-1.5 text-sm text-slate-600 leading-relaxed">
                Get the full-screen iPhone &amp; mobile app experience for live classes, recorded lectures, DPPs, tests, PYQs, and Atomic Guru AI.
              </p>
            </div>
          </div>

          {/* Live Status Banner */}
          {(installState === "installed" || installState === "native") && (
            <div className="mt-5 flex flex-col gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-2.5">
                <span className="material-symbols-outlined text-emerald-600">check_circle</span>
                <div>
                  <p className="text-sm font-bold text-emerald-900">
                    {installState === "native"
                      ? "You are using the Atomic Pathshala app"
                      : "Atomic Pathshala is installed"}
                  </p>
                  <p className="text-xs text-emerald-700">
                    Launch your dashboard to continue learning.
                  </p>
                </div>
              </div>
              <Link
                href="/dashboard"
                className="inline-flex min-h-[44px] items-center justify-center gap-1.5 rounded-xl bg-emerald-600 px-5 text-sm font-bold text-white transition hover:bg-emerald-700 active:scale-[0.98]"
              >
                Open Dashboard
                <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
              </Link>
            </div>
          )}

          {/* Real Browser Install Button (Android/Desktop Chrome/Edge only — never faked on iOS) */}
          {installState === "prompt-ready" && deferred && (
            <div className="mt-5 flex flex-col gap-2 sm:flex-row">
              <button
                type="button"
                onClick={handleBrowserInstall}
                className="flex min-h-[48px] flex-1 items-center justify-center gap-2 rounded-2xl bg-primary px-5 text-sm font-bold text-white shadow-sm transition hover:bg-primary/95 active:scale-[0.98]"
              >
                <span className="material-symbols-outlined text-[20px]">install_mobile</span>
                Install Atomic Pathshala App
              </button>
            </div>
          )}

          {/* iOS In-App Browser Warning (WhatsApp / Instagram / Chrome on iOS) */}
          {tab === "ios" && (iosContext === "in-app" || iosContext === "other-browser") && installState !== "installed" && (
            <div className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 p-4">
              <div className="flex items-start gap-2.5">
                <span className="material-symbols-outlined text-amber-600 shrink-0 mt-0.5">warning</span>
                <div className="flex-1 text-left">
                  <p className="text-sm font-bold text-amber-950">
                    {iosContext === "in-app"
                      ? "Open in Safari to install on your " + deviceLabel
                      : "Switch to Safari to install on your " + deviceLabel}
                  </p>
                  <p className="mt-1 text-xs text-amber-800 leading-relaxed">
                    {iosContext === "in-app"
                      ? "You opened this link inside an app (like WhatsApp or Instagram). Tap the Safari / Compass icon in the corner, or copy the link below and open it in Safari."
                      : "Apple only allows Home Screen app installation from Safari. Copy this link and open it in Safari."}
                  </p>
                  <button
                    type="button"
                    onClick={copyCurrentUrl}
                    className="mt-3 inline-flex min-h-[40px] items-center gap-1.5 rounded-xl bg-amber-600 px-4 text-xs font-bold text-white transition hover:bg-amber-700 active:scale-[0.98]"
                  >
                    <span className="material-symbols-outlined text-[16px]">
                      {copied ? "check" : "content_copy"}
                    </span>
                    {copied ? "Link Copied — Open in Safari" : "Copy Install Link"}
                  </button>
                </div>
              </div>
            </div>
          )}
        </section>

        {/* Platform Selector Tabs */}
        <section className="rounded-3xl border border-slate-200/80 bg-white p-5 sm:p-6 shadow-xs">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <h2 className="text-lg font-extrabold text-slate-900">
              How to Install
            </h2>
            <div
              role="tablist"
              aria-label="Choose your device"
              className="inline-flex rounded-xl bg-slate-100 p-1"
            >
              {(
                [
                  { id: "ios", label: "iPhone / iPad" },
                  { id: "android", label: "Android" },
                  { id: "desktop", label: "Desktop" },
                ] as const
              ).map((t) => (
                <button
                  key={t.id}
                  type="button"
                  role="tab"
                  aria-selected={tab === t.id}
                  onClick={() => setTab(t.id)}
                  className={`min-h-[36px] rounded-lg px-3.5 text-xs font-bold transition ${
                    tab === t.id
                      ? "bg-white text-primary shadow-xs"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          {tab === "ios" && (
            <div className="mt-5 space-y-3">
              <div className="flex items-center justify-between rounded-2xl bg-slate-50 px-4 py-3 border border-slate-200/70">
                <span className="text-xs font-semibold text-slate-600">
                  Works on iPhone &amp; iPad • No App Store needed
                </span>
                <span className="text-[11px] font-bold text-primary">iOS Safari</span>
              </div>

              <ol className="space-y-2.5">
                {IOS_STEPS.map((s) => (
                  <li
                    key={s.step}
                    className="flex items-start gap-3.5 rounded-2xl border border-slate-200/70 bg-white p-3.5"
                  >
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-extrabold text-white">
                      {s.step}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-bold text-slate-900">{s.title}</p>
                      <p className="mt-0.5 text-xs text-slate-600 leading-relaxed">
                        {s.detail}
                      </p>
                    </div>
                    <div className="shrink-0 self-center">
                      {s.icon === "share" && (
                        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-primary">
                          <IOSShareIcon className="w-5 h-5" />
                        </span>
                      )}
                      {s.icon === "add" && (
                        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 text-slate-700">
                          <IOSAddBoxIcon className="w-5 h-5" />
                        </span>
                      )}
                      {s.icon === "app" && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src="/icons/apple-touch-icon.png"
                          alt=""
                          width={40}
                          height={40}
                          className="rounded-xl border border-slate-200"
                        />
                      )}
                      {s.badge && (
                        <span className="inline-flex h-8 items-center rounded-lg bg-blue-50 px-2.5 text-xs font-bold text-primary">
                          {s.badge}
                        </span>
                      )}
                    </div>
                  </li>
                ))}
              </ol>
            </div>
          )}

          {tab === "android" && (
            <div className="mt-5 space-y-4">
              <ol className="space-y-2.5">
                <li className="flex items-start gap-3.5 rounded-2xl border border-slate-200/70 p-3.5">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-extrabold text-white">1</span>
                  <div>
                    <p className="text-sm font-bold text-slate-900">Open in Google Chrome</p>
                    <p className="mt-0.5 text-xs text-slate-600">Visit <span className="font-semibold">ap.atomicpathshala.in/install</span> in Chrome on Android.</p>
                  </div>
                </li>
                <li className="flex items-start gap-3.5 rounded-2xl border border-slate-200/70 p-3.5">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-extrabold text-white">2</span>
                  <div>
                    <p className="text-sm font-bold text-slate-900">Tap &ldquo;Install App&rdquo; or Chrome Menu (⋮)</p>
                    <p className="mt-0.5 text-xs text-slate-600">Tap the Install button above when available, or open ⋮ → <b>Add to Home screen</b> / <b>Install app</b>.</p>
                  </div>
                </li>
                <li className="flex items-start gap-3.5 rounded-2xl border border-slate-200/70 p-3.5">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-extrabold text-white">3</span>
                  <div>
                    <p className="text-sm font-bold text-slate-900">Or download the Android APK</p>
                    <p className="mt-0.5 text-xs text-slate-600">Prefer the native Android package? Download directly below.</p>
                  </div>
                </li>
              </ol>
              <a
                href="/api/apps/download/android"
                className="inline-flex min-h-[44px] w-full items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm font-bold text-slate-800 transition hover:bg-slate-100"
              >
                <span className="material-symbols-outlined text-[18px]">android</span>
                Download Android APK
              </a>
            </div>
          )}

          {tab === "desktop" && (
            <div className="mt-5 space-y-4">
              <ol className="space-y-2.5">
                <li className="flex items-start gap-3.5 rounded-2xl border border-slate-200/70 p-3.5">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-extrabold text-white">1</span>
                  <div>
                    <p className="text-sm font-bold text-slate-900">Install in Chrome or Edge</p>
                    <p className="mt-0.5 text-xs text-slate-600">Click the install icon in the address bar (top-right) and choose <b>Install</b>.</p>
                  </div>
                </li>
                <li className="flex items-start gap-3.5 rounded-2xl border border-slate-200/70 p-3.5">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-extrabold text-white">2</span>
                  <div>
                    <p className="text-sm font-bold text-slate-900">Windows Desktop App</p>
                    <p className="mt-0.5 text-xs text-slate-600">Or download the dedicated Windows 10/11 installer.</p>
                  </div>
                </li>
              </ol>
              <a
                href="/api/apps/download/windows"
                className="inline-flex min-h-[44px] w-full items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm font-bold text-slate-800 transition hover:bg-slate-100"
              >
                <span className="material-symbols-outlined text-[18px]">desktop_windows</span>
                Download Windows Installer (.exe)
              </a>
            </div>
          )}
        </section>

        {/* Benefits Grid */}
        <section className="grid gap-3 sm:grid-cols-2">
          {BENEFITS.map((b) => (
            <div
              key={b.title}
              className="flex items-start gap-3 rounded-2xl border border-slate-200/80 bg-white p-4"
            >
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-primary">
                <span className="material-symbols-outlined text-[20px]">{b.icon}</span>
              </span>
              <div>
                <h3 className="text-sm font-bold text-slate-900">{b.title}</h3>
                <p className="mt-0.5 text-xs text-slate-600 leading-relaxed">{b.desc}</p>
              </div>
            </div>
          ))}
        </section>

        {/* Troubleshooting & FAQ */}
        <section className="rounded-3xl border border-slate-200/80 bg-white p-5 sm:p-6 shadow-xs">
          <h2 className="text-lg font-extrabold text-slate-900">Troubleshooting &amp; FAQ</h2>
          <div className="mt-3 divide-y divide-slate-100">
            {FAQS.map((f, idx) => {
              const isOpen = openFaq === idx;
              return (
                <div key={f.q} className="py-2.5">
                  <button
                    type="button"
                    onClick={() => setOpenFaq(isOpen ? null : idx)}
                    aria-expanded={isOpen}
                    className="flex min-h-[44px] w-full items-center justify-between gap-3 text-left text-sm font-bold text-slate-900"
                  >
                    <span>{f.q}</span>
                    <span className="material-symbols-outlined text-[20px] text-slate-400">
                      {isOpen ? "expand_less" : "expand_more"}
                    </span>
                  </button>
                  {isOpen && (
                    <p className="pb-2 text-xs text-slate-600 leading-relaxed">{f.a}</p>
                  )}
                </div>
              );
            })}
          </div>
        </section>

        {/* Footer Info */}
        <footer className="flex flex-col items-center justify-between gap-2 px-2 text-center text-xs text-slate-500 sm:flex-row sm:text-left">
          <span>Atomic Pathshala • App Shell v1.2.0 • Auto-updating</span>
          <div className="flex items-center gap-4">
            <Link href="/login" className="font-semibold text-primary hover:underline">
              Student Login
            </Link>
            <Link href="/dashboard" className="font-semibold text-slate-700 hover:underline">
              Continue in Browser
            </Link>
          </div>
        </footer>
      </main>
    </div>
  );
}
