import { NextRequest, NextResponse } from "next/server";
import { syncLectureSheet } from "@/lib/lecture-sheet/sync";
import { googleSheetsClient, SheetsNotConfiguredError } from "@/lib/lecture-sheet/sheets-client";
import { sheetId } from "@/lib/lecture-sheet/columns";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

/** Same convention as the other cron routes: Bearer CRON_SECRET; closed in production without it. */
function isAuthorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return process.env.NODE_ENV !== "production";
  return req.headers.get("authorization") === `Bearer ${secret}`;
}

/**
 * Once a day (Vercel cron on this plan; the Sheet's own timer runs it every 30 minutes): new / edited classes go to the lecture Sheet, links typed in
 * the Sheet go to their classes (this also catches edits the Apps Script missed),
 * failed rows are retried.
 */
export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!sheetId()) return NextResponse.json({ skipped: "LECTURE_SHEET_ID is not set" });
  try {
    const result = await syncLectureSheet(googleSheetsClient(sheetId()));
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[lecture_sheet_cron_failed]", message);
    return NextResponse.json({ ok: false, error: message }, { status: err instanceof SheetsNotConfiguredError ? 200 : 500 });
  }
}
