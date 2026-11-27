import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requirePermission, UnauthorizedError } from "@/lib/rbac/guard";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { apiError, apiSuccess, handleApiError } from "@/lib/api/response";
import {
  generateFullScript,
  ScriptSection,
  sectionsToMarkdown,
} from "@/lib/ai-studio/production/script-studio";

const generateScriptSchema = z.object({
  topic: z.string().trim().min(2).max(240),
  language: z.string().trim().max(24).default("en"),
  medium: z.string().trim().max(40).default("BILINGUAL"),
  style: z.string().trim().max(40).default("TEACHER_STYLE"),
  targetDurationSec: z.number().int().min(15).max(14400).default(480),
  planSummary: z.string().trim().max(6000).optional(),
});

const sectionSchema = z.object({
  id: z.string(),
  type: z.enum(["HOOK", "INTRO", "MAIN", "ENGAGEMENT", "CTA", "ENDING"]),
  title: z.string(),
  content: z.string(),
  durationSec: z.number().int().min(1).default(30),
});

const saveScriptSchema = z.object({
  scriptId: z.string().optional(),
  title: z.string().trim().min(1).max(200),
  sections: z.array(sectionSchema).min(1),
  language: z.string().optional(),
  medium: z.string().optional(),
  style: z.string().optional(),
  saveAsNewVersion: z.boolean().default(false),
});

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) throw new UnauthorizedError();
    await requirePermission(session.user.id, PERMISSIONS.CONTENT_STUDIO_SCRIPT);

    const scripts = await prisma.contentScript.findMany({
      where: { projectId: params.id },
      orderBy: { version: "desc" },
    });

    return apiSuccess({ scripts });
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
    await requirePermission(session.user.id, PERMISSIONS.CONTENT_STUDIO_SCRIPT);
    await requirePermission(session.user.id, PERMISSIONS.CONTENT_STUDIO_AI_GENERATE);

    const body = generateScriptSchema.parse(await req.json());
    const script = await generateFullScript({
      ...body,
      projectId: params.id,
      userId: session.user.id,
      roleName: session.user.role ?? undefined,
    });

    return apiSuccess({ script }, 201);
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
    await requirePermission(session.user.id, PERMISSIONS.CONTENT_STUDIO_SCRIPT);

    const body = saveScriptSchema.parse(await req.json());
    const sections = body.sections as ScriptSection[];
    const markdown = sectionsToMarkdown(sections);
    const wordCount = markdown.split(/\s+/).filter(Boolean).length;
    const totalDur = sections.reduce((acc, s) => acc + (s.durationSec || 0), 0);

    if (body.saveAsNewVersion || !body.scriptId) {
      const latest = await prisma.contentScript.findFirst({
        where: { projectId: params.id },
        orderBy: { version: "desc" },
        select: { version: true },
      });
      const version = (latest?.version ?? 0) + 1;

      const created = await prisma.$transaction(async (tx) => {
        await tx.contentScript.updateMany({
          where: { projectId: params.id, isActive: true },
          data: { isActive: false },
        });
        const next = await tx.contentScript.create({
          data: {
            projectId: params.id,
            version,
            title: body.title,
            hook: sections.find((s) => s.type === "HOOK")?.content ?? null,
            cta: sections.find((s) => s.type === "CTA")?.content ?? null,
            bodyMarkdown: markdown,
            sectionsJson: sections as unknown as Prisma.InputJsonValue,
            language: body.language || "en",
            medium: body.medium || "BILINGUAL",
            style: body.style || "TEACHER_STYLE",
            wordCount,
            estimatedDurationSec: totalDur,
            isActive: true,
            createdById: session.user.id,
          },
        });
        await tx.contentHistory.create({
          data: {
            projectId: params.id,
            entityType: "SCRIPT",
            entityId: next.id,
            version,
            snapshot: { title: next.title, wordCount },
            changeSummary: `Saved Script v${version}`,
            actorId: session.user.id,
          },
        });
        return next;
      });
      return apiSuccess({ script: created }, 201);
    }

    const existing = await prisma.contentScript.findFirst({
      where: { id: body.scriptId, projectId: params.id },
    });
    if (!existing) return apiError("Script not found", 404);

    const updated = await prisma.contentScript.update({
      where: { id: body.scriptId },
      data: {
        title: body.title,
        hook: sections.find((s) => s.type === "HOOK")?.content ?? null,
        cta: sections.find((s) => s.type === "CTA")?.content ?? null,
        bodyMarkdown: markdown,
        sectionsJson: sections as unknown as Prisma.InputJsonValue,
        ...(body.language ? { language: body.language } : {}),
        ...(body.medium ? { medium: body.medium } : {}),
        ...(body.style ? { style: body.style } : {}),
        wordCount,
        estimatedDurationSec: totalDur,
      },
    });

    return apiSuccess({ script: updated });
  } catch (err) {
    return handleApiError(err);
  }
}
