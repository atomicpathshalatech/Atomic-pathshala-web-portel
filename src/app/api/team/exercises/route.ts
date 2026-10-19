import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { requirePermission, UnauthorizedError } from "@/lib/rbac/guard";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { apiSuccess, handleApiError } from "@/lib/api/response";
import { createExercise } from "@/lib/exercises/exercise-service";

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) throw new UnauthorizedError();
    await requirePermission(session.user.id, PERMISSIONS.QUESTION_READ);

    const { searchParams } = new URL(request.url);
    const subject = searchParams.get("subject")?.trim();
    const chapter = searchParams.get("chapter")?.trim();
    const status = searchParams.get("status")?.trim();
    const search = searchParams.get("search")?.trim();
    const page = Math.max(1, Number(searchParams.get("page") ?? 1));
    const limit = Math.min(50, Math.max(1, Number(searchParams.get("limit") ?? 20)));
    const skip = (page - 1) * limit;

    const where: any = {};
    if (subject && subject !== "ALL") {
      where.subject = { equals: subject, mode: "insensitive" };
    }
    if (chapter && chapter !== "ALL") {
      where.chapter = { contains: chapter, mode: "insensitive" };
    }
    if (status && status !== "ALL") {
      where.status = status;
    }
    if (search) {
      where.OR = [
        { title: { contains: search, mode: "insensitive" } },
        { exerciseCode: { contains: search, mode: "insensitive" } },
        { chapter: { contains: search, mode: "insensitive" } },
      ];
    }

    const [exercises, total, countsByStatus] = await Promise.all([
      prisma.exercise.findMany({
        where,
        include: {
          createdBy: { select: { name: true, email: true } },
          _count: {
            select: {
              questions: true,
              sections: true,
              attempts: true,
              exports: true,
            },
          },
        },
        orderBy: { updatedAt: "desc" },
        skip,
        take: limit,
      }),
      prisma.exercise.count({ where }),
      prisma.exercise.groupBy({
        by: ["status"],
        _count: { id: true },
      }),
    ]);

    const statusCounts: Record<string, number> = { DRAFT: 0, PUBLISHED: 0, ARCHIVED: 0 };
    for (const sc of countsByStatus) {
      statusCounts[sc.status] = sc._count.id;
    }

    return apiSuccess({
      exercises,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
      statusCounts,
    });
  } catch (err) {
    return handleApiError(err);
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) throw new UnauthorizedError();
    await requirePermission(session.user.id, PERMISSIONS.QUESTION_CREATE);

    const body = await request.json();
    if (!body.title?.trim()) {
      return NextResponse.json({ error: "Exercise title is required" }, { status: 400 });
    }
    if (!body.subject?.trim()) {
      return NextResponse.json({ error: "Subject is required" }, { status: 400 });
    }
    if (!body.chapter?.trim()) {
      return NextResponse.json({ error: "Chapter is required" }, { status: 400 });
    }

    const exercise = await createExercise({
      ...body,
      createdById: session.user.id,
    });

    return apiSuccess(exercise, 201);
  } catch (err) {
    return handleApiError(err);
  }
}
