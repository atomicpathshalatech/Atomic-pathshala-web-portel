import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { requirePermission, UnauthorizedError } from "@/lib/rbac/guard";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { apiSuccess, handleApiError } from "@/lib/api/response";
import {
  runChemistryVerification,
  runRetentionAnalysis,
  transformScriptSection,
} from "@/lib/ai-studio/production/script-studio";

const transformSchema = z.object({
  action: z.enum([
    "REWRITE",
    "SHORTEN",
    "EXPAND",
    "CHANGE_TONE",
    "TRANSLATE",
    "REGENERATE",
    "ADD_EXAMPLE",
    "CHEMISTRY_VERIFY",
    "RETENTION_ANALYZE",
  ]),
  scriptId: z.string().optional(),
  text: z.string().trim().min(3).max(20000),
  targetTone: z.string().optional(),
  targetLanguage: z.string().optional(),
});

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) throw new UnauthorizedError();
    await requirePermission(session.user.id, PERMISSIONS.CONTENT_STUDIO_SCRIPT);
    await requirePermission(session.user.id, PERMISSIONS.CONTENT_STUDIO_AI_GENERATE);

    const body = transformSchema.parse(await req.json());

    if (body.action === "CHEMISTRY_VERIFY") {
      const audit = await runChemistryVerification({
        projectId: params.id,
        scriptId: body.scriptId || "",
        scriptText: body.text,
        userId: session.user.id,
        roleName: session.user.role ?? undefined,
      });
      return apiSuccess({ chemistryAudit: audit });
    }

    if (body.action === "RETENTION_ANALYZE") {
      const review = await runRetentionAnalysis({
        projectId: params.id,
        scriptId: body.scriptId || "",
        scriptText: body.text,
        userId: session.user.id,
        roleName: session.user.role ?? undefined,
      });
      return apiSuccess({ retentionReview: review });
    }

    const res = await transformScriptSection({
      projectId: params.id,
      sectionText: body.text,
      action: body.action,
      targetTone: body.targetTone,
      targetLanguage: body.targetLanguage,
      userId: session.user.id,
      roleName: session.user.role ?? undefined,
    });

    return apiSuccess(res);
  } catch (err) {
    return handleApiError(err);
  }
}
