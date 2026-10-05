import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { hasPermission } from "@/lib/rbac/guard";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { analyzeQuestionElement, AnalyzableElement } from "@/lib/questions/ai-element-analyzer";

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const canRead = await hasPermission(session.user.id, PERMISSIONS.QUESTION_READ);
    if (!canRead) {
      return NextResponse.json({ success: false, error: "Forbidden: insufficient permissions" }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const { element, elementContent, questionContext } = body;

    if (!element || typeof elementContent !== "string") {
      return NextResponse.json(
        { success: false, error: "Element and elementContent are required" },
        { status: 400 }
      );
    }

    const result = await analyzeQuestionElement({
      element: element as AnalyzableElement,
      elementContent,
      questionContext: questionContext || { statement: elementContent },
    });

    return NextResponse.json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error("[analyze-element] Error:", error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Internal error" },
      { status: 500 }
    );
  }
}
