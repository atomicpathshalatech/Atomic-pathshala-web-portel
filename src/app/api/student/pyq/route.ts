import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { apiSuccess, handleApiError } from "@/lib/api/response";
import { UnauthorizedError } from "@/lib/rbac/guard";
import { pyqOverview } from "@/lib/pyq/student-practice";

export const dynamic = "force-dynamic";

/** PYQ practice: subjects with their papers (exam + year) and chapters. */
export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) throw new UnauthorizedError();
    return apiSuccess(await pyqOverview());
  } catch (error) {
    return handleApiError(error);
  }
}
