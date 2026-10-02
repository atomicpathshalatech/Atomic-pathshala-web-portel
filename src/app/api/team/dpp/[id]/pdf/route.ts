import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { requirePermission, UnauthorizedError } from "@/lib/rbac/guard";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { apiError, handleApiError } from "@/lib/api/response";
import { ensureDppTest } from "@/lib/dpp/dpp-test";

/**
 * Teacher / admin download of a DPP — the question sheet or the solutions
 * PDF (any status, drafts included), built by the same booklet engine as
 * tests from the DPP's backing test.
 *
 * GET /api/team/dpp/:id/pdf?type=questions|solutions
 */
export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) throw new UnauthorizedError();
    await requirePermission(session.user.id, PERMISSIONS.DPP_READ);
    const backing = await ensureDppTest(params.id);
    if (!backing) return apiError("Add questions to this DPP before downloading it.", 409);
    const type = request.nextUrl.searchParams.get("type") === "solutions" ? "solutions" : "questions";
    return NextResponse.redirect(new URL(`/api/tests/${backing.testId}/pdf?type=${type}`, request.url), 302);
  } catch (error) {
    return handleApiError(error);
  }
}
