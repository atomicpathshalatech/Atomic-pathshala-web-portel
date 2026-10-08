import "server-only";
import { prisma } from "@/lib/db";

/**
 * YouTube Data API quota accounting.
 *
 * Google gives a project a fixed number of quota UNITS per day (10,000 by
 * default), reset at midnight Pacific time; every request costs units by its
 * kind. Google has no API to ask "how much is left", so every call Atomic
 * makes is recorded here with its cost — the admin dashboard adds them up, and
 * the team sees the quota running low before a class fails to start.
 *
 * Rows live in the audit log (action YOUTUBE_API_CALL), so no new table.
 */

export const YOUTUBE_USAGE_ACTION = "YOUTUBE_API_CALL";

export function youtubeDailyQuotaLimit(): number {
  const n = Number(process.env.YOUTUBE_DAILY_QUOTA);
  return Number.isFinite(n) && n > 0 ? n : 10_000;
}

/** Quota units one request costs (Google's published costs). */
export function youtubeCallCost(method: string, path: string): number {
  const m = method.toUpperCase();
  const p = path.split("?")[0]!.toLowerCase();
  if (m === "GET") {
    if (p.startsWith("/search")) return 100;
    if (p.startsWith("/livechat/messages")) return 5;
    return 1;
  }
  if (p.startsWith("/videos") && m === "POST") return 1600; // an upload
  return 50; // insert / update / delete / bind / transition
}

export type YoutubeCallRecord = {
  channel: string;
  operation: string;
  method: string;
  path: string;
  ok: boolean;
  status: number | null;
  kind?: string | null;
  reason?: string | null;
};

/** Never throws and never delays the caller. */
export function recordYoutubeCall(call: YoutubeCallRecord): void {
  const cost = youtubeCallCost(call.method, call.path);
  prisma.auditLog
    .create({
      data: {
        action: YOUTUBE_USAGE_ACTION,
        entityType: "YoutubeApi",
        entityId: call.operation.slice(0, 120),
        metadata: {
          channel: call.channel,
          method: call.method,
          cost,
          ok: call.ok,
          status: call.status,
          ...(call.kind ? { kind: call.kind } : {}),
          ...(call.reason ? { reason: call.reason } : {}),
        },
      },
    })
    .catch((err) => console.warn("[youtube_usage_record_failed]", err instanceof Error ? err.message : err));
}

/** Start of the current quota day (midnight in Los Angeles) and the next reset. */
export function youtubeQuotaDay(now = new Date()): { start: Date; reset: Date } {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Los_Angeles",
    hour12: false,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(now);
  const get = (t: string) => Number(parts.find((x) => x.type === t)?.value ?? 0);
  const sinceMidnightMs = ((get("hour") % 24) * 3600 + get("minute") * 60 + get("second")) * 1000 + now.getMilliseconds();
  const start = new Date(now.getTime() - sinceMidnightMs);
  return { start, reset: new Date(start.getTime() + 24 * 3600_000) };
}

export type YoutubeUsageSummary = {
  limit: number;
  usedToday: number;
  remainingToday: number;
  requestsToday: number;
  requestsThisMonth: number;
  unitsThisMonth: number;
  resetAt: string;
  byEndpointToday: { operation: string; requests: number; units: number; failed: number }[];
  lastQuotaError: { at: string; operation: string; reason: string | null } | null;
  lastErrors: { at: string; operation: string; kind: string | null; reason: string | null; status: number | null }[];
  daily: { day: string; units: number; requests: number }[];
};

type Row = { entityId: string | null; metadata: unknown; createdAt: Date };
const meta = (r: Row) => (r.metadata && typeof r.metadata === "object" ? (r.metadata as Record<string, unknown>) : {});
const costOf = (r: Row) => (typeof meta(r).cost === "number" ? (meta(r).cost as number) : 0);

export async function getYoutubeUsageSummary(now = new Date()): Promise<YoutubeUsageSummary> {
  const { start, reset } = youtubeQuotaDay(now);
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const weekStart = new Date(start.getTime() - 6 * 24 * 3600_000);
  const from = monthStart < weekStart ? monthStart : weekStart;

  const rows: Row[] = await prisma.auditLog.findMany({
    where: { action: YOUTUBE_USAGE_ACTION, createdAt: { gte: from } },
    select: { entityId: true, metadata: true, createdAt: true },
    orderBy: { createdAt: "desc" },
    take: 50_000,
  });

  const today = rows.filter((r) => r.createdAt >= start);
  const usedToday = today.reduce((n, r) => n + costOf(r), 0);
  const byOp = new Map<string, { operation: string; requests: number; units: number; failed: number }>();
  for (const r of today) {
    const key = r.entityId ?? "unknown";
    const cur = byOp.get(key) ?? { operation: key, requests: 0, units: 0, failed: 0 };
    cur.requests++;
    cur.units += costOf(r);
    if (meta(r).ok === false) cur.failed++;
    byOp.set(key, cur);
  }
  const month = rows.filter((r) => r.createdAt >= monthStart);
  const failures = rows.filter((r) => meta(r).ok === false);
  const quotaErr = failures.find((r) => meta(r).kind === "QUOTA");

  const dayKey = (d: Date) => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Los_Angeles" }).format(d);
  const daily = new Map<string, { day: string; units: number; requests: number }>();
  for (let i = 6; i >= 0; i--) {
    const k = dayKey(new Date(start.getTime() - i * 24 * 3600_000 + 3600_000));
    daily.set(k, { day: k, units: 0, requests: 0 });
  }
  for (const r of rows) {
    const d = daily.get(dayKey(r.createdAt));
    if (d) {
      d.units += costOf(r);
      d.requests++;
    }
  }

  const limit = youtubeDailyQuotaLimit();
  return {
    limit,
    usedToday,
    remainingToday: Math.max(0, limit - usedToday),
    requestsToday: today.length,
    requestsThisMonth: month.length,
    unitsThisMonth: month.reduce((n, r) => n + costOf(r), 0),
    resetAt: reset.toISOString(),
    byEndpointToday: Array.from(byOp.values()).sort((a, b) => b.units - a.units),
    lastQuotaError: quotaErr
      ? { at: quotaErr.createdAt.toISOString(), operation: quotaErr.entityId ?? "unknown", reason: (meta(quotaErr).reason as string) ?? null }
      : null,
    lastErrors: failures.slice(0, 20).map((r) => ({
      at: r.createdAt.toISOString(),
      operation: r.entityId ?? "unknown",
      kind: (meta(r).kind as string) ?? null,
      reason: (meta(r).reason as string) ?? null,
      status: typeof meta(r).status === "number" ? (meta(r).status as number) : null,
    })),
    daily: Array.from(daily.values()),
  };
}

/** Units still available today (for a warning before a class is started). */
export async function youtubeQuotaRemainingToday(): Promise<number> {
  const { start } = youtubeQuotaDay();
  const rows: Row[] = await prisma.auditLog.findMany({
    where: { action: YOUTUBE_USAGE_ACTION, createdAt: { gte: start } },
    select: { entityId: true, metadata: true, createdAt: true },
    take: 20_000,
  });
  return Math.max(0, youtubeDailyQuotaLimit() - rows.reduce((n, r) => n + costOf(r), 0));
}
