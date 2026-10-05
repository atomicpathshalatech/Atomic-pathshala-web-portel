import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { hasPermission } from "@/lib/rbac/guard";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { runChapterAiAudit } from "@/lib/questions/chapter-audit-engine";

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
    const { subject, chapter, limit = 500, batchSize = 25 } = body;

    if (!subject || !chapter) {
      return NextResponse.json(
        { success: false, error: "Both subject and chapter are required for chapter audit." },
        { status: 400 }
      );
    }

    const report = await runChapterAiAudit(prisma as any, {
      subject,
      chapter,
      limit: typeof limit === "number" ? Math.min(Math.max(1, limit), 1000) : 500,
      batchSize: typeof batchSize === "number" ? Math.min(Math.max(5, batchSize), 50) : 25,
    });

    return NextResponse.json({
      success: true,
      data: report,
    });
  } catch (error) {
    console.error("[audit-chapter] Error:", error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Internal error" },
      { status: 500 }
    );
  }
}
