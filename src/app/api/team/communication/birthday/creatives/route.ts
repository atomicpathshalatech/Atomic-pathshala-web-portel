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

    const creatives = await prisma.birthdayCreative.findMany({ orderBy: [{ category: "asc" }, { createdAt: "desc" }] });
    return apiSuccess({ creatives });
  } catch (error) {
    return handleApiError(error);
  }
}

const schema = z.object({
  name: z.string().trim().min(2).max(120),
  category: z.enum(CATEGORIES),
  imageUrl: z.string().trim().min(1),
});

/**
 * POST — registers an already-uploaded image as a creative. The file
 * itself goes through the existing, unmodified POST /api/upload first (R2
 * or local dev storage); this endpoint just records the resulting URL
 * against a category, matching the "Admin creative library can upload
 * multiple images" requirement without a second upload code path.
 */
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) throw new UnauthorizedError();
    await requirePermission(session.user.id, PERMISSIONS.COMMUNICATION_CENTER_ACCESS);

    const input = schema.parse(await req.json());
    const creative = await prisma.birthdayCreative.create({ data: input });
    return apiSuccess({ creative }, 201);
  } catch (error) {
    return handleApiError(error);
  }
}
