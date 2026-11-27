import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requirePermission, UnauthorizedError } from "@/lib/rbac/guard";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { apiSuccess, handleApiError } from "@/lib/api/response";
import { DEFAULT_STUDIO_PROVIDERS } from "@/lib/ai-studio/router";
import { isEnvKeyConfigured } from "@/lib/ai-studio/providers/text-adapters";

const upsertProviderSchema = z.object({
  id: z.string().optional(),
  provider: z.string().trim().min(2).max(40),
  modality: z.enum(["TEXT", "IMAGE", "VOICE", "MUSIC", "VIDEO", "SLIDE", "RESEARCH"]),
  taskType: z
    .enum([
      "GENERAL",
      "RESEARCH",
      "TOPIC_ANALYSIS",
      "SCRIPT_WRITING",
      "SEO",
      "CHEMISTRY_VERIFICATION",
      "THUMBNAIL_PROMPT",
      "CONTENT_PLANNING",
      "SUMMARIZATION",
    ])
    .default("GENERAL"),
  modelId: z.string().trim().min(2).max(120),
  displayName: z.string().trim().min(2).max(120),
  envKeyRef: z.enum([
    "GEMINI_API_KEY",
    "GEMINI_API_KEYS",
    "OPENAI_API_KEY",
    "XAI_API_KEY",
    "GROQ_API_KEY",
    "ANTHROPIC_API_KEY",
    "ELEVENLABS_API_KEY",
    "SARVAM_API_KEY",
    "SUNO_API_KEY",
    "REPLICATE_API_TOKEN",
    "RUNWAY_API_KEY",
    "KLING_API_KEY",
    "YOUTUBE_API_KEY",
  ]),
  priority: z.number().int().min(1).max(1000).default(100),
  isEnabled: z.boolean().default(true),
  isDefault: z.boolean().default(false),
  fallbackProvider: z.string().trim().max(40).nullable().optional(),
  fallbackModelId: z.string().trim().max(120).nullable().optional(),
  timeoutMs: z.number().int().min(3000).max(120000).default(30000),
  inputCostPer1M: z.number().min(0).default(0),
  outputCostPer1M: z.number().min(0).default(0),
  unitCostUsd: z.number().min(0).default(0),
});

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) throw new UnauthorizedError();
    await requirePermission(session.user.id, PERMISSIONS.CONTENT_STUDIO_ACCESS);

    const dbConfigs = await prisma.aiProviderConfig.findMany({
      orderBy: [{ modality: "asc" }, { taskType: "asc" }, { priority: "asc" }],
    });

    const source =
      dbConfigs.length > 0
        ? dbConfigs.map((c) => ({ ...c, persisted: true }))
        : DEFAULT_STUDIO_PROVIDERS.map((d, idx) => ({
            id: `default-${idx}`,
            ...d,
            taskType: d.taskType || "GENERAL",
            persisted: false,
          }));

    const providers = source.map((p) => ({
      ...p,
      envConfigured: isEnvKeyConfigured(p.envKeyRef),
    }));

    return apiSuccess({ providers, usingDefaults: dbConfigs.length === 0 });
  } catch (err) {
    return handleApiError(err);
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) throw new UnauthorizedError();
    await requirePermission(session.user.id, PERMISSIONS.CONTENT_STUDIO_PROVIDER_MANAGE);

    const body = upsertProviderSchema.parse(await req.json());

    const config = await prisma.$transaction(async (tx) => {
      if (body.isDefault) {
        await tx.aiProviderConfig.updateMany({
          where: { modality: body.modality, taskType: body.taskType, isDefault: true },
          data: { isDefault: false },
        });
      }

      const saved = body.id && !body.id.startsWith("default-")
        ? await tx.aiProviderConfig.update({
            where: { id: body.id },
            data: {
              provider: body.provider,
              modality: body.modality,
              taskType: body.taskType,
              modelId: body.modelId,
              displayName: body.displayName,
              envKeyRef: body.envKeyRef,
              priority: body.priority,
              isEnabled: body.isEnabled,
              isDefault: body.isDefault,
              fallbackProvider: body.fallbackProvider ?? null,
              fallbackModelId: body.fallbackModelId ?? null,
              timeoutMs: body.timeoutMs,
              inputCostPer1M: body.inputCostPer1M,
              outputCostPer1M: body.outputCostPer1M,
              unitCostUsd: body.unitCostUsd,
            },
          })
        : await tx.aiProviderConfig.upsert({
            where: {
              provider_modality_taskType_modelId: {
                provider: body.provider,
                modality: body.modality,
                taskType: body.taskType,
                modelId: body.modelId,
              },
            },
            create: {
              provider: body.provider,
              modality: body.modality,
              taskType: body.taskType,
              modelId: body.modelId,
              displayName: body.displayName,
              envKeyRef: body.envKeyRef,
              priority: body.priority,
              isEnabled: body.isEnabled,
              isDefault: body.isDefault,
              fallbackProvider: body.fallbackProvider ?? null,
              fallbackModelId: body.fallbackModelId ?? null,
              timeoutMs: body.timeoutMs,
              inputCostPer1M: body.inputCostPer1M,
              outputCostPer1M: body.outputCostPer1M,
              unitCostUsd: body.unitCostUsd,
            },
            update: {
              displayName: body.displayName,
              envKeyRef: body.envKeyRef,
              priority: body.priority,
              isEnabled: body.isEnabled,
              isDefault: body.isDefault,
              fallbackProvider: body.fallbackProvider ?? null,
              fallbackModelId: body.fallbackModelId ?? null,
              timeoutMs: body.timeoutMs,
              inputCostPer1M: body.inputCostPer1M,
              outputCostPer1M: body.outputCostPer1M,
              unitCostUsd: body.unitCostUsd,
            },
          });

      await tx.auditLog.create({
        data: {
          userId: session.user.id,
          action: "CONTENT_STUDIO_PROVIDER_UPSERT",
          entityType: "AiProviderConfig",
          entityId: saved.id,
          metadata: {
            provider: saved.provider,
            modality: saved.modality,
            taskType: saved.taskType,
            modelId: saved.modelId,
            isEnabled: saved.isEnabled,
            isDefault: saved.isDefault,
          },
        },
      });

      return saved;
    });

    return apiSuccess({
      provider: { ...config, envConfigured: isEnvKeyConfigured(config.envKeyRef) },
    });
  } catch (err) {
    return handleApiError(err);
  }
}
