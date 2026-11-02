"use client";

import { useRef, useState } from "react";

type Totals = { cards: number; reminders: number; failed: number; skipped: number };

/**
 * Sends everyone in the tab their ID card by email or WhatsApp (PDF attached)
 * — or, without a photo, the "photo missing, upload and re-download" note.
 * Runs in batches on the server; each person gets each message once per
 * channel, so pressing it again only sends what is still due.
 */
export function SendIdCardsButton({ kind, channel = "email" }: { kind: "STUDENT" | "TEAM"; channel?: "email" | "whatsapp" }) {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const stop = useRef(false);
  const label = kind === "TEAM" ? "team members" : "students";
  const wa = channel === "whatsapp";
  const via = wa ? "WhatsApp" : "email";

  async function run() {
    setError(null);
    setMsg(null);
    try {
      const c = await fetch(`/api/team/id-cards/send?kind=${kind === "TEAM" ? "team" : "student"}&channel=${channel}`);
      const cj = await c.json().catch(() => null);
      if (!c.ok || !cj?.success) throw new Error(cj?.error ?? "Could not check who is due.");
      const { cards, reminders, templatesReady } = cj.data as { cards: number; reminders: number; templatesReady: boolean };
      if (cards + reminders === 0) {
        setMsg(`Everyone${wa ? " with a mobile number" : ""} has already been sent their card on ${via} — nothing to send.`);
        return;
      }
      const note =
        wa && !templatesReady
          ? `\n\nNote: no approved WhatsApp template is set up, so WhatsApp only delivers to people who messaged Atomic Pathshala in the last 24 hours — others will show as failed.`
          : "";
      if (
        !window.confirm(
          `Send ID cards to ${label} on ${via}?\n\n• ${cards} will get their ID card (PDF attached)\n• ${reminders} have no photo — they get "Your photo is missing, kindly upload your photo and re-download your ID card" with an upload link\n\nEach person gets it only once.${note}`
        )
      )
        return;

      setBusy(true);
      stop.current = false;
      const totals: Totals = { cards: 0, reminders: 0, failed: 0, skipped: 0 };
      const skip: string[] = [];
      let lastError = "";
      for (let round = 0; round < 500 && !stop.current; round++) {
        const res = await fetch("/api/team/id-cards/send", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ kind, channel, skip }),
        });
        const j = await res.json().catch(() => null);
        if (!res.ok || !j?.success) throw new Error(j?.error ?? "Sending stopped.");
        const r = j.data as { cards: number; reminders: number; failed: number; skipped: string[]; remaining: number; lastError?: string };
        if (r.lastError) lastError = r.lastError;
        totals.cards += r.cards;
        totals.reminders += r.reminders;
        totals.failed += r.failed;
        totals.skipped += r.skipped.length;
        skip.push(...r.skipped);
        setMsg(`Sent ${totals.cards} cards · ${totals.reminders} photo reminders${totals.failed ? ` · ${totals.failed} failed` : ""} · ${r.remaining} left…`);
        if (r.remaining === 0) break;
        // Nothing went out in this round (e.g. the provider refusing): stop instead of looping.
        if (r.cards + r.reminders === 0 && r.skipped.length === 0) break;
      }
      setMsg(
        `Done on ${via}: ${totals.cards} ID cards and ${totals.reminders} photo reminders sent.` +
          (totals.failed ? ` ${totals.failed} failed${lastError ? ` (${lastError})` : ""} — press again later to retry them.` : "") +
          (totals.skipped ? ` ${totals.skipped} not sent yet — their card details are incomplete (see "Card data").` : "")
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Sending stopped.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col items-start gap-1 max-w-md">
      <div className="flex items-center gap-2">
        <button
          type="button"
          disabled={busy}
          onClick={run}
          className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-bold text-white disabled:opacity-60 ${
            wa ? "bg-[#1fa855] hover:bg-[#178c46]" : "bg-[#0f3a9e] hover:bg-[#0a2463]"
          }`}
        >
          <span className={`material-symbols-outlined text-[18px] ${busy ? "animate-spin" : ""}`}>
            {busy ? "progress_activity" : wa ? "chat" : "forward_to_inbox"}
          </span>
          {busy ? "Sending…" : wa ? `Send on WhatsApp to all ${label}` : `Email ID cards to all ${label}`}
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
