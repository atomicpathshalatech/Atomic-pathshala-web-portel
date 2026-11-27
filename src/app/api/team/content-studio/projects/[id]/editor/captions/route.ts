import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { requirePermission, UnauthorizedError } from "@/lib/rbac/guard";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { apiSuccess, handleApiError } from "@/lib/api/response";
import { parseAiJson } from "@/lib/ai/latex-json";
import { studioProviderRouter } from "@/lib/ai-studio/router";

const captionsSchema = z.object({
  text: z.string().trim().min(5).max(12000),
  language: z.enum(["hindi", "english", "hinglish"]).default("hinglish"),
  totalDurationMs: z.number().int().min(3000).max(1800000).default(15000),
});

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) throw new UnauthorizedError();
    await requirePermission(session.user.id, PERMISSIONS.CONTENT_STUDIO_AI_GENERATE);

    const body = captionsSchema.parse(await req.json());
    const prompt = [
      `Break the following spoken script into short, readable video captions (max 6-8 words per caption) in ${body.language}.`,
      `Distribute them cleanly across 0 to ${body.totalDurationMs} ms.`,
      "",
      "TEXT:",
      body.text,
      "",
      "Return JSON: { captions: Array<{ text: string, startMs: number, durationMs: number }> }",
    ].join("\n");

    const res = await studioProviderRouter.generateText({
      prompt,
      systemPrompt: "You are a Video Subtitle Timing Specialist. Output strict valid JSON.",
      taskType: "SUMMARIZATION",
      responseFormat: "json",
      feature: "EDITOR_CAPTIONS",
      userId: session.user.id,
      roleName: session.user.role ?? undefined,
      projectId: params.id,
    });

    const parsed = parseAiJson(res.text) as {
      captions?: Array<{ text: string; startMs: number; durationMs: number }>;
    } | null;

    return apiSuccess({
      captions: Array.isArray(parsed?.captions) ? parsed!.captions : [],
    });
  } catch (err) {
    return handleApiError(err);
  }
}
