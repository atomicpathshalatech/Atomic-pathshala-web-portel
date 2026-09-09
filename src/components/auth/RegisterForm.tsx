"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";

type Step = "phone" | "otp" | "details" | "done";

const RESEND_SECONDS = 45;

export function RegisterForm() {
  const router = useRouter();
  const [step, setStep] = useState<Step>("phone");
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [verifyToken, setVerifyToken] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState(0);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (cooldown <= 0) return;
    timer.current = setInterval(() => setCooldown((c) => Math.max(0, c - 1)), 1000);
    return () => {
      if (timer.current) clearInterval(timer.current);
    };
  }, [cooldown]);

  const normalisedPhone = phone.replace(/\D/g, "").replace(/^91(?=\d{10}$)/, "");
  const phoneValid = /^[6-9]\d{9}$/.test(normalisedPhone);

  async function sendOtp() {
    setError(null);
    setInfo(null);
    if (!phoneValid) return setError("Enter a valid 10-digit Indian mobile number.");
    setBusy(true);
    try {
      const res = await fetch("/api/auth/otp/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: normalisedPhone, purpose: "STUDENT_SIGNUP" }),
      });
      const json = await res.json();
      if (json?.data?.existingAccount) {
        setError("An account already exists for this number. Please sign in instead.");
        return;
      }
      if (!res.ok || !json.success) throw new Error(json.error ?? "Could not send the code.");
      setStep("otp");
      setCooldown(RESEND_SECONDS);
      setInfo(
        json.data.delivered
          ? "We sent a 6-digit code to your phone."
          : json.data.debugCode
          ? `Dev mode — your code is ${json.data.debugCode}`
          : "Code created. (SMS delivery isn't configured on this environment.)"
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not send the code.");
    } finally {
      setBusy(false);
    }
  }

  async function verifyOtp() {
    setError(null);
    if (!/^\d{4,8}$/.test(otp)) return setError("Enter the code you received.");
    setBusy(true);
    try {
      const res = await fetch("/api/auth/otp/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: normalisedPhone, purpose: "STUDENT_SIGNUP", code: otp }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error ?? "Verification failed.");
      setVerifyToken(json.data.verifyToken);
      setStep("details");
      setInfo(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Verification failed.");
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
      // Auto sign-in, then send them into the app.
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
          {step === "phone" && "Start with your mobile number."}
          {step === "otp" && `Enter the code sent to +91 ${normalisedPhone}.`}
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
            onClick={sendOtp}
            disabled={busy || !phoneValid}
            className="w-full rounded-xl bg-blue-600 py-2.5 text-sm font-bold text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {busy ? "Sending…" : "Send OTP"}
          </button>
        </div>
      )}

      {step === "otp" && (
        <div className="space-y-3">
          <input
            inputMode="numeric"
            autoFocus
            value={otp}
            onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
            placeholder="6-digit code"
            className={`${input} text-center tracking-[0.5em] font-bold`}
          />
          <button
            type="button"
            onClick={verifyOtp}
            disabled={busy || otp.length < 4}
            className="w-full rounded-xl bg-blue-600 py-2.5 text-sm font-bold text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {busy ? "Verifying…" : "Verify"}
          </button>
          <div className="flex items-center justify-between text-xs text-slate-500">
            <button type="button" onClick={() => setStep("phone")} className="hover:text-slate-800">
              Change number
            </button>
            <button
              type="button"
              onClick={sendOtp}
              disabled={cooldown > 0 || busy}
              className="font-semibold text-blue-600 disabled:text-slate-400"
            >
              {cooldown > 0 ? `Resend in ${cooldown}s` : "Resend code"}
            </button>
          </div>
        </div>
      )}

      {step === "details" && (
        <div className="space-y-3">
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

      {(error || info) && (
        <p className={`mt-3 text-xs font-semibold ${error ? "text-red-600" : "text-slate-500"}`}>
          {error || info}
        </p>
      )}

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
