import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requirePermission, UnauthorizedError } from "@/lib/rbac/guard";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { apiError, apiSuccess, handleApiError } from "@/lib/api/response";
import { getR2ObjectBuffer } from "@/lib/storage/r2-client";
import { persistGeneratedStudioAsset } from "@/lib/ai-studio/storage";

const createVoiceoverSchema = z.object({
  title: z.string().trim().min(1).max(160),
  scriptId: z.string().optional(),
  preset: z.string().default("EDUCATIONAL"),
  provider: z.enum(["OPENAI", "ELEVENLABS", "SARVAM"]).default("OPENAI"),
  model: z.string().default("tts-1"),
  voiceProfileId: z.string().optional(),
  format: z.enum(["mp3", "wav"]).default("mp3"),
  rawText: z.string().trim().min(3).max(40000),
});

const patchVoiceoverSchema = z.object({
  action: z.enum(["UPDATE_SEGMENT", "REORDER_SEGMENTS", "MERGE_SEGMENTS", "DELETE_SEGMENT", "EXPORT_ALL"]),
  voiceoverId: z.string(),
  segmentId: z.string().optional(),
  mergeWithSegmentId: z.string().optional(),
  orderedIds: z.array(z.string()).optional(),
  patch: z
    .object({
      text: z.string().optional(),
      pauseAfterMs: z.number().int().min(0).max(10000).optional(),
      speed: z.number().min(0.5).max(2.0).optional(),
      volume: z.number().min(0).max(2.0).optional(),
      fadeInMs: z.number().int().min(0).max(5000).optional(),
      fadeOutMs: z.number().int().min(0).max(5000).optional(),
      trimStartMs: z.number().int().min(0).optional(),
      trimEndMs: z.number().int().min(0).nullable().optional(),
    })
    .optional(),
});

