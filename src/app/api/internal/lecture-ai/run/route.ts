import { NextRequest, NextResponse } from "next/server";
import { runSteps, triggerRun } from "@/lib/recorded-lectures/ai/pipeline";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

function isAuthorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  // Fail closed in production: an unset secret must not leave the route open.
  if (!secret) return process.env.NODE_ENV !== "production";
  return req.headers.get("authorization") === `Bearer ${secret}`;
}

/**
 * Internal only: runs the lecture AI pass (transcript, translation, AI
 * voice) for up to ~4 minutes, saves progress, and hands over to a fresh
 * invocation when work remains. Called by the app itself (start, status
 * poll, daily cron) with CRON_SECRET — never by a browser.
 */
export async function POST(req: NextRequest) {
  if (!isAuthorized(req)) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  const body = await req.json().catch(() => ({}));
  const lectureId = typeof body?.lectureId === "string" ? body.lectureId : "";
  if (!lectureId) return NextResponse.json({ message: "lectureId required" }, { status: 400 });

  const r = await runSteps(lectureId, 250_000);
  if (r.more) triggerRun(lectureId);
  return NextResponse.json({ ok: true, ...r });
}
