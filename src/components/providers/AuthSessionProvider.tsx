"use client";

import { SessionProvider } from "next-auth/react";
import type { ReactNode } from "react";

/**
 * `refetchOnWindowFocus` is disabled: every focus-triggered hit to
 * `/api/auth/session` re-runs the NextAuth `session` callback, which makes a
 * cross-region `DeviceSession` lookup in Postgres. Route navigations and API
 * calls still re-validate the session server-side via `getServerSession`, so
 * single-session enforcement is unaffected — this only stops a redundant
 * round trip each time the tab regains focus.
 */
export function AuthSessionProvider({ children }: { children: ReactNode }) {
  return <SessionProvider refetchOnWindowFocus={false}>{children}</SessionProvider>;
}
