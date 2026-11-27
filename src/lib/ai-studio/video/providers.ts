import "server-only";
import { prisma } from "@/lib/prisma";
import { readGeminiKeys } from "@/lib/ai/gemini-models";
import { assertStudioBudget, recordStudioUsage } from "../budget";
import { createStudioJob, updateStudioJobProgress } from "../jobs";
import { persistGeneratedStudioAsset } from "../storage";
import { StudioProviderError } from "../types";
import { VIDEO_PROVIDER_CAPABILITIES } from "./capabilities";

function cleanKey(envRef: string): string | null {
  if (envRef === "GEMINI_API_KEY") {
    return readGeminiKeys()[0] || null;
  }
  const raw = process.env[envRef];
  if (!raw) return null;
  let k = raw.trim();
  if ((k.startsWith('"') && k.endsWith('"')) || (k.startsWith("'") && k.endsWith("'"))) {
    k = k.slice(1, -1).trim();
  }
  return k.length > 0 ? k : null;
}

export function isVideoProviderConfigured(provider: string): boolean {
  const cap = VIDEO_PROVIDER_CAPABILITIES[provider];
  if (!cap) return false;
  return Boolean(cleanKey(cap.envKeyRef));
}

export async function submitVideoGenerationJob(params: {
  projectId: string;
  sceneId?: string;
  provider: string;
  model: string;
  mode: string;
  prompt: string;
  aspectRatio: string;
  durationSec: number;
  referenceImageUrl?: string;
  cameraMovement?: string;
  lighting?: string;
  environment?: string;
  mood?: string;
  userId: string;
  roleName?: string;
}) {
  const cap = VIDEO_PROVIDER_CAPABILITIES[params.provider];
  if (!cap) {
    throw new StudioProviderError(`Unsupported video provider: ${params.provider}`, "NOT_CONFIGURED", params.provider, false);
  }

  const modelMeta = cap.models.find((m) => m.id === params.model) || cap.models[0];
  const estimatedCostUsd =
    modelMeta?.costPerSecUsd !== null && modelMeta?.costPerSecUsd !== undefined
      ? Number((modelMeta.costPerSecUsd * params.durationSec).toFixed(4))
      : null;

  await assertStudioBudget({
    userId: params.userId,
    roleName: params.roleName,
    projectId: params.projectId,
    estimatedCostUsd: estimatedCostUsd ?? 0.1,
  });

  const apiKey = cleanKey(cap.envKeyRef);
  if (!apiKey) {
    throw new StudioProviderError(
      `${cap.label} is not configured (${cap.envKeyRef} missing in environment).`,
      "NOT_CONFIGURED",
      params.provider,
      false
    );
  }

  const enrichedPrompt = [
    params.prompt,
    params.cameraMovement && params.cameraMovement !== "Static" ? `Camera: ${params.cameraMovement}` : "",
    params.lighting ? `Lighting: ${params.lighting}` : "",
    params.environment ? `Environment: ${params.environment}` : "",
    params.mood ? `Mood: ${params.mood}` : "",
  ]
    .filter(Boolean)
    .join(". ");

  const job = await createStudioJob({
    userId: params.userId,
    projectId: params.projectId,
    modality: "VIDEO",
    taskType: params.mode,
    provider: params.provider,
    model: params.model,
    inputPayload: { prompt: enrichedPrompt, aspectRatio: params.aspectRatio, durationSec: params.durationSec },
    estimatedCostUsd: estimatedCostUsd ?? undefined,
  });

  const videoGen = await prisma.videoGeneration.create({
    data: {
      projectId: params.projectId,
      sceneId: params.sceneId ?? null,
      jobId: job.id,
      mode: params.mode,
      prompt: enrichedPrompt,
      aspectRatio: params.aspectRatio,
      durationSec: params.durationSec,
      provider: params.provider,
      model: params.model,
      status: "PROCESSING",
      progress: 10,
      referenceImageUrl: params.referenceImageUrl ?? null,
      cameraMovement: params.cameraMovement ?? null,
      lighting: params.lighting ?? null,
      environment: params.environment ?? null,
      mood: params.mood ?? null,
      costUsd: estimatedCostUsd,
      createdById: params.userId,
    },
  });

  try {
    let externalTaskId = "";

    if (params.provider === "RUNWAY") {
      const endpoint = params.referenceImageUrl
        ? "https://api.dev.runwayml.com/v1/image_to_video"
        : "https://api.dev.runwayml.com/v1/text_to_video";
      const res = await fetch(endpoint, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "X-Runway-Version": "2024-11-06",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: params.model,
          promptText: enrichedPrompt,
          ...(params.referenceImageUrl ? { promptImage: params.referenceImageUrl } : {}),
          ratio: params.aspectRatio === "9:16" ? "720:1280" : params.aspectRatio === "1:1" ? "960:960" : "1280:720",
          duration: params.durationSec,
        }),
        signal: AbortSignal.timeout(20000),
      });
      if (!res.ok) throw new Error(`Runway API ${res.status}: ${await res.text()}`);
      const data = (await res.json()) as { id?: string };
      externalTaskId = data.id || "";
    } else if (params.provider === "REPLICATE_VIDEO") {
      const res = await fetch("https://api.replicate.com/v1/predictions", {
        method: "POST",
        headers: {
          Authorization: `Token ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: params.model,
          input: {
            prompt: enrichedPrompt,
            ...(params.referenceImageUrl ? { first_frame_image: params.referenceImageUrl } : {}),
          },
        }),
        signal: AbortSignal.timeout(20000),
      });
      if (!res.ok) throw new Error(`Replicate API ${res.status}: ${await res.text()}`);
      const data = (await res.json()) as { id?: string };
      externalTaskId = data.id || "";
    } else if (params.provider === "GOOGLE_VEO") {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${params.model}:predictLongRunning?key=${apiKey}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            instances: [{ prompt: enrichedPrompt }],
            parameters: { aspectRatio: params.aspectRatio, durationSeconds: params.durationSec },
          }),
          signal: AbortSignal.timeout(20000),
        }
      );
      if (!res.ok) throw new Error(`Google Veo API ${res.status}: ${await res.text()}`);
      const data = (await res.json()) as { name?: string };
      externalTaskId = data.name || "";
    } else if (params.provider === "KLING") {
      const baseUrl = process.env.KLING_BASE_URL || "https://api.klingai.com/v1";
      const res = await fetch(`${baseUrl}/videos/text2video`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model_name: params.model,
          prompt: enrichedPrompt,
          aspect_ratio: params.aspectRatio,
          duration: String(params.durationSec),
        }),
        signal: AbortSignal.timeout(20000),
      });
      if (!res.ok) throw new Error(`Kling API ${res.status}: ${await res.text()}`);
      const data = (await res.json()) as { data?: { task_id?: string } };
      externalTaskId = data.data?.task_id || "";
    }

    await prisma.videoGeneration.update({
      where: { id: videoGen.id },
      data: { externalTaskId, progress: 25 },
    });
    await updateStudioJobProgress({
      jobId: job.id,
      status: "PROCESSING",
      progress: 25,
      externalJobId: externalTaskId,
    });

    return { videoGen, job };
  } catch (err) {
    const rawMsg = err instanceof Error ? err.message : String(err);
    const msg = rawMsg.replace(/([?&]key=)[^&\s"']+/gi, "$1REDACTED");
    await prisma.videoGeneration.update({
      where: { id: videoGen.id },
      data: { status: "FAILED", errorMessage: msg },
    });
    await updateStudioJobProgress({
      jobId: job.id,
      status: "FAILED",
      progress: 0,
      errorMessage: msg,
    });
    throw new Error(msg);
  }
}

export async function pollVideoGenerationStatus(videoGenId: string, userId: string) {
  const vg = await prisma.videoGeneration.findUnique({ where: { id: videoGenId } });
  if (!vg) throw new Error("Video generation not found");
  if (vg.status === "COMPLETED" || vg.status === "CANCELLED" || !vg.externalTaskId) {
    return vg;
  }

  const cap = VIDEO_PROVIDER_CAPABILITIES[vg.provider];
  const apiKey = cap ? cleanKey(cap.envKeyRef) : null;
  if (!apiKey) return vg;

  let remoteStatus: "PROCESSING" | "COMPLETED" | "FAILED" = "PROCESSING";
  let downloadUrl: string | null = null;
  let errorMsg: string | null = null;

  if (vg.provider === "RUNWAY") {
    const res = await fetch(`https://api.dev.runwayml.com/v1/tasks/${vg.externalTaskId}`, {
      headers: { Authorization: `Bearer ${apiKey}`, "X-Runway-Version": "2024-11-06" },
    });
    if (res.ok) {
      const data = (await res.json()) as { status?: string; output?: string[]; failure?: string };
      if (data.status === "SUCCEEDED" && data.output?.[0]) {
        remoteStatus = "COMPLETED";
        downloadUrl = data.output[0];
      } else if (data.status === "FAILED") {
        remoteStatus = "FAILED";
        errorMsg = data.failure || "Runway task failed";
      }
    }
  } else if (vg.provider === "REPLICATE_VIDEO") {
    const res = await fetch(`https://api.replicate.com/v1/predictions/${vg.externalTaskId}`, {
      headers: { Authorization: `Token ${apiKey}` },
    });
    if (res.ok) {
      const data = (await res.json()) as { status?: string; output?: string | string[]; error?: string };
      if (data.status === "succeeded") {
        remoteStatus = "COMPLETED";
        downloadUrl = Array.isArray(data.output) ? data.output[0] || null : data.output || null;
      } else if (data.status === "failed" || data.status === "canceled") {
        remoteStatus = "FAILED";
        errorMsg = data.error || "Replicate prediction failed";
      }
    }
  } else if (vg.provider === "GOOGLE_VEO") {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/${vg.externalTaskId}?key=${apiKey}`
    );
    if (res.ok) {
      const data = (await res.json()) as {
        done?: boolean;
        error?: { message?: string };
        response?: { generateVideoResponse?: { generatedSamples?: Array<{ video?: { uri?: string } }> } };
      };
      if (data.done) {
        if (data.error) {
          remoteStatus = "FAILED";
          errorMsg = data.error.message || "Veo generation failed";
        } else {
          remoteStatus = "COMPLETED";
          downloadUrl =
            data.response?.generateVideoResponse?.generatedSamples?.[0]?.video?.uri || null;
        }
      }
    }
  }

  if (remoteStatus === "COMPLETED" && downloadUrl) {
    const vidRes = await fetch(downloadUrl, { signal: AbortSignal.timeout(45000) });
    const buffer = Buffer.from(await vidRes.arrayBuffer());
    const { generatedAsset } = await persistGeneratedStudioAsset({
      userId,
      projectId: vg.projectId ?? undefined,
      assetType: "VIDEO_CLIP",
      buffer,
      filename: `video-${vg.id}.mp4`,
      mimeType: "video/mp4",
      title: `AI Clip (${vg.provider} · ${vg.durationSec}s)`,
      prompt: vg.prompt,
      provider: vg.provider,
      model: vg.model,
      durationMs: vg.durationSec * 1000,
    });

    if (vg.sceneId) {
      await prisma.storyboardScene.updateMany({
        where: { id: vg.sceneId },
        data: { videoAssetId: generatedAsset.id },
      });
    }

    await recordStudioUsage({
      feature: "CONTENT_STUDIO_VIDEO",
      provider: vg.provider,
      model: vg.model,
      modality: "VIDEO",
      userId,
      projectId: vg.projectId ?? undefined,
      jobId: vg.jobId ?? undefined,
      durationMs: vg.durationSec * 1000,
      costUsd: vg.costUsd ?? null,
      ok: true,
    });

    if (vg.jobId) {
      await updateStudioJobProgress({
        jobId: vg.jobId,
        status: "COMPLETED",
        progress: 100,
        actualCostUsd: vg.costUsd ?? undefined,
        outputPayload: { assetId: generatedAsset.id, videoUrl: generatedAsset.publicUrl },
      });
    }

    return prisma.videoGeneration.update({
      where: { id: vg.id },
      data: {
        status: "COMPLETED",
        progress: 100,
        assetId: generatedAsset.id,
        videoUrl: generatedAsset.publicUrl,
      },
    });
  }

  if (remoteStatus === "FAILED") {
    if (vg.jobId) {
      await updateStudioJobProgress({
        jobId: vg.jobId,
        status: "FAILED",
        progress: 100,
        errorMessage: errorMsg || "Video generation failed",
      });
    }
    return prisma.videoGeneration.update({
      where: { id: vg.id },
      data: { status: "FAILED", errorMessage: errorMsg || "Video generation failed" },
    });
  }

  return vg;
}
