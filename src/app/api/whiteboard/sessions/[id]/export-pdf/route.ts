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
 * generates a PDF in the exact sequence of slides with no duplicates, no missing pages,
 * and with current canvas strokes accurately merged.
 */
export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) throw new UnauthorizedError();

    const access = await resolveWhiteboardAccess(session.user.id, params.id);
    if (!access) throw new ForbiddenError();

    const body = await request.json().catch(() => ({}));
    const title = typeof body?.title === "string" ? body.title : "Class Notes";

    // Fetch all pages belonging to this session
    const saved = await prisma.whiteboardPage.findMany({
      where: { sessionId: params.id },
      select: { id: true, pageNumber: true, background: true, objects: true },
    });

    if (saved.length === 0) {
      return apiError("This board has no slides to export yet.", 400);
    }

    // Determine the authoritative page sequence (matching client ordered IDs or database pageNumber)
    let orderedSaved: typeof saved = [];
    if (Array.isArray(body?.orderedPageIds) && body.orderedPageIds.length > 0) {
      const pageMap = new Map(saved.map((p) => [p.id, p]));
      for (const id of body.orderedPageIds) {
        const found = pageMap.get(id);
        if (found) {
          orderedSaved.push(found);
          pageMap.delete(id);
        }
      }
      // Append any remaining pages (if any)
      for (const remaining of pageMap.values()) {
        orderedSaved.push(remaining);
      }
    } else {
      orderedSaved = [...saved].sort((a, b) => a.pageNumber - b.pageNumber);
    }

    // Convert to PageDataForExport with strictly sequential 1-based page numbering (1, 2, ... N)
    const pages: PageDataForExport[] = orderedSaved.map((p, idx) => ({
      pageNumber: idx + 1,
      background: p.background,
      objects: (p.objects ?? []) as unknown as PageDataForExport["objects"],
    }));

    // Update the on-screen active slide's latest strokes in-place (never duplicating or inserting extra slides)
    const current = body?.currentPage;
    if (current && Array.isArray(current.objects)) {
      let targetIdx = -1;
      if (current.id) {
        targetIdx = orderedSaved.findIndex((p) => p.id === current.id);
      }
      if (targetIdx === -1 && typeof current.pageNumber === "number") {
        targetIdx = current.pageNumber - 1;
      }
      if (targetIdx >= 0 && targetIdx < pages.length) {
        pages[targetIdx] = {
          pageNumber: targetIdx + 1,
          background: current.background ?? pages[targetIdx]!.background,
          objects: current.objects,
        };
      }
    }

    const { generateWhiteboardPdf } = await import("@/lib/whiteboard/pdf-generator");
    const pdfBuffer = await generateWhiteboardPdf(pages, title);

    const filename = `${(title || "Class_Notes").replace(/[^a-zA-Z0-9_-]/g, "_")}.pdf`;

    // Try uploading to R2 storage for presigned URL download
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
