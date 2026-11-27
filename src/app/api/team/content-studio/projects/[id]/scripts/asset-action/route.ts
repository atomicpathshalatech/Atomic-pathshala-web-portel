import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { requirePermission, UnauthorizedError } from "@/lib/rbac/guard";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { apiSuccess, handleApiError } from "@/lib/api/response";
import { studioProviderRouter } from "@/lib/ai-studio/router";
import { persistGeneratedStudioAsset } from "@/lib/ai-studio/storage";
import { createStudioJob } from "@/lib/ai-studio/jobs";

const assetActionSchema = z.object({
  action: z.enum(["IMAGE", "VOICE", "VIDEO", "DIAGRAM", "SLIDE", "MUSIC", "CAPTION"]),
  sectionTitle: z.string().trim().default("Section"),
  sectionText: z.string().trim().min(3).max(8000),
});

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) throw new UnauthorizedError();
    await requirePermission(session.user.id, PERMISSIONS.CONTENT_STUDIO_AI_GENERATE);

    const body = assetActionSchema.parse(await req.json());

    if (body.action === "IMAGE") {
      await requirePermission(session.user.id, PERMISSIONS.CONTENT_STUDIO_THUMBNAIL);
      const img = await studioProviderRouter.generateImage({
        prompt: `Educational visual illustration for: ${body.sectionTitle}. Context: ${body.sectionText.slice(0, 400)}`,
        feature: "SCRIPT_TO_IMAGE",
        userId: session.user.id,
        roleName: session.user.role ?? undefined,
        projectId: params.id,
      });
      const { generatedAsset } = await persistGeneratedStudioAsset({
        userId: session.user.id,
        projectId: params.id,
        assetType: "IMAGE",
        buffer: img.buffer,
        filename: `${body.sectionTitle.slice(0, 30).replace(/\s+/g, "-")}.png`,
        mimeType: img.mimeType,
        title: `Image: ${body.sectionTitle}`,
        provider: img.provider,
        model: img.model,
      });
      return apiSuccess({ asset: generatedAsset }, 201);
    }

    if (body.action === "VOICE") {
      await requirePermission(session.user.id, PERMISSIONS.CONTENT_STUDIO_VOICE);
      const voice = await studioProviderRouter.generateVoice({
        text: body.sectionText.slice(0, 4000),
        feature: "SCRIPT_TO_VOICE",
        userId: session.user.id,
        roleName: session.user.role ?? undefined,
        projectId: params.id,
      });
      const { generatedAsset } = await persistGeneratedStudioAsset({
        userId: session.user.id,
        projectId: params.id,
        assetType: "VOICEOVER",
        buffer: voice.buffer,
        filename: `${body.sectionTitle.slice(0, 30).replace(/\s+/g, "-")}.mp3`,
        mimeType: voice.mimeType,
        title: `Voiceover: ${body.sectionTitle}`,
        provider: voice.provider,
        model: voice.model,
      });
      return apiSuccess({ asset: generatedAsset }, 201);
    }

    if (body.action === "CAPTION") {
      const cap = await studioProviderRouter.generateText({
        prompt: `Generate clean SRT-style captions/subtitles for this spoken script:\n\n${body.sectionText}`,
        taskType: "SUMMARIZATION",
        feature: "SCRIPT_TO_CAPTION",
        userId: session.user.id,
        roleName: session.user.role ?? undefined,
        projectId: params.id,
      });
      const { generatedAsset } = await persistGeneratedStudioAsset({
        userId: session.user.id,
        projectId: params.id,
        assetType: "CAPTION",
        buffer: Buffer.from(cap.text, "utf-8"),
        filename: `${body.sectionTitle.slice(0, 30).replace(/\s+/g, "-")}.srt`,
        mimeType: "text/plain",
        title: `Captions: ${body.sectionTitle}`,
        provider: cap.provider,
        model: cap.model,
      });
      return apiSuccess({ asset: generatedAsset }, 201);
    }

    // VIDEO, MUSIC, DIAGRAM, SLIDE -> enqueue tracked AiGenerationJob for Phase 04+ workers
    const modality =
      body.action === "VIDEO" ? "VIDEO" : body.action === "MUSIC" ? "MUSIC" : "SLIDE";
    const job = await createStudioJob({
      userId: session.user.id,
      projectId: params.id,
      modality,
      taskType: `SCRIPT_TO_${body.action}`,
      inputPayload: { sectionTitle: body.sectionTitle, sectionText: body.sectionText },
    });

    return apiSuccess({ job }, 202);
  } catch (err) {
    return handleApiError(err);
  }
}
