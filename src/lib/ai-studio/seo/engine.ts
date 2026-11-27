import "server-only";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { parseAiJson } from "@/lib/ai/latex-json";
import { studioProviderRouter } from "../router";
import { formatBrandContextForPrompt } from "./brand-context";

export interface SeoTitleOption {
  title: string;
  type: string;
  clarity: number;
  searchRelevance: number;
  audienceRelevance: number;
  curiosity: number;
  misleadingRisk: "LOW" | "MEDIUM" | "HIGH";
  reasoning: string;
}

export interface SeoChapterItem {
  timestamp: string;
  title: string;
}

export interface SeoShortsItem {
  idea: string;
  hook: string;
  script: string;
}

function enforceTagLimit(tags: string[], maxChars = 480): string[] {
  const out: string[] = [];
  let total = 0;
  for (const raw of tags) {
    const t = raw.trim();
    if (!t) continue;
    const cost = t.length + (out.length > 0 ? 1 : 0);
    if (total + cost > maxChars) break;
    out.push(t);
    total += cost;
  }
  return out;
}

export async function generateCompleteSeoPackage(params: {
  projectId: string;
  topic: string;
  subject?: string;
  chapter?: string;
  language: string;
  videoType: string;
  channel: string;
  targetAudience?: string;
  scriptText?: string;
  userId: string;
  roleName?: string;
}) {
  const prompt = [
    formatBrandContextForPrompt(),
    "",
    `VIDEO DETAILS:`,
    `- Topic: ${params.topic}`,
    `- Subject: ${params.subject || "Science / NEET-JEE"} | Chapter: ${params.chapter || "N/A"}`,
    `- Language: ${params.language} | Video Type: ${params.videoType} | Channel: ${params.channel}`,
    `- Target Audience: ${params.targetAudience || "NEET UG 2026/2027 & Board students"}`,
    params.scriptText ? `\nSCRIPT EXCERPT:\n${params.scriptText.slice(0, 3500)}` : "",
    "",
    "YOUTUBE POLICY & QUALITY RULES:",
    "1. Do NOT keyword stuff, invent fake search volumes, promise guaranteed viral reach, or write misleading clickbait.",
    "2. Keep tags relevant and concise (total <= 480 characters).",
    "3. Keep hashtags between 3 and 5 relevant hashtags.",
    "4. Title scores (1-10) are AI estimates of clarity, searchRelevance, audienceRelevance, and curiosity.",
    "",
    "Return a valid JSON object with these keys:",
    "{",
    '  "titles": Array<{ "title": string, "type": "Search-focused"|"Curiosity-focused"|"Educational"|"NEET-focused"|"Hindi-focused"|"Bilingual"|"PYQ-focused"|"One Shot"|"Revision"|"Live class", "clarity": number, "searchRelevance": number, "audienceRelevance": number, "curiosity": number, "misleadingRisk": "LOW"|"MEDIUM"|"HIGH", "reasoning": string }>,',
    '  "description": string (complete YouTube description with Opening, Summary, What Viewers Will Learn, Chapters placeholder, Batch/Course info, CTA, Website, Social links, Disclaimer),',
    '  "tags": string[] (10-15 relevant tags),',
    '  "hashtags": string[] (3-5 hashtags starting with #),',
    '  "chapters": Array<{ "timestamp": string, "title": string }>,',
    '  "targetKeywords": string[],',
    '  "pinnedComment": string,',
    '  "communityPost": string,',
    '  "instagramCaption": string,',
    '  "reelCaption": string,',
    '  "whatsappMessage": string,',
    '  "shortsPack": Array<{ "idea": string, "hook": string, "script": string }>',
    "}",
  ]
    .filter(Boolean)
    .join("\n");

  const aiRes = await studioProviderRouter.generateText({
    prompt,
    systemPrompt: "You are a YouTube Packaging & Educational SEO Strategist. Output strict valid JSON.",
    taskType: "SEO",
    responseFormat: "json",
    feature: "SEO_PACKAGE_GENERATE",
    userId: params.userId,
    roleName: params.roleName,
    projectId: params.projectId,
  });

  const parsed = (parseAiJson(aiRes.text) as Record<string, unknown> | null) || {};
  const titles = Array.isArray(parsed.titles) ? (parsed.titles as SeoTitleOption[]) : [];
  const tags = enforceTagLimit(Array.isArray(parsed.tags) ? (parsed.tags as string[]) : []);
  const hashtags = (Array.isArray(parsed.hashtags) ? (parsed.hashtags as string[]) : []).slice(0, 5);
  const chapters = Array.isArray(parsed.chapters) ? (parsed.chapters as SeoChapterItem[]) : [];
  const targetKeywords = Array.isArray(parsed.targetKeywords) ? (parsed.targetKeywords as string[]) : [];
  const shortsPack = Array.isArray(parsed.shortsPack) ? (parsed.shortsPack as SeoShortsItem[]) : [];

  const seoPkg = await prisma.$transaction(async (tx) => {
    const created = await tx.seoPackage.create({
      data: {
        projectId: params.projectId,
        language: params.language,
        videoType: params.videoType,
        channel: params.channel,
        titles: titles as unknown as Prisma.InputJsonValue,
        description: typeof parsed.description === "string" ? parsed.description : "",
        tags,
        hashtags,
        chapters: chapters as unknown as Prisma.InputJsonValue,
        targetKeywords,
        pinnedComment: typeof parsed.pinnedComment === "string" ? parsed.pinnedComment : "",
        communityPost: typeof parsed.communityPost === "string" ? parsed.communityPost : "",
        instagramCaption: typeof parsed.instagramCaption === "string" ? parsed.instagramCaption : "",
        reelCaption: typeof parsed.reelCaption === "string" ? parsed.reelCaption : "",
        whatsappMessage: typeof parsed.whatsappMessage === "string" ? parsed.whatsappMessage : "",
        shortsPack: shortsPack as unknown as Prisma.InputJsonValue,
        providerUsed: aiRes.provider,
        modelUsed: aiRes.model,
        createdById: params.userId,
      },
    });

    await tx.contentHistory.create({
      data: {
        projectId: params.projectId,
        entityType: "SEO",
        entityId: created.id,
        version: 1,
        snapshot: { titleCount: titles.length, tagCount: tags.length, provider: aiRes.provider },
        changeSummary: `Generated YouTube SEO Package (${aiRes.provider})`,
        actorId: params.userId,
      },
    });

    return created;
  });

  return seoPkg;
}
