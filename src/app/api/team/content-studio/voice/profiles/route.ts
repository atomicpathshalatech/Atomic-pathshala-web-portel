import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requirePermission, UnauthorizedError } from "@/lib/rbac/guard";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { apiError, apiSuccess, handleApiError } from "@/lib/api/response";
import {
  DEFAULT_OPENAI_VOICES,
  VOICE_PROVIDER_CAPABILITIES,
} from "@/lib/ai-studio/voice/capabilities";
import { isVoiceProviderConfigured } from "@/lib/ai-studio/voice/providers";

const createProfileSchema = z.object({
  name: z.string().trim().min(2).max(100),
  provider: z.enum(["OPENAI", "ELEVENLABS", "SARVAM"]),
  externalVoiceId: z.string().trim().min(1).max(120),
  language: z.string().trim().default("en"),
  accent: z.string().trim().optional(),
  gender: z.string().trim().optional(),
  style: z.string().trim().optional(),
  tone: z.string().trim().optional(),
  approvedUsage: z.string().trim().default("EDUCATIONAL_AND_PROMO"),
  isCloned: z.boolean().default(false),
  consentStatus: z.enum(["NONE", "SELF_CONSENT", "AUTHORIZED_CONSENT"]).default("NONE"),
  usageRestrictions: z.string().trim().max(500).optional(),
});

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) throw new UnauthorizedError();
    await requirePermission(session.user.id, PERMISSIONS.CONTENT_STUDIO_VOICE);

    let profiles = await prisma.voiceProfile.findMany({
      orderBy: [{ provider: "asc" }, { name: "asc" }],
    });

    if (profiles.length === 0) {
      await prisma.voiceProfile.createMany({
        data: DEFAULT_OPENAI_VOICES.map((v) => ({
          ...v,
          provider: "OPENAI",
          approvedUsage: "EDUCATIONAL_AND_PROMO",
          isActive: true,
        })),
        skipDuplicates: true,
      });
      profiles = await prisma.voiceProfile.findMany({
        orderBy: [{ provider: "asc" }, { name: "asc" }],
      });
    }

    const providers = Object.values(VOICE_PROVIDER_CAPABILITIES).map((cap) => ({
      ...cap,
      configured: isVoiceProviderConfigured(cap.provider),
    }));

    return apiSuccess({ profiles, providers });
  } catch (err) {
    return handleApiError(err);
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) throw new UnauthorizedError();
    await requirePermission(session.user.id, PERMISSIONS.CONTENT_STUDIO_VOICE);

    const body = createProfileSchema.parse(await req.json());
    const cap = VOICE_PROVIDER_CAPABILITIES[body.provider];

    if (body.isCloned) {
      if (!cap?.supportsCloning) {
        return apiError(`${body.provider} does not support voice cloning.`, 400);
      }
      if (body.consentStatus === "NONE") {
        return apiError(
          "Voice cloning requires verified self-consent or explicit third-party authorization.",
          403
        );
      }
    }

    const profile = await prisma.voiceProfile.upsert({
      where: {
        provider_externalVoiceId: {
          provider: body.provider,
          externalVoiceId: body.externalVoiceId,
        },
      },
      create: {
        name: body.name,
        provider: body.provider,
        externalVoiceId: body.externalVoiceId,
        language: body.language,
        accent: body.accent ?? null,
        gender: body.gender ?? null,
        style: body.style ?? null,
        tone: body.tone ?? null,
        approvedUsage: body.approvedUsage,
        isCloned: body.isCloned,
        ownerId: session.user.id,
        consentStatus: body.consentStatus,
        usageRestrictions: body.usageRestrictions ?? null,
        createdById: session.user.id,
      },
      update: {
        name: body.name,
        language: body.language,
        accent: body.accent ?? null,
        gender: body.gender ?? null,
        style: body.style ?? null,
        tone: body.tone ?? null,
        approvedUsage: body.approvedUsage,
        usageRestrictions: body.usageRestrictions ?? null,
        isActive: true,
      },
    });

    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        action: "CONTENT_STUDIO_VOICE_PROFILE_UPSERT",
        entityType: "VoiceProfile",
        entityId: profile.id,
        metadata: { provider: profile.provider, isCloned: profile.isCloned, consentStatus: profile.consentStatus },
      },
    });

    return apiSuccess({ profile }, 201);
  } catch (err) {
    return handleApiError(err);
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) throw new UnauthorizedError();
    await requirePermission(session.user.id, PERMISSIONS.CONTENT_STUDIO_VOICE);

    const { id, isActive } = z
      .object({ id: z.string(), isActive: z.boolean() })
      .parse(await req.json());

    const profile = await prisma.voiceProfile.update({
      where: { id },
      data: { isActive },
    });

    return apiSuccess({ profile });
  } catch (err) {
    return handleApiError(err);
  }
}
