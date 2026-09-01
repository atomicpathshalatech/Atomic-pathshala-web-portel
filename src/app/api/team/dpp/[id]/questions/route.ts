import { NextRequest } from "next/server";
import { z } from "zod";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { requirePermission, UnauthorizedError } from "@/lib/rbac/guard";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/response";

const attachSchema = z.object({
  questionIds: z.array(z.string()).min(1),
});

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) throw new UnauthorizedError();
    await requirePermission(session.user.id, PERMISSIONS.DPP_UPDATE);

    const dpp = await prisma.dpp.findUnique({ where: { id: params.id } });
    if (!dpp) return apiError("DPP not found", 404);

    const { questionIds } = attachSchema.parse(await request.json());

    const existingLinks = await prisma.dppQuestion.findMany({
      where: { dppId: params.id },
      select: { questionId: true, order: true },
    });
    const alreadyLinked = new Set(existingLinks.map((l) => l.questionId));
    let nextOrder = existingLinks.reduce((max, l) => Math.max(max, l.order), -1) + 1;

    const toAdd = questionIds.filter((qid) => !alreadyLinked.has(qid));

    if (toAdd.length > 0) {
      await prisma.dppQuestion.createMany({
        data: toAdd.map((questionId) => ({ dppId: params.id, questionId, order: nextOrder++ })),
      });
    }

    return apiSuccess({ added: toAdd.length });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) throw new UnauthorizedError();
    await requirePermission(session.user.id, PERMISSIONS.DPP_UPDATE);

    const { searchParams } = new URL(request.url);
    const questionId = searchParams.get("questionId");
    if (!questionId) return apiError("questionId is required", 400);

    await prisma.dppQuestion.deleteMany({ where: { dppId: params.id, questionId } });

    return apiSuccess({ removed: true });
  } catch (error) {
    return handleApiError(error);
  }
}
