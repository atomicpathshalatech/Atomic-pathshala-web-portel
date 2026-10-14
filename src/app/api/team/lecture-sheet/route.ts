import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { requirePermission, UnauthorizedError } from "@/lib/rbac/guard";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { apiError, apiSuccess, handleApiError } from "@/lib/api/response";
import { syncLectureSheet } from "@/lib/lecture-sheet/sync";
import { googleSheetsClient, serviceAccountEmail, SheetsNotConfiguredError } from "@/lib/lecture-sheet/sheets-client";
import { sheetId, sheetTab } from "@/lib/lecture-sheet/columns";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

async function staff() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) throw new UnauthorizedError();
  await requirePermission(session.user.id, PERMISSIONS.BATCH_READ);
  return session.user.id;
}

/** How the lecture Sheet integration stands: setup, row sync counts, recent link attempts. */
export async function GET() {
  try {
    await staff();
    const [byStatus, failed, mappings] = await Promise.all([
      prisma.lectureSheetRow.groupBy({ by: ["status"], _count: { _all: true } }),
      prisma.lectureSheetRow.findMany({ where: { status: "FAILED" }, take: 10, orderBy: { updatedAt: "desc" }, select: { scheduleId: true, lastError: true, attempts: true } }),
      prisma.lectureVideoMapping.findMany({ take: 30, orderBy: { createdAt: "desc" }, select: { createdAt: true, lectureRef: true, input: true, videoId: true, status: true, reason: true, source: true, schedule: { select: { title: true } } } }),
    ]);
    return apiSuccess({
      configured: {
        sheetId: Boolean(sheetId()),
        tab: sheetTab(),
        serviceAccount: serviceAccountEmail(), // share the Sheet with this email (Editor)
        webhookSecret: Boolean(process.env.LECTURE_SHEET_WEBHOOK_SECRET),
      },
      rows: Object.fromEntries(byStatus.map((r) => [r.status, r._count._all])),
      failed,
      mappings,
    });
  } catch (error) {
    return handleApiError(error);
  }
}

/** "Sync now": the same round the cron runs. */
export async function POST() {
  try {
    await staff();
    if (!sheetId()) return apiError("LECTURE_SHEET_ID is not set on the server.", 400);
    return apiSuccess(await syncLectureSheet(googleSheetsClient(sheetId())));
  } catch (error) {
    if (error instanceof SheetsNotConfiguredError) return apiError(error.message, 400);
    return handleApiError(error);
  }
}
