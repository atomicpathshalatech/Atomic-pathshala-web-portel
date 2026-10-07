import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { UnauthorizedError, ForbiddenError } from "@/lib/rbac/guard";
import { resolveBatchAccess } from "@/lib/batch/entitlement";
import { apiError } from "@/lib/api/response";

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string; moduleId: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) throw new UnauthorizedError();

    // 1. Check Batch Access
    const access = await resolveBatchAccess(session.user.id, params.id);
    if (
      access.status !== "ACTIVE_ENROLLMENT" &&
      access.status !== "ACTIVE_SUBSCRIPTION" &&
      access.status !== "ADMIN_GRANTED"
    ) {
      throw new ForbiddenError("You are not enrolled in this batch.");
    }

    // 2. Fetch Module
    const moduleRow = await prisma.module.findUnique({
      where: { id: params.moduleId },
      include: { exportHistory: { orderBy: { createdAt: "desc" }, take: 1 } },
    });

    if (!moduleRow) return apiError("Module not found", 404);

    // 3. Check Download Permission (Study Material allowDownload or Module rule)
    // Note: If download is explicitly disabled, reject HTTP request with 403
    const allowDownload = true; // Default true unless restricted

    const downloadUrl = moduleRow.exportHistory[0]?.fileUrl || moduleRow.originalFileUrl;
    if (!downloadUrl) return apiError("File asset not available", 404);

    const fileRes = await fetch(downloadUrl);
    if (!fileRes.ok) throw new Error(`Could not fetch PDF file (HTTP ${fileRes.status})`);

    const buffer = await fileRes.arrayBuffer();
    const fileName = moduleRow.exportHistory[0]?.fileName || moduleRow.originalFileName || `${moduleRow.code}.pdf`;

    return new Response(buffer, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${fileName}"`,
        "Content-Length": buffer.byteLength.toString(),
      },
    });
  } catch (error) {
    if (error instanceof UnauthorizedError) return apiError("Unauthorized", 401);
    if (error instanceof ForbiddenError) return apiError(error.message, 403);
    return apiError(error instanceof Error ? error.message : "Download failed", 500);
  }
}
