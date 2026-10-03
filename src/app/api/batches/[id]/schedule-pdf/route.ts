import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { hasPermission } from "@/lib/rbac/guard";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { apiError } from "@/lib/api/response";
import { buildBatchScheduleHtml } from "@/lib/batch/schedule-pdf";
import { renderHtmlPdf } from "@/lib/pdf/html-to-pdf";
import { brandLogoDataUrl } from "@/lib/pdf/brand-logo";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Subject-wise schedule of a batch — always built from the current timetable.
 *
 * GET /api/batches/:id/schedule-pdf?subject=Chemistry[&view=1]
 *   view=1 → the page itself (preview); otherwise a PDF download.
 * Team members who can read batches, and students enrolled in the batch.
 */
export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) return apiError("Please log in.", 401);

    let allowed = await hasPermission(session.user.id, PERMISSIONS.BATCH_READ);
    if (!allowed) {
      const enrolled = await prisma.batchEnrollment.findFirst({
        where: { batchId: params.id, status: "ACTIVE", student: { userId: session.user.id } },
        select: { id: true },
      });
      allowed = Boolean(enrolled);
    }
    if (!allowed) return apiError("You do not have access to this batch.", 403);

    const subject = request.nextUrl.searchParams.get("subject")?.trim() || null;
    const built = await buildBatchScheduleHtml(params.id, subject, brandLogoDataUrl());
    if (!built) return apiError("Batch not found", 404);

    if (request.nextUrl.searchParams.get("view") === "1") {
      return new NextResponse(built.html, {
        headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" },
      });
    }
    const pdf = await renderHtmlPdf(built.html, { timeoutMs: 45_000 });
    return new NextResponse(new Uint8Array(pdf), {
      headers: {
        "Content-Type": "application/pdf",
        "Cache-Control": "no-store",
        "Content-Disposition": `attachment; filename="schedule.pdf"; filename*=UTF-8''${encodeURIComponent(built.fileName)}`,
      },
    });
  } catch (error) {
    console.error("[batch_schedule_pdf_error]", error);
    return apiError("Could not prepare the schedule right now. Please try again.", 500);
  }
}
