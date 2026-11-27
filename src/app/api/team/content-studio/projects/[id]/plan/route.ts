import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requirePermission, UnauthorizedError } from "@/lib/rbac/guard";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { apiSuccess, handleApiError } from "@/lib/api/response";
import { generateContentPlan } from "@/lib/ai-studio/production/planner";

const planInputSchema = z.object({
  topic: z.string().trim().min(2).max(240),
  subject: z.string().trim().max(120).optional(),
  chapter: z.string().trim().max(160).optional(),
  audience: z.string().trim().max(200).optional(),
  examTrack: z.string().trim().max(60).optional(),
  classLevel: z.string().trim().max(60).optional(),
  language: z.string().trim().max(24).default("en"),
  medium: z.string().trim().max(40).default("BILINGUAL"),
  contentFormat: z.string().trim().max(60).default("LONG_FORM_YOUTUBE"),
  platform: z.string().trim().max(40).default("YOUTUBE"),
  targetDurationSec: z.number().int().min(15).max(14400).default(600),
  teacherName: z.string().trim().max(120).optional(),
  tone: z.string().trim().max(40).default("EDUCATIONAL"),
  objective: z.string().trim().max(1000).optional(),
  referenceMaterials: z.string().trim().max(4000).optional(),
});

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) throw new UnauthorizedError();
    await requirePermission(session.user.id, PERMISSIONS.CONTENT_STUDIO_PROJECT_READ);

    const plans = await prisma.contentPlan.findMany({
      where: { projectId: params.id },
      orderBy: { version: "desc" },
    });

    return apiSuccess({ plans });
  } catch (err) {
    return handleApiError(err);
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) throw new UnauthorizedError();
    await requirePermission(session.user.id, PERMISSIONS.CONTENT_STUDIO_AI_GENERATE);

    const body = planInputSchema.parse(await req.json());
    const result = await generateContentPlan({
      ...body,
      projectId: params.id,
      userId: session.user.id,
      roleName: session.user.role ?? undefined,
    });

    return apiSuccess(result, 201);
  } catch (err) {
    return handleApiError(err);
  }
}
