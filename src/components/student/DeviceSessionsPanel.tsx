"use client";

import { useEffect, useState } from "react";
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

/** Self-service "your active sessions" panel — lists this account's
 * DeviceSession rows (from every device that's ever logged in) and lets
 * the student revoke any of them, including the one they're on right now
 * (that just signs that device out on its next request). */
export function DeviceSessionsPanel() {
  const [sessions, setSessions] = useState<DeviceSession[] | null>(null);
  const [revokingId, setRevokingId] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/security/sessions/my")
      .then((res) => res.json())
      .then((body) => {
        if (body.success) setSessions(body.data.sessions);
      })
      .catch(() => {
        // leave sessions null — panel just shows nothing rather than an error
      });
  }, []);

  async function revoke(id: string) {
    setRevokingId(id);
    try {
      const res = await fetch(`/api/security/sessions/my/${id}`, { method: "DELETE" });
      const body = await res.json();
      if (!res.ok || !body.success) {
        toast.error(body.error ?? "Could not sign out that device.");
        return;
      }
      setSessions((prev) =>
        prev
          ? prev.map((s) => (s.id === id ? { ...s, revokedAt: new Date().toISOString() } : s))
          : prev
      );
      toast.success("Device signed out.");
    } catch {
      toast.error("Something went wrong. Please try again.");
    } finally {
      setRevokingId(null);
    }
  }

  if (sessions === null) {
    return (
      <div className="glass-card rounded-2xl p-5">
        <h2 className="font-headline-md text-headline-md text-on-surface mb-1">Active Sessions</h2>
        <p className="text-body-sm text-on-surface-variant">Loading...</p>
      </div>
    );
  }

  const active = sessions.filter((s) => !s.revokedAt);

  return (
    <div className="glass-card rounded-2xl p-5 space-y-3">
      <div>
        <h2 className="font-headline-md text-headline-md text-on-surface">Active Sessions</h2>
        <p className="text-body-sm text-on-surface-variant">Devices currently signed in to your account.</p>
      </div>

      {active.length === 0 && <p className="text-body-sm text-on-surface-variant">No active sessions found.</p>}

      {active.map((s) => (
        <div
          key={s.id}
          className="flex items-center justify-between gap-4 py-2 border-b border-outline-variant/20 last:border-b-0"
        >
          <div className="flex items-center gap-3 min-w-0">
            <span className="material-symbols-outlined text-on-surface-variant shrink-0">
              {s.deviceType === "Mobile" ? "smartphone" : s.deviceType === "Tablet" ? "tablet_mac" : "computer"}
            </span>
            <div className="min-w-0">
              <p className="text-label-md text-on-surface truncate">
                {s.browser ?? "Unknown Browser"} on {s.os ?? "Unknown OS"}
              </p>
              <p className="text-label-sm text-on-surface-variant">
                Signed in {new Date(s.createdAt).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => revoke(s.id)}
            disabled={revokingId === s.id}
            className="text-label-sm font-label-sm text-error hover:opacity-80 shrink-0 disabled:opacity-50"
          >
            {revokingId === s.id ? "Signing out..." : "Sign out"}
          </button>
        </div>
      ))}
    </div>
  );
}
