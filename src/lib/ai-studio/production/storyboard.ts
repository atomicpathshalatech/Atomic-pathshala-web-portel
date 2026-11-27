import "server-only";
import { prisma } from "@/lib/prisma";
import { parseAiJson } from "@/lib/ai/latex-json";
import { studioProviderRouter } from "../router";

interface GeneratedSceneInput {
  orderIndex: number;
  title: string;
  durationSec: number;
  narrationText: string;
  visualPrompt: string;
  requiredImage: string;
  requiredVideo: string;
  diagramSpec: string;
  animationNotes: string;
  cameraDirection: string;
  textOnScreen: string;
  voiceInstructions: string;
  musicInstructions: string;
}

export async function generateStoryboardFromScript(params: {
  projectId: string;
  scriptId: string;
  aspectRatio?: string;
  userId: string;
  roleName?: string;
}) {
  const script = await prisma.contentScript.findUnique({ where: { id: params.scriptId } });
  if (!script) throw new Error("Script not found");

  const prompt = [
    "Convert the following educational script into a detailed scene-by-scene storyboard.",
    `Aspect Ratio: ${params.aspectRatio || "16:9"}`,
    "",
    "SCRIPT:",
    script.bodyMarkdown,
    "",
    "Return JSON with key `scenes` (array of 4 to 10 scenes).",
    "Each scene MUST have: { orderIndex: number, title: string, durationSec: number, narrationText: string, visualPrompt: string, requiredImage: string, requiredVideo: string, diagramSpec: string, animationNotes: string, cameraDirection: string, textOnScreen: string, voiceInstructions: string, musicInstructions: string }",
  ].join("\n");

  const aiRes = await studioProviderRouter.generateText({
    prompt,
    systemPrompt: "You are a Video Director & Storyboard Artist. Output strict valid JSON.",
    taskType: "CONTENT_PLANNING",
    responseFormat: "json",
    feature: "STORYBOARD_GENERATE",
    userId: params.userId,
    roleName: params.roleName,
    projectId: params.projectId,
  });

  const parsed = parseAiJson(aiRes.text) as { scenes?: GeneratedSceneInput[] } | null;
  const scenes = Array.isArray(parsed?.scenes) ? parsed!.scenes : [];
  const totalDurationSec = scenes.reduce((sum, s) => sum + (Number(s.durationSec) || 10), 0);

  const latest = await prisma.storyboard.findFirst({
    where: { projectId: params.projectId },
    orderBy: { version: "desc" },
    select: { version: true },
  });
  const version = (latest?.version ?? 0) + 1;

  const storyboard = await prisma.$transaction(async (tx) => {
    const created = await tx.storyboard.create({
      data: {
        projectId: params.projectId,
        scriptId: params.scriptId,
        version,
        aspectRatio: params.aspectRatio || "16:9",
        totalDurationSec,
        createdById: params.userId,
        scenes: {
          create: scenes.map((s, idx) => ({
            orderIndex: Number(s.orderIndex) || idx + 1,
            title: s.title || `Scene ${idx + 1}`,
            durationSec: Number(s.durationSec) || 10,
            narrationText: s.narrationText || "",
            visualPrompt: s.visualPrompt || "",
            requiredImage: s.requiredImage || "",
            requiredVideo: s.requiredVideo || "",
            diagramSpec: s.diagramSpec || "",
            animationNotes: s.animationNotes || "",
            cameraDirection: s.cameraDirection || "Static medium shot",
            textOnScreen: s.textOnScreen || "",
            voiceInstructions: s.voiceInstructions || "Clear, engaging",
            musicInstructions: s.musicInstructions || "Subtle ambient underscore",
          })),
        },
      },
      include: { scenes: { orderBy: { orderIndex: "asc" } } },
    });

    await tx.contentHistory.create({
      data: {
        projectId: params.projectId,
        entityType: "STORYBOARD",
        entityId: created.id,
        version,
        snapshot: { sceneCount: created.scenes.length, aspectRatio: created.aspectRatio },
        changeSummary: `Generated Storyboard v${version} (${created.scenes.length} scenes)`,
        actorId: params.userId,
      },
    });

    return created;
  });

  return storyboard;
}
