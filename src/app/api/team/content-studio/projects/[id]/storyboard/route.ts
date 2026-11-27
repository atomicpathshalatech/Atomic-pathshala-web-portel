import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requirePermission, UnauthorizedError } from "@/lib/rbac/guard";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { apiError, apiSuccess, handleApiError } from "@/lib/api/response";
import { generateStoryboardFromScript } from "@/lib/ai-studio/production/storyboard";

const createStoryboardSchema = z.object({
  scriptId: z.string().trim(),
  aspectRatio: z.string().trim().default("16:9"),
});

const updateSceneSchema = z.object({
  sceneId: z.string().trim(),
  title: z.string().trim().optional(),
  durationSec: z.number().int().min(1).max(3600).optional(),
  narrationText: z.string().optional(),
  visualPrompt: z.string().optional(),
  requiredImage: z.string().optional(),
  requiredVideo: z.string().optional(),
  diagramSpec: z.string().optional(),
  animationNotes: z.string().optional(),
  cameraDirection: z.string().optional(),
  textOnScreen: z.string().optional(),
  voiceInstructions: z.string().optional(),
  musicInstructions: z.string().optional(),
});

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) throw new UnauthorizedError();
    await requirePermission(session.user.id, PERMISSIONS.CONTENT_STUDIO_PROJECT_READ);

    const storyboards = await prisma.storyboard.findMany({
      where: { projectId: params.id },
      include: { scenes: { orderBy: { orderIndex: "asc" } } },
      orderBy: { version: "desc" },
    });

    return apiSuccess({ storyboards });
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
    await requirePermission(session.user.id, PERMISSIONS.CONTENT_STUDIO_AI_GENERATE);

    const body = createStoryboardSchema.parse(await req.json());
    const storyboard = await generateStoryboardFromScript({
      projectId: params.id,
      scriptId: body.scriptId,
      aspectRatio: body.aspectRatio,
      userId: session.user.id,
      roleName: session.user.role ?? undefined,
    });

    return apiSuccess({ storyboard }, 201);
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
    await requirePermission(session.user.id, PERMISSIONS.CONTENT_STUDIO_PROJECT_UPDATE);

    const body = updateSceneSchema.parse(await req.json());
    const existing = await prisma.storyboardScene.findFirst({
      where: { id: body.sceneId, storyboard: { projectId: params.id } },
    });
    if (!existing) return apiError("Scene not found", 404);

    const updated = await prisma.storyboardScene.update({
      where: { id: body.sceneId },
      data: {
        ...(body.title !== undefined ? { title: body.title } : {}),
        ...(body.durationSec !== undefined ? { durationSec: body.durationSec } : {}),
        ...(body.narrationText !== undefined ? { narrationText: body.narrationText } : {}),
        ...(body.visualPrompt !== undefined ? { visualPrompt: body.visualPrompt } : {}),
        ...(body.requiredImage !== undefined ? { requiredImage: body.requiredImage } : {}),
        ...(body.requiredVideo !== undefined ? { requiredVideo: body.requiredVideo } : {}),
        ...(body.diagramSpec !== undefined ? { diagramSpec: body.diagramSpec } : {}),
        ...(body.animationNotes !== undefined ? { animationNotes: body.animationNotes } : {}),
        ...(body.cameraDirection !== undefined ? { cameraDirection: body.cameraDirection } : {}),
        ...(body.textOnScreen !== undefined ? { textOnScreen: body.textOnScreen } : {}),
        ...(body.voiceInstructions !== undefined ? { voiceInstructions: body.voiceInstructions } : {}),
        ...(body.musicInstructions !== undefined ? { musicInstructions: body.musicInstructions } : {}),
      },
    });

    return apiSuccess({ scene: updated });
  } catch (err) {
    return handleApiError(err);
  }
}
