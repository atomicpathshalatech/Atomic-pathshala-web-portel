import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { requirePermission, UnauthorizedError } from "@/lib/rbac/guard";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { apiSuccess, handleApiError } from "@/lib/api/response";
import {
  getQuestionVerificationStatus,
  triggerQuestionVerification,
} from "@/lib/questions/verification-service";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) throw new UnauthorizedError();
    await requirePermission(session.user.id, PERMISSIONS.QUESTION_READ);

    const data = await getQuestionVerificationStatus(params.id);

    return apiSuccess({
      data,
      message: "Question verification details retrieved successfully",
    });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) throw new UnauthorizedError();
    await requirePermission(session.user.id, PERMISSIONS.QUESTION_READ);

    const body = await req.json().catch(() => ({}));
    const forceReverify = body?.forceReverify !== undefined ? Boolean(body.forceReverify) : true;
    const triggerSource = body?.triggerSource || "MANUAL";

    const result = await triggerQuestionVerification(params.id, {
      forceReverify,
      triggerSource,
      userId: session.user.id,
    });

    return apiSuccess({
      result,
      message: "Multi-AI question verification initiated successfully",
    });
  } catch (error) {
    return handleApiError(error);
  }
}
