"use client";

import { useEffect, useState } from "react";
import { isNativeApp } from "@/lib/platform";

const KEY = "atomic_rate_prompt";
const DAY = 24 * 60 * 60 * 1000;

type State = { firstSeen: number; opens: number; snoozedUntil: number; done: boolean };

function load(): State {
  try {
    const s = JSON.parse(localStorage.getItem(KEY) || "null") as State | null;
    if (s && typeof s.firstSeen === "number") return s;
  } catch {
    // fresh
  }
  return { firstSeen: Date.now(), opens: 0, snoozedUntil: 0, done: false };
}
function save(s: State) {
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    // storage unavailable: the prompt just may come back
  }
}

/**
 * "Rate Atomic Pathshala": a small rating + feedback card in the Android app,
 * now and then — from the 3rd time the app is opened and a day after the
 * first use; "Later" asks again in a week; never again once sent. Saved as
 * student feedback (testimonial, reviewed by the team before it shows).
 */
export function RateAppPrompt() {
  const [open, setOpen] = useState(false);
  const [rating, setRating] = useState(0);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isNativeApp()) return;
    let counted = false;
    try {
      counted = sessionStorage.getItem(KEY) === "1";
      sessionStorage.setItem(KEY, "1");
    } catch {
      // count every load
    }
    const s = load();
    if (!counted) s.opens += 1;
    save(s);
    if (s.done || Date.now() < s.snoozedUntil) return;
    if (s.opens >= 3 && Date.now() - s.firstSeen > DAY) {
      const t = setTimeout(() => setOpen(true), 4000);
      return () => clearTimeout(t);
    }
  }, []);

  if (!open) return null;

  const later = () => {
    save({ ...load(), snoozedUntil: Date.now() + 7 * DAY });
    setOpen(false);
  };

  const send = async () => {
    if (!rating) {
      setError("Tap a star to rate.");
      return;
    }
    const quote = text.trim() || (rating >= 4 ? "Loving the Atomic Pathshala app!" : "");
    if (quote.length < 5) {
      setError("Tell us in a few words what we can improve.");
      return;
    }
    setSending(true);
    setError(null);
    try {
      const res = await fetch("/api/student/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ quote, rating }),
      });
      if (!res.ok) throw new Error();
      save({ ...load(), done: true });
      setSent(true);
      setTimeout(() => setOpen(false), 1800);
    } catch {
      setError("Could not send right now. Please try again.");
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[950] flex items-end justify-center bg-black/40 p-3 sm:items-center" role="dialog" aria-modal="true" aria-label="Rate the app">
      <div className="w-full max-w-sm space-y-3 rounded-2xl bg-white p-5 shadow-2xl">
        {sent ? (
          <p className="py-4 text-center text-sm font-bold text-emerald-700">Thank you for your feedback! 🙏</p>
        ) : (
          <>
            <div className="text-center">
              <p className="text-base font-black text-slate-900">Enjoying Atomic Pathshala?</p>
              <p className="text-xs text-slate-500">Rate the app and tell us what to make better.</p>
            </div>
            <div className="flex justify-center gap-1.5">
              {[1, 2, 3, 4, 5].map((n) => (
                <button key={n} type="button" onClick={() => setRating(n)} aria-label={`${n} star${n > 1 ? "s" : ""}`} className="p-0.5">
                  <span className={`material-symbols-outlined text-4xl ${n <= rating ? "text-amber-400" : "text-slate-300"}`} style={{ fontVariationSettings: `'FILL' ${n <= rating ? 1 : 0}` }}>
                    star
                  </span>
                </button>
              ))}
            </div>
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={3}
              maxLength={1000}
              placeholder={rating && rating < 4 ? "What should we improve?" : "Your feedback (optional)"}
              className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30"
            />
            {error && <p className="text-xs text-rose-600">{error}</p>}
            <div className="flex gap-2">
              <button type="button" onClick={later} className="flex-1 rounded-xl border border-slate-200 py-2.5 text-sm font-bold text-slate-600">
                Later
              </button>
              <button type="button" onClick={send} disabled={sending} className="flex-1 rounded-xl bg-blue-600 py-2.5 text-sm font-bold text-white disabled:opacity-60">
                {sending ? "Sending…" : "Send"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
