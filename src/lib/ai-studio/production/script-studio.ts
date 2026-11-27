import "server-only";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { parseAiJson } from "@/lib/ai/latex-json";
import { studioProviderRouter } from "../router";

export interface ScriptSection {
  id: string;
  type: "HOOK" | "INTRO" | "MAIN" | "ENGAGEMENT" | "CTA" | "ENDING";
  title: string;
  content: string;
  durationSec: number;
}

export function sectionsToMarkdown(sections: ScriptSection[]): string {
  return sections
    .map((s) => `## [${s.type}] ${s.title} (~${s.durationSec}s)\n\n${s.content}`)
    .join("\n\n---\n\n");
}

export async function generateFullScript(params: {
  projectId: string;
  topic: string;
  language: string;
  medium: string;
  style: string;
  targetDurationSec?: number;
  planSummary?: string;
  userId: string;
  roleName?: string;
}) {
  const prompt = [
    `Write a complete, production-ready video script for Atomic Pathshala.`,
    `Topic: ${params.topic}`,
    `Language: ${params.language} | Medium: ${params.medium} | Style: ${params.style}`,
    `Target Duration: ${params.targetDurationSec ?? 480} seconds`,
    params.planSummary ? `Content Plan Context:\n${params.planSummary}` : "",
    "",
    "Return a valid JSON object with key `sections` (array of objects):",
    "Each object: { id: string, type: 'HOOK'|'INTRO'|'MAIN'|'ENGAGEMENT'|'CTA'|'ENDING', title: string, content: string, durationSec: number }",
    "Requirements:",
    "- First item MUST be HOOK (5-15 seconds).",
    "- Second item MUST be INTRO explaining why the viewer should watch.",
    "- Include 2-4 MAIN logical segments.",
    "- Include at least 1 ENGAGEMENT section (questions/examples/interaction).",
    "- Include CTA and ENDING.",
  ]
    .filter(Boolean)
    .join("\n");

  const aiRes = await studioProviderRouter.generateText({
    prompt,
    systemPrompt: "You are an expert EdTech scriptwriter. Output strict valid JSON.",
    taskType: "SCRIPT_WRITING",
    responseFormat: "json",
    feature: "SCRIPT_GENERATE",
    userId: params.userId,
    roleName: params.roleName,
    projectId: params.projectId,
  });

  const parsed = parseAiJson(aiRes.text) as { sections?: ScriptSection[] } | null;
  const sections: ScriptSection[] =
    Array.isArray(parsed?.sections) && parsed!.sections.length > 0
      ? parsed!.sections.map((s, idx) => ({
          id: s.id || `sec-${idx + 1}`,
          type: s.type || "MAIN",
          title: s.title || `Section ${idx + 1}`,
          content: s.content || "",
          durationSec: Number(s.durationSec) || 30,
        }))
      : [
          {
            id: "sec-1",
            type: "MAIN",
            title: params.topic,
            content: aiRes.text,
            durationSec: params.targetDurationSec ?? 300,
          },
        ];

  const markdown = sectionsToMarkdown(sections);
  const wordCount = markdown.split(/\s+/).filter(Boolean).length;
  const totalDur = sections.reduce((acc, s) => acc + (s.durationSec || 0), 0);

  const latest = await prisma.contentScript.findFirst({
    where: { projectId: params.projectId },
    orderBy: { version: "desc" },
    select: { version: true },
  });
  const version = (latest?.version ?? 0) + 1;

  const script = await prisma.$transaction(async (tx) => {
    await tx.contentScript.updateMany({
      where: { projectId: params.projectId, isActive: true },
      data: { isActive: false },
    });

    const created = await tx.contentScript.create({
      data: {
        projectId: params.projectId,
        version,
        title: `${params.topic} — v${version}`,
        hook: sections.find((s) => s.type === "HOOK")?.content ?? null,
        cta: sections.find((s) => s.type === "CTA")?.content ?? null,
        bodyMarkdown: markdown,
        sectionsJson: sections as unknown as Prisma.InputJsonValue,
        language: params.language,
        medium: params.medium,
        style: params.style,
        wordCount,
        estimatedDurationSec: totalDur,
        providerUsed: aiRes.provider,
        modelUsed: aiRes.model,
        isActive: true,
        createdById: params.userId,
      },
    });

    await tx.contentProject.update({
      where: { id: params.projectId },
      data: { status: "SCRIPT_READY" },
    });

    await tx.contentHistory.create({
      data: {
        projectId: params.projectId,
        entityType: "SCRIPT",
        entityId: created.id,
        version,
        snapshot: { title: created.title, style: params.style, language: params.language },
        changeSummary: `Generated Script v${version} (${aiRes.provider})`,
        actorId: params.userId,
      },
    });

    return created;
  });

  return script;
}

