"use client";

import { useRef, useState } from "react";

type Totals = { cards: number; reminders: number; failed: number; skipped: number };

/**
 * Emails everyone in the tab their ID card (PDF attached) — or, without a
 * photo, the "photo missing, upload and re-download" note. Runs in batches
 * on the server; each person gets each email once, so pressing it again
 * only sends what is still due.
 */
export function SendIdCardsButton({ kind }: { kind: "STUDENT" | "TEAM" }) {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const stop = useRef(false);
  const label = kind === "TEAM" ? "team members" : "students";

  async function run() {
    setError(null);
    setMsg(null);
    try {
      const c = await fetch(`/api/team/id-cards/send?kind=${kind === "TEAM" ? "team" : "student"}`);
      const cj = await c.json().catch(() => null);
      if (!c.ok || !cj?.success) throw new Error(cj?.error ?? "Could not check who is due.");
      const { cards, reminders } = cj.data as { cards: number; reminders: number };
      if (cards + reminders === 0) {
        setMsg(`Everyone has already been emailed — nothing to send.`);
        return;
      }
      if (
        !window.confirm(
          `Email ID cards to ${label}?\n\n• ${cards} will get their ID card (PDF attached)\n• ${reminders} have no photo — they get "Your photo is missing, kindly upload your photo and re-download your ID card" with an upload link\n\nEach person is emailed only once.`
        )
      )
        return;

      setBusy(true);
      stop.current = false;
      const totals: Totals = { cards: 0, reminders: 0, failed: 0, skipped: 0 };
      const skip: string[] = [];
      for (let round = 0; round < 500 && !stop.current; round++) {
        const res = await fetch("/api/team/id-cards/send", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ kind, skip }),
        });
        const j = await res.json().catch(() => null);
        if (!res.ok || !j?.success) throw new Error(j?.error ?? "Sending stopped.");
        const r = j.data as { cards: number; reminders: number; failed: number; skipped: string[]; remaining: number };
        totals.cards += r.cards;
        totals.reminders += r.reminders;
        totals.failed += r.failed;
        totals.skipped += r.skipped.length;
        skip.push(...r.skipped);
        setMsg(`Sent ${totals.cards} cards · ${totals.reminders} photo reminders${totals.failed ? ` · ${totals.failed} failed` : ""} · ${r.remaining} left…`);
        if (r.remaining === 0) break;
        // Nothing went out in this round (e.g. mail provider refusing): stop instead of looping.
        if (r.cards + r.reminders === 0 && r.skipped.length === 0) break;
      }
      setMsg(
        `Done: ${totals.cards} ID cards and ${totals.reminders} photo reminders sent.` +
          (totals.failed ? ` ${totals.failed} failed (they will be retried by the daily job).` : "") +
          (totals.skipped ? ` ${totals.skipped} not sent yet — their card details are incomplete (see "Card data").` : "")
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Sending stopped.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col items-start gap-1">
      <div className="flex items-center gap-2">
        <button
          type="button"
          disabled={busy}
          onClick={run}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-bold bg-emerald-600 hover:bg-emerald-500 text-white disabled:opacity-60"
        >
          <span className={`material-symbols-outlined text-[18px] ${busy ? "animate-spin" : ""}`}>{busy ? "progress_activity" : "forward_to_inbox"}</span>
          {busy ? "Sending…" : `Email ID cards to all ${label}`}
        </button>
        {busy && (
          <button type="button" onClick={() => (stop.current = true)} className="px-2 py-1.5 rounded-lg text-xs font-bold border border-outline-variant">
            Stop
          </button>
        )}
      </div>
      {msg && <p className="text-xs text-on-surface-variant">{msg}</p>}
      {error && <p className="text-xs text-error font-semibold">{error}</p>}
    </div>
  );
}
