import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requirePermission, UnauthorizedError } from "@/lib/rbac/guard";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { apiError, apiSuccess, handleApiError } from "@/lib/api/response";
import { applyPronunciationDictionary } from "@/lib/ai-studio/voice/pronunciation";
import { synthesizeVoiceSegment } from "@/lib/ai-studio/voice/providers";
import { DELIVERY_PRESETS } from "@/lib/ai-studio/voice/capabilities";
import { persistGeneratedStudioAsset } from "@/lib/ai-studio/storage";

const generateVoiceSchema = z.object({
  voiceoverId: z.string(),
  segmentId: z.string().optional(), // If omitted, generates all DRAFT/FAILED segments
  stability: z.number().min(0).max(1).optional(),
  styleExaggeration: z.number().min(0).max(1).optional(),
  pitch: z.number().min(-1).max(1).optional(),
});

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) throw new UnauthorizedError();
    await requirePermission(session.user.id, PERMISSIONS.CONTENT_STUDIO_VOICE);
    await requirePermission(session.user.id, PERMISSIONS.CONTENT_STUDIO_AI_GENERATE);

    const body = generateVoiceSchema.parse(await req.json());
    const vo = await prisma.voiceoverProject.findFirst({
      where: { id: body.voiceoverId, projectId: params.id },
      include: { segments: { orderBy: { orderIndex: "asc" } } },
    });
    if (!vo) return apiError("Voiceover project not found", 404);

    const profile = vo.voiceProfileId
      ? await prisma.voiceProfile.findUnique({ where: { id: vo.voiceProfileId } })
      : null;

    const rules = await prisma.pronunciationRule.findMany({
      where: { isActive: true },
      select: { term: true, phonetic: true },
    });

    const presetMeta = DELIVERY_PRESETS.find((p) => p.id === vo.preset);
    const targets = body.segmentId
      ? vo.segments.filter((s) => s.id === body.segmentId)
      : vo.segments.filter((s) => s.status !== "READY");

    const updatedSegments = [];
    for (const seg of targets) {
      const normalized = applyPronunciationDictionary(seg.text, rules);
      try {
        const res = await synthesizeVoiceSegment({
          provider: vo.provider,
          model: vo.model,
          voiceId: profile?.externalVoiceId || "nova",
          text: normalized,
          format: vo.format === "wav" ? "wav" : "mp3",
          speed: seg.speed || presetMeta?.speed || 1.0,
          stability: body.stability,
          styleExaggeration: body.styleExaggeration,
          pitch: body.pitch,
          instructions: presetMeta?.instruction,
          userId: session.user.id,
          roleName: session.user.role ?? undefined,
          projectId: params.id,
        });

        const ext = vo.format === "wav" ? "wav" : "mp3";
        const { generatedAsset } = await persistGeneratedStudioAsset({
          userId: session.user.id,
          projectId: params.id,
          assetType: "VOICEOVER",
          buffer: res.buffer,
          filename: `vo-${vo.id}-seg-${seg.orderIndex}.${ext}`,
          mimeType: res.mimeType,
          title: `${vo.title} — Seg ${seg.orderIndex}`,
          provider: vo.provider,
          model: vo.model,
          durationMs: res.durationMs,
        });

        const updated = await prisma.voiceoverSegment.update({
          where: { id: seg.id },
          data: {
            normalizedText: normalized,
            assetId: generatedAsset.id,
            audioUrl: generatedAsset.publicUrl,
            durationMs: Math.max(1000, Math.round((seg.text.split(/\s+/).length / 2.5) * 1000)),
            status: "READY",
            errorMessage: null,
          },
        });
        updatedSegments.push(updated);
      } catch (err) {
        const failed = await prisma.voiceoverSegment.update({
          where: { id: seg.id },
          data: {
            status: "FAILED",
            errorMessage: err instanceof Error ? err.message : String(err),
          },
        });
        updatedSegments.push(failed);
      }
    }

    const allSegs = await prisma.voiceoverSegment.findMany({
      where: { voiceoverId: vo.id },
      orderBy: { orderIndex: "asc" },
    });
    const totalDurationMs = allSegs.reduce((acc, s) => acc + (s.durationMs || 0) + s.pauseAfterMs, 0);
    await prisma.voiceoverProject.update({
      where: { id: vo.id },
      data: { totalDurationMs },
    });

    return apiSuccess({ updatedSegments, totalDurationMs });
  } catch (err) {
    return handleApiError(err);
  }
}
