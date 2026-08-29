"use client";

import { ArrowLeft, BadgeCheck, CreditCard, Save, ShieldCheck, SlidersHorizontal } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useAiChatUser } from "@/components/ai-chat/AiChatUserContext";
import type { Language, StudentProfile } from "@/types/ai-chat";

interface AccessDetails {
  plan: string;
  accessType: string;
  status: string;
  expiresAt: string | null;
  batch: { title: string } | null;
  course: { title: string } | null;
  subscription: { grantedAt: string; reason: string | null } | null;
}

interface SettingsData {
  // Source's own SettingsData.user carried atomicId/role/isPro — none of
  // those exist on atomic-ops's session.user (see profile-utils.ts's
  // publicUser()). Role/admin-link visibility now comes from
  // useAiChatUser() instead of this payload.
  user: { id: string; email: string | null; name: string | null };
  studentProfile: StudentProfile;
  profile: { phone: string | null; favoriteSubject: string | null } | null;
  preferences: { language: Language; emailNotifications: boolean; pushNotifications: boolean } | null;
  access: AccessDetails | null;
}

function readable(value: string) {
  return value.replaceAll("_", " ").toLowerCase().replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export function SettingsScreen() {
  // Source gated this whole screen behind `useAuth()`'s user/backend fields
  // (guest vs signed-in-via-NextAuth). This route group is already
  // server-gated to a signed-in atomic-ops user (see app/(guru)/layout.tsx),
  // so `user` here is always present — no guest/backend branching needed.
  const { user } = useAiChatUser();
  const [data, setData] = useState<SettingsData | null>(null);
  const [name, setName] = useState("");
  const [className, setClassName] = useState("");
  const [target, setTarget] = useState("NEET");
  const [atomicBatch, setAtomicBatch] = useState("NO_BATCH");
  const [board, setBoard] = useState("");
  const [language, setLanguage] = useState<Language>("hinglish");
  const [phone, setPhone] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    void fetch("/api/ai-chat/profile", { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) throw new Error("Could not load settings.");
        return response.json() as Promise<SettingsData>;
      })
      .then((next) => {
        setData(next);
        setName(next.studentProfile.name ?? "");
        setClassName(next.studentProfile.className ?? "");
        setTarget(next.studentProfile.target ?? "NEET");
        setAtomicBatch(next.studentProfile.atomicBatch ?? "NO_BATCH");
        setBoard(next.studentProfile.board ?? "");
        setLanguage(next.studentProfile.language ?? "hinglish");
        setPhone(next.profile?.phone ?? "");
      })
      .catch((caughtError) => setError(caughtError instanceof Error ? caughtError.message : "Could not load settings."));
  }, []);

  const save = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      const response = await fetch("/api/ai-chat/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          className: className || null,
          target,
          atomicBatch,
          board: board || null,
          preferredLanguage: language,
          language,
          phone: phone || null,
        }),
      });
      const next = (await response.json()) as Partial<SettingsData> & { error?: string };
      if (!response.ok) throw new Error(next.error ?? "Could not save settings.");
      setData((current) => (current ? { ...current, ...next } : current));
      setMessage("Settings saved.");
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Could not save settings.");
    } finally {
      setSaving(false);
    }
  };

  const access = data?.access;
  return (
    <main className="min-h-dvh bg-white dark:bg-atomic-navy">
      <div className="mx-auto max-w-4xl px-4 py-7 sm:px-6">
        <div className="flex items-center justify-between gap-4 border-b border-slate-200 pb-5 dark:border-slate-700">
          <div>
            <p className="text-sm font-medium text-atomic-orange">Atomic Guru</p>
            <h1 className="text-2xl font-bold">Settings</h1>
          </div>
          <Link href="/guru" className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800" title="Return to chat" aria-label="Return to chat">
            <ArrowLeft className="h-5 w-5" />
          </Link>
        </div>

        <section className="border-b border-slate-200 py-6 dark:border-slate-700">
          <div className="mb-4 flex items-center gap-2">
            <CreditCard className="h-5 w-5 text-atomic-orange" />
            <h2 className="font-semibold">Current access</h2>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <div><p className="text-xs text-slate-500">Current plan</p><p className="mt-1 font-semibold">{access ? readable(access.plan) : "Basic"}</p></div>
            <div><p className="text-xs text-slate-500">Access type</p><p className="mt-1 font-semibold">{access ? readable(access.accessType) : "Basic plan"}</p></div>
            <div><p className="text-xs text-slate-500">Subscription status</p><p className="mt-1 font-semibold">{access ? readable(access.status) : "Active"}</p></div>
            <div><p className="text-xs text-slate-500">Expiry date</p><p className="mt-1 font-semibold">{access?.expiresAt ? new Date(access.expiresAt).toLocaleDateString("en-IN") : "No expiry"}</p></div>
            <div><p className="text-xs text-slate-500">Atomic Pathshala batch</p><p className="mt-1 font-semibold">{readable(atomicBatch)}</p></div>
          </div>
        </section>

        <form onSubmit={save} className="border-b border-slate-200 py-6 dark:border-slate-700">
          <div className="mb-4 flex items-center gap-2"><BadgeCheck className="h-5 w-5 text-atomic-orange" /><h2 className="font-semibold">Profile</h2></div>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="text-sm"><span className="mb-1 block text-slate-500">Name</span><input value={name} onChange={(event) => setName(event.target.value)} className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 outline-none focus:border-atomic-orange dark:border-slate-700 dark:bg-slate-900" /></label>
            <label className="text-sm"><span className="mb-1 block text-slate-500">Phone</span><input value={phone} onChange={(event) => setPhone(event.target.value)} className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 outline-none focus:border-atomic-orange dark:border-slate-700 dark:bg-slate-900" /></label>
            <label className="text-sm"><span className="mb-1 block text-slate-500">Class</span><select value={className} onChange={(event) => setClassName(event.target.value)} className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 outline-none focus:border-atomic-orange dark:border-slate-700 dark:bg-slate-900"><option value="">Select class</option><option value="11th">11th</option><option value="12th">12th</option><option value="Dropper">Dropper</option></select></label>
            <label className="text-sm"><span className="mb-1 block text-slate-500">Board</span><input value={board} onChange={(event) => setBoard(event.target.value)} className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 outline-none focus:border-atomic-orange dark:border-slate-700 dark:bg-slate-900" /></label>
            <label className="text-sm"><span className="mb-1 block text-slate-500">Target</span><select value={target} onChange={(event) => setTarget(event.target.value)} className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 outline-none focus:border-atomic-orange dark:border-slate-700 dark:bg-slate-900"><option>NEET</option><option>JEE</option><option>Board</option><option>Other</option></select></label>
            <label className="text-sm"><span className="mb-1 block text-slate-500">Atomic Pathshala batch</span><select value={atomicBatch} onChange={(event) => setAtomicBatch(event.target.value)} className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 outline-none focus:border-atomic-orange dark:border-slate-700 dark:bg-slate-900"><option value="SELECTION_PRO">Selection Pro Batch</option><option value="SELECTION_1_0">Selection 1.0 Batch</option><option value="ARAMBH">Arambh Batch</option><option value="MANZIL">Manzil Batch</option><option value="UDAAN">Udaan Batch (Class 10th)</option><option value="NO_BATCH">No Batch</option></select></label>
            <label className="text-sm"><span className="mb-1 block text-slate-500">Language</span><select value={language} onChange={(event) => setLanguage(event.target.value as Language)} className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 outline-none focus:border-atomic-orange dark:border-slate-700 dark:bg-slate-900"><option value="hinglish">Hinglish</option><option value="english">English</option><option value="hindi">Hindi</option></select></label>
          </div>
          {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
          {message && <p className="mt-3 text-sm text-emerald-700">{message}</p>}
          <button type="submit" disabled={saving} className="mt-5 inline-flex items-center gap-2 rounded-lg bg-atomic-orange px-4 py-2.5 text-sm font-semibold text-white hover:bg-atomic-orange-dark disabled:opacity-60"><Save className="h-4 w-4" />{saving ? "Saving..." : "Save settings"}</button>
        </form>

        <section className="py-6">
          <div className="mb-3 flex items-center gap-2"><ShieldCheck className="h-5 w-5 text-atomic-orange" /><h2 className="font-semibold">Account</h2></div>
          <p className="text-sm text-slate-500">{data?.user.email ?? user.email}</p>
          <Link href="/guru/dashboard" className="mb-3 flex items-center gap-2 text-sm font-semibold text-atomic-orange"><CreditCard className="h-4 w-4" /> View full progress dashboard</Link>
          {user.isAdmin && <Link href="/guru/admin" className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-atomic-orange"><SlidersHorizontal className="h-4 w-4" /> Open admin dashboard</Link>}
          {user.isScheduleManager && <Link href="/guru/schedule" className="mt-3 flex items-center gap-2 text-sm font-semibold text-atomic-orange"><SlidersHorizontal className="h-4 w-4" /> Manage class schedule</Link>}
        </section>
      </div>
    </main>
  );
}
