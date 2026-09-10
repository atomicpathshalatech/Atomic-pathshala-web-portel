"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { isAppShell } from "@/lib/platform";

/**
 * Keeps the public marketing home page ("/") out of the installed app.
 *
 *   - Ordinary browser tab  → renders nothing, the website home shows as normal.
 *   - Installed PWA / native → covers the page with a splash and redirects:
 *       signed in     → /dashboard
 *       not signed in → /login
 *
 * The detection (display-mode / Capacitor) is client-only, so the marketing
 * markup is still sent by the server; this swaps it out on hydration before
 * the browser paints it for app users. The manifest `start_url` already
 * points installs at /dashboard — this covers the cases where an app user
 * still lands on "/" (logo tap, deep link, cold start, bookmark).
 */
export function AppEntryGate() {
  const router = useRouter();
  const { status } = useSession();
  const [inApp, setInApp] = useState(false);
  const [resolved, setResolved] = useState(false);

  // Run once on the client — isAppShell() needs `window`.
  useEffect(() => {
    setInApp(isAppShell());
    setResolved(true);
  }, []);

  useEffect(() => {
    if (!resolved || !inApp) return;
    if (status === "loading") return;
    router.replace(status === "authenticated" ? "/dashboard" : "/login");
  }, [resolved, inApp, status, router]);

  if (!resolved || !inApp) return null;

  return (
    <div
      className="fixed inset-0 z-[9999] grid place-items-center bg-[#090D16]"
      role="status"
      aria-label="Opening the app"
    >
      <span className="h-8 w-8 animate-spin rounded-full border-2 border-white/25 border-t-white" />
    </div>
  );
}
