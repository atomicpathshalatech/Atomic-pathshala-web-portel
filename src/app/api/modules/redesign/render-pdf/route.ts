import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { apiError } from "@/lib/api/response";
import { requirePermission } from "@/lib/rbac/guard";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { buildRedesignedModuleHtml } from "@/lib/module-studio/module-redesign-renderer";
import { applyGlobalFindAndReplaceToAST, ReplacementRule } from "@/lib/module-studio/find-replace-engine";
import { ModuleSubject } from "@/lib/module-studio/subject-design-system";
import type { ModuleElementInput } from "@/lib/validation/module";
import { prisma } from "@/lib/db";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return apiError("Authentication required", 401);
    }

    await requirePermission(session.user.id, PERMISSIONS.TEAM_PORTAL_ACCESS);

    const body = await request.json();
    const {
      elements,
      subject = "CHEMISTRY",
      moduleNumber = "Module 01",
      chapterName = "Academic Chapter",
      facultyName = "Atomic Pathshala Faculty",
      targetExam = "NEET (UG)",
      isPrintMode = false,
      findReplaceRules = [],
    } = body as {
      elements: ModuleElementInput[];
      subject: ModuleSubject;
      moduleNumber: string;
      chapterName: string;
      facultyName?: string;
      targetExam?: string;
      isPrintMode?: boolean;
      findReplaceRules?: ReplacementRule[];
    };

    // If print mode (No watermark) is requested, check for Admin/SuperAdmin permission
    if (isPrintMode) {
      const user = await prisma.user.findUnique({
        where: { id: session.user.id },
        include: { role: true },
      });

      const roleName = user?.role?.name;
      const isSuperAdminOrAdmin = roleName === "SUPER_ADMIN" || roleName === "ADMIN";

      if (!isSuperAdminOrAdmin) {
        return apiError("Only Administrators are authorized to generate unwatermarked Print PDFs", 403);
      }
    }

    // 1. Apply Global Find & Replace if rules exist
    const processedElements = findReplaceRules.length > 0
      ? applyGlobalFindAndReplaceToAST(elements, findReplaceRules)
      : elements;

    // 2. Build full standalone HTML
    const htmlContent = buildRedesignedModuleHtml(processedElements, {
      subject,
      moduleNumber,
      chapterName,
      facultyName,
      targetExam,
      isPrintMode: !!isPrintMode,
      includeCover: true,
    });

    return new NextResponse(htmlContent, {
      status: 200,
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "no-store",
      },
    });
  } catch (err: any) {
    console.error("[module_redesign_render_error]", err);
    return apiError(err.message || "Failed to render redesigned module", 500);
  }
}
