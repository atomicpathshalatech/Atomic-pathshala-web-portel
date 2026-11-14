import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { requirePermission, UnauthorizedError } from "@/lib/rbac/guard";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { apiSuccess, handleApiError } from "@/lib/api/response";
import { syncFacultyToEmployees } from "@/lib/employees/employee-service";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) throw new UnauthorizedError();
    await requirePermission(session.user.id, PERMISSIONS.TEAM_PORTAL_ACCESS);

    const synced = await syncFacultyToEmployees();
    return apiSuccess({
      message: `Successfully synced ${synced.length} faculty and staff members to employee verification directory.`,
      records: synced,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
