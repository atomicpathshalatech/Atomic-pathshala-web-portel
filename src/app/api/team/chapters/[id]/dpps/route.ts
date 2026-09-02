import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { requirePermission, UnauthorizedError } from "@/lib/rbac/guard";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/response";
import { generateDppCode } from "@/lib/dpp/code";
import { LanguageMode } from "@prisma/client";
import { isDppSlotMandatory } from "@/lib/chapters/sequence";

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) throw new UnauthorizedError();
    await requirePermission(session.user.id, PERMISSIONS.DPP_READ);

    const dpps = await prisma.dpp.findMany({
      where: { chapterId: params.id },
      include: {
        _count: { select: { questions: true } },
      },
      orderBy: { createdAt: "asc" },
    });

    // Chapter-scoped slot/label/mandatory-vs-optional info, per the
    // DPP1-4-required/DPP5-optional default policy — computed here rather
    // than stored so relabeling never requires a data migration.
    const dppsWithSlot = dpps.map((dpp, idx) => {
      const slot = idx + 1;
      return {
        ...dpp,
        slot,
        slotLabel: `DPP ${slot}`,
        slotRequired: isDppSlotMandatory(slot),
        slotComplete: dpp._count.questions > 0,
      };
    });

    return apiSuccess({ dpps: dppsWithSlot });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) throw new UnauthorizedError();
    await requirePermission(session.user.id, PERMISSIONS.DPP_CREATE);

    const chapter = await prisma.chapter.findUnique({
      where: { id: params.id },
      include: { subject: true },
    });
    if (!chapter) return apiError("Chapter not found", 404);

    const body = await request.json();
    const {
      name,
      level,
      difficulty,
      estimatedTimeMin,
      correctMarks,
      incorrectMarks,
      topics,
      instructions,
      languageMode,
    } = body;

    if (!name?.trim()) {
      return apiError("DPP Name is required", 400);
    }

    const code = await generateDppCode(prisma);
    const existingDppCount = await prisma.dpp.count({ where: { chapterId: chapter.id } });
    const slot = existingDppCount + 1;

    const dpp = await prisma.dpp.create({
      data: {
        code,
        name: name.trim(),
        subject: chapter.subject.title,
        chapter: chapter.title,
        chapterId: chapter.id,
        level: typeof level === "number" ? level : 1,
        difficulty: difficulty || "MEDIUM",
        estimatedTimeMin: typeof estimatedTimeMin === "number" ? estimatedTimeMin : 30,
        correctMarks: typeof correctMarks === "number" ? correctMarks : 4,
        incorrectMarks: typeof incorrectMarks === "number" ? incorrectMarks : -1,
        topics: Array.isArray(topics) ? topics : [],
        instructions: instructions?.trim() || null,
        languageMode: languageMode && Object.values(LanguageMode).includes(languageMode) ? languageMode : LanguageMode.BOTH,
        status: "ACTIVE",
        createdById: session.user.id,
      },
    });

    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        action: "DPP_CREATED",
        entityType: "Dpp",
        entityId: dpp.id,
        metadata: { chapterId: chapter.id, name: dpp.name, code: dpp.code },
      },
    });

    return apiSuccess(
      { dpp: { ...dpp, slot, slotLabel: `DPP ${slot}`, slotRequired: isDppSlotMandatory(slot), slotComplete: false } },
      201
    );
  } catch (error) {
    return handleApiError(error);
  }
}