import { NextRequest } from "next/server";
import { z } from "zod";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { requirePermission, UnauthorizedError } from "@/lib/rbac/guard";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/response";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) throw new UnauthorizedError();
    await requirePermission(session.user.id, PERMISSIONS.COMMUNICATION_CENTER_ACCESS);

    const items = await prisma.todaySpecial.findMany({ orderBy: { specialDate: "asc" } });
    return apiSuccess({ items });
  } catch (error) {
    return handleApiError(error);
  }
}

const schema = z.object({
  specialDate: z.string().regex(/^(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/, "Use MM-DD, e.g. 09-15."),
  title: z.string().trim().min(2).max(150),
  content: z.string().trim().min(2),
  imageUrl: z.string().trim().url().optional().or(z.literal("")),
  ctaLabel: z.string().trim().max(60).optional(),
  ctaUrl: z.string().trim().url().optional().or(z.literal("")),
  targetClass: z.string().trim().optional(),
  targetExam: z.string().trim().optional(),
  targetBoard: z.string().trim().optional(),
  targetBatchId: z.string().trim().optional(),
});

/** POST — create (spec section 12: Admin can create a special for any date; one per date, upsert-style). */
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) throw new UnauthorizedError();
    await requirePermission(session.user.id, PERMISSIONS.COMMUNICATION_CENTER_ACCESS);

    const input = schema.parse(await req.json());
    const existing = await prisma.todaySpecial.findUnique({ where: { specialDate: input.specialDate } });
    if (existing) return apiError(`A Today Special already exists for ${input.specialDate}. Edit that one instead.`, 409);

    const item = await prisma.todaySpecial.create({
      data: {
        ...input,
        imageUrl: input.imageUrl || null,
        ctaLabel: input.ctaLabel || null,
        ctaUrl: input.ctaUrl || null,
        targetClass: input.targetClass || null,
        targetExam: input.targetExam || null,
        targetBoard: input.targetBoard || null,
        targetBatchId: input.targetBatchId || null,
      },
    });
    return apiSuccess({ item }, 201);
  } catch (error) {
    return handleApiError(error);
  }
}
