import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin, UnauthorizedError, ForbiddenError } from "@/lib/ai-chat/auth";
import { logAiChatEvent } from "@/lib/ai-chat/audit";
import { getPrisma } from "@/lib/ai-chat/prisma";

// Source also let this endpoint change `role` (GUEST/STUDENT/PRO/FACULTY/ADMIN)
// and `isPro`, both plain fields on its own dropped User model. Neither maps
// cleanly onto atomic-ops:
//  - role is now the real platform-wide RBAC relation (Role/GlobalRole) —
//    flipping it from this AI Chat admin sub-panel would silently change a
//    user's access across the whole ERP, well beyond this feature's scope.
//    Core role changes stay in the platform's own user/RBAC management.
//  - isPro is now tracked as an AiChatSubscription + UserAccess pair (plan,
//    accessType, expiry, audit trail) via /api/ai-chat/admin/access, which
//    is the sanctioned way to grant/revoke/suspend access. Duplicating a
//    bare boolean flip here would leave UserAccess without a backing
//    subscription record, so that responsibility stays there instead.
// This route keeps only the listing and the isSuspended toggle, which maps
// directly onto the real User.status field.
const updateSchema = z.object({
  userId: z.string().min(1),
  isSuspended: z.boolean(),
});

function accessError(error: unknown) {
  if (error instanceof UnauthorizedError) {
    return NextResponse.json({ error: "Sign in is required." }, { status: 401 });
  }
  if (error instanceof ForbiddenError) {
    return NextResponse.json({ error: "Administrator access is required." }, { status: 403 });
  }
  return null;
}

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    await requireAdmin();
    const search = new URL(request.url).searchParams.get("search")?.trim();
    const prisma = getPrisma();
    const users = await prisma.user.findMany({
      where: search
        ? {
            OR: [
              { email: { contains: search, mode: "insensitive" } },
              { name: { contains: search, mode: "insensitive" } },
            ],
          }
        : undefined,
      orderBy: { createdAt: "desc" },
      take: 100,
      select: {
        id: true,
        email: true,
        name: true,
        role: { select: { name: true } },
        status: true,
        lastLoginAt: true,
        createdAt: true,
        aiChatAccess: { select: { status: true, plan: true } },
        aiChatProfile: { select: { target: true, className: true } },
      },
    });

    return NextResponse.json({ users });
  } catch (error) {
    const response = accessError(error);
    if (response) return response;
    console.error("[Admin users API]", error);
    return NextResponse.json({ error: "Could not load users." }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const admin = await requireAdmin();
    const parsed = updateSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Invalid user update." },
        { status: 400 }
      );
    }

    const prisma = getPrisma();
    const user = await prisma.user.update({
      where: { id: parsed.data.userId },
      data: { status: parsed.data.isSuspended ? "SUSPENDED" : "ACTIVE" },
    });
    await logAiChatEvent({
      actorUserId: admin.id,
      targetUserId: user.id,
      event: "USER_SUSPENSION_CHANGED",
      entityType: "AiChatUser",
      metadata: { status: user.status },
    });

    return NextResponse.json({ user });
  } catch (error) {
    const response = accessError(error);
    if (response) return response;
    console.error("[Admin user update API]", error);
    return NextResponse.json({ error: "Could not update user." }, { status: 500 });
  }
}
