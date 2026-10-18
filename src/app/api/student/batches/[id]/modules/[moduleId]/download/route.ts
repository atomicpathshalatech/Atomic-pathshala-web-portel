import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { UnauthorizedError, ForbiddenError } from "@/lib/rbac/guard";
import { resolveBatchAccess } from "@/lib/batch/entitlement";
import { apiError } from "@/lib/api/response";
import { moduleFileLink } from "@/lib/module-studio/module-files";

export const dynamic = "force-dynamic";

/**
 * A student downloads a module of their batch: only a PUBLISHED module whose
 * batch is this batch (its id, code or name), as a 10-minute signed link.
 * Before, any enrolled student could fetch any module, drafts included.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string; moduleId: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) throw new UnauthorizedError();

    const access = await resolveBatchAccess(session.user.id, params.id);
    if (
      access.status !== "ACTIVE_ENROLLMENT" &&
      access.status !== "ACTIVE_SUBSCRIPTION" &&
      access.status !== "ADMIN_GRANTED"
    ) {
      throw new ForbiddenError("You are not enrolled in this batch.");
    }

    const [batch, moduleRow] = await Promise.all([
      prisma.batch.findUnique({ where: { id: params.id }, select: { id: true, code: true, name: true } }),
      prisma.module.findUnique({
        where: { id: params.moduleId },
        select: {
          code: true,
          status: true,
          batch: true,
          originalFileUrl: true,
          originalFileName: true,
          exportHistory: { orderBy: { createdAt: "desc" }, take: 1, select: { fileUrl: true, fileName: true } },
        },
      }),
    ]);
    const moduleBatch = (moduleRow?.batch || "").trim().toLowerCase();
    const inThisBatch =
      !!batch && !!moduleBatch && [batch.id, batch.code, batch.name].some((v) => (v || "").trim().toLowerCase() === moduleBatch);
    // Same answer for "no such module" and "not yours", so ids cannot be probed.
    if (!moduleRow || moduleRow.status !== "PUBLISHED" || !inThisBatch) return apiError("Module not found", 404);

    const latest = moduleRow.exportHistory[0];
    const stored = latest?.fileUrl || moduleRow.originalFileUrl;
    const fileName = latest?.fileName || moduleRow.originalFileName || `${moduleRow.code}.pdf`;
    const link = stored ? await moduleFileLink(stored, { downloadName: fileName, expiresInSeconds: 300 }) : null;
    if (!link) return apiError("File asset not available", 404);

    const res = NextResponse.redirect(link, 302);
    res.headers.set("Cache-Control", "private, no-store");
    res.headers.set("Referrer-Policy", "no-referrer");
    return res;
  } catch (error) {
    if (error instanceof UnauthorizedError) return apiError("Unauthorized", 401);
    if (error instanceof ForbiddenError) return apiError(error.message, 403);
    console.error("[student_module_download]", error instanceof Error ? error.message : error);
    return apiError("Download failed", 500);
  }
}
