import "server-only";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { parseAiJson } from "@/lib/ai/latex-json";
import { studioProviderRouter } from "../router";

export interface ContentPlanInput {
  projectId: string;
  topic: string;
  subject?: string;
  chapter?: string;
  audience?: string;
  examTrack?: string;
  classLevel?: string;
  language: string;
  medium: string;
  contentFormat: string;
  platform: string;
  targetDurationSec: number;
  teacherName?: string;
  tone: string;
  objective?: string;
  referenceMaterials?: string;
  competitorRefs?: unknown;
  userId: string;
  roleName?: string;
}

export async function generateContentPlan(input: ContentPlanInput) {
  const prompt = [
    `Generate a complete, structured 17-part video production plan for Atomic Pathshala.`,
    `Topic: ${input.topic}`,
    `Subject: ${input.subject || "General"} | Chapter: ${input.chapter || "N/A"} | Exam Track: ${input.examTrack || "NEET/JEE"} | Class: ${input.classLevel || "11-12"}`,
    `Audience: ${input.audience || "Indian NEET/JEE/Board students"}`,
    `Language: ${input.language} | Medium: ${input.medium} | Format: ${input.contentFormat} | Platform: ${input.platform}`,
    `Target Duration: ${input.targetDurationSec}s | Teacher: ${input.teacherName || "Faculty"} | Tone: ${input.tone}`,
    `Objective: ${input.objective || "Conceptual clarity and student engagement"}`,
    input.referenceMaterials ? `Reference Materials: ${input.referenceMaterials}` : "",
    "",
    "Return a valid JSON object with EXACTLY these 17 keys:",
    "1. contentObjective (string)",
    "2. audience (string)",
    "3. videoAngle (string)",
    "4. targetViewer (string)",
    "5. openingHook (string)",
    "6. introduction (string)",
    "7. segmentStructure (array of { title, durationSec, summary })",
    "8. mainContent (string)",
    "9. visualPlan (string)",
    "10. animationRequirements (array of strings)",
    "11. diagramRequirements (array of strings)",
    "12. examples (array of strings)",
    "13. questionPoints (array of strings)",
    "14. retentionPoints (array of strings)",
    "15. cta (string)",
    "16. ending (string)",
    "17. shortsOpportunities (array of strings)",
  ]
    .filter(Boolean)
    .join("\n");

  const aiRes = await studioProviderRouter.generateText({
    prompt,
    systemPrompt: "You are a Senior EdTech Content Producer. Output strict valid JSON.",
    taskType: "CONTENT_PLANNING",
    responseFormat: "json",
    feature: "CONTENT_PLAN_GENERATE",
    userId: input.userId,
    roleName: input.roleName,
    projectId: input.projectId,
  });

  const planData = (parseAiJson(aiRes.text) as Record<string, unknown> | null) || {
    rawPlanText: aiRes.text,
  };

  const latest = await prisma.contentPlan.findFirst({
    where: { projectId: input.projectId },
    orderBy: { version: "desc" },
    select: { version: true },
  });
  const version = (latest?.version ?? 0) + 1;

  const plan = await prisma.$transaction(async (tx) => {
    const created = await tx.contentPlan.create({
      data: {
        projectId: input.projectId,
        version,
        topic: input.topic,
        subject: input.subject ?? null,
        chapter: input.chapter ?? null,
        audience: input.audience ?? null,
        examTrack: input.examTrack ?? null,
        classLevel: input.classLevel ?? null,
        language: input.language,
        medium: input.medium,
        contentFormat: input.contentFormat,
        platform: input.platform,
        targetDurationSec: input.targetDurationSec,
        teacherName: input.teacherName ?? null,
        tone: input.tone,
        objective: input.objective ?? null,
        referenceMaterials: input.referenceMaterials ?? null,
        competitorRefs: (input.competitorRefs as Prisma.InputJsonValue | undefined) ?? undefined,
        planData: planData as Prisma.InputJsonValue,
        providerUsed: aiRes.provider,
        modelUsed: aiRes.model,
        createdById: input.userId,
      },
    });

    await tx.contentProject.update({
      where: { id: input.projectId },
      data: {
        status: "PLANNED",
        topic: input.topic,
        subject: input.subject ?? undefined,
        chapter: input.chapter ?? undefined,
      },
    });

    await tx.contentHistory.create({
      data: {
        projectId: input.projectId,
        entityType: "PROJECT",
        entityId: created.id,
        version,
        snapshot: { topic: input.topic, format: input.contentFormat, provider: aiRes.provider },
        changeSummary: `Generated Content Plan v${version}`,
        actorId: input.userId,
      },
    });

    return created;
  });

  return { plan, providerUsed: aiRes.provider, modelUsed: aiRes.model };
}
