import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { UnauthorizedError, ForbiddenError } from "@/lib/rbac/guard";
import { resolveWhiteboardAccess } from "@/lib/whiteboard/access";
import { apiError, handleApiError } from "@/lib/api/response";
import type { PageDataForExport } from "@/lib/whiteboard/pdf-generator";
import { prisma } from "@/lib/db";

export const runtime = "nodejs";
export const maxDuration = 120;

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

    const body = await request.json().catch(() => ({}));
    const title = typeof body?.title === "string" ? body.title : "Class Notes";

    // The whole lecture comes from the saved board. Sending every page's
    // strokes in the request (the old way) went over the request-size limit
    // on a long class — a 36-slide lecture could not be exported at all.
    // Only the slide on screen is sent, so strokes not autosaved yet are in.
    let pages = body?.pages as PageDataForExport[] | undefined;
    if (!Array.isArray(pages) || pages.length === 0) {
      const saved = await prisma.whiteboardPage.findMany({
        where: { sessionId: params.id },
        select: { pageNumber: true, background: true, objects: true },
        orderBy: { pageNumber: "asc" },
      });
      pages = saved.map((p) => ({ pageNumber: p.pageNumber, background: p.background, objects: (p.objects ?? []) as unknown as PageDataForExport["objects"] }));
      const current = body?.currentPage as PageDataForExport | undefined;
      if (current && typeof current.pageNumber === "number" && Array.isArray(current.objects)) {
        const i = pages.findIndex((p) => p.pageNumber === current.pageNumber);
        if (i >= 0) pages[i] = { ...pages[i]!, objects: current.objects, background: current.background ?? pages[i]!.background };
        else pages.push({ pageNumber: current.pageNumber, background: current.background ?? "blank", objects: current.objects });
      }
    }

    if (pages.length === 0) {
      return apiError("This board has no slides to export yet.", 400);
    }

    const { generateWhiteboardPdf } = await import("@/lib/whiteboard/pdf-generator");
    const pdfBuffer = await generateWhiteboardPdf(pages, title);

    const filename = `${(title || "Class_Notes").replace(/[^a-zA-Z0-9_-]/g, "_")}.pdf`;

    // A whole lecture is bigger than a response may be, so the file goes to
    // storage and the browser downloads it from there.
    try {
      const { uploadBufferToR2, createPresignedDownloadUrl } = await import("@/lib/storage/r2-client");
      const key = `whiteboard-exports/${params.id}/${Date.now()}.pdf`;
      await uploadBufferToR2({ key, buffer: pdfBuffer, contentType: "application/pdf" });
      const url = await createPresignedDownloadUrl({
        key,
        expiresInSeconds: 600,
        contentType: "application/pdf",
        contentDisposition: `attachment; filename="${filename}"`,
      });
      return Response.json({ success: true, data: { url, filename, pages: pages.length } });
    } catch (storageErr) {
      console.warn("[whiteboard_export_storage_fallback]", storageErr);
    }
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
