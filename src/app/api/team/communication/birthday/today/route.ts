import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { requirePermission, UnauthorizedError } from "@/lib/rbac/guard";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { apiSuccess, handleApiError } from "@/lib/api/response";
import { findTodaysBirthdaySubjects } from "@/lib/birthday/subjects";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/team/communication/birthday/today — Admin-only. Today's birthday subjects joined with their send status for the current year (spec section 16). */
export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) throw new UnauthorizedError();
    await requirePermission(session.user.id, PERMISSIONS.COMMUNICATION_CENTER_ACCESS);

    const subjects = await findTodaysBirthdaySubjects();
    const year = new Date().getFullYear();

    const logs = await prisma.birthdaySendLog.findMany({
      where: {
        year,
        OR: subjects.map((s) => ({ subjectType: s.subjectType, subjectId: s.subjectId })),
      },
    });
    const logBySubject = new Map(logs.map((l) => [`${l.subjectType}:${l.subjectId}`, l]));

    const rows = subjects.map((s) => {
      const log = logBySubject.get(`${s.subjectType}:${s.subjectId}`);
      return {
        subjectType: s.subjectType,
        subjectId: s.subjectId,
        name: s.name,
        dob: s.dob,
        category: s.category,
        board: s.board,
        activeBatchName: s.activeBatchName,
        whatsappNumber: s.whatsappNumber,
        status: log?.status ?? "PENDING",
        sentAt: log?.sentAt ?? null,
        failureReason: log?.failureReason ?? null,
        triggerType: log?.triggerType ?? null,
      };
    });

    return apiSuccess({
      date: new Date().toISOString().slice(0, 10),
      total: rows.length,
      rows,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
