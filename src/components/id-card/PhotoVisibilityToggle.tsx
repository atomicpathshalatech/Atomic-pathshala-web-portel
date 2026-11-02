"use client";

import { useState } from "react";

/** Owner's choice: show my photo on the public QR verification page or not. */
export function PhotoVisibilityToggle({ kind, initial }: { kind: "STUDENT" | "TEAM"; initial: boolean }) {
  const [on, setOn] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function toggle() {
    const next = !on;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/id-card/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind, showPhotoPublicly: next }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.success) throw new Error(json?.error ?? "Could not save.");
      setOn(next);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <label className="flex items-start gap-3 cursor-pointer">
        <button
          type="button"
          role="switch"
          aria-checked={on}
          disabled={busy}
          onClick={toggle}
          className={`mt-0.5 relative w-10 h-6 rounded-full transition shrink-0 disabled:opacity-60 ${on ? "bg-[#1d4ed8]" : "bg-slate-300"}`}
        >
          <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-all ${on ? "left-[18px]" : "left-0.5"}`} />
        </button>
        <span className="text-sm text-on-surface">
          <span className="font-semibold">Show my photo on the verification page</span>
          <span className="block text-xs text-on-surface-variant mt-0.5">
            Anyone who scans your card&apos;s QR code sees whether the card is valid. Your date of birth, mobile number and email are never shown there.
          </span>
        </span>
      </label>
      {error && <p className="text-xs text-error mt-1">{error}</p>}
    </div>
  );
}
