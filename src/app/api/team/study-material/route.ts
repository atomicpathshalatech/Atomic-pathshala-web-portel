import { NextRequest } from "next/server";
import { z } from "zod";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { requirePermission, UnauthorizedError } from "@/lib/rbac/guard";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/response";
import { validateModuleInput } from "@/lib/study-material";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const createSchema = z.object({
  classExam: z.enum(["CLASS_11", "CLASS_12", "NEET", "JEE"]),
  subject: z.string().trim().min(1),
  ncertChapterId: z.string().trim().min(1).nullable().optional(),
  chapterTitle: z.string().trim().min(1).max(300),
  chapterClass: z.number().int().nullable().optional(),
  isCustomChapter: z.boolean().optional(),
  language: z.enum(["HINDI", "ENGLISH"]),
  type: z.enum([
    "MODULE",
    "SHORT_NOTES",
    "MIND_MAP",
    "FORMULA_SHEET",
    "NCERT_HIGHLIGHTED",
    "NCERT_EXEMPLAR",
    "NEET_PYQ",
    "JEE_PYQ",
  ]),
  title: z.string().trim().min(1).max(200),
  // `fileUrl` holds the FileAsset id returned by the R2 upload.
  fileUrl: z.string().min(1),
  fileName: z.string().trim().min(1).max(300),
  sizeBytes: z.number().int().nonnegative().optional(),
  mimeType: z.string().optional(),
});

/**
 * GET /api/team/study-material?classExam=&subject=&language=&ncertChapterId=&custom=1
 * Lists matching materials (published or not) for the admin manager.
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) throw new UnauthorizedError();
    await requirePermission(session.user.id, PERMISSIONS.STUDY_MATERIAL_MANAGE);

    const sp = request.nextUrl.searchParams;
    const classExam = sp.get("classExam");
    const subject = sp.get("subject");
    if (!classExam || !subject) return apiError("classExam and subject are required", 400);

    const language = sp.get("language");
    const ncertChapterId = sp.get("ncertChapterId");
    const custom = sp.get("custom");
    const chapterTitle = sp.get("chapterTitle");

    const materials = await prisma.studyMaterial.findMany({
      where: {
        classExam: classExam as never,
        subject,
        ...(language ? { language: language as never } : {}),
        ...(custom === "1" && chapterTitle
          ? { isCustomChapter: true, chapterTitle }
          : ncertChapterId
          ? { ncertChapterId }
          : {}),
      },
      orderBy: [{ type: "asc" }, { order: "asc" }, { createdAt: "asc" }],
    });
    return apiSuccess({ materials });
  } catch (error) {
    return handleApiError(error);
  }
}

/** POST /api/team/study-material — create one module row. */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) throw new UnauthorizedError();
    await requirePermission(session.user.id, PERMISSIONS.STUDY_MATERIAL_MANAGE);

    const input = createSchema.parse(await request.json());
    const isCustom = !!input.isCustomChapter;

    const err = validateModuleInput({
      classExam: input.classExam,
      subject: input.subject,
      ncertChapterId: isCustom ? null : input.ncertChapterId ?? null,
      chapterTitle: input.chapterTitle,
      chapterClass: input.chapterClass ?? null,
      isCustomChapter: isCustom,
      language: input.language,
      type: input.type,
      title: input.title,
      fileUrl: input.fileUrl,
      fileName: input.fileName,
    });
    if (err) return apiError(err, 422);

    const last = await prisma.studyMaterial.findFirst({
      where: {
        classExam: input.classExam as never,
        subject: input.subject,
        language: input.language as never,
        type: input.type as never,
        ...(isCustom
          ? { isCustomChapter: true, chapterTitle: input.chapterTitle }
          : { ncertChapterId: input.ncertChapterId ?? undefined }),
      },
      orderBy: { order: "desc" },
      select: { order: true },
    });

    const material = await prisma.studyMaterial.create({
      data: {
        classExam: input.classExam as never,
        subject: input.subject,
        ncertChapterId: isCustom ? null : input.ncertChapterId ?? null,
        chapterTitle: input.chapterTitle,
        chapterClass: isCustom ? null : input.chapterClass ?? null,
        isCustomChapter: isCustom,
        language: input.language as never,
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
