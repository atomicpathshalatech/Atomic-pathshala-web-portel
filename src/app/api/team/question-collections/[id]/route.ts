import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { requirePermission, UnauthorizedError } from "@/lib/rbac/guard";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { apiError, apiSuccess, handleApiError } from "@/lib/api/response";

export const dynamic = "force-dynamic";

async function session(permission: string) {
  const s = await getServerSession(authOptions);
  if (!s?.user?.id) throw new UnauthorizedError();
  await requirePermission(s.user.id, permission as never);
  return s.user.id;
}

/** One collection and its questions (newest added first). */
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    await session(PERMISSIONS.QUESTION_READ);
    const c = await prisma.questionCollection.findUnique({
      where: { id: params.id },
      select: {
        id: true,
        name: true,
        description: true,
        items: {
          orderBy: { addedAt: "desc" },
          take: 500,
          select: {
            addedAt: true,
            question: {
              select: {
                id: true,
                questionCode: true,
                subject: true,
                chapter: true,
                type: true,
                status: true,
                translations: { select: { language: true, statement: true }, take: 2 },
              },
            },
          },
        },
      },
    });
    if (!c) return apiError("Collection not found", 404);
    return apiSuccess({
      collection: {
        id: c.id,
        name: c.name,
        description: c.description,
        questions: c.items.map(({ addedAt, question: q }) => {
          const t = q.translations.find((x) => x.language.toUpperCase() === "ENGLISH") ?? q.translations[0];
          return {
            id: q.id,
            questionCode: q.questionCode,
            subject: q.subject,
            chapter: q.chapter,
            type: q.type,
            status: q.status,
            addedAt,
            preview: (t?.statement ?? "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().slice(0, 160),
          };
        }),
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}

const itemSchema = z.object({ questionId: z.string().min(1), action: z.enum(["add", "remove"]) });

/** Add a question to the collection, or take it out (the question itself is not touched). */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const userId = await session(PERMISSIONS.QUESTION_UPDATE);
    const body = itemSchema.parse(await req.json());
    const c = await prisma.questionCollection.findUnique({ where: { id: params.id }, select: { id: true } });
    if (!c) return apiError("Collection not found", 404);
    if (body.action === "add") {
      if (!(await prisma.question.findUnique({ where: { id: body.questionId }, select: { id: true } }))) return apiError("Question not found", 404);
      await prisma.questionCollectionItem.upsert({
        where: { collectionId_questionId: { collectionId: c.id, questionId: body.questionId } },
        create: { collectionId: c.id, questionId: body.questionId, addedById: userId },
        update: {},
      });
    } else {
      await prisma.questionCollectionItem.deleteMany({ where: { collectionId: c.id, questionId: body.questionId } });
    }
    await prisma.questionCollection.update({ where: { id: c.id }, data: { updatedAt: new Date() } });
    const count = await prisma.questionCollectionItem.count({ where: { collectionId: c.id } });
    return apiSuccess({ count });
  } catch (error) {
    return handleApiError(error);
  }
}

const renameSchema = z.object({ name: z.string().trim().min(1).max(120), description: z.string().trim().max(500).optional() });

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    await session(PERMISSIONS.QUESTION_UPDATE);
    const body = renameSchema.parse(await req.json());
    const clash = await prisma.questionCollection.findFirst({ where: { id: { not: params.id }, name: { equals: body.name, mode: "insensitive" } }, select: { id: true } });
    if (clash) return apiError("A collection with this name already exists.", 409);
    const c = await prisma.questionCollection.update({ where: { id: params.id }, data: { name: body.name, description: body.description ?? undefined }, select: { id: true, name: true } });
    return apiSuccess({ collection: c });
  } catch (error) {
    return handleApiError(error);
  }
}

/** Deletes the collection (the list only — its questions stay in the Question Bank). */
export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    await session(PERMISSIONS.QUESTION_UPDATE);
    await prisma.questionCollection.delete({ where: { id: params.id } });
    return apiSuccess({ deleted: true });
  } catch (error) {
    return handleApiError(error);
  }
}
