import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { requirePermission, UnauthorizedError } from "@/lib/rbac/guard";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { apiSuccess, handleApiError } from "@/lib/api/response";
import { searchMasterChapters } from "@/lib/batch/master-chapters";

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) throw new UnauthorizedError();
    await requirePermission(session.user.id, PERMISSIONS.BATCH_READ);

    const { searchParams } = new URL(request.url);
    const query = searchParams.get("q") || "";

    const chapters = await searchMasterChapters(query);
    return apiSuccess({ chapters });
  } catch (error) {
    return handleApiError(error);
  }
}
