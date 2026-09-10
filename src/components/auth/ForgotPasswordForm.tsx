"use client";

import { useState } from "react";
import Link from "next/link";

/**
 * Email-link password reset. One field (mobile number or email) → we email
 * a single-use reset link to the account's registered address. The response
 * is always the same whether or not the account exists (no enumeration).
 */
export function ForgotPasswordForm() {
  const [identifier, setIdentifier] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (identifier.trim().length < 3) {
      setError("Enter your mobile number or email.");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ identifier: identifier.trim() }),
      });
      const json = await res.json();
      if (!res.ok || !json?.success) {
        setError(json?.error ?? "Something went wrong. Try again.");
        return;
      }
      setSent(true);
    } catch {
      setError("Something went wrong. Try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="w-full max-w-md glass-card rounded-2xl p-8 md:p-10 space-y-6">
      <div className="space-y-2 text-center flex flex-col items-center">
        <div className="w-14 h-14 rounded-2xl overflow-hidden p-1 bg-white border border-slate-200/80 shadow-sm flex items-center justify-center">
          <img src="/brand/logo.png" alt="Atomic Pathshala" className="w-full h-full object-contain" />
        </div>
        <h1 className="font-headline-lg text-headline-lg text-on-surface">Reset your password</h1>
        <p className="font-body-md text-body-md text-on-surface-variant">
          {sent
            ? "Check your email for the reset link."
            : "Enter your mobile number or email and we'll email you a reset link."}
        </p>
      </div>

      {sent ? (
        <div className="space-y-4 text-center">
          <div className="rounded-xl bg-emerald-50 border border-emerald-200 p-4 text-sm text-emerald-800">
            If an account exists for <b>{identifier.trim()}</b>, a password-reset link is on its way.
            The link expires in 60 minutes and can be used once.
          </div>
          <p className="text-xs text-on-surface-variant">
            Didn&apos;t get it? Check spam, or{" "}
            <button
              type="button"
              onClick={() => setSent(false)}
              className="font-semibold text-primary hover:underline"
            >
              try again
            </button>
            .
          </p>
          <Link href="/login" className="inline-block text-sm font-semibold text-primary hover:underline">
            Back to log in
          </Link>
        </div>
      ) : (
        <form onSubmit={onSubmit} className="space-y-5" noValidate>
          <div className="space-y-1.5">
            <label htmlFor="identifier" className="font-label-md text-label-md text-on-surface">
              Mobile number or email
            </label>
            <input
              id="identifier"
              type="text"
              autoComplete="username"
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              className="w-full rounded-xl border border-outline-variant/40 bg-surface px-4 py-3 font-body-md text-body-md text-on-surface focus:outline-none focus:ring-2 focus:ring-primary"
              placeholder="98XXXXXXXX or you@example.com"
            />
            {error && <p className="text-label-sm font-label-sm text-error">{error}</p>}
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="w-full bg-primary text-on-primary font-label-md text-label-md px-8 py-3.5 rounded-xl hover:opacity-90 active:scale-[0.99] transition-all disabled:opacity-60"
          >
            {submitting ? "Sending…" : "Send reset link"}
          </button>

          <p className="text-center font-label-sm text-label-sm text-on-surface-variant">
            Remembered it?{" "}
            <Link href="/login" className="text-primary font-bold hover:underline">
              Log in
            </Link>
          </p>
        </form>
      )}
    </div>
  );
}
