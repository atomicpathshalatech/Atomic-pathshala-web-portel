import { NextRequest } from "next/server";
import { z } from "zod";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { requirePermission, UnauthorizedError } from "@/lib/rbac/guard";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { apiSuccess, handleApiError } from "@/lib/api/response";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CATEGORIES = ["FOUNDATION9", "CLASS10", "CLASS11", "CLASS12", "NEET", "JEE", "BOARD", "GENERAL"] as const;

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) throw new UnauthorizedError();
    await requirePermission(session.user.id, PERMISSIONS.COMMUNICATION_CENTER_ACCESS);

    const templates = await prisma.birthdayTemplate.findMany({ orderBy: [{ category: "asc" }, { priority: "desc" }] });
    return apiSuccess({ templates });
  } catch (error) {
    return handleApiError(error);
  }
}

const schema = z.object({
  name: z.string().trim().min(2).max(120),
  category: z.enum(CATEGORIES),
  board: z.string().trim().optional(),
  messageText: z.string().trim().min(10),
  priority: z.number().int().optional(),
});

/** POST — new template. See lib/birthday/templates.ts pickBirthdayTemplate() for the board -> category -> GENERAL fallback this feeds. */
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) throw new UnauthorizedError();
    await requirePermission(session.user.id, PERMISSIONS.COMMUNICATION_CENTER_ACCESS);

    const input = schema.parse(await req.json());
    const template = await prisma.birthdayTemplate.create({
      data: { ...input, board: input.board || null, priority: input.priority ?? 0 },
    });
    return apiSuccess({ template }, 201);
  } catch (error) {
    return handleApiError(error);
  }
}
