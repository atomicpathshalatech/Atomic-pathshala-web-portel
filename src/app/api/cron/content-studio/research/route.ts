import { NextRequest } from "next/server";
import { ResearchCategory } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { apiError, apiSuccess, handleApiError } from "@/lib/api/response";
import { scanAllActiveCompetitors } from "@/lib/ai-studio/research/competitors";
import { runOpportunityResearch } from "@/lib/ai-studio/research/opportunity-engine";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(req: NextRequest) {
  try {
    const authHeader = req.headers.get("authorization");
    const secret = process.env.CRON_SECRET;
    if (process.env.NODE_ENV === "production" && (!secret || authHeader !== `Bearer ${secret}`)) {
      return apiError("Unauthorized", 401);
    }

    const config = await prisma.researchAutomationConfig.findUnique({
      where: { key: "singleton" },
    });
    if (!config || !config.isEnabled) {
      return apiSuccess({ skipped: true, reason: "Research automation disabled" });
    }

    const competitorResults = await scanAllActiveCompetitors();
    const systemActorId = config.updatedById || "SYSTEM";
    const categoryResults = [];

    for (const cat of config.categories.slice(0, 3)) {
      try {
        const res = await runOpportunityResearch({
          category: cat as ResearchCategory,
          language: config.languages[0] || "hi",
          userId: systemActorId,
        });
        categoryResults.push({ category: cat, count: res.opportunities.length, ok: true });
      } catch (err) {
        categoryResults.push({
          category: cat,
          ok: false,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }

    await prisma.researchAutomationConfig.update({
      where: { key: "singleton" },
      data: {
        lastRunAt: new Date(),
        lastRunStatus: "COMPLETED",
        lastRunSummary: JSON.stringify({ competitorResults, categoryResults }).slice(0, 2000),
      },
    });

    return apiSuccess({ competitorResults, categoryResults });
  } catch (err) {
    return handleApiError(err);
  }
}
