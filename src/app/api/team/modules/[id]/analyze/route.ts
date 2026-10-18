import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { apiError, apiSuccess } from "@/lib/api/response";
import { prisma } from "@/lib/db";
import { analyzePdfDocument } from "@/lib/module-studio/pdf-analyzer";
import { hasPermission } from "@/lib/rbac/guard";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { readModuleFile } from "@/lib/module-studio/module-files";

export const runtime = "nodejs";
export const maxDuration = 45;

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return apiError("Authentication required", 401);
    }
    if (!(await hasPermission(session.user.id, PERMISSIONS.MODULE_READ))) {
      return apiError("You do not have permission to open modules.", 403);
    }

    const moduleRow = await prisma.module.findUnique({
      where: { id: params.id },
      select: { originalFileUrl: true },
    });

    if (!moduleRow?.originalFileUrl) {
      return apiError("Module PDF not found", 404);
    }

    const buffer = await readModuleFile(moduleRow.originalFileUrl);
    const report = await analyzePdfDocument(buffer);

    return apiSuccess(report);
  } catch (err: any) {
    console.error("[pdf_analyze_error]", err);
    return apiError(err.message || "Failed to analyze PDF", 500);
  }
}
