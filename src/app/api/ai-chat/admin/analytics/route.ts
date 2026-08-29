import { NextResponse } from "next/server";
import { requireAdmin, UnauthorizedError, ForbiddenError } from "@/lib/ai-chat/auth";
import { getPrisma } from "@/lib/ai-chat/prisma";

export const runtime = "nodejs";

export async function GET() {
  try {
    await requireAdmin();
    const prisma = getPrisma();
    const [users, proUsers, activeSubscriptions, conversations, messages, recentLogs] =
      await Promise.all([
        prisma.user.count(),
        // Source counted User.isPro || role in (PRO, FACULTY, ADMIN) — neither
        // field exists on atomic-ops's User. "Pro" now means an ACTIVE
        // PRO/LIFETIME UserAccess record (the same thing hasActiveSubscription
        // checks in access.ts).
        prisma.user.count({
          where: { aiChatAccess: { status: "ACTIVE", plan: { in: ["PRO", "LIFETIME"] } } },
        }),
        prisma.aiChatSubscription.count({ where: { status: { in: ["ACTIVE", "TRIALING"] } } }),
        prisma.conversation.count({ where: { deletedAt: null } }),
        prisma.chatMessage.count(),
        // atomic-ops's shared AuditLog has action/entityType, not event —
        // scoped to entityType starting "AiChat" so this only shows AI Chat
        // activity, not unrelated team-portal/CRM audit entries that now
        // live in the same table.
        prisma.auditLog.findMany({
          where: { entityType: { startsWith: "AiChat" } },
          orderBy: { createdAt: "desc" },
          take: 12,
          select: { id: true, action: true, createdAt: true, metadata: true },
        }),
      ]);

    return NextResponse.json({
      metrics: { users, proUsers, activeSubscriptions, conversations, messages },
      recentLogs: recentLogs.map((log) => ({
        id: log.id,
        event: log.action,
        createdAt: log.createdAt,
        metadata: log.metadata,
      })),
    });
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ error: "Sign in is required." }, { status: 401 });
    }
    if (error instanceof ForbiddenError) {
      return NextResponse.json({ error: "Administrator access is required." }, { status: 403 });
    }
    console.error("[Admin analytics API]", error);
    return NextResponse.json({ error: "Could not load analytics." }, { status: 500 });
  }
}
