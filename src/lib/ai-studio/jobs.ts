import "server-only";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { pusherServer } from "@/lib/realtime/pusher-server";
import { StudioModality } from "./types";

export function studioProjectChannel(projectId: string): string {
  return `private-studio-project-${projectId}`;
}

async function emitJobEvent(
  projectId: string | null | undefined,
  event: string,
  payload: Record<string, unknown>
) {
  if (!projectId || !process.env.PUSHER_APP_ID) return;
  try {
    await pusherServer.trigger(studioProjectChannel(projectId), event, payload);
  } catch (err) {
    console.warn("[ai-studio/jobs] Pusher trigger failed:", err);
  }
}

export async function createStudioJob(params: {
  userId: string;
  projectId?: string;
  modality: StudioModality;
  taskType: string;
  provider?: string;
  model?: string;
  inputPayload?: Record<string, unknown>;
  estimatedCostUsd?: number;
}) {
  const job = await prisma.aiGenerationJob.create({
    data: {
      userId: params.userId,
      projectId: params.projectId ?? null,
      modality: params.modality,
      taskType: params.taskType,
      status: "QUEUED",
      progress: 0,
      provider: params.provider ?? null,
      model: params.model ?? null,
      inputPayload: (params.inputPayload as Prisma.InputJsonValue | undefined) ?? undefined,
      estimatedCostUsd: params.estimatedCostUsd ?? null,
    },
  });

  await emitJobEvent(job.projectId, "job:created", {
    jobId: job.id,
    status: job.status,
    progress: job.progress,
    modality: job.modality,
  });

  return job;
}

export async function updateStudioJobProgress(params: {
  jobId: string;
  status?: "PROCESSING" | "WAITING_WEBHOOK" | "COMPLETED" | "FAILED";
  progress?: number;
  externalJobId?: string;
  outputPayload?: Record<string, unknown>;
  errorMessage?: string;
  actualCostUsd?: number;
}) {
  const data: Prisma.AiGenerationJobUpdateInput = {
    ...(params.status ? { status: params.status } : {}),
    ...(params.progress !== undefined ? { progress: Math.max(0, Math.min(100, params.progress)) } : {}),
    ...(params.externalJobId !== undefined ? { externalJobId: params.externalJobId } : {}),
    ...(params.outputPayload !== undefined
      ? { outputPayload: params.outputPayload as Prisma.InputJsonValue }
      : {}),
    ...(params.errorMessage !== undefined ? { errorMessage: params.errorMessage } : {}),
    ...(params.actualCostUsd !== undefined ? { actualCostUsd: params.actualCostUsd } : {}),
  };

  if (params.status === "PROCESSING") {
    data.startedAt = new Date();
  } else if (params.status === "COMPLETED" || params.status === "FAILED") {
    data.completedAt = new Date();
  }

  const job = await prisma.aiGenerationJob.update({
    where: { id: params.jobId },
    data,
  });

  await emitJobEvent(job.projectId, "job:updated", {
    jobId: job.id,
    status: job.status,
    progress: job.progress,
    errorMessage: job.errorMessage,
  });

  return job;
}

export async function cancelStudioJob(jobId: string) {
  const existing = await prisma.aiGenerationJob.findUnique({ where: { id: jobId } });
  if (!existing) return null;
  if (existing.status === "COMPLETED" || existing.status === "FAILED" || existing.status === "CANCELLED") {
    return existing;
  }

  const updated = await prisma.aiGenerationJob.update({
    where: { id: jobId },
    data: {
      cancelRequested: true,
      status: "CANCELLED",
      completedAt: new Date(),
    },
  });

  await emitJobEvent(updated.projectId, "job:updated", {
    jobId: updated.id,
    status: updated.status,
    progress: updated.progress,
  });

  return updated;
}

export async function retryStudioJob(jobId: string) {
  const existing = await prisma.aiGenerationJob.findUnique({ where: { id: jobId } });
  if (!existing) return null;
  if (existing.status !== "FAILED" && existing.status !== "CANCELLED") {
    throw new Error(`Only FAILED or CANCELLED jobs can be retried (current: ${existing.status})`);
  }
  if (existing.attempts >= existing.maxAttempts) {
    throw new Error(`Max retry attempts (${existing.maxAttempts}) reached for job ${jobId}`);
  }
  const updated = await prisma.aiGenerationJob.update({
    where: { id: jobId },
    data: {
      status: "QUEUED",
      progress: 0,
      cancelRequested: false,
      errorMessage: null,
      retryAt: null,
      startedAt: null,
      completedAt: null,
      outputPayload: Prisma.DbNull,
      lockedUntil: null,
      attempts: { increment: 1 },
    },
  });

  await emitJobEvent(updated.projectId, "job:updated", {
    jobId: updated.id,
    status: updated.status,
    progress: updated.progress,
  });

  return updated;
}
