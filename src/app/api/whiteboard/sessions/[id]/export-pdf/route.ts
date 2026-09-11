import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { UnauthorizedError, ForbiddenError } from "@/lib/rbac/guard";
import { resolveWhiteboardAccess } from "@/lib/whiteboard/access";
import { apiError, handleApiError } from "@/lib/api/response";
import type { PageDataForExport } from "@/lib/whiteboard/pdf-generator";

/**
 * On-demand PDF export for the whiteboard toolbar's "download" button —
 * generates a PDF straight from whatever the client currently has in memory
 * (not from saved DB state, and not the class-end finalization pipeline,
 * which also generates PPTX / uploads to R2 / marks the session finalized —
 * side effects that don't belong to a mid-class "export current slide" click).
 */
export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) throw new UnauthorizedError();

    const access = await resolveWhiteboardAccess(session.user.id, params.id);
    if (!access) throw new ForbiddenError();

    const body = await request.json();
    const pages = body?.pages as PageDataForExport[] | undefined;
    const title = typeof body?.title === "string" ? body.title : "Class Notes";

    if (!Array.isArray(pages) || pages.length === 0) {
      return apiError("No whiteboard page data was provided to export.", 400);
    }

    const { generateWhiteboardPdf } = await import("@/lib/whiteboard/pdf-generator");
    const pdfBuffer = await generateWhiteboardPdf(pages, title);

    const filename = `${(title || "Class_Notes").replace(/[^a-zA-Z0-9_-]/g, "_")}.pdf`;
    return new Response(pdfBuffer, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Content-Length": String(pdfBuffer.length),
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}
