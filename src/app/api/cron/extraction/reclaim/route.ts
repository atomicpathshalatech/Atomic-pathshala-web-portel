import { NextRequest, NextResponse } from "next/server";
import { waitUntil } from "@vercel/functions";
import { reclaimStaleExtractionJobs } from "@/lib/extraction/process-job";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function isAuthorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  // Fail closed in production: an unset secret must not leave the route open.
  if (!secret) return process.env.NODE_ENV !== "production";
  const auth = req.headers.get("authorization");
  return auth === `Bearer ${secret}`;
}

/**
 * Server-side safety net for stuck PDF-extraction jobs.
 *
 * A job is PROCESSING while its browser runner (the extraction page) or the
 * serverless invocation that started it drives chunks. If that runner dies —
 * tab closed, invocation timed out — the job is orphaned at whatever % it
 * reached. reclaimStaleExtractionJobs() already heals such jobs server-side,
 * and the jobs-list endpoint fires it via waitUntil on every poll — but ONLY
 * while someone has the extraction page open. A job orphaned when nobody is
 * looking sits in PROCESSING indefinitely (observed: jobs stuck for a full day
 * until the page was reopened). This cron is that missing wakeup: it runs the
 * same reclaimer on a schedule so orphans heal with nobody watching.
 *
 * Scheduled once daily (matching every other cron in this project) — Vercel's
 * Hobby plan rejects the whole deployment if any cron runs more often than once
 * a day. On Pro or above this could run every few minutes for much faster
 * recovery; worth revisiting if the account is upgraded. Until then, active use
 * still heals promptly via the jobs-list poll; this only backstops idle orphans.
 *
 * Returns immediately and does the work in waitUntil: a single reclaim can
 * advance several jobs, each up to its own time budget, which would otherwise
 * risk the function's request timeout. maxJobs is higher than the poll path's
 * default so one daily sweep clears a backlog rather than two jobs at a time.
 */
export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  waitUntil(
    reclaimStaleExtractionJobs({ maxJobs: 10 }).catch((e) =>
      console.error("[cron/extraction/reclaim] failed:", e)
    )
  );

  return NextResponse.json({ ok: true, message: "Stale extraction-job reclaim started." });
}
