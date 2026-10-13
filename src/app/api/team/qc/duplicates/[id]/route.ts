import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { requirePermission, UnauthorizedError } from "@/lib/rbac/guard";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { apiError, apiSuccess, handleApiError } from "@/lib/api/response";
import { decideDuplicate, DUPLICATE_DECISIONS } from "@/lib/qc/duplicate-scan";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  status: z.enum(DUPLICATE_DECISIONS),
  note: z.string().trim().max(500).optional(),
});

// A person's decision on a duplicate pair. It is recorded only — no question is merged, hidden or deleted.
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) throw new UnauthorizedError();
    await requirePermission(session.user.id, PERMISSIONS.QUESTION_VERIFY);

    const body = bodySchema.parse(await req.json());
    const exists = await prisma.questionDuplicateCandidate.findUnique({ where: { id: params.id }, select: { id: true } });
    if (!exists) return apiError("This pair no longer exists (one of the questions was edited or deleted).", 404);
    const candidate = await decideDuplicate(params.id, session.user.id, body.status, body.note);
    return apiSuccess({ candidate });
  } catch (error) {
    return handleApiError(error);
  }
}
