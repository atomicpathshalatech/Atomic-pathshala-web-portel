import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

function isAuthorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return true;
  return req.headers.get("authorization") === `Bearer ${secret}`;
}

/**
 * Internal-only continuation endpoint for the YouTube recording-archive
 * pipeline's chunked resumable upload (src/lib/youtube/archive-service.ts).
 * Never called by a browser or any external client — only by the archive
 * service's own unawaited self-continuation call, so a large recording's
 * upload keeps moving forward chunk-by-chunk across many short serverless
 * invocations instead of waiting for the once-daily cron safety net.
 * Reuses CRON_SECRET (already provisioned for the other cron routes) rather
 * than introducing a second secret, since the only legitimate caller is
 * this app itself.
 */
export async function POST(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  let whiteboardSessionId: string | undefined;
  try {
    const body = await req.json();
    whiteboardSessionId = body?.whiteboardSessionId;
  } catch {
    return NextResponse.json({ success: false, error: "Invalid JSON body" }, { status: 400 });
  }
  if (!whiteboardSessionId) {
    return NextResponse.json({ success: false, error: "whiteboardSessionId is required" }, { status: 400 });
  }

  try {
    const { runArchiveUpload } = await import("@/lib/youtube/archive-service");
    await runArchiveUpload(whiteboardSessionId);
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("[youtube_archive_continue_error]", whiteboardSessionId, error);
    return NextResponse.json({ success: false, error: error?.message || "Internal error" }, { status: 500 });
  }
}
