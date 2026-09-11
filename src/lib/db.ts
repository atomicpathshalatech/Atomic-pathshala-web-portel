import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

// Forces a safe PgBouncer connection pool size in code, regardless of
// whatever `connection_limit` value is baked into the DATABASE_URL env var
// on Vercel. connection_limit=1 (set to avoid pool exhaustion under
// concurrent serverless invocations) also means every Promise.all() of
// independent queries inside a single request gets serialized onto that one
// connection — and several pages here (student dashboard, team analytics)
// fire 9-11 independent queries per request. Combined with the DB being
// cross-region from the Vercel function (~1s round trip per query, see
// requireStudentSession's comment in ./auth/session.ts), that serialization
// turned ordinary page loads into 10+ second requests that time out with a
// bare "Something went wrong". connection_limit=5 lets those queries
// actually run concurrently, without needing anyone to touch Vercel's env
// vars — this override always wins.
function buildDatabaseUrl(): string | undefined {
  const raw = process.env.DATABASE_URL;
  if (!raw) return undefined;
  try {
    const url = new URL(raw);
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
