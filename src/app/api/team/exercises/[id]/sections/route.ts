import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { requirePermission, UnauthorizedError } from "@/lib/rbac/guard";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { apiSuccess, handleApiError } from "@/lib/api/response";

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) throw new UnauthorizedError();
    await requirePermission(session.user.id, PERMISSIONS.QUESTION_CREATE);

    const body = await request.json();
    if (!body.title?.trim()) {
      return NextResponse.json({ error: "Section title is required" }, { status: 400 });
    }

    const currentCount = await prisma.exerciseSection.count({
      where: { exerciseId: params.id },
    });

    const section = await prisma.exerciseSection.create({
      data: {
        exerciseId: params.id,
        title: body.title.trim(),
        description: body.description?.trim() || null,
        topic: body.topic?.trim() || null,
        subTopic: body.subTopic?.trim() || null,
        order: currentCount,
      },
    });

    return apiSuccess(section, 201);
  } catch (err) {
    return handleApiError(err);
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) throw new UnauthorizedError();
    await requirePermission(session.user.id, PERMISSIONS.QUESTION_CREATE);

    const body = await request.json();

    // Case 1: Bulk reorder sections [{ id, order, title? }]
    if (Array.isArray(body.sections)) {
      await prisma.$transaction(
        body.sections.map((sec: { id: string; order: number; title?: string }) =>
          prisma.exerciseSection.update({
            where: { id: sec.id, exerciseId: params.id },
            data: {
              order: sec.order,
              ...(sec.title ? { title: sec.title.trim() } : {}),
            },
          })
        )
      );
      return apiSuccess({ updated: true, count: body.sections.length });
    }

    // Case 2: Update single section
    if (body.sectionId) {
      const data: any = {};
      if (body.title !== undefined) data.title = body.title.trim();
      if (body.description !== undefined) data.description = body.description?.trim() || null;
      if (body.order !== undefined) data.order = Number(body.order);
      if (body.pageBreakBefore !== undefined) data.pageBreakBefore = Boolean(body.pageBreakBefore);

      const updated = await prisma.exerciseSection.update({
        where: { id: body.sectionId, exerciseId: params.id },
        data,
      });
      return apiSuccess(updated);
    }

    return NextResponse.json({ error: "Invalid section update payload" }, { status: 400 });
  } catch (err) {
    return handleApiError(err);
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) throw new UnauthorizedError();
    await requirePermission(session.user.id, PERMISSIONS.QUESTION_CREATE);

    const { searchParams } = new URL(request.url);
    const sectionId = searchParams.get("sectionId");

    if (!sectionId) {
      return NextResponse.json({ error: "sectionId parameter is required" }, { status: 400 });
    }

    // Verify section belongs to this exercise
    const section = await prisma.exerciseSection.findUnique({
      where: { id: sectionId, exerciseId: params.id },
      include: { _count: { select: { questions: true } } },
    });

    if (!section) {
      return NextResponse.json({ error: "Section not found" }, { status: 404 });
    }

    // Unassign questions to avoid cascade deletion of question mappings
    await prisma.exerciseQuestion.updateMany({
      where: { sectionId },
      data: { sectionId: null },
    });

    await prisma.exerciseSection.delete({
      where: { id: sectionId },
    });

    return apiSuccess({ deleted: true, unlinkedQuestions: section._count.questions });
  } catch (err) {
    return handleApiError(err);
  }
}

