import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { apiError, apiSuccess } from "@/lib/api/response";
import { requirePermission } from "@/lib/rbac/guard";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { translateStructuredAST } from "@/lib/module-studio/bilingual-engine";
import type { ModuleElementInput } from "@/lib/validation/module";

export const runtime = "nodejs";
export const maxDuration = 120;

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return apiError("Authentication required", 401);
    }

    await requirePermission(session.user.id, PERMISSIONS.TEAM_PORTAL_ACCESS);

    const body = await request.json();
    const { elements, targetLanguage, subject } = body as {
      elements: ModuleElementInput[];
      targetLanguage: "HINDI" | "ENGLISH";
      subject?: string;
    };

    if (!elements || !Array.isArray(elements) || elements.length === 0) {
      return apiError("No AST elements provided for translation", 400);
    }

    if (!targetLanguage || (targetLanguage !== "HINDI" && targetLanguage !== "ENGLISH")) {
      return apiError("Valid targetLanguage (HINDI or ENGLISH) is required", 400);
    }

    const translatedAst = await translateStructuredAST(elements, {
      targetLanguage,
      subject,
    });

    return apiSuccess({
      success: true,
      targetLanguage,
      totalElements: translatedAst.length,
      ast: translatedAst,
    });
  } catch (err: any) {
    console.error("[module_redesign_translate_error]", err);
    return apiError(err.message || "Failed to translate module AST", 500);
  }
}
