import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { apiError } from "@/lib/api/response";
import { getLatestRelease, isAppPlatform, releaseDownloadUrl } from "@/lib/apps/releases";

export const dynamic = "force-dynamic";

/**
 * Download the current Windows (.exe) or Android (.apk) app. One app for
 * everyone: it opens the portal of whoever signs in (student → student
 * portal, team → team portal), so any signed-in user may download it.
 */
export async function GET(_request: NextRequest, { params }: { params: { platform: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return apiError("Please log in to download the app.", 401);
  if (!isAppPlatform(params.platform)) return apiError("Unknown app.", 404);

  const release = await getLatestRelease(params.platform);
  if (!release) {
    return apiError(
      params.platform === "android" ? "The Android app hasn't been published yet." : "The Windows app isn't available right now.",
      404
    );
  }
  return NextResponse.redirect(releaseDownloadUrl(release), 302);
}
