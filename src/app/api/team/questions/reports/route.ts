import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { requirePermission, UnauthorizedError } from "@/lib/rbac/guard";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { apiSuccess, handleApiError } from "@/lib/api/response";
import { QUESTION_REPORT_STATUSES } from "@/lib/validation/question-report";

/**
 * Admin Report Dashboard listing (`/team/questions/reports` in the UI).
 * Gated on QUESTION_READ — the same permission every question-review
 * surface uses — not a new report-specific code; SME/ADMIN/SUB_ADMIN/
 * ACADEMIC_HEAD/QUESTION_TEAM/SUPER_ADMIN/FOUNDER already hold it.
 *
 * Scope note: the source spec also fans a notification out to Super
 * Admin, Sub Admin, the question's subject teacher(s), and its creator
 * the moment a report lands. Not wired up here — atomic-ops's
 * notification engine (src/lib/notifications/engine.ts) is driven by a
 * fixed NotificationType enum + template registry, and QUESTION_REPORTED
 * isn't one of its event types. Adding one is a real schema change
 * (migration) rather than something to guess at from this pass; this
 * dashboard + claim/resolve flow works today by admins/teachers checking
 * it, same as `/team/questions/[id]/versions` review already does.
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) throw new UnauthorizedError();
    await requirePermission(session.user.id, PERMISSIONS.QUESTION_READ);

    const statusParam = request.nextUrl.searchParams.get("status");
    const status =
      statusParam && (QUESTION_REPORT_STATUSES as readonly string[]).includes(statusParam)
        ? statusParam
        : undefined;

    const reports = await prisma.questionReport.findMany({
      where: status ? { status } : undefined,
      orderBy: { createdAt: "desc" },
      include: {
        question: { select: { id: true, subject: true, chapter: true, questionCode: true } },
        reportedBy: { select: { id: true, name: true, email: true } },
        claimedBy: { select: { id: true, name: true, email: true } },
      },
    });

    return apiSuccess({ reports });
  } catch (error) {
    return handleApiError(error);
  }
}
