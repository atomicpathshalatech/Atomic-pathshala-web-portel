"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

type Invitation = {
  id: string;
  email: string;
  phone: string;
  intendedRoleName: string | null;
  status: "PENDING" | "OPENED" | "SUBMITTED" | "APPROVED" | "REJECTED" | "EXPIRED";
  createdAt: string;
  expiresAt: string;
  openedAt: string | null;
  submittedAt: string | null;
  reviewedAt: string | null;
  invitedBy: { name: string } | null;
  createdUser: {
    id: string;
    name: string;
    status: string;
    role: { name: string } | null;
    teacher: { department: string; subjects: string[]; bio: string | null } | null;
  } | null;
};

const STATUS_STYLE: Record<Invitation["status"], string> = {
  PENDING: "bg-slate-100 text-slate-600",
  OPENED: "bg-blue-100 text-blue-700",
  SUBMITTED: "bg-amber-100 text-amber-800",
  APPROVED: "bg-emerald-100 text-emerald-700",
  REJECTED: "bg-red-100 text-red-700",
  EXPIRED: "bg-slate-100 text-slate-400",
};

export function StaffInvitationsConsole({ invitableRoles }: { invitableRoles: string[] }) {
  const [items, setItems] = useState<Invitation[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ email: "", phone: "", intendedRoleName: "" });
  const [sending, setSending] = useState(false);
  const [lastLink, setLastLink] = useState<{ url: string; delivered: boolean } | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/team/invitations", { cache: "no-store" });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error ?? "Failed to load.");
      setItems(json.data.invitations);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to load invitations.");
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    load();
  }, [load]);

  async function invite(e: React.FormEvent) {
    e.preventDefault();
    setSending(true);
    setLastLink(null);
    try {
      const res = await fetch("/api/team/invitations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: form.email.trim(),
          phone: form.phone.trim(),
          intendedRoleName: form.intendedRoleName || null,
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error ?? "Failed to send invite.");
      setLastLink({ url: json.data.inviteUrl, delivered: json.data.emailDelivered });
      toast.success(
        json.data.emailDelivered ? "Invitation emailed." : "Invitation created — copy the link below."
      );
      setForm({ email: "", phone: "", intendedRoleName: "" });
      load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to send invite.");
    } finally {
      setSending(false);
    }
  }

  async function act(id: string, action: "approve" | "reject" | "resend", roleName?: string | null) {
    if (action === "reject" && !window.confirm("Reject this profile? The account is kept but gets no access.")) return;
    setBusyId(id);
    try {
      const res = await fetch(`/api/team/invitations/${id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, roleName: roleName ?? undefined }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error ?? "Action failed.");
      if (action === "resend" && json.data?.inviteUrl) {
        setLastLink({ url: json.data.inviteUrl, delivered: json.data.emailDelivered });
      }
      toast.success(
        action === "approve"
          ? `Approved${json.data?.roleAssigned ? ` as ${json.data.roleAssigned}` : " (no role yet)"}`
          : action === "reject"
          ? "Rejected"
          : "New invitation link generated"
      );
      load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Action failed.");
    } finally {
      setBusyId(null);
    }
  }

  const pending = useMemo(() => items.filter((i) => i.status === "SUBMITTED"), [items]);
  const rest = useMemo(() => items.filter((i) => i.status !== "SUBMITTED"), [items]);

  return (
    <div className="space-y-6 max-w-5xl">
      <header>
        <h1 className="text-2xl font-black text-slate-900 dark:text-white">Staff Invitations</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
          Invite an educator or team member by email &amp; phone. They set up a profile; you approve it
          here. A role is assigned separately.
        </p>
      </header>

      {/* Invite form */}
      <form
        onSubmit={invite}
        className="grid gap-3 sm:grid-cols-[1fr_1fr_1fr_auto] items-end rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4"
      >
        <label className="block">
          <span className="text-xs font-bold text-slate-500 uppercase tracking-wide">Email *</span>
          <input
            type="email"
            required
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            className="mt-1 w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-sm"
            placeholder="person@example.com"
          />
        </label>
        <label className="block">
          <span className="text-xs font-bold text-slate-500 uppercase tracking-wide">Phone *</span>
          <input
            required
            value={form.phone}
            onChange={(e) => setForm({ ...form, phone: e.target.value })}
            className="mt-1 w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-sm"
            placeholder="+91…"
          />
        </label>
        <label className="block">
          <span className="text-xs font-bold text-slate-500 uppercase tracking-wide">
            Pre-authorise role (optional)
          </span>
          <select
            value={form.intendedRoleName}
            onChange={(e) => setForm({ ...form, intendedRoleName: e.target.value })}
            className="mt-1 w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-sm font-semibold"
          >
            <option value="">— none (assign later) —</option>
            {invitableRoles.map((r) => (
              <option key={r} value={r}>
                {r.replace(/_/g, " ")}
              </option>
            ))}
          </select>
        </label>
        <button
          type="submit"
          disabled={sending}
          className="rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold px-4 py-2 disabled:opacity-50"
        >
          {sending ? "Sending…" : "Invite"}
        </button>
      </form>

      {lastLink && (
        <div className="rounded-xl border border-blue-200 bg-blue-50 dark:bg-blue-950/30 dark:border-blue-900 p-3 text-xs">
          <p className="font-semibold text-blue-800 dark:text-blue-300">
            {lastLink.delivered
              ? "Invitation emailed. Link (share only if the email doesn't arrive):"
              : "Email delivery isn't configured — send this link to the invitee:"}
          </p>
          <div className="mt-1.5 flex items-center gap-2">
            <code className="flex-1 truncate rounded bg-white dark:bg-slate-900 border border-blue-200 dark:border-blue-900 px-2 py-1">
              {lastLink.url}
            </code>
            <button
              type="button"
              onClick={() => {
                navigator.clipboard.writeText(lastLink.url);
                toast.success("Link copied");
              }}
              className="rounded-lg bg-blue-600 text-white px-2.5 py-1 font-bold"
            >
              Copy
            </button>
          </div>
        </div>
      )}

      {/* Pending approvals */}
      <section>
        <h2 className="text-sm font-black text-slate-900 dark:text-white mb-2">
          Pending Educators / Team Members ({pending.length})
        </h2>
        {pending.length === 0 ? (
          <p className="text-xs text-slate-400">No profiles waiting for review.</p>
        ) : (
          <div className="space-y-2">
            {pending.map((i) => (
              <PendingCard key={i.id} inv={i} busy={busyId === i.id} onAct={act} invitableRoles={invitableRoles} />
            ))}
          </div>
        )}
      </section>

      {/* All invitations */}
      <section>
        <h2 className="text-sm font-black text-slate-900 dark:text-white mb-2">All invitations</h2>
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="text-slate-400 uppercase tracking-wide">
              <tr className="border-b border-slate-100 dark:border-slate-800">
                <th className="text-left px-3 py-2">Email</th>
                <th className="text-left px-3 py-2">Phone</th>
                <th className="text-left px-3 py-2">Role (intended)</th>
                <th className="text-left px-3 py-2">Status</th>
                <th className="text-left px-3 py-2">Invited</th>
                <th className="text-left px-3 py-2">Expires</th>
                <th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-3 py-4 text-slate-400">Loading…</td>
                </tr>
              ) : rest.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-3 py-4 text-slate-400">Nothing yet.</td>
                </tr>
              ) : (
                rest.map((i) => (
                  <tr key={i.id} className="border-b border-slate-50 dark:border-slate-800/60">
                    <td className="px-3 py-2 font-semibold text-slate-800 dark:text-slate-200">{i.email}</td>
                    <td className="px-3 py-2 text-slate-500">{i.phone}</td>
                    <td className="px-3 py-2 text-slate-500">{i.intendedRoleName?.replace(/_/g, " ") || "—"}</td>
                    <td className="px-3 py-2">
                      <span className={`rounded px-1.5 py-0.5 font-bold ${STATUS_STYLE[i.status]}`}>{i.status}</span>
                    </td>
                    <td className="px-3 py-2 text-slate-400">{new Date(i.createdAt).toLocaleDateString()}</td>
                    <td className="px-3 py-2 text-slate-400">{new Date(i.expiresAt).toLocaleDateString()}</td>
                    <td className="px-3 py-2 text-right">
                      {(i.status === "PENDING" || i.status === "OPENED" || i.status === "EXPIRED") && (
                        <button
                          type="button"
                          disabled={busyId === i.id}
                          onClick={() => act(i.id, "resend")}
                          className="rounded-lg border border-slate-300 dark:border-slate-700 px-2 py-1 font-bold hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-50"
                        >
                          Resend
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function PendingCard({
  inv,
  busy,
  onAct,
  invitableRoles,
}: {
  inv: Invitation;
  busy: boolean;
  onAct: (id: string, a: "approve" | "reject" | "resend", role?: string | null) => void;
  invitableRoles: string[];
}) {
  const [role, setRole] = useState(inv.intendedRoleName ?? "");
  const u = inv.createdUser;
  return (
    <div className="rounded-2xl border border-amber-200 dark:border-amber-900/60 bg-amber-50/40 dark:bg-amber-950/20 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-bold text-slate-900 dark:text-white">{u?.name ?? inv.email}</p>
          <p className="text-xs text-slate-500">{inv.email} · {inv.phone}</p>
          <p className="mt-1 text-xs text-slate-500 whitespace-pre-line">{u?.teacher?.bio ?? "—"}</p>
          <p className="mt-1 text-[11px] text-slate-400">
            Invited {new Date(inv.createdAt).toLocaleDateString()} · Submitted{" "}
            {inv.submittedAt ? new Date(inv.submittedAt).toLocaleDateString() : "—"}
          </p>
        </div>
        <div className="flex flex-col items-end gap-2">
          <select
            value={role}
            onChange={(e) => setRole(e.target.value)}
            className="rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-2 py-1 text-xs font-semibold"
          >
            <option value="">Approve with no role</option>
            {invitableRoles.map((r) => (
              <option key={r} value={r}>
                {r.replace(/_/g, " ")}
              </option>
            ))}
          </select>
          <div className="flex gap-2">
            <button
              type="button"
              disabled={busy}
              onClick={() => onAct(inv.id, "approve", role || null)}
              className="rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold px-3 py-1.5 disabled:opacity-50"
            >
              Approve
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => onAct(inv.id, "reject")}
              className="rounded-lg bg-red-600 hover:bg-red-700 text-white text-xs font-bold px-3 py-1.5 disabled:opacity-50"
            >
              Reject
            </button>
            {u && (
              <a
                href={`/team/users/${u.id}`}
                className="rounded-lg border border-slate-300 dark:border-slate-700 text-xs font-bold px-3 py-1.5 hover:bg-slate-50 dark:hover:bg-slate-800"
              >
                View profile
              </a>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
