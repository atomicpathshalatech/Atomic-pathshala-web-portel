import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requirePermission, UnauthorizedError } from "@/lib/rbac/guard";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { apiSuccess, handleApiError } from "@/lib/api/response";
import { MUSIC_PROVIDER_CAPABILITIES } from "@/lib/ai-studio/music/capabilities";
import { generateMusicOrSfxAudio, isMusicProviderConfigured } from "@/lib/ai-studio/music/providers";
import { persistGeneratedStudioAsset } from "@/lib/ai-studio/storage";

const generateMusicSchema = z.object({
  provider: z.enum(["ELEVENLABS_MUSIC", "REPLICATE_MUSICGEN", "SUNO"]).default("ELEVENLABS_MUSIC"),
  kind: z.enum(["MUSIC", "SFX"]).default("MUSIC"),
  prompt: z.string().trim().min(3).max(2000),
  preset: z.string().optional(),
  genre: z.string().optional(),
  mood: z.string().optional(),
  style: z.string().optional(),
  intensity: z.string().optional(),
  energy: z.string().optional(),
  structureNotes: z.string().optional(),
  bpm: z.number().int().min(40).max(240).optional(),
  durationSec: z.number().int().min(2).max(120).default(15),
  instrumental: z.boolean().default(true),
  loopable: z.boolean().default(false),
  variations: z.number().int().min(1).max(3).default(1),
});

const saveMixSchema = z.object({
  title: z.string().trim().min(1).max(160).default("Voice + Music Mix"),
  voiceAssetId: z.string().nullable().optional(),
  musicAssetId: z.string().nullable().optional(),
  voiceVolume: z.number().min(0).max(2).default(1.0),
  musicVolumeDuringSpeech: z.number().min(0).max(1).default(0.2),
  musicVolumeDuringPause: z.number().min(0).max(1).default(0.75),
  duckingFadeMs: z.number().int().min(50).max(3000).default(250),
  duckingRecoveryMs: z.number().int().min(50).max(5000).default(600),
  manualOverride: z.boolean().default(false),
  fadeInMs: z.number().int().min(0).max(5000).default(500),
  fadeOutMs: z.number().int().min(0).max(5000).default(1000),
  loopMusic: z.boolean().default(true),
  exportedAssetId: z.string().nullable().optional(),
});

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) throw new UnauthorizedError();
    await requirePermission(session.user.id, PERMISSIONS.CONTENT_STUDIO_MUSIC);

    const [generations, audioAssets, mixes] = await Promise.all([
      prisma.musicGeneration.findMany({
        where: { projectId: params.id },
        orderBy: { createdAt: "desc" },
        take: 40,
      }),
      prisma.generatedAsset.findMany({
        where: {
          projectId: params.id,
          assetType: { in: ["MUSIC", "SFX", "AUDIO", "VOICEOVER"] },
        },
        orderBy: { createdAt: "desc" },
        take: 60,
      }),
      prisma.audioMixProject.findMany({
        where: { projectId: params.id },
        orderBy: { updatedAt: "desc" },
        take: 10,
      }),
    ]);

    const providers = Object.values(MUSIC_PROVIDER_CAPABILITIES).map((cap) => ({
      ...cap,
      configured: isMusicProviderConfigured(cap.provider),
    }));

    return apiSuccess({ generations, audioAssets, mixes, providers });
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
    await requirePermission(session.user.id, PERMISSIONS.CONTENT_STUDIO_MUSIC);
    await requirePermission(session.user.id, PERMISSIONS.CONTENT_STUDIO_AI_GENERATE);

    const body = generateMusicSchema.parse(await req.json());
    const cap = MUSIC_PROVIDER_CAPABILITIES[body.provider];

    const fullPrompt = [
      body.prompt,
      body.preset ? `Preset: ${body.preset}` : "",
      body.mood ? `Mood: ${body.mood}` : "",
      body.genre ? `Genre: ${body.genre}` : "",
      body.structureNotes ? `Structure: ${body.structureNotes}` : "",
      body.loopable ? "Seamless loop." : "",
      body.instrumental ? "Instrumental only, no vocals." : "",
    ]
      .filter(Boolean)
      .join(". ");

    const results = [];
    for (let v = 1; v <= body.variations; v++) {
      const audio = await generateMusicOrSfxAudio({
        provider: body.provider,
        kind: body.kind,
        prompt: fullPrompt,
        durationSec: body.durationSec,
        userId: session.user.id,
        roleName: session.user.role ?? undefined,
        projectId: params.id,
      });

      const { generatedAsset } = await persistGeneratedStudioAsset({
        userId: session.user.id,
        projectId: params.id,
        assetType: body.kind === "SFX" ? "SFX" : "MUSIC",
        buffer: audio.buffer,
        filename: `${body.kind.toLowerCase()}-v${v}-${Date.now()}.mp3`,
        mimeType: audio.mimeType,
        title: `${body.preset || body.kind} v${v}`,
        prompt: fullPrompt,
        provider: body.provider,
        model: audio.model,
        durationMs: body.durationSec * 1000,
      });

      const gen = await prisma.musicGeneration.create({
        data: {
          projectId: params.id,
          kind: body.kind,
          prompt: fullPrompt,
          preset: body.preset ?? null,
          genre: body.genre ?? null,
          mood: body.mood ?? null,
          style: body.style ?? null,
          intensity: body.intensity ?? null,
          energy: body.energy ?? null,
          structureNotes: body.structureNotes ?? null,
          bpm: body.bpm ?? null,
          durationSec: body.durationSec,
          instrumental: body.instrumental,
          loopable: body.loopable,
          variationIndex: v,
          provider: body.provider,
          model: audio.model,
          status: "COMPLETED",
          licenseType: cap?.licenseType ?? "See provider terms",
          licenseTermsUrl: cap?.licenseTermsUrl ?? null,
          commercialAllowed: cap?.commercialAllowed ?? null,
          costUsd: audio.costUsd,
          assetId: generatedAsset.id,
          audioUrl: generatedAsset.publicUrl,
          createdById: session.user.id,
        },
      });
      results.push(gen);
    }

    return apiSuccess({ generations: results }, 201);
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
    await requirePermission(session.user.id, PERMISSIONS.CONTENT_STUDIO_MUSIC);

    const body = saveMixSchema.parse(await req.json());
    const mix = await prisma.audioMixProject.create({
      data: {
        projectId: params.id,
        title: body.title,
        voiceAssetId: body.voiceAssetId ?? null,
        musicAssetId: body.musicAssetId ?? null,
        voiceVolume: body.voiceVolume,
        musicVolumeDuringSpeech: body.musicVolumeDuringSpeech,
        musicVolumeDuringPause: body.musicVolumeDuringPause,
        duckingFadeMs: body.duckingFadeMs,
        duckingRecoveryMs: body.duckingRecoveryMs,
        manualOverride: body.manualOverride,
        fadeInMs: body.fadeInMs,
        fadeOutMs: body.fadeOutMs,
        loopMusic: body.loopMusic,
        exportedAssetId: body.exportedAssetId ?? null,
        createdById: session.user.id,
      },
    });

    return apiSuccess({ mix }, 201);
  } catch (err) {
    return handleApiError(err);
  }
}
