import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { apiError, apiSuccess } from "@/lib/api/response";
import { planAiEdits, applyAcceptedAiEdits, type AiEditOperation } from "@/lib/module-studio/ai-edit-engine";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return apiError("Authentication required", 401);
    }

    const body = await request.json();
    const action = body?.action || "plan";

    if (action === "plan") {
      const instruction = String(body?.instruction || "").trim();
      if (!instruction) {
        return apiError("Please provide an editing instruction", 400);
      }

      const targetPage = body?.targetPage ? Number(body.targetPage) : undefined;
      const plan = await planAiEdits(params.id, instruction, { targetPage });
      return apiSuccess(plan);
    }

    if (action === "apply") {
      const acceptedOps = (body?.acceptedOps || []) as AiEditOperation[];
      const result = await applyAcceptedAiEdits(params.id, acceptedOps);
      return apiSuccess(result);
    }

    return apiError("Invalid action", 400);
  } catch (err: any) {
    console.error("[ai_edit_error]", err);
    return apiError(err.message || "Failed to process AI edit", 500);
  }
}
