import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { UnauthorizedError } from "@/lib/rbac/guard";
import { predictNEETRank } from "@/lib/predictor/neet-rank-service";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/response";

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) throw new UnauthorizedError();

    const { searchParams } = new URL(request.url);
    const marks = Number(searchParams.get("marks"));
    const category = searchParams.get("category")?.trim() || "General";
    if (!Number.isFinite(marks)) return apiError("marks must be a number", 400);

    const prediction = await predictNEETRank({
      marks,
      maxMarks: 720,
      category,
    });

    return apiSuccess({
      available: true,
      prediction,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
