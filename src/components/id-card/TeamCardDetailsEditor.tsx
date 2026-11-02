"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

/**
 * HR / admin fills in what a team member's ID card needs and the member can't
 * set themselves: date of joining (printed as "Member Since"), designation
 * and date of birth.
 */
export function TeamCardDetailsEditor({
  userId,
  name,
  joiningDate,
  designation,
  dob,
  hasTeacherProfile,
}: {
  userId: string;
  name: string;
  /** yyyy-mm-dd (IST) or "" */
  joiningDate: string;
  designation: string;
  dob: string;
  hasTeacherProfile: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ joiningDate, designation, dob });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/team/id-cards/${userId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "setDetails",
          kind: "TEAM",
          joiningDate: form.joiningDate || null,
          designation: form.designation.trim() || null,
          ...(hasTeacherProfile ? { dob: form.dob || null } : {}),
        }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.success) throw new Error(json?.error ?? "Could not save.");
      setOpen(false);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save.");
    } finally {
      setBusy(false);
    }
  }

  const input = "w-full px-3 py-2 rounded-lg border border-outline-variant bg-surface text-sm text-on-surface";
  return (
    <>
      <button
        type="button"
        onClick={() => {
          setForm({ joiningDate, designation, dob });
          setError(null);
          setOpen(true);
        }}
        className="px-2 py-1 rounded-lg text-[11px] font-bold border border-[#1d4ed8]/40 text-[#1d4ed8] hover:bg-[#1d4ed8]/5 transition"
      >
        Edit details
      </button>

      {open && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={() => !busy && setOpen(false)}>
          <div className="w-full max-w-sm rounded-2xl bg-surface p-5 space-y-4 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div>
              <p className="text-base font-bold text-on-surface">ID card details</p>
              <p className="text-xs text-on-surface-variant">{name}</p>
            </div>
            <label className="block space-y-1">
              <span className="text-xs font-bold text-on-surface">Date of joining (Member Since)</span>
              <input type="date" value={form.joiningDate} onChange={(e) => setForm({ ...form, joiningDate: e.target.value })} className={input} />
            </label>
            <label className="block space-y-1">
              <span className="text-xs font-bold text-on-surface">Designation</span>
              <input
                type="text"
                value={form.designation}
                maxLength={120}
                placeholder="e.g. Senior Chemistry Faculty"
                onChange={(e) => setForm({ ...form, designation: e.target.value })}
                className={input}
              />
            </label>
            {hasTeacherProfile && (
              <label className="block space-y-1">
                <span className="text-xs font-bold text-on-surface">Date of birth</span>
                <input type="date" value={form.dob} onChange={(e) => setForm({ ...form, dob: e.target.value })} className={input} />
              </label>
            )}
            {error && <p className="text-xs text-error font-semibold">{error}</p>}
            <div className="flex gap-2 justify-end">
              <button type="button" disabled={busy} onClick={() => setOpen(false)} className="px-4 py-2 rounded-xl text-sm font-bold border border-outline-variant">
                Cancel
              </button>
              <button type="button" disabled={busy} onClick={save} className="px-4 py-2 rounded-xl text-sm font-bold bg-[#0f3a9e] text-white disabled:opacity-60">
                {busy ? "Saving…" : "Save"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
