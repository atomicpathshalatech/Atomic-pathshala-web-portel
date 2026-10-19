import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { apiError, handleApiError } from "@/lib/api/response";
import { requireTeam } from "@/lib/pyq/api";
import { importReportCsv } from "@/lib/pyq/review-service";

/** GET — CSV import report: every extracted question, its metadata, issues and review state. */
export async function GET(_request: NextRequest, { params }: { params: { id: string } }) {
  try {
    await requireTeam(PERMISSIONS.QUESTION_IMPORT);
    const job = await prisma.extractionJob.findFirst({ where: { id: params.id, isPyqImport: true }, select: { sourceName: true } });
    if (!job) return apiError("Import not found", 404);
    const csv = await importReportCsv(params.id);
    const name = `${job.sourceName.replace(/[^\w.-]+/g, "_")}-import-report.csv`;
    return new NextResponse("﻿" + csv, {
      headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="${name}"` },
    });
  } catch (error) {
    return handleApiError(error);
  }
}
