"use client";

import { useState } from "react";
import { toast } from "sonner";

type DeviceSession = {
  id: string;
  deviceType: string;
  browser: string | null;
  os: string | null;
  ipAddress: string | null;
  revokedAt: string | null;
  revokedReason: string | null;
  createdAt: string;
};

type LookupUser = { id: string; name: string; email: string };

export function SecurityCenter({ initialPolicy }: { initialPolicy: string }) {
  const [policy, setPolicy] = useState(initialPolicy);
  const [savingPolicy, setSavingPolicy] = useState(false);

  const [email, setEmail] = useState("");
  const [searching, setSearching] = useState(false);
  const [lookupUser, setLookupUser] = useState<LookupUser | null>(null);
  const [sessions, setSessions] = useState<DeviceSession[]>([]);
  const [revokingId, setRevokingId] = useState<string | null>(null);
  const [searchError, setSearchError] = useState<string | null>(null);

  async function savePolicy(next: string) {
    setSavingPolicy(true);
    try {
      const res = await fetch("/api/team/security/config", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ policy: next }),
      });
      const body = await res.json();
      if (!res.ok || !body.success) {
        toast.error(body.error ?? "Could not update the policy.");
        return;
      }
      setPolicy(next);
      toast.success("Session policy updated.");
    } catch {
      toast.error("Something went wrong. Please try again.");
    } finally {
      setSavingPolicy(false);
    }
  }

  async function search(e: React.FormEvent) {
    e.preventDefault();
    setSearching(true);
    setSearchError(null);
    setLookupUser(null);
    setSessions([]);
    try {
      const res = await fetch(`/api/team/security/sessions?email=${encodeURIComponent(email.trim())}`);
      const body = await res.json();
      if (!res.ok || !body.success) {
        setSearchError(body.error ?? "No sessions found.");
        return;
      }
      setLookupUser(body.data.user);
      setSessions(body.data.sessions);
    } catch {
      setSearchError("Something went wrong. Please try again.");
    } finally {
      setSearching(false);
    }
  }

  async function revoke(id: string) {
    setRevokingId(id);
    try {
      const res = await fetch(`/api/team/security/sessions/${id}`, { method: "DELETE" });
      const body = await res.json();
      if (!res.ok || !body.success) {
        toast.error(body.error ?? "Could not revoke that session.");
        return;
      }
      setSessions((prev) =>
        prev.map((s) => (s.id === id ? { ...s, revokedAt: new Date().toISOString() } : s))
      );
      toast.success("Session revoked.");
    } catch {
      toast.error("Something went wrong. Please try again.");
    } finally {
      setRevokingId(null);
    }
  }

  return (
    <div className="space-y-stack-lg max-w-4xl">
      <div className="glass-card p-stack-lg rounded-xl space-y-stack-md">
        <div>
          <h2 className="font-headline-md text-headline-md text-primary">Session Policy</h2>
          <p className="text-on-surface-variant font-body-md mt-1">
            Controls what happens when a user logs in on a second device.
          </p>
        </div>
        <div className="flex flex-col sm:flex-row gap-3">
          <button
            type="button"
            disabled={savingPolicy}
            onClick={() => savePolicy("SINGLE_SESSION")}
            className={`flex-1 text-left rounded-xl border p-4 transition-colors disabled:opacity-60 ${
              policy === "SINGLE_SESSION"
                ? "border-primary bg-primary-container/15"
                : "border-outline-variant hover:bg-surface-container-lowest"
            }`}
          >
            <p className="font-label-md text-on-surface">Single Session</p>
            <p className="text-label-sm text-on-surface-variant mt-0.5">
              Logging in on a new device signs the account out everywhere else automatically.
            </p>
          </button>
          <button
            type="button"
            disabled={savingPolicy}
            onClick={() => savePolicy("MULTI_SESSION")}
            className={`flex-1 text-left rounded-xl border p-4 transition-colors disabled:opacity-60 ${
              policy === "MULTI_SESSION"
                ? "border-primary bg-primary-container/15"
                : "border-outline-variant hover:bg-surface-container-lowest"
            }`}
          >
            <p className="font-label-md text-on-surface">Multiple Sessions</p>
            <p className="text-label-sm text-on-surface-variant mt-0.5">
              Accounts can stay signed in on more than one device at a time.
            </p>
          </button>
        </div>
      </div>

      <div className="glass-card p-stack-lg rounded-xl space-y-stack-md">
        <div>
          <h2 className="font-headline-md text-headline-md text-primary">Device Sessions Lookup</h2>
          <p className="text-on-surface-variant font-body-md mt-1">
            Search a user by email to view and revoke their active sessions.
          </p>
        </div>
        <form onSubmit={search} className="flex gap-3">
          <input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            type="email"
            placeholder="student@example.com"
            className="flex-1 rounded-lg border border-outline-variant bg-surface-container-lowest py-2 px-3 text-body-md outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
          />
          <button
            type="submit"
            disabled={searching || !email.trim()}
            className="px-5 py-2 bg-primary text-on-primary rounded-lg font-label-md disabled:opacity-60"
          >
            {searching ? "Searching..." : "Search"}
          </button>
        </form>

        {searchError && <p className="text-label-sm text-error">{searchError}</p>}

        {lookupUser && (
          <div className="space-y-3">
            <p className="text-label-md text-on-surface">
              {lookupUser.name} <span className="text-on-surface-variant">({lookupUser.email})</span>
            </p>
            {sessions.length === 0 ? (
              <p className="text-label-sm text-on-surface-variant">No device sessions recorded yet.</p>
            ) : (
              <div className="glass-card rounded-xl overflow-hidden">
                <table className="w-full text-left border-collapse">
                  <thead className="bg-surface-container-low border-b border-outline-variant/30">
                    <tr>
                      <th className="px-4 py-3 font-label-sm text-on-surface-variant">Device</th>
                      <th className="px-4 py-3 font-label-sm text-on-surface-variant">IP</th>
                      <th className="px-4 py-3 font-label-sm text-on-surface-variant">Status</th>
                      <th className="px-4 py-3 font-label-sm text-on-surface-variant">Signed In</th>
                      <th className="px-4 py-3 font-label-sm text-on-surface-variant text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-outline-variant/20">
                    {sessions.map((s) => (
                      <tr key={s.id}>
                        <td className="px-4 py-3 text-label-sm">
                          {s.browser ?? "Unknown"} · {s.os ?? "Unknown"} · {s.deviceType}
                        </td>
                        <td className="px-4 py-3 text-label-sm text-on-surface-variant">{s.ipAddress ?? "—"}</td>
                        <td className="px-4 py-3">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                              s.revokedAt
                                ? "bg-surface-container text-on-surface-variant"
                                : "bg-tertiary-container text-on-tertiary-container"
                            }`}
                          >
                            {s.revokedAt ? s.revokedReason ?? "Revoked" : "Active"}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-label-sm text-on-surface-variant">
                          {new Date(s.createdAt).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}
                        </td>
                        <td className="px-4 py-3 text-right">
                          {!s.revokedAt && (
                            <button
                              type="button"
                              onClick={() => revoke(s.id)}
                              disabled={revokingId === s.id}
                              className="text-label-sm text-error hover:opacity-80 disabled:opacity-50"
                            >
                              {revokingId === s.id ? "Revoking..." : "Revoke"}
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
