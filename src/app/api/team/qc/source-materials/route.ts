import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { requirePermission, UnauthorizedError } from "@/lib/rbac/guard";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { apiSuccess, handleApiError } from "@/lib/api/response";
import {
  addChunksToSourceMaterial,
  createSourceMaterial,
  querySourceMaterials,
} from "@/lib/source-library/service";

const createSourceMaterialSchema = z.object({
  title: z.string().trim().min(2),
  category: z.enum([
    "NCERT_TEXTBOOK",
    "NCERT_EXEMPLAR",
    "ALLEN_MODULE",
    "PREVIOUS_YEAR_QUESTIONS",
    "REFERENCE_BOOK",
    "FACULTY_NOTES",
    "QUESTION_BANK",
    "OFFICIAL_ANSWER_KEY",
    "OTHER",
  ]),
  subject: z.enum(["PHYSICS", "CHEMISTRY", "BOTANY", "ZOOLOGY"]),
  classLevel: z.enum(["CLASS_11", "CLASS_12", "DROPPER"]),
  bookName: z.string().optional(),
  chapterNumber: z.number().int().optional(),
  chapterName: z.string().optional(),
  topicName: z.string().optional(),
  fileUrl: z.string().url(),
  storageKey: z.string().optional(),
  fileType: z.enum(["PDF", "IMAGE", "SCANNED_PDF"]).default("PDF"),
  fileSize: z.number().int().optional(),
  pageCount: z.number().int().optional(),
  editionYear: z.string().optional(),
  extractedText: z.string().optional(),
  metadata: z.record(z.any()).optional(),
  chunks: z
    .array(
      z.object({
        pageNumber: z.number().int(),
        chunkIndex: z.number().int(),
        topic: z.string().optional(),
        subtopic: z.string().optional(),
        content: z.string().min(1),
        bbox: z
          .object({
            x1: z.number(),
            y1: z.number(),
            x2: z.number(),
            y2: z.number(),
          })
          .optional(),
        figureUrl: z.string().url().optional(),
      })
    )
    .optional(),
});

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) throw new UnauthorizedError();
    await requirePermission(session.user.id, PERMISSIONS.QUESTION_VERIFY);

    const { searchParams } = new URL(req.url);
    const subject = searchParams.get("subject") || undefined;
    const classLevel = searchParams.get("classLevel") || undefined;
    const category = searchParams.get("category") || undefined;
    const chapterName = searchParams.get("chapterName") || undefined;
    const search = searchParams.get("search") || undefined;
    const page = searchParams.get("page") ? parseInt(searchParams.get("page")!, 10) : 1;
    const limit = searchParams.get("limit") ? parseInt(searchParams.get("limit")!, 10) : 20;

    const result = await querySourceMaterials({
      subject,
      classLevel,
      category,
      chapterName,
      search,
      page,
      limit,
    });

    return apiSuccess(result);
  } catch (err: any) {
    return handleApiError(err);
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) throw new UnauthorizedError();
    await requirePermission(session.user.id, PERMISSIONS.QUESTION_VERIFY);
    const userId = session.user.id;

    const body = createSourceMaterialSchema.parse(await req.json());

    const material = await createSourceMaterial({
      ...body,
      uploadedById: userId,
    });

    if (body.chunks && body.chunks.length > 0) {
      await addChunksToSourceMaterial(
        body.chunks.map((c) => ({
          ...c,
          sourceMaterialId: material.id,
        }))
      );
    }

    return apiSuccess(material);
  } catch (err: any) {
    return handleApiError(err);
  }
}
