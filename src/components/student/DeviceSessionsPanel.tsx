"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { detectDeviceMeta } from "@/lib/security/device-client";

type DeviceSession = {
  id: string;
  deviceId: string | null;
  deviceName: string | null;
  deviceCategory: "DESKTOP" | "TABLET" | "MOBILE";
  deviceType: string;
  browser: string | null;
  os: string | null;
  ipAddress: string | null;
  lastActiveAt: string;
  revokedAt: string | null;
  revokedReason: string | null;
  createdAt: string;
};

export function DeviceSessionsPanel() {
  const [sessions, setSessions] = useState<DeviceSession[] | null>(null);
  const [revokingId, setRevokingId] = useState<string | null>(null);
  const [currentDeviceId, setCurrentDeviceId] = useState<string>("");

  useEffect(() => {
    const meta = detectDeviceMeta();
    setCurrentDeviceId(meta.deviceId);

    fetch("/api/security/sessions/my")
      .then((res) => res.json())
      .then((body) => {
        if (body.success) setSessions(body.data.sessions);
      })
      .catch(() => {
        // Leave sessions null on error
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
        <h2 className="font-headline-md text-headline-md text-on-surface mb-1">Login Devices</h2>
        <p className="text-body-sm text-on-surface-variant">Loading your authorized devices...</p>
      </div>
    );
  }

  const active = sessions.filter((s) => !s.revokedAt);

  return (
    <div className="glass-card rounded-2xl p-5 space-y-4">
      <div>
        <div className="flex items-center justify-between">
          <h2 className="font-headline-md text-headline-md text-on-surface">Login Devices</h2>
          <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-teal-50 dark:bg-teal-950 text-teal-700 dark:text-teal-300 border border-teal-500/20">
            {active.length} Active Devices
          </span>
        </div>
        <p className="text-body-sm text-on-surface-variant mt-1">
          Your authorized learning devices across Laptop, Tablet, and Mobile.
        </p>
      </div>

      {active.length === 0 ? (
        <p className="text-body-sm text-on-surface-variant py-2">No active sessions found.</p>
      ) : (
        <div className="space-y-3">
          {active.map((s) => {
            const isThisDevice = s.deviceId && currentDeviceId && s.deviceId === currentDeviceId;
            return (
              <div
                key={s.id}
                className={`p-4 rounded-2xl border transition flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                  isThisDevice
                    ? "bg-teal-50/50 dark:bg-teal-950/20 border-teal-500/30"
                    : "bg-surface-container-low border-outline-variant/20"
                }`}
              >
                <div className="flex items-center gap-3.5 min-w-0">
                  <div
                    className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                      isThisDevice
                        ? "bg-teal-600 text-white"
                        : "bg-surface-container text-on-surface-variant"
                    }`}
                  >
                    <span className="material-symbols-outlined text-xl">
                      {s.deviceCategory === "MOBILE"
                        ? "smartphone"
                        : s.deviceCategory === "TABLET"
                        ? "tablet_mac"
                        : "computer"}
                    </span>
                  </div>

                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-label-md font-bold text-on-surface truncate">
                        {s.deviceName || `${s.os ?? "Device"} (${s.browser ?? "Browser"})`}
                      </p>
                      {isThisDevice && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-teal-100 dark:bg-teal-900 text-teal-800 dark:text-teal-200">
                          <span className="material-symbols-outlined text-xs">check_circle</span>
                          This Device
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-on-surface-variant mt-0.5 flex flex-wrap items-center gap-2">
                      <span>{s.deviceCategory === "DESKTOP" ? "Laptop / Desktop" : s.deviceCategory === "TABLET" ? "Tablet" : "Mobile Phone"}</span>
                      <span>&bull;</span>
                      <span>
                        Last active:{" "}
                        {new Date(s.lastActiveAt || s.createdAt).toLocaleString("en-IN", {
                          dateStyle: "short",
                          timeStyle: "short",
                        })}
                      </span>
                    </div>
                  </div>
                </div>

                {!isThisDevice ? (
                  <button
                    type="button"
                    onClick={() => revoke(s.id)}
                    disabled={revokingId === s.id}
                    className="self-end sm:self-center px-3 py-1.5 rounded-xl text-xs font-semibold text-rose-500 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/40 border border-rose-200/40 transition disabled:opacity-50"
                  >
                    {revokingId === s.id ? "Signing out..." : "Sign Out"}
                  </button>
                ) : (
                  <span className="self-end sm:self-center text-xs text-teal-600 font-bold px-3 py-1.5">
                    Currently Active
                  </span>
                )}
              </div>
            );
          })}
        </div>
      )}

      <div className="p-3.5 rounded-xl bg-surface-container-lowest border border-outline-variant/20 text-xs text-on-surface-variant flex items-start gap-2.5">
        <span className="material-symbols-outlined text-base text-primary shrink-0 mt-0.5">
          verified_user
        </span>
        <p className="leading-relaxed">
          Your Atomic Pathshala account allows active sessions on your Laptop, Tablet, and Mobile phone. If you get a new device or phone, you can sign out previous devices here or choose to replace them when you log in.
        </p>
      </div>
    </div>
  );
}
