import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { requirePermission, UnauthorizedError } from "@/lib/rbac/guard";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { apiError, apiSuccess, handleApiError } from "@/lib/api/response";
import { uploadBufferToR2 } from "@/lib/storage/r2-client";
import { APP_FILE_EXTENSION, APP_PLATFORMS, getLatestRelease, manifestKey, type AppRelease } from "@/lib/apps/releases";

export const dynamic = "force-dynamic";

const schema = z.object({
  platform: z.enum(APP_PLATFORMS),
  fileAssetId: z.string().min(1),
  version: z.string().trim().min(1).max(30).regex(/^[0-9A-Za-z.\-+]+$/, "Version: numbers and dots, e.g. 1.0.3"),
  notes: z.string().trim().max(500).optional(),
});

async function authorize() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) throw new UnauthorizedError();
  await requirePermission(session.user.id, PERMISSIONS.APP_RELEASE_MANAGE);
  return session.user.id;
}

/** Current builds (App Releases page). */
export async function GET() {
  try {
    await authorize();
    const [windows, android] = await Promise.all(APP_PLATFORMS.map((p) => getLatestRelease(p)));
    return apiSuccess({ windows, android });
  } catch (error) {
    return handleApiError(error);
  }
}

/**
 * Publish an uploaded installer as the current build. The browser has
 * already sent the file straight to storage (it is far over the request size
 * limit); this checks that upload and points apps/<platform>/latest.json at it.
 */
export async function POST(request: NextRequest) {
  try {
    const userId = await authorize();
    const input = schema.parse(await request.json());

    const asset = await prisma.fileAsset.findUnique({ where: { id: input.fileAssetId } });
    if (!asset || asset.ownerId !== userId || asset.status !== "ACTIVE" || asset.visibility !== "PUBLIC") {
      return apiError("Uploaded file not found. Please upload it again.", 404);
    }
    const ext = APP_FILE_EXTENSION[input.platform];
    if (!asset.originalFilename.toLowerCase().endsWith(ext) || !asset.storageKey.toLowerCase().endsWith(ext)) {
      return apiError(`Please upload the ${ext} file for this app.`, 400);
    }

    const release: AppRelease = {
      platform: input.platform,
      version: input.version,
      key: asset.storageKey,
      fileName: asset.originalFilename,
      sizeBytes: Number(asset.sizeBytes) || null,
      publishedAt: new Date().toISOString(),
      notes: input.notes || null,
    };
    await uploadBufferToR2({
      key: manifestKey(input.platform),
      buffer: Buffer.from(JSON.stringify(release, null, 2)),
      contentType: "application/json",
    });

    await prisma.auditLog.create({
      data: {
        userId,
        action: "APP_RELEASE_PUBLISH",
        entityType: "AppRelease",
        entityId: input.platform,
        metadata: { version: release.version, key: release.key, sizeBytes: release.sizeBytes },
      },
    });

    return apiSuccess({ release });
  } catch (error) {
    return handleApiError(error);
  }
}
