import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { requirePermission, UnauthorizedError } from "@/lib/rbac/guard";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { apiError, apiSuccess, handleApiError } from "@/lib/api/response";

export const dynamic = "force-dynamic";

/** Every collection with its size. ?questionId= also says which ones hold that question. */
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) throw new UnauthorizedError();
    await requirePermission(session.user.id, PERMISSIONS.QUESTION_READ);

    const questionId = req.nextUrl.searchParams.get("questionId");
    const [collections, holding] = await Promise.all([
      prisma.questionCollection.findMany({
        orderBy: { updatedAt: "desc" },
        select: { id: true, name: true, description: true, createdAt: true, updatedAt: true, _count: { select: { items: true } } },
      }),
      questionId ? prisma.questionCollectionItem.findMany({ where: { questionId }, select: { collectionId: true } }) : Promise.resolve([]),
    ]);
    const holds = new Set(holding.map((h) => h.collectionId));
    return apiSuccess({
      collections: collections.map((c) => ({ id: c.id, name: c.name, description: c.description, count: c._count.items, updatedAt: c.updatedAt, hasQuestion: holds.has(c.id) })),
    });
  } catch (error) {
    return handleApiError(error);
  }
}

const createSchema = z.object({
  name: z.string().trim().min(1).max(120),
  description: z.string().trim().max(500).optional(),
  questionId: z.string().min(1).optional(), // add this question straight away
});

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) throw new UnauthorizedError();
    await requirePermission(session.user.id, PERMISSIONS.QUESTION_UPDATE);

    const body = createSchema.parse(await req.json());
    const exists = await prisma.questionCollection.findFirst({ where: { name: { equals: body.name, mode: "insensitive" } }, select: { id: true } });
    if (exists) return apiError("A collection with this name already exists.", 409);
    if (body.questionId && !(await prisma.question.findUnique({ where: { id: body.questionId }, select: { id: true } }))) {
      return apiError("Question not found", 404);
    }
    const collection = await prisma.questionCollection.create({
      data: {
        name: body.name,
        description: body.description || null,
        createdById: session.user.id,
        ...(body.questionId ? { items: { create: { questionId: body.questionId, addedById: session.user.id } } } : {}),
      },
      select: { id: true, name: true },
    });
    return apiSuccess({ collection }, 201);
  } catch (error) {
    return handleApiError(error);
  }
}
