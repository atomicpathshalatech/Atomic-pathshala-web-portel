import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requirePermission, UnauthorizedError } from "@/lib/rbac/guard";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { apiSuccess, handleApiError } from "@/lib/api/response";

const automationSchema = z.object({
  isEnabled: z.boolean(),
  frequency: z.enum(["DAILY", "WEEKLY"]).default("DAILY"),
  scheduleCron: z.string().trim().min(5).max(60).default("0 6 * * *"),
  categories: z
    .array(z.enum(["NEET", "JEE", "BOARDS", "MOTIVATIONAL", "EDUCATIONAL_NEWS"]))
    .min(1),
  languages: z.array(z.string().trim().min(2).max(16)).min(1),
  notifyUserIds: z.array(z.string().trim()).default([]),
});

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) throw new UnauthorizedError();
    await requirePermission(session.user.id, PERMISSIONS.CONTENT_STUDIO_RESEARCH);

    const config = await prisma.researchAutomationConfig.findUnique({
      where: { key: "singleton" },
    });

    return apiSuccess({ config });
  } catch (err) {
    return handleApiError(err);
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) throw new UnauthorizedError();
    await requirePermission(session.user.id, PERMISSIONS.CONTENT_STUDIO_PROVIDER_MANAGE);

    const body = automationSchema.parse(await req.json());
    const config = await prisma.researchAutomationConfig.upsert({
      where: { key: "singleton" },
      create: {
        key: "singleton",
        isEnabled: body.isEnabled,
        frequency: body.frequency,
        scheduleCron: body.scheduleCron,
        categories: body.categories,
        languages: body.languages,
        notifyUserIds: body.notifyUserIds,
        updatedById: session.user.id,
      },
      update: {
        isEnabled: body.isEnabled,
        frequency: body.frequency,
        scheduleCron: body.scheduleCron,
        categories: body.categories,
        languages: body.languages,
        notifyUserIds: body.notifyUserIds,
        updatedById: session.user.id,
      },
    });

    return apiSuccess({ config });
  } catch (err) {
    return handleApiError(err);
  }
}
