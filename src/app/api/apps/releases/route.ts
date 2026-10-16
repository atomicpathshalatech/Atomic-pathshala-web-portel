import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { apiError, apiSuccess } from "@/lib/api/response";
import { APP_PLATFORMS, getLatestRelease } from "@/lib/apps/releases";

export const dynamic = "force-dynamic";

/** Version / size of the current app builds, for the Download App window. */
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return apiError("Unauthorized", 401);
  const entries = await Promise.all(
    APP_PLATFORMS.map(async (p) => {
      const r = await getLatestRelease(p);
      return [p, r ? { version: r.version, sizeBytes: r.sizeBytes, publishedAt: r.publishedAt, notes: r.notes } : null] as const;
    })
  );
  return apiSuccess(Object.fromEntries(entries));
}
