import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { apiError, handleApiError } from "@/lib/api/response";
import { ensureDppTest } from "@/lib/dpp/dpp-test";

export const runtime = "nodejs";

/**
 * Student / Teacher access to DPP Question Paper & Solutions PDF.
 * GET /api/dpp/:id/pdf?type=questions|solutions
 */
export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) return apiError("Please log in to view this DPP.", 401);

    const backing = await ensureDppTest(params.id);
    if (!backing) return apiError("This DPP has no questions attached yet.", 404);

    const type = request.nextUrl.searchParams.get("type") === "questions" ? "questions" : "solutions";
    const redirectUrl = new URL(`/api/tests/${backing.testId}/pdf?type=${type}`, request.url);
    return NextResponse.redirect(redirectUrl, 302);
  } catch (error) {
    return handleApiError(error);
  }
}
