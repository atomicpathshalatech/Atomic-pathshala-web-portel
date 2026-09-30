import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { isSuperAdmin } from "@/lib/rbac/super-admin";
import { allClassVideoIds } from "@/lib/teaching/stats";
import { refreshYoutubeVideoStats } from "@/lib/youtube/video-stats";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** POST (form on the Performance page) — refresh YouTube lengths + views now. Super Admin only. */
export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!(await isSuperAdmin(session?.user?.id))) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  let refreshed = "fail";
  try {
    const ids = await allClassVideoIds();
    const res = await refreshYoutubeVideoStats(ids);
    if (res.ok) refreshed = String(res.updated);
  } catch (err) {
    console.warn("[performance_refresh_youtube]", err instanceof Error ? err.message : err);
  }
  return NextResponse.redirect(new URL(`/team/performance?tab=teachers&refreshed=${refreshed}`, request.url), 303);
}
