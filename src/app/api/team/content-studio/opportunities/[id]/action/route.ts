import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requirePermission, UnauthorizedError } from "@/lib/rbac/guard";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { apiError, apiSuccess, handleApiError } from "@/lib/api/response";
import { studioProviderRouter } from "@/lib/ai-studio/router";

const actionSchema = z.object({
  action: z.enum([
    "SAVE_IDEA",
    "CREATE_PROJECT",
    "GENERATE_CONTENT_PLAN",
    "GENERATE_SCRIPT",
    "GENERATE_SHORTS",
    "DISMISS",
  ]),
});

function makeSlug(title: string): string {
  const base = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
  return `${base || "topic"}-${Math.random().toString(36).slice(2, 7)}`;
}

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) throw new UnauthorizedError();
    await requirePermission(session.user.id, PERMISSIONS.CONTENT_STUDIO_RESEARCH);

    const body = actionSchema.parse(await req.json());
    const opp = await prisma.contentOpportunity.findUnique({ where: { id: params.id } });
    if (!opp) return apiError("Opportunity not found", 404);

    if (body.action === "DISMISS") {
      const updated = await prisma.contentOpportunity.update({
        where: { id: opp.id },
        data: { status: "DISMISSED" },
      });
      return apiSuccess({ opportunity: updated });
    }

    if (body.action === "SAVE_IDEA") {
      const idea = await prisma.contentIdea.create({
        data: {
          title: opp.topic,
          topic: opp.topic,
          source: "TREND_RESEARCH",
          trendScore: opp.opportunityScore,
          competitorRefs: opp.competitorRefs ?? undefined,
          brief: `${opp.whyThisTopic}\n\nAngle: ${opp.suggestedAngle || ""}`,
          status: "SHORTLISTED",
          createdById: session.user.id,
        },
      });
      await prisma.contentOpportunity.update({
        where: { id: opp.id },
        data: { status: "SAVED", savedIdeaId: idea.id },
      });
      return apiSuccess({ idea }, 201);
    }

    // Ensure a project exists for CREATE_PROJECT / GENERATE_CONTENT_PLAN / GENERATE_SCRIPT / GENERATE_SHORTS
    await requirePermission(session.user.id, PERMISSIONS.CONTENT_STUDIO_PROJECT_CREATE);

    const projectType =
      body.action === "GENERATE_SHORTS" || opp.recommendedFormat === "SHORTS"
        ? "YOUTUBE_SHORT"
        : opp.recommendedFormat === "REEL"
          ? "INSTAGRAM_REEL"
          : opp.recommendedFormat === "LECTURE"
            ? "LECTURE"
            : "YOUTUBE_VIDEO";

    const project = opp.projectId
      ? await prisma.contentProject.findUnique({ where: { id: opp.projectId } })
      : null;

    const activeProject =
      project ||
      (await prisma.contentProject.create({
        data: {
          title: opp.topic,
          slug: makeSlug(opp.topic),
          description: opp.researchSummary,
          type: projectType,
          status: "PLANNED",
          topic: opp.topic,
          subject: opp.category,
          targetAudience: opp.audienceFit || opp.category,
          platform: projectType === "INSTAGRAM_REEL" ? "INSTAGRAM" : "YOUTUBE",
          objective: opp.whyThisTopic,
          ownerId: session.user.id,
        },
      }));

    if (!opp.projectId) {
      await prisma.contentOpportunity.update({
        where: { id: opp.id },
        data: { status: "CONVERTED", projectId: activeProject.id },
      });
    }

    if (body.action === "CREATE_PROJECT") {
      return apiSuccess({ project: activeProject }, 201);
    }

    await requirePermission(session.user.id, PERMISSIONS.CONTENT_STUDIO_AI_GENERATE);

    const taskPrompt =
      body.action === "GENERATE_CONTENT_PLAN"
        ? `Create a structured content plan (hook, key sections, visual cues, CTA, publishing checklist) for Atomic Pathshala.\nTopic: ${opp.topic}\nCategory: ${opp.category}\nSummary: ${opp.researchSummary}\nAngle: ${opp.suggestedAngle || ""}`
        : body.action === "GENERATE_SHORTS"
          ? `Write a crisp 45-60 second YouTube Shorts / Reel script in Hinglish/English for Atomic Pathshala.\nTopic: ${opp.topic}\nAngle: ${opp.suggestedAngle || ""}\nInclude: 3-second Hook, Core Explanation, Visual Cue, and CTA.`
          : `Write a complete, engaging YouTube video script for Atomic Pathshala.\nTopic: ${opp.topic}\nCategory: ${opp.category}\nSummary: ${opp.researchSummary}\nAngle: ${opp.suggestedAngle || ""}\nInclude: Hook, Intro, Structured Sections, Examples, and CTA.`;

    const aiRes = await studioProviderRouter.generateText({
      prompt: taskPrompt,
      taskType: body.action === "GENERATE_CONTENT_PLAN" ? "CONTENT_PLANNING" : "SCRIPT_WRITING",
      feature: `OPPORTUNITY_${body.action}`,
      userId: session.user.id,
      roleName: session.user.role ?? undefined,
      projectId: activeProject.id,
    });

    const script = await prisma.contentScript.create({
      data: {
        projectId: activeProject.id,
        title: `${opp.topic} (${body.action.replace("GENERATE_", "")})`,
        bodyMarkdown: aiRes.text,
        wordCount: aiRes.text.split(/\s+/).filter(Boolean).length,
        estimatedDurationSec: body.action === "GENERATE_SHORTS" ? 55 : 480,
        providerUsed: aiRes.provider,
        modelUsed: aiRes.model,
        createdById: session.user.id,
      },
    });

    await prisma.contentHistory.create({
      data: {
        projectId: activeProject.id,
        entityType: "SCRIPT",
        entityId: script.id,
        version: 1,
        snapshot: { title: script.title, provider: aiRes.provider, model: aiRes.model },
        changeSummary: `Generated via Opportunity Engine (${body.action})`,
        actorId: session.user.id,
      },
    });

    return apiSuccess({ project: activeProject, script }, 201);
  } catch (err) {
    return handleApiError(err);
  }
}
