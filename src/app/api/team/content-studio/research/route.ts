import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { ResearchCategory } from "@prisma/client";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requirePermission, UnauthorizedError } from "@/lib/rbac/guard";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { apiSuccess, handleApiError } from "@/lib/api/response";
import { runOpportunityResearch } from "@/lib/ai-studio/research/opportunity-engine";

const runResearchSchema = z.object({
  category: z
    .enum(["NEET", "JEE", "BOARDS", "MOTIVATIONAL", "EDUCATIONAL_NEWS"])
    .default("NEET"),
  language: z.string().trim().max(16).default("hi"),
});

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) throw new UnauthorizedError();
    await requirePermission(session.user.id, PERMISSIONS.CONTENT_STUDIO_RESEARCH);

    const category = req.nextUrl.searchParams.get("category");
    const status = req.nextUrl.searchParams.get("status");

    const opportunities = await prisma.contentOpportunity.findMany({
      where: {
        ...(category ? { category: category as ResearchCategory } : {}),
        ...(status ? { status } : { status: { not: "DISMISSED" } }),
      },
      orderBy: [{ researchedAt: "desc" }, { opportunityScore: "desc" }],
      take: 40,
    });

    const latestResearchedAt = opportunities[0]?.researchedAt ?? null;

    return apiSuccess({ opportunities, latestResearchedAt });
  } catch (err) {
    return handleApiError(err);
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) throw new UnauthorizedError();
    await requirePermission(session.user.id, PERMISSIONS.CONTENT_STUDIO_RESEARCH);
    await requirePermission(session.user.id, PERMISSIONS.CONTENT_STUDIO_AI_GENERATE);

    const body = runResearchSchema.parse(await req.json());
    const result = await runOpportunityResearch({
      category: body.category,
      language: body.language,
      userId: session.user.id,
      roleName: session.user.role ?? undefined,
    });

    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        action: "CONTENT_STUDIO_RESEARCH_RUN",
        entityType: "ContentOpportunity",
        entityId: body.category,
        metadata: {
          category: body.category,
          sourceCount: result.sourceCount,
          createdCount: result.opportunities.length,
        },
      },
    });

    return apiSuccess(result, 201);
  } catch (err) {
    return handleApiError(err);
  }
}
