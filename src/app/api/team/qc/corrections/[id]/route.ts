import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { requirePermission, UnauthorizedError } from "@/lib/rbac/guard";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { apiError, apiSuccess, handleApiError } from "@/lib/api/response";
import { CorrectionError, decideCorrection } from "@/lib/qc/pipeline";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  action: z.enum(["approve", "reject"]),
  note: z.string().trim().max(500).optional(),
});

// A person approves or rejects a proposed correction. Approving is what edits
// the question (its previous version is kept); nothing is applied on its own.
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) throw new UnauthorizedError();
    await requirePermission(session.user.id, PERMISSIONS.QUESTION_APPROVE);

    const body = bodySchema.parse(await req.json());
    const correction = await decideCorrection(params.id, session.user.id, body.action, body.note);
    return apiSuccess({ correction });
  } catch (error) {
    if (error instanceof CorrectionError) return apiError(error.message, 409);
    return handleApiError(error);
  }
}
