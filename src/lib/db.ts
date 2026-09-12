import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

// Forces a safe Supabase pooler configuration in code, regardless of
// whatever is actually baked into the DATABASE_URL env var on Vercel.
//
// 1. PORT: Supabase's shared pooler hostname (`*.pooler.supabase.com`)
//    serves two completely different things on the same host — port 5432 is
//    PgBouncer SESSION mode, hard-capped at a small fixed number of total
//    client connections project-wide (confirmed directly against this
//    project: "FATAL: max clients reached in session mode - max clients are
//    limited to pool_size: 15"); port 6543 is TRANSACTION mode, the one
//    actually meant for a serverless app's bursty, short-lived connections.
//    If DATABASE_URL is ever set to the session-mode port (5432) — exactly
//    the same wrong-port mistake found and fixed earlier on a different
//    Supabase project this app used to point at — every concurrent
//    serverless invocation competes for the same 15-connection cap
//    project-wide, and requests start failing outright with "max clients
//    reached" under any real traffic. This forces port 6543 + pgbouncer=true
//    whenever the host looks like a Supabase pooler host, so the app can
//    never silently end up back on the session-mode port again.
// 2. connection_limit: independent of the port fix above, connection_limit=1
//    (set at one point to avoid pool exhaustion) means every Promise.all()
//    of independent queries inside a single request gets serialized onto
//    one connection — and several pages here (student dashboard, team
//    analytics) fire 9-11 independent queries per request. Forcing
//    connection_limit=5 lets those actually run concurrently.
//
// Both overrides always win, regardless of what's set on Vercel — no one
// needs to touch env vars for this to take effect.
function buildDatabaseUrl(): string | undefined {
  const raw = process.env.DATABASE_URL;
  if (!raw) return undefined;
  try {
    const url = new URL(raw);
    if (url.hostname.endsWith(".pooler.supabase.com")) {
      url.port = "6543";
      url.searchParams.set("pgbouncer", "true");
    }
    url.searchParams.set("connection_limit", "5");
    return url.toString();
  } catch {
    return raw;
  }
}

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    datasourceUrl: buildDatabaseUrl(),
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });

globalForPrisma.prisma = prisma;
