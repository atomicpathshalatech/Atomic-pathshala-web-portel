import { NextResponse } from "next/server";
import { requireAdmin, UnauthorizedError, ForbiddenError } from "@/lib/ai-chat/auth";
import { getPrisma } from "@/lib/ai-chat/prisma";
import { computeDashboardStats } from "@/lib/ai-chat/dashboardStats";

export const runtime = "nodejs";

function accessError(error: unknown) {
  if (error instanceof UnauthorizedError) {
    return NextResponse.json({ error: "Sign in is required." }, { status: 401 });
  }
  if (error instanceof ForbiddenError) {
    return NextResponse.json({ error: "Administrator access is required." }, { status: 403 });
  }
  return null;
}

export async function GET(request: Request) {
  try {
    await requireAdmin();
    const params = new URL(request.url).searchParams;
    const userId = params.get("userId");

    const prisma = getPrisma();

    // Single-student detailed view
    if (userId) {
      // Source selected atomicId/role (plain string fields on its own User
      // model) — neither exists here. id already identifies the student;
      // role is the real RBAC relation, included for context only.
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { id: true, name: true, email: true, role: { select: { name: true } } },
      });
      if (!user) {
        return NextResponse.json({ error: "Student not found." }, { status: 404 });
      }
      const stats = await computeDashboardStats(userId);
      return NextResponse.json({ user, stats });
    }

    // List view — all students with a lightweight summary. Source filtered
    // role in (STUDENT, PRO, BASIC) on its own dropped string field; the
    // real RBAC equivalent of "student" is role.name === "STUDENT" (Pro/Basic
    // was a plan tier, now tracked separately on UserAccess, not a role).
    const users = await prisma.user.findMany({
      where: { role: { name: "STUDENT" } },
      orderBy: { createdAt: "desc" },
      take: 200,
      select: {
        id: true,
        name: true,
        email: true,
        aiChatProfile: { select: { xp: true, currentStreak: true } },
      },
    });

    const summaries = await Promise.all(
      users.map(async (user) => {
        const stats = await computeDashboardStats(user.id);
        return {
          id: user.id,
          name: user.name,
          email: user.email,
          xp: stats.xp,
          level: stats.level,
          currentStreak: stats.currentStreak,
          accuracy: stats.accuracy,
          healthScore: stats.healthScore,
        };
      })
    );

    return NextResponse.json({ students: summaries });
  } catch (error) {
    const response = accessError(error);
    if (response) return response;
    console.error("[Admin Student Performance API]", error);
    return NextResponse.json({ error: "Could not load student performance." }, { status: 500 });
  }
}
