"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type Loaded =
  | { state: "loading" }
  | { state: "invalid"; message: string }
  | { state: "ok"; email: string; phone: string; expiresAt: string }
  | { state: "done" };

export function StaffRegistrationForm({ token }: { token: string }) {
  const [loaded, setLoaded] = useState<Loaded>({ state: "loading" });
  const [form, setForm] = useState({
    name: "",
    dob: "",
    qualification: "",
    experience: "",
    password: "",
    confirm: "",
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`/api/invite/${token}`, { cache: "no-store" });
        const json = await res.json();
        if (!res.ok || !json.success) {
          setLoaded({ state: "invalid", message: json.error ?? "This invitation link is not valid." });
          return;
        }
        setLoaded({ state: "ok", ...json.data });
      } catch {
        setLoaded({ state: "invalid", message: "Could not load this invitation. Try again later." });
      }
    })();
  }, [token]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (form.password.length < 8) return setError("Password must be at least 8 characters.");
    if (form.password !== form.confirm) return setError("Passwords do not match.");
    setSubmitting(true);
    try {
      const res = await fetch(`/api/invite/${token}/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name,
          dob: form.dob,
          qualification: form.qualification,
          experience: form.experience,
          password: form.password,
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error ?? "Submission failed.");
      setLoaded({ state: "done" });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Submission failed.");
    } finally {
      setSubmitting(false);
    }
  }

  const card = "w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 sm:p-8 shadow-sm";

  if (loaded.state === "loading") {
    return (
      <div className={card}>
        <p className="text-sm text-slate-500">Loading your invitation…</p>
      </div>
    );
  }

  if (loaded.state === "invalid") {
    return (
      <div className={`${card} text-center`}>
        <span className="material-symbols-outlined text-4xl text-amber-500">link_off</span>
        <h1 className="mt-2 text-lg font-black text-slate-900">Invitation unavailable</h1>
        <p className="mt-1 text-sm text-slate-500">{loaded.message}</p>
        <p className="mt-4 text-xs text-slate-400">
          Please contact your Founder, Coordinator, or Administrator.
        </p>
      </div>
    );
  }

  if (loaded.state === "done") {
    return (
      <div className={`${card} text-center`}>
        <span className="material-symbols-outlined text-4xl text-emerald-500">task_alt</span>
        <h1 className="mt-2 text-lg font-black text-slate-900">Your profile has been submitted successfully.</h1>
        <p className="mt-1 text-sm text-slate-500">
          Your verification / approval is pending. You&apos;ll be able to sign in once an administrator
          approves your account.
        </p>
        <Link
          href="/login"
          className="mt-5 inline-block rounded-xl bg-slate-900 px-5 py-2.5 text-xs font-bold text-white hover:bg-slate-800"
        >
          Go to sign in
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className={card}>
      <div className="mb-5 text-center">
        <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
          <span className="material-symbols-outlined text-2xl">badge</span>
        </div>
        <h1 className="text-lg font-black text-slate-900">You&apos;re invited to join Atomic Pathshala.</h1>
        <p className="mt-1 text-xs text-slate-500">Set up your staff profile — it&apos;s reviewed before you get access.</p>
      </div>

      <div className="space-y-3">
        <Field label="Email">
          <input value={loaded.email} disabled className="input-disabled" />
        </Field>
        <Field label="Phone">
          <input value={loaded.phone} disabled className="input-disabled" />
        </Field>
        <Field label="Full name *">
          <input
            required
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            className="input"
            placeholder="As on your government ID"
          />
        </Field>
        <Field label="Date of birth *">
          <input
            required
            type="date"
            value={form.dob}
            onChange={(e) => setForm({ ...form, dob: e.target.value })}
            className="input"
          />
        </Field>
        <Field label="Highest qualification *">
          <input
            required
            value={form.qualification}
            onChange={(e) => setForm({ ...form, qualification: e.target.value })}
            className="input"
            placeholder="e.g. M.Sc. Physics"
          />
        </Field>
        <Field label="Experience *">
          <input
            required
            value={form.experience}
            onChange={(e) => setForm({ ...form, experience: e.target.value })}
            className="input"
            placeholder="e.g. 6 years teaching NEET Physics"
          />
        </Field>
        <Field label="Set a password *">
          <input
            required
            type="password"
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
            className="input"
            placeholder="At least 8 characters"
          />
        </Field>
        <Field label="Confirm password *">
          <input
            required
            type="password"
            value={form.confirm}
            onChange={(e) => setForm({ ...form, confirm: e.target.value })}
            className="input"
          />
        </Field>
      </div>

      {error && <p className="mt-3 text-xs font-semibold text-red-600">{error}</p>}

      <button
        type="submit"
        disabled={submitting}
        className="mt-5 w-full rounded-xl bg-blue-600 py-2.5 text-sm font-bold text-white hover:bg-blue-700 disabled:opacity-50"
      >
        {submitting ? "Submitting…" : "Submit profile"}
      </button>

      <style jsx>{`
        :global(.input) {
          width: 100%;
          border-radius: 0.6rem;
          border: 1px solid #cbd5e1;
          padding: 0.5rem 0.75rem;
          font-size: 0.875rem;
        }
        :global(.input-disabled) {
          width: 100%;
          border-radius: 0.6rem;
          border: 1px solid #e2e8f0;
          background: #f8fafc;
          color: #64748b;
          padding: 0.5rem 0.75rem;
          font-size: 0.875rem;
        }
      `}</style>
    </form>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-xs font-bold text-slate-500">{label}</span>
      <div className="mt-1">{children}</div>
    </label>
  );
}
