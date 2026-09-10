"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import { verifyWithMsg91Widget } from "@/lib/msg91-widget";

type Step = "phone" | "details" | "done";

/**
 * Student sign-up. Phone verification is handled by the MSG91 OTP Widget
 * (src/lib/msg91-widget.ts) — it renders its own send/enter/verify popup
 * and returns a signed access token, which /api/auth/otp/verify-widget
 * confirms with MSG91 and exchanges for the short-lived `verifyToken` that
 * /api/students/register expects. No OTP code is handled by this app.
 */
export function RegisterForm() {
  const router = useRouter();
  const [step, setStep] = useState<Step>("phone");
  const [phone, setPhone] = useState("");
  const [verifyToken, setVerifyToken] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const normalisedPhone = phone.replace(/\D/g, "").replace(/^0+/, "").replace(/^91(?=\d{10}$)/, "");
  const phoneValid = /^[6-9]\d{9}$/.test(normalisedPhone);

  async function verifyPhone() {
    setError(null);
    if (!phoneValid) return setError("Enter a valid 10-digit Indian mobile number.");
    setBusy(true);
    try {
      // 1. Widget popup — MSG91 sends + verifies the OTP, returns a token.
      const accessToken = await verifyWithMsg91Widget(`91${normalisedPhone}`);

      // 2. Confirm that token server-side, get our register token.
      const res = await fetch("/api/auth/otp/verify-widget", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: normalisedPhone, accessToken, purpose: "STUDENT_SIGNUP" }),
      });
      const json = await res.json();
      if (json?.data?.existingAccount) {
        setError("An account already exists for this number. Please sign in instead.");
        return;
      }
      if (!res.ok || !json.success) throw new Error(json.error ?? "Verification failed. Please retry.");
      setVerifyToken(json.data.verifyToken);
      setStep("details");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Verification failed. Please retry.");
    } finally {
      setBusy(false);
    }
  }

  async function createAccount() {
    setError(null);
    if (name.trim().length < 2) return setError("Enter your full name.");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return setError("Enter a valid email.");
    if (password.length < 8 || !/[A-Z]/.test(password) || !/[0-9]/.test(password))
      return setError("Password needs 8+ characters, one uppercase letter and one number.");
    if (password !== confirm) return setError("Passwords do not match.");
    setBusy(true);
    try {
      const res = await fetch("/api/students/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: normalisedPhone, verifyToken, name: name.trim(), email: email.trim(), password }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error ?? "Could not create your account.");
      setStep("done");
      const r = await signIn("credentials", { email: email.trim(), password, redirect: false });
      if (r?.ok) router.push("/dashboard");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not create your account.");
    } finally {
      setBusy(false);
    }
  }

  const card = "w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-6 sm:p-8 shadow-sm";
  const input =
    "w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500";

  return (
    <div className={card}>
      <div className="mb-5 text-center">
        <h1 className="text-xl font-black text-slate-900">Create your student account</h1>
        <p className="mt-1 text-xs text-slate-500">
          {step === "phone" && "Verify your mobile number to begin."}
          {step === "details" && "Just a few details and you're in."}
          {step === "done" && "All set!"}
        </p>
      </div>

      {step === "phone" && (
        <div className="space-y-3">
          <label className="block">
            <span className="text-xs font-bold text-slate-500">Mobile number</span>
            <div className="mt-1 flex items-center gap-2">
              <span className="rounded-lg bg-slate-100 px-2.5 py-2.5 text-sm font-semibold text-slate-500">+91</span>
              <input
                inputMode="numeric"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="10-digit number"
                className={input}
              />
            </div>
          </label>
          <button
            type="button"
            onClick={verifyPhone}
            disabled={busy || !phoneValid}
            className="w-full rounded-xl bg-blue-600 py-2.5 text-sm font-bold text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {busy ? "Verifying…" : "Verify with OTP"}
          </button>
          <p className="text-center text-[11px] text-slate-400">
            You&apos;ll get a one-time code on this number.
          </p>
        </div>
      )}

      {step === "details" && (
        <div className="space-y-3">
          <div className="rounded-lg bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-700">
            +91 {normalisedPhone} verified ✓
          </div>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Full name" className={input} />
          <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email" type="email" className={input} />
          <input
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Create a password"
            type="password"
            className={input}
          />
          <input
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            placeholder="Confirm password"
            type="password"
            className={input}
          />
          <button
            type="button"
            onClick={createAccount}
            disabled={busy}
            className="w-full rounded-xl bg-blue-600 py-2.5 text-sm font-bold text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {busy ? "Creating…" : "Create account"}
          </button>
        </div>
      )}

      {step === "done" && (
        <div className="text-center space-y-3">
          <span className="material-symbols-outlined text-4xl text-emerald-500">task_alt</span>
          <p className="text-sm text-slate-600">Account created. Taking you to your dashboard…</p>
          <Link href="/login" className="text-xs font-semibold text-blue-600">
            Or sign in
          </Link>
        </div>
      )}

      {error && <p className="mt-3 text-xs font-semibold text-red-600">{error}</p>}

      {step !== "done" && (
        <p className="mt-5 text-center text-xs text-slate-500">
          Already have an account?{" "}
          <Link href="/login" className="font-semibold text-blue-600">
            Sign in
          </Link>
        </p>
      )}
    </div>
  );
}
