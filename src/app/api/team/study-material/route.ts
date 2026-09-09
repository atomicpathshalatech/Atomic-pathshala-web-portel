import { NextRequest } from "next/server";
import { z } from "zod";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { requirePermission, UnauthorizedError } from "@/lib/rbac/guard";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/response";
import { isStudyMaterialType } from "@/lib/study-material";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const createSchema = z.object({
  chapterId: z.string().min(1),
  type: z.string().refine(isStudyMaterialType, "Invalid study material type"),
  title: z.string().trim().min(1).max(200),
  // `fileUrl` holds the FileAsset id returned by the R2 upload — the student
  // file route resolves it to a presigned URL with the right disposition.
  fileUrl: z.string().min(1),
  fileName: z.string().trim().min(1).max(300),
  sizeBytes: z.number().int().nonnegative().optional(),
  mimeType: z.string().optional(),
});

/** GET /api/team/study-material?chapterId=... — every material for a chapter (published or not). */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) throw new UnauthorizedError();
    await requirePermission(session.user.id, PERMISSIONS.STUDY_MATERIAL_MANAGE);

    const chapterId = request.nextUrl.searchParams.get("chapterId");
    if (!chapterId) return apiError("chapterId is required", 400);

    const materials = await prisma.studyMaterial.findMany({
      where: { chapterId },
      orderBy: [{ type: "asc" }, { order: "asc" }, { createdAt: "asc" }],
    });
    return apiSuccess({ materials });
  } catch (error) {
    return handleApiError(error);
  }
}

/** POST /api/team/study-material — add one uploaded PDF to a chapter. */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) throw new UnauthorizedError();
    await requirePermission(session.user.id, PERMISSIONS.STUDY_MATERIAL_MANAGE);

    const input = createSchema.parse(await request.json());

    const chapter = await prisma.chapter.findUnique({
      where: { id: input.chapterId },
      select: { id: true },
    });
    if (!chapter) return apiError("Chapter not found", 404);

    const last = await prisma.studyMaterial.findFirst({
      where: { chapterId: input.chapterId, type: input.type as never },
      orderBy: { order: "desc" },
      select: { order: true },
    });

    const material = await prisma.studyMaterial.create({
      data: {
        chapterId: input.chapterId,
        type: input.type as never,
        title: input.title,
        fileUrl: input.fileUrl,
        fileName: input.fileName,
        sizeBytes: input.sizeBytes ?? 0,
        mimeType: input.mimeType || "application/pdf",
        order: (last?.order ?? -1) + 1,
        createdById: session.user.id,
      },
    });

    return apiSuccess({ material }, 201);
  } catch (error) {
    return handleApiError(error);
  }
}