function splitTextIntoSegments(raw: string): string[] {
  const paragraphs = raw
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean);
  if (paragraphs.length > 1) return paragraphs;
  const sentences = raw.match(/[^.!?।]+[.!?।]*/g) || [raw];
  const chunks: string[] = [];
  let buf = "";
  for (const s of sentences) {
    if ((buf + " " + s).trim().length > 350 && buf) {
      chunks.push(buf.trim());
      buf = s;
    } else {
      buf = (buf + " " + s).trim();
    }
  }
  if (buf.trim()) chunks.push(buf.trim());
  return chunks.length > 0 ? chunks : [raw.trim()];
}

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) throw new UnauthorizedError();
    await requirePermission(session.user.id, PERMISSIONS.CONTENT_STUDIO_VOICE);

    const voiceovers = await prisma.voiceoverProject.findMany({
      where: { projectId: params.id },
      include: { segments: { orderBy: { orderIndex: "asc" } } },
      orderBy: { createdAt: "desc" },
    });

    return apiSuccess({ voiceovers });
  } catch (err) {
    return handleApiError(err);
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) throw new UnauthorizedError();
    await requirePermission(session.user.id, PERMISSIONS.CONTENT_STUDIO_VOICE);

    const body = createVoiceoverSchema.parse(await req.json());
    const segmentsText = splitTextIntoSegments(body.rawText);

    const voiceover = await prisma.voiceoverProject.create({
      data: {
        projectId: params.id,
        scriptId: body.scriptId ?? null,
        title: body.title,
        preset: body.preset,
        provider: body.provider,
        model: body.model,
        voiceProfileId: body.voiceProfileId ?? null,
        format: body.format,
        createdById: session.user.id,
        segments: {
          create: segmentsText.map((text, idx) => ({
            orderIndex: idx + 1,
            text,
            status: "DRAFT",
          })),
        },
      },
      include: { segments: { orderBy: { orderIndex: "asc" } } },
    });

    return apiSuccess({ voiceover }, 201);
  } catch (err) {
    return handleApiError(err);
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) throw new UnauthorizedError();
    await requirePermission(session.user.id, PERMISSIONS.CONTENT_STUDIO_VOICE);

    const body = patchVoiceoverSchema.parse(await req.json());

    if (body.action === "UPDATE_SEGMENT" && body.segmentId && body.patch) {
      const seg = await prisma.voiceoverSegment.findFirst({
        where: { id: body.segmentId, voiceover: { projectId: params.id } },
        select: { id: true },
      });
      if (!seg) return apiError("Segment not found", 404);
      const updated = await prisma.voiceoverSegment.update({
        where: { id: seg.id },
        data: {
          ...(body.patch.text !== undefined ? { text: body.patch.text, status: "DRAFT" } : {}),
          ...(body.patch.pauseAfterMs !== undefined ? { pauseAfterMs: body.patch.pauseAfterMs } : {}),
          ...(body.patch.speed !== undefined ? { speed: body.patch.speed } : {}),
          ...(body.patch.volume !== undefined ? { volume: body.patch.volume } : {}),
          ...(body.patch.fadeInMs !== undefined ? { fadeInMs: body.patch.fadeInMs } : {}),
          ...(body.patch.fadeOutMs !== undefined ? { fadeOutMs: body.patch.fadeOutMs } : {}),
          ...(body.patch.trimStartMs !== undefined ? { trimStartMs: body.patch.trimStartMs } : {}),
          ...(body.patch.trimEndMs !== undefined ? { trimEndMs: body.patch.trimEndMs } : {}),
        },
      });
      return apiSuccess({ segment: updated });
    }

    if (body.action === "DELETE_SEGMENT" && body.segmentId) {
      const deleted = await prisma.voiceoverSegment.deleteMany({
        where: { id: body.segmentId, voiceover: { projectId: params.id } },
      });
      if (deleted.count === 0) return apiError("Segment not found", 404);
      return apiSuccess({ deleted: true });
    }

    if (body.action === "REORDER_SEGMENTS" && body.orderedIds) {
      await prisma.$transaction(
        body.orderedIds.map((segId, idx) =>
          prisma.voiceoverSegment.updateMany({
            where: { id: segId, voiceover: { projectId: params.id } },
            data: { orderIndex: idx + 1 },
          })
        )
      );
      return apiSuccess({ reordered: true });
    }

    if (body.action === "MERGE_SEGMENTS" && body.segmentId && body.mergeWithSegmentId) {
      const [s1, s2] = await Promise.all([
        prisma.voiceoverSegment.findFirst({ where: { id: body.segmentId, voiceover: { projectId: params.id } } }),
        prisma.voiceoverSegment.findFirst({ where: { id: body.mergeWithSegmentId, voiceover: { projectId: params.id } } }),
      ]);
      if (!s1 || !s2) return apiError("Segments not found", 404);
      const merged = await prisma.$transaction(async (tx) => {
        const next = await tx.voiceoverSegment.update({
          where: { id: s1.id },
          data: { text: `${s1.text}\n${s2.text}`, status: "DRAFT" },
        });
        await tx.voiceoverSegment.delete({ where: { id: s2.id } });
        return next;
      });
      return apiSuccess({ segment: merged });
    }

    if (body.action === "EXPORT_ALL") {
      await requirePermission(session.user.id, PERMISSIONS.CONTENT_STUDIO_EXPORT);
      const vo = await prisma.voiceoverProject.findFirst({
        where: { id: body.voiceoverId, projectId: params.id },
        include: { segments: { orderBy: { orderIndex: "asc" } } },
      });
      if (!vo) return apiError("Voiceover project not found", 404);

      const readySegs = vo.segments.filter((s) => s.status === "READY" && s.assetId);
      if (readySegs.length === 0) {
        return apiError("Generate at least one segment before exporting.", 400);
      }

      const assetIds = readySegs.map((s) => s.assetId!);
      const assets = await prisma.generatedAsset.findMany({
        where: { id: { in: assetIds } },
      });
      const assetMap = new Map(assets.map((a) => [a.id, a]));

      const buffers: Buffer[] = [];
      for (const seg of readySegs) {
        const asset = assetMap.get(seg.assetId!);
        if (!asset?.storageKey) continue;
        const obj = await getR2ObjectBuffer(asset.storageKey);
        if (obj?.buffer) buffers.push(obj.buffer);
      }
      if (buffers.length === 0) return apiError("No audio buffers found in R2", 404);

      const combined = Buffer.concat(buffers);
      const ext = vo.format === "wav" ? "wav" : "mp3";
      const mimeType = ext === "wav" ? "audio/wav" : "audio/mpeg";

      const { generatedAsset } = await persistGeneratedStudioAsset({
        userId: session.user.id,
        projectId: params.id,
        assetType: "VOICEOVER",
        buffer: combined,
        filename: `${vo.title.replace(/\s+/g, "-").slice(0, 40)}-final.${ext}`,
        mimeType,
        title: `${vo.title} (Final Export)`,
        provider: vo.provider,
        model: vo.model,
      });

      await prisma.voiceoverProject.update({
        where: { id: vo.id },
        data: { exportedAssetId: generatedAsset.id },
      });

      return apiSuccess({ exportedAsset: generatedAsset });
    }

    return apiError("Unsupported action", 400);
  } catch (err) {
    return handleApiError(err);
  }
}
