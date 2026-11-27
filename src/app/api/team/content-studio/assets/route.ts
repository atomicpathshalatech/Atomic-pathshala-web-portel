import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { StudioAssetType } from "@prisma/client";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requirePermission, UnauthorizedError } from "@/lib/rbac/guard";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { apiError, apiSuccess, handleApiError } from "@/lib/api/response";
import { persistGeneratedStudioAsset } from "@/lib/ai-studio/storage";

const VALID_ASSET_TYPES = new Set<string>([
  "IMAGE",
  "THUMBNAIL",
  "VIDEO_CLIP",
  "AUDIO",
  "VOICEOVER",
  "MUSIC",
  "SFX",
  "SCRIPT",
  "SLIDE",
  "PDF",
  "CAPTION",
  "EXPORTED_VIDEO",
]);

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) throw new UnauthorizedError();
    await requirePermission(session.user.id, PERMISSIONS.CONTENT_STUDIO_ASSETS);

    const q = req.nextUrl.searchParams.get("q")?.trim();
    const assetType = req.nextUrl.searchParams.get("assetType");
    const projectId = req.nextUrl.searchParams.get("projectId");
    const tag = req.nextUrl.searchParams.get("tag")?.trim();

    const assets = await prisma.generatedAsset.findMany({
      where: {
        ...(assetType && VALID_ASSET_TYPES.has(assetType)
          ? { assetType: assetType as StudioAssetType }
          : {}),
        ...(projectId ? { projectId } : {}),
        ...(tag ? { tags: { has: tag } } : {}),
        ...(q
          ? {
              OR: [
                { title: { contains: q, mode: "insensitive" } },
                { prompt: { contains: q, mode: "insensitive" } },
                { tags: { has: q } },
              ],
            }
          : {}),
      },
      include: {
        project: { select: { id: true, title: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 80,
    });

    return apiSuccess({ assets });
  } catch (err) {
    return handleApiError(err);
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) throw new UnauthorizedError();
    await requirePermission(session.user.id, PERMISSIONS.CONTENT_STUDIO_ASSETS);

    const form = await req.formData();
    const file = form.get("file");
    if (!(file instanceof File)) {
      return apiError("A file is required", 400);
    }

    const assetTypeRaw = String(form.get("assetType") || "IMAGE").toUpperCase();
    const assetType: StudioAssetType = VALID_ASSET_TYPES.has(assetTypeRaw)
      ? (assetTypeRaw as StudioAssetType)
      : "IMAGE";
    const projectId = form.get("projectId") ? String(form.get("projectId")) : undefined;
    const title = form.get("title") ? String(form.get("title")).trim() : file.name;
    const tagsRaw = form.get("tags") ? String(form.get("tags")) : "";
    const tags = tagsRaw
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean)
      .slice(0, 15);

    const maxBytes = 50 * 1024 * 1024; // 50 MB direct server limit
    if (file.size > maxBytes) {
      return apiError("File exceeds 50 MB server upload limit", 413);
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const { generatedAsset } = await persistGeneratedStudioAsset({
      userId: session.user.id,
      projectId,
      assetType,
      buffer,
      filename: file.name,
      mimeType: file.type || "application/octet-stream",
      title,
      tags,
    });

    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        action: "CONTENT_STUDIO_ASSET_UPLOAD",
        entityType: "GeneratedAsset",
        entityId: generatedAsset.id,
        metadata: { title, assetType, projectId: projectId ?? null, sizeBytes: file.size },
      },
    });

    return apiSuccess({ asset: generatedAsset }, 201);
  } catch (err) {
    return handleApiError(err);
  }
}
