import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { applyVideoMapping, pushLectures, syncLectureSheet } from "@/lib/lecture-sheet/sync";
import { verifySignedRequest } from "@/lib/lecture-sheet/signature";
import { googleSheetsClient, SheetsNotConfiguredError } from "@/lib/lecture-sheet/sheets-client";
import { sheetId } from "@/lib/lecture-sheet/columns";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * Called by the lecture Sheet's Apps Script when someone fills a YouTube link
 * in a row (docs/LECTURE_SHEET_SETUP.md). Signed with LECTURE_SHEET_WEBHOOK_SECRET;
 * see src/lib/lecture-sheet/signature.ts. The answer tells the script what to
 * show in the row's sync_status cell.
 */
const bodySchema = z.object({
  lecture_id: z.string().trim().min(1).max(100),
  youtube_video_id: z.string().max(500).optional().nullable(),
  youtube_video_url: z.string().max(500).optional().nullable(),
  youtube_live_url: z.string().max(500).optional().nullable(),
});

// Per-instance limit: plenty for people editing a Sheet, stops a flood.
const hits: number[] = [];
const LIMIT_PER_MINUTE = 120;

export async function POST(req: NextRequest) {
  const now = Date.now();
  while (hits.length && hits[0]! < now - 60_000) hits.shift();
  if (hits.length >= LIMIT_PER_MINUTE) return NextResponse.json({ ok: false, error: "too many requests" }, { status: 429 });
  hits.push(now);

  const rawBody = await req.text();
  if (rawBody.length > 4000) return NextResponse.json({ ok: false, error: "request too large" }, { status: 413 });
  const verified = verifySignedRequest({
    secret: process.env.LECTURE_SHEET_WEBHOOK_SECRET,
    timestamp: req.headers.get("x-atomic-timestamp"),
    signature: req.headers.get("x-atomic-signature"),
    rawBody,
  });
  if (!verified.ok) {
    console.warn("[lecture_sheet_webhook_refused]", verified.reason);
    return NextResponse.json({ ok: false, error: verified.reason }, { status: 401 });
  }

  // {"action":"sync"} from the Sheet's 30-minute timer: the full round (classes → Sheet, links → classes).
  // (Vercel runs our own cron only once a day on this plan.)
  let parsed: unknown;
  try {
    parsed = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ ok: false, error: "invalid request" }, { status: 400 });
  }
  if ((parsed as { action?: string })?.action === "sync") {
    if (!sheetId()) return NextResponse.json({ ok: false, error: "LECTURE_SHEET_ID is not set on the server" }, { status: 400 });
    try {
      return NextResponse.json({ ok: true, ...(await syncLectureSheet(googleSheetsClient(sheetId()))) });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error("[lecture_sheet_sync_failed]", message);
      return NextResponse.json({ ok: false, error: message }, { status: err instanceof SheetsNotConfiguredError ? 400 : 500 });
    }
  }

  let body: z.infer<typeof bodySchema>;
  try {
    body = bodySchema.parse(parsed);
  } catch {
    return NextResponse.json({ ok: false, error: "invalid request" }, { status: 400 });
  }

  const result = await applyVideoMapping({
    lectureRef: body.lecture_id,
    inputs: { videoId: body.youtube_video_id, videoUrl: body.youtube_video_url, liveUrl: body.youtube_live_url },
    source: "SHEET_WEBHOOK",
  });

  // Refresh that row's app columns (status, recording status) when the Sheet API is set up.
  if (result.scheduleId && result.status !== "UNCHANGED" && sheetId()) {
    try {
      await pushLectures(googleSheetsClient(sheetId()), { scheduleIds: [result.scheduleId] });
    } catch (err) {
      if (!(err instanceof SheetsNotConfiguredError)) console.warn("[lecture_sheet_row_refresh_failed]", err instanceof Error ? err.message : err);
    }
  }

  const message =
    result.status === "APPLIED" ? `LINKED ${result.videoId}` : result.status === "UNCHANGED" ? "SYNCED (no change)" : `REJECTED: ${result.reason}`;
  return NextResponse.json({ ok: result.status !== "REJECTED", status: result.status, message, videoId: result.videoId ?? null });
}