export async function transformScriptSection(params: {
  projectId: string;
  sectionText: string;
  action: "REWRITE" | "SHORTEN" | "EXPAND" | "CHANGE_TONE" | "TRANSLATE" | "REGENERATE" | "ADD_EXAMPLE";
  targetTone?: string;
  targetLanguage?: string;
  userId: string;
  roleName?: string;
}) {
  const instructionMap: Record<string, string> = {
    REWRITE: "Rewrite this script section for better clarity, flow, and spoken delivery.",
    SHORTEN: "Shorten this script section by ~40% while keeping all key concepts intact.",
    EXPAND: "Expand this script section with deeper explanation and step-by-step clarity.",
    CHANGE_TONE: `Rewrite this script section in a ${params.targetTone || "ENERGETIC"} tone.`,
    TRANSLATE: `Translate/adapt this script section naturally into ${params.targetLanguage || "Hinglish"} for Indian students.`,
    REGENERATE: "Write a fresh alternative version of this script section with a stronger opening.",
    ADD_EXAMPLE: "Enhance this script section by adding a relatable real-world or exam-relevant example.",
  };

  const res = await studioProviderRouter.generateText({
    prompt: `${instructionMap[params.action]}\n\nORIGINAL TEXT:\n${params.sectionText}\n\nReturn ONLY the updated section text.`,
    taskType: "SCRIPT_WRITING",
    feature: `SCRIPT_${params.action}`,
    userId: params.userId,
    roleName: params.roleName,
    projectId: params.projectId,
  });

  return { updatedText: res.text.trim(), provider: res.provider, model: res.model };
}

export async function runChemistryVerification(params: {
  projectId: string;
  scriptId: string;
  scriptText: string;
  userId: string;
  roleName?: string;
}) {
  const prompt = [
    "Audit the following Chemistry educational script for scientific accuracy.",
    "STRICT RULES:",
    "1. Distinguish clearly between verified scientific facts, AI-generated explanations, and unverified/potentially incorrect statements.",
    "2. Check chemical terminology, equations, balancing, reaction mechanisms, and structures.",
    "3. Note NCERT alignment only where you are certain; NEVER invent NCERT page numbers or fake citations.",
    "",
    "SCRIPT:",
    params.scriptText,
    "",
    "Return JSON: { overallStatus: 'VERIFIED'|'NEEDS_CORRECTION'|'FLAGGED', verifiedFacts: string[], aiExplanations: string[], unverifiedStatements: string[], equationChecks: string[], ncertNotes: string[] }",
  ].join("\n");

  const res = await studioProviderRouter.generateText({
    prompt,
    systemPrompt: "You are a strict Chemistry SME & Scientific Auditor. Output valid JSON.",
    taskType: "CHEMISTRY_VERIFICATION",
    responseFormat: "json",
    feature: "CHEMISTRY_ACCURACY_CHECK",
    userId: params.userId,
    roleName: params.roleName,
    projectId: params.projectId,
  });

  const audit = (parseAiJson(res.text) as Record<string, unknown> | null) || {
    overallStatus: "FLAGGED",
    unverifiedStatements: [res.text],
  };

  await prisma.contentScript.update({
    where: { id: params.scriptId },
    data: { chemistryAudit: audit as Prisma.InputJsonValue },
  });

  return audit;
}

export async function runRetentionAnalysis(params: {
  projectId: string;
  scriptId: string;
  scriptText: string;
  userId: string;
  roleName?: string;
}) {
  const prompt = [
    "Review the following educational video script and suggest practical improvements for pacing and viewer engagement.",
    "Do NOT claim that suggestions guarantee retention or virality.",
    "",
    "SCRIPT:",
    params.scriptText,
    "",
    "Return JSON: { hookImprovements: string[], patternChanges: string[], visualChanges: string[], examplesToAdd: string[], questionsToAsk: string[], curiosityLoops: string[], transitions: string[] }",
  ].join("\n");

  const res = await studioProviderRouter.generateText({
    prompt,
    systemPrompt: "You are an educational video editor & pacing reviewer. Output valid JSON.",
    taskType: "SUMMARIZATION",
    responseFormat: "json",
    feature: "RETENTION_ANALYSIS",
    userId: params.userId,
    roleName: params.roleName,
    projectId: params.projectId,
  });

  const review = (parseAiJson(res.text) as Record<string, unknown> | null) || {
    hookImprovements: [res.text],
  };

  await prisma.contentScript.update({
    where: { id: params.scriptId },
    data: { retentionReview: review as Prisma.InputJsonValue },
  });

  return review;
}
