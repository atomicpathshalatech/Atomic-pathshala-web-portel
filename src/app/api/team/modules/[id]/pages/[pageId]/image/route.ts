import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { requirePermission, UnauthorizedError } from "@/lib/rbac/guard";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/response";
import { uploadFile, StorageNotConfiguredError } from "@/lib/storage";

// Image uploads for an IMAGE block on a Module page. Returns the public
// URL only — the client is responsible for inserting it into the block's
// content as `![](url)`, the same inline-image convention the Question
// Bank's formula renderer already uses (src/lib/test-portal/formula.ts),
// so Note Studio doesn't invent a second image syntax.
const MAX_BYTES = 8 * 1024 * 1024;
const ALLOWED_TYPES: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

export async function POST(request: NextRequest, { params }: { params: { id: string; pageId: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) throw new UnauthorizedError();
    await requirePermission(session.user.id, PERMISSIONS.MODULE_UPDATE);

    const page = await prisma.modulePage.findFirst({ where: { id: params.pageId, moduleId: params.id } });
    if (!page) return apiError("Page not found", 404);

    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File)) return apiError("No image was uploaded.", 400);

    const extension = ALLOWED_TYPES[file.type];
    if (!extension) return apiError("Please upload a JPG, PNG or WEBP image.", 400);
    if (file.size > MAX_BYTES) return apiError("Image is too large — please keep it under 8MB.", 400);

    const buffer = Buffer.from(await file.arrayBuffer());
    const key = `module-images/${params.id}/${params.pageId}-${Date.now()}.${extension}`;
    const url = await uploadFile({ key, body: buffer, contentType: file.type });

    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        action: "MODULE_IMAGE_UPLOADED",
        entityType: "ModulePage",
        entityId: params.pageId,
      },
    });

    return apiSuccess({ url });
  } catch (error) {
    if (error instanceof StorageNotConfiguredError) return apiError(error.message, 503);
    return handleApiError(error);
  }
}
