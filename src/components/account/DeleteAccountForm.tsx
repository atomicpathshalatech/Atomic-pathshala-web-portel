"use client";

import { useState } from "react";
import Link from "next/link";
import { signOut } from "next-auth/react";

export function DeleteAccountForm({ signedIn, canSelfDelete, email }: { signedIn: boolean; canSelfDelete: boolean; email: string }) {
  const [confirm, setConfirm] = useState("");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  if (!signedIn) {
    return (
      <p>
        <Link href="/login?callbackUrl=%2Fdelete-account" className="font-bold text-blue-700 underline">
          Log in
        </Link>{" "}
        to the account you want to delete, then come back to this page.
      </p>
    );
  }
  if (!canSelfDelete) {
    return (
      <p>
        Staff and teacher accounts are closed by an administrator. Please write to <a href={`mailto:${email}`}>{email}</a>.
      </p>
    );
  }
  if (done) {
    return <p className="font-semibold text-emerald-700">Your request is received. Your account is now closed and its data will be deleted within 30 days.</p>;
  }

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/account/delete-request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirm, reason }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok) throw new Error(json?.error || "Could not send the request");
      setDone(true);
      setTimeout(() => signOut({ callbackUrl: "/" }), 2500);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not send the request");
      setBusy(false);
    }
  };

  return (
    <div className="space-y-3 not-prose">
      <p className="text-sm text-slate-700">This cannot be undone. Your batches, test history and progress will no longer be available to you.</p>
      <textarea
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        maxLength={500}
        placeholder="Why are you leaving? (optional)"
        className="w-full rounded-xl border border-slate-300 p-3 text-sm"
        rows={2}
      />
      <label className="block text-sm text-slate-700">
        Type <b>DELETE</b> to confirm
        <input
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          className="mt-1 w-full rounded-xl border border-slate-300 p-2.5 text-sm"
          autoComplete="off"
        />
      </label>
      {error && <p className="text-sm font-semibold text-red-600">{error}</p>}
      <button
        type="button"
        onClick={submit}
        disabled={busy || confirm.trim().toUpperCase() !== "DELETE"}
        className="rounded-xl bg-red-600 px-5 py-2.5 text-sm font-bold text-white hover:bg-red-700 disabled:opacity-50"
      >
        {busy ? "Sending…" : "Delete my account"}
      </button>
    </div>
  );
}
