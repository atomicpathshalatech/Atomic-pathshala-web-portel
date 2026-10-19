import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/response";
import { requireTeam } from "@/lib/pyq/api";
import { saveOcrPage } from "@/lib/pyq/import-service";

const schema = z.object({
  pageNumber: z.number().int().min(1).max(5000),
  text: z.string().max(60_000),
  confidence: z.number().min(0).max(100),
});

/**
 * POST — text the browser recognised (tesseract.js, English + Hindi) on one
 * scanned page. Once every page of a page group is read, the group is
 * queued and parsed like any text page.
 */
export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    await requireTeam(PERMISSIONS.QUESTION_IMPORT);
    const body = schema.parse(await request.json());
    const job = await prisma.extractionJob.findFirst({ where: { id: params.id, isPyqImport: true }, select: { id: true } });
    if (!job) return apiError("Import not found", 404);
    const res = await saveOcrPage(job.id, body.pageNumber, body.text, body.confidence);
    return apiSuccess(res);
  } catch (error) {
    return handleApiError(error);
  }
}
