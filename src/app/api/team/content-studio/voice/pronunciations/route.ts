import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requirePermission, UnauthorizedError } from "@/lib/rbac/guard";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { apiError, apiSuccess, handleApiError } from "@/lib/api/response";

const ruleSchema = z.object({
  term: z.string().trim().min(1).max(120),
  phonetic: z.string().trim().min(1).max(200),
  category: z
    .enum(["CHEMISTRY", "BIOLOGY", "PHYSICS", "NEET", "ENGLISH_IN_HINDI", "GENERAL"])
    .default("GENERAL"),
  language: z.string().trim().default("hi"),
});

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) throw new UnauthorizedError();
    await requirePermission(session.user.id, PERMISSIONS.CONTENT_STUDIO_VOICE);

    const rules = await prisma.pronunciationRule.findMany({
      where: { isActive: true },
      orderBy: [{ category: "asc" }, { term: "asc" }],
    });

    return apiSuccess({ rules });
  } catch (err) {
    return handleApiError(err);
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) throw new UnauthorizedError();
    await requirePermission(session.user.id, PERMISSIONS.CONTENT_STUDIO_VOICE);

    const body = ruleSchema.parse(await req.json());
    const rule = await prisma.pronunciationRule.upsert({
      where: { term_language: { term: body.term, language: body.language } },
      create: {
        ...body,
        createdById: session.user.id,
      },
      update: {
        phonetic: body.phonetic,
        category: body.category,
        isActive: true,
      },
    });

    return apiSuccess({ rule }, 201);
  } catch (err) {
    return handleApiError(err);
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) throw new UnauthorizedError();
    await requirePermission(session.user.id, PERMISSIONS.CONTENT_STUDIO_VOICE);

    const id = req.nextUrl.searchParams.get("id");
    if (!id) return apiError("Missing id", 400);

    await prisma.pronunciationRule.delete({ where: { id } });
    return apiSuccess({ deleted: true });
  } catch (err) {
    return handleApiError(err);
  }
}
