import "server-only";
import { parseAiJson } from "@/lib/ai/latex-json";
import { studioProviderRouter } from "../router";
import { persistGeneratedStudioAsset } from "../storage";
import { ThumbnailConcept, ThumbnailLayer } from "./types";

export async function generateThumbnailConcepts(params: {
  topic: string;
  subject?: string;
  chapter?: string;
  projectType: string;
  targetAudience?: string;
  keyMessage?: string;
  thumbnailText?: string;
  platform: string;
  userId: string;
  roleName?: string;
  projectId: string;
}): Promise<{ concepts: ThumbnailConcept[]; provider: string; model: string }> {
  const prompt = [
    `Generate 5 distinct, high-impact YouTube/Social thumbnail concepts for Atomic Pathshala.`,
    `Topic: ${params.topic}`,
    `Type: ${params.projectType} | Subject: ${params.subject || "General"} | Chapter: ${params.chapter || "N/A"}`,
    `Audience: ${params.targetAudience || "NEET/JEE/Board students"} | Platform: ${params.platform}`,
    params.keyMessage ? `Key Message: ${params.keyMessage}` : "",
    params.thumbnailText ? `Preferred Text Hint: ${params.thumbnailText}` : "",
    "",
    "Use 5 DIFFERENT styles from: Curiosity, Exam Urgency, Concept Visual, Minimal Premium, Teacher-Focused, Emotional, Cinematic, Problem/Solution, Before/After.",
    "STRICT RULE: Keep headlineText VERY SHORT (2 to 5 words max) so it is readable on mobile without overcrowding.",
    "",
    "Return JSON: { concepts: Array<{ id, style, headlineText, subText, compositionNote, backgroundPrompt, primaryColor, accentColor }> }",
  ]
    .filter(Boolean)
    .join("\n");

  const res = await studioProviderRouter.generateText({
    prompt,
    systemPrompt: "You are a YouTube Creative Director for Indian EdTech. Output strict valid JSON.",
    taskType: "THUMBNAIL_PROMPT",
    responseFormat: "json",
    feature: "THUMBNAIL_CONCEPTS",
    userId: params.userId,
    roleName: params.roleName,
    projectId: params.projectId,
  });

  const parsed = parseAiJson(res.text) as { concepts?: ThumbnailConcept[] } | null;
  const concepts = Array.isArray(parsed?.concepts) ? parsed!.concepts : [];

  return {
    concepts: concepts.slice(0, 6).map((c, idx) => ({
      id: c.id || `concept-${idx + 1}`,
      style: c.style || "Concept Visual",
      headlineText: c.headlineText || params.topic.slice(0, 24),
      subText: c.subText,
      compositionNote: c.compositionNote || "",
      backgroundPrompt: c.backgroundPrompt || `Clean dramatic educational background for ${params.topic}`,
      primaryColor: c.primaryColor || "#0050cb",
      accentColor: c.accentColor || "#f97316",
    })),
    provider: res.provider,
    model: res.model,
  };
}

export async function generateThumbnailImageLayer(params: {
  prompt: string;
  width: number;
  height: number;
  userId: string;
  roleName?: string;
  projectId: string;
}) {
  const size =
    params.width > params.height
      ? "1792x1024"
      : params.height > params.width
        ? "1024x1792"
        : "1024x1024";

  const img = await studioProviderRouter.generateImage({
    prompt: `${params.prompt}. High-contrast, clean composition suitable for a YouTube thumbnail background with space for bold typography. No garbled text.`,
    size,
    quality: "hd",
    feature: "THUMBNAIL_IMAGE_GEN",
    userId: params.userId,
    roleName: params.roleName,
    projectId: params.projectId,
  });

  const { generatedAsset } = await persistGeneratedStudioAsset({
    userId: params.userId,
    projectId: params.projectId,
    assetType: "THUMBNAIL",
    buffer: img.buffer,
    filename: `thumb-bg-${Date.now()}.png`,
    mimeType: img.mimeType,
    title: `AI Thumbnail BG (${size})`,
    prompt: params.prompt,
    provider: img.provider,
    model: img.model,
    width: params.width,
    height: params.height,
  });

  return generatedAsset;
}

export function buildDefaultThumbnailLayers(params: {
  width: number;
  height: number;
  headlineText: string;
  subText?: string;
  primaryColor?: string;
  accentColor?: string;
  logoUrl?: string;
  teacherImageUrl?: string;
}): ThumbnailLayer[] {
  const w = params.width;
  const h = params.height;
  const layers: ThumbnailLayer[] = [
    {
      id: "layer-bg",
      type: "BACKGROUND",
      name: "Background Gradient",
      x: 0,
      y: 0,
      width: w,
      height: h,
      rotation: 0,
      opacity: 1,
      visible: true,
      fillColor: "#0B0E14",
      gradientEndColor: params.primaryColor || "#0050cb",
    },
    {
      id: "layer-glow",
      type: "GLOW",
      name: "Accent Glow",
      x: Math.round(w * 0.55),
      y: Math.round(h * 0.1),
      width: Math.round(w * 0.45),
      height: Math.round(h * 0.8),
      rotation: 0,
      opacity: 0.45,
      visible: true,
      fillColor: params.accentColor || "#f97316",
    },
    {
      id: "layer-logo",
      type: "LOGO",
      name: "Atomic Pathshala Logo",
      x: 40,
      y: 36,
      width: 140,
      height: 56,
      rotation: 0,
      opacity: 1,
      visible: true,
      imageUrl: params.logoUrl || "/atomic-logo.png",
    },
    {
      id: "layer-headline",
      type: "TEXT",
      name: "Headline Text",
      x: 48,
      y: Math.round(h * 0.34),
      width: Math.round(w * 0.56),
      height: 180,
      rotation: 0,
      opacity: 1,
      visible: true,
      text: params.headlineText.toUpperCase(),
      fontFamily: "Inter, sans-serif",
      fontSize: Math.round(w * 0.062),
      fontWeight: "900",
      color: "#FFFFFF",
      strokeColor: "#000000",
      strokeWidth: 6,
      shadowColor: "rgba(0,0,0,0.8)",
      shadowBlur: 18,
      align: "left",
    },
  ];

  if (params.subText) {
    layers.push({
      id: "layer-subtext",
      type: "TEXT",
      name: "Badge / Subtext",
      x: 48,
      y: Math.round(h * 0.68),
      width: Math.round(w * 0.5),
      height: 70,
      rotation: 0,
      opacity: 1,
      visible: true,
      text: params.subText,
      fontFamily: "Inter, sans-serif",
      fontSize: Math.round(w * 0.03),
      fontWeight: "700",
      color: params.accentColor || "#f97316",
      strokeColor: "#000000",
      strokeWidth: 3,
      align: "left",
    });
  }

  if (params.teacherImageUrl) {
    layers.push({
      id: "layer-teacher",
      type: "TEACHER_IMAGE",
      name: "Teacher Cutout",
      x: Math.round(w * 0.62),
      y: Math.round(h * 0.08),
      width: Math.round(w * 0.35),
      height: Math.round(h * 0.92),
      rotation: 0,
      opacity: 1,
      visible: true,
      imageUrl: params.teacherImageUrl,
    });
  }

  return layers;
}
