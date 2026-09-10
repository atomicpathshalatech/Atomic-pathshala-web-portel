"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";

/**
 * Step 2 of the email-link reset: the user landed here from the emailed
 * /reset-password?token=… link and chooses a new password.
 */
export function ResetPasswordForm() {
  const router = useRouter();
  const token = useSearchParams().get("token") ?? "";

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [show, setShow] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const tokenMissing = token.trim().length < 20;

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (password.length < 8 || !/[A-Z]/.test(password) || !/[0-9]/.test(password)) {
      setError("Password needs 8+ characters, one uppercase letter and one number.");
      return;
    }
    if (password !== confirm) {
      setError("Passwords do not match.");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: token.trim(), newPassword: password }),
      });
      const json = await res.json();
      if (!res.ok || !json?.success) {
        setError(json?.error ?? "Could not reset your password.");
        return;
      }
      setDone(true);
      setTimeout(() => router.push("/login"), 2000);
    } catch {
      setError("Could not reset your password.");
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
        <h1 className="font-headline-lg text-headline-lg text-on-surface">Choose a new password</h1>
      </div>

      {tokenMissing ? (
        <div className="space-y-4 text-center">
          <div className="rounded-xl bg-red-50 border border-red-200 p-4 text-sm text-red-700">
            This reset link is missing or malformed. Request a new one.
          </div>
          <Link href="/forgot-password" className="inline-block text-sm font-semibold text-primary hover:underline">
            Send a new reset link
          </Link>
        </div>
      ) : done ? (
        <div className="space-y-3 text-center">
          <div className="rounded-xl bg-emerald-50 border border-emerald-200 p-4 text-sm text-emerald-800">
            Password updated. Taking you to log in…
          </div>
          <Link href="/login" className="inline-block text-sm font-semibold text-primary hover:underline">
            Log in now
          </Link>
        </div>
      ) : (
        <form onSubmit={onSubmit} className="space-y-5" noValidate>
          <div className="space-y-1.5">
            <label htmlFor="password" className="font-label-md text-label-md text-on-surface">
              New password
            </label>
            <div className="relative">
              <input
                id="password"
                type={show ? "text" : "password"}
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-xl border border-outline-variant/40 bg-surface px-4 py-3 pr-12 font-body-md text-body-md text-on-surface focus:outline-none focus:ring-2 focus:ring-primary"
                placeholder="••••••••"
              />
              <button
                type="button"
                onClick={() => setShow((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-on-surface-variant hover:text-primary text-label-sm"
                tabIndex={-1}
              >
                {show ? "Hide" : "Show"}
              </button>
            </div>
          </div>

          <div className="space-y-1.5">
            <label htmlFor="confirm" className="font-label-md text-label-md text-on-surface">
              Confirm new password
            </label>
            <input
              id="confirm"
              type={show ? "text" : "password"}
              autoComplete="new-password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              className="w-full rounded-xl border border-outline-variant/40 bg-surface px-4 py-3 font-body-md text-body-md text-on-surface focus:outline-none focus:ring-2 focus:ring-primary"
              placeholder="••••••••"
            />
          </div>

          {error && <p className="text-label-sm font-label-sm text-error">{error}</p>}

          <button
            type="submit"
            disabled={submitting}
            className="w-full bg-primary text-on-primary font-label-md text-label-md px-8 py-3.5 rounded-xl hover:opacity-90 active:scale-[0.99] transition-all disabled:opacity-60"
          >
            {submitting ? "Updating…" : "Update password"}
          </button>
        </form>
      )}
    </div>
  );
}
