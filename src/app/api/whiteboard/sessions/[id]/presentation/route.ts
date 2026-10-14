import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { UnauthorizedError, ForbiddenError } from "@/lib/rbac/guard";
import { resolveWhiteboardAccess } from "@/lib/whiteboard/access";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/response";
import { freshFileUrl } from "@/lib/storage/stored-file-url";

export const dynamic = "force-dynamic";

// A link to this class's presentation file that works now. The stored link
// may be a signed link that has already expired (they last 10 minutes).
export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) throw new UnauthorizedError();
    const access = await resolveWhiteboardAccess(session.user.id, params.id);
    if (!access) throw new ForbiddenError();

    const wb = await prisma.whiteboardSession.findUnique({ where: { id: params.id }, select: { presentationUrl: true, presentationType: true, presentationName: true } });
    if (!wb?.presentationUrl) return apiError("No presentation is set for this class.", 404);

    const url = await freshFileUrl(wb.presentationUrl, { expiresInSeconds: 3600 });
    // ?open=1: go straight to the file (a stable link to put behind a button).
    if (request.nextUrl.searchParams.get("open") === "1") return NextResponse.redirect(new URL(url, request.nextUrl.origin), 302);
    return apiSuccess({ url, presentationType: wb.presentationType, presentationName: wb.presentationName });
  } catch (error) {
    return handleApiError(error);
  }
}
