import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { hasPermission } from "@/lib/rbac/guard";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { migrateLegacyQuestionIds } from "@/lib/questions/canonical-id-migrator";

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const canManage = await hasPermission(session.user.id, PERMISSIONS.QUESTION_VERIFY);
    if (!canManage) {
      return NextResponse.json({ success: false, error: "Forbidden: insufficient permissions" }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const { dryRun = false, limit = 500, subject } = body;

    const summary = await migrateLegacyQuestionIds(prisma as any, {
      dryRun: Boolean(dryRun),
      limit: typeof limit === "number" ? Math.min(Math.max(1, limit), 2000) : 500,
      subject: typeof subject === "string" ? subject : undefined,
    });

    return NextResponse.json({
      success: true,
      data: summary,
    });
  } catch (error) {
    console.error("[migrate-canonical-ids] Error:", error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Internal error" },
      { status: 500 }
    );
  }
}
