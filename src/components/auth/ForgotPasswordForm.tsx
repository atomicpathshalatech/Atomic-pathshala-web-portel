"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";

type Step = "email" | "verify" | "reset" | "done";

/**
 * Locked "Email + DOB + Security Question" reset flow, 3 real steps against
 * 3 real API routes:
 *   1. POST /api/auth/forgot-password/question  {email} -> {securityQuestion}
 *   2. POST /api/auth/forgot-password/verify     {email, dob, securityAnswer} -> {token}
 *   3. POST /api/auth/forgot-password/reset      {token, newPassword} -> {ok}
 * No email/SMS delivery exists in this build (password-only auth, no SMS
 * OTP per locked policy) — step 2's token is handed straight back in the
 * response and used immediately for step 3, rather than emailed.
 */
export function ForgotPasswordForm() {
  const router = useRouter();
  const [step, setStep] = useState<Step>("email");
  const [submitting, setSubmitting] = useState(false);

  const [email, setEmail] = useState("");
  const [securityQuestion, setSecurityQuestion] = useState("");
  const [dob, setDob] = useState("");
  const [securityAnswer, setSecurityAnswer] = useState("");
  const [token, setToken] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function handleEmailSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch("/api/auth/forgot-password/question", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        setError(json.error ?? "Something went wrong. Please try again.");
        return;
      }
      setSecurityQuestion(json.data.securityQuestion);
      setStep("verify");
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleVerifySubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch("/api/auth/forgot-password/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, dob, securityAnswer }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        setError(json.error ?? "Those details don't match our records.");
        return;
      }
      setToken(json.data.token);
      setStep("reset");
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleResetSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (newPassword !== confirmPassword) {
      setError("Passwords don't match.");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/auth/forgot-password/reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, newPassword }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        setError(json.error ?? "Something went wrong. Please try again.");
        return;
      }
      toast.success("Password reset. Log in with your new password.");
      setStep("done");
      setTimeout(() => router.push("/login"), 1500);
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="w-full max-w-md glass-card rounded-2xl p-8 md:p-10 space-y-6">
      <div className="space-y-2 text-center">
        <h1 className="font-headline-lg text-headline-lg text-on-surface">Reset password</h1>
        <p className="font-body-md text-body-md text-on-surface-variant">
          {step === "email" && "Enter the email on your account."}
          {step === "verify" && "Answer your security question to verify it's you."}
          {step === "reset" && "Choose a new password."}
          {step === "done" && "All set."}
        </p>
      </div>

      {error && (
        <p className="text-label-sm font-label-sm text-error text-center bg-error/10 rounded-lg py-2 px-3">
          {error}
        </p>
      )}

      {step === "email" && (
        <form onSubmit={handleEmailSubmit} className="space-y-5" noValidate>
          <div className="space-y-1.5">
            <label htmlFor="email" className="font-label-md text-label-md text-on-surface">
              Email
            </label>
            <input
              id="email"
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-xl border border-outline-variant/40 bg-surface px-4 py-3 font-body-md text-body-md text-on-surface focus:outline-none focus:ring-2 focus:ring-primary"
              placeholder="you@example.com"
            />
          </div>
          <button
            type="submit"
            disabled={submitting}
            className="w-full bg-primary text-on-primary font-label-md text-label-md px-8 py-3.5 rounded-xl hover:opacity-90 active:scale-[0.99] transition-all disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {submitting ? "Checking..." : "Continue"}
          </button>
        </form>
      )}

      {step === "verify" && (
        <form onSubmit={handleVerifySubmit} className="space-y-5" noValidate>
          <div className="space-y-1.5">
            <label htmlFor="dob" className="font-label-md text-label-md text-on-surface">
              Date of birth
            </label>
            <input
              id="dob"
              type="date"
              required
              value={dob}
              onChange={(e) => setDob(e.target.value)}
              className="w-full rounded-xl border border-outline-variant/40 bg-surface px-4 py-3 font-body-md text-body-md text-on-surface focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
          <div className="space-y-1.5">
            <label htmlFor="securityAnswer" className="font-label-md text-label-md text-on-surface">
              {securityQuestion}
            </label>
            <input
              id="securityAnswer"
              type="text"
              required
              value={securityAnswer}
              onChange={(e) => setSecurityAnswer(e.target.value)}
              className="w-full rounded-xl border border-outline-variant/40 bg-surface px-4 py-3 font-body-md text-body-md text-on-surface focus:outline-none focus:ring-2 focus:ring-primary"
              placeholder="Your answer"
            />
          </div>
          <button
            type="submit"
            disabled={submitting}
            className="w-full bg-primary text-on-primary font-label-md text-label-md px-8 py-3.5 rounded-xl hover:opacity-90 active:scale-[0.99] transition-all disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {submitting ? "Verifying..." : "Verify"}
          </button>
        </form>
      )}

      {step === "reset" && (
        <form onSubmit={handleResetSubmit} className="space-y-5" noValidate>
          <div className="space-y-1.5">
            <label htmlFor="newPassword" className="font-label-md text-label-md text-on-surface">
              New password
            </label>
            <input
              id="newPassword"
              type="password"
              required
              autoComplete="new-password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="w-full rounded-xl border border-outline-variant/40 bg-surface px-4 py-3 font-body-md text-body-md text-on-surface focus:outline-none focus:ring-2 focus:ring-primary"
              placeholder="At least 8 characters, 1 uppercase, 1 number"
            />
          </div>
          <div className="space-y-1.5">
            <label htmlFor="confirmPassword" className="font-label-md text-label-md text-on-surface">
              Confirm new password
            </label>
            <input
              id="confirmPassword"
              type="password"
              required
              autoComplete="new-password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="w-full rounded-xl border border-outline-variant/40 bg-surface px-4 py-3 font-body-md text-body-md text-on-surface focus:outline-none focus:ring-2 focus:ring-primary"
              placeholder="••••••••"
            />
          </div>
          <button
            type="submit"
            disabled={submitting}
            className="w-full bg-primary text-on-primary font-label-md text-label-md px-8 py-3.5 rounded-xl hover:opacity-90 active:scale-[0.99] transition-all disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {submitting ? "Saving..." : "Reset Password"}
          </button>
        </form>
      )}

      {step === "done" && (
        <p className="text-center font-body-md text-body-md text-on-surface-variant">
          Redirecting you to login…
        </p>
      )}

      <p className="text-center font-label-sm text-label-sm text-on-surface-variant">
        Remembered it?{" "}
        <Link href="/login" className="text-primary font-bold hover:underline">
          Back to login
        </Link>
      </p>
    </div>
  );
}
