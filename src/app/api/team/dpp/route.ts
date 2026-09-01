import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { requirePermission, UnauthorizedError } from "@/lib/rbac/guard";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { apiSuccess, handleApiError } from "@/lib/api/response";
import { dppSchema } from "@/lib/validation/dpp";
import { resolveSubjectChapterNames } from "@/lib/questions/legacy";
import { generateDppCode } from "@/lib/dpp/code";
import { Prisma } from "@prisma/client";

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    await requirePermission(session?.user?.id, PERMISSIONS.DPP_READ);

    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search")?.trim();
    const status = searchParams.get("status");
    const level = searchParams.get("level");
    const page = Math.max(1, Number(searchParams.get("page") ?? 1));
    const pageSize = 20;

    const where = {
      ...(search
        ? {
            OR: [
              { name: { contains: search, mode: "insensitive" as const } },
              { code: { contains: search, mode: "insensitive" as const } },
            ],
          }
        : {}),
      ...(status ? { status } : {}),
      ...(level ? { level: Number(level) } : {}),
    };

    const [dpps, total, statusCounts] = await Promise.all([
      prisma.dpp.findMany({
        where,
        include: { _count: { select: { questions: true } } },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.dpp.count({ where }),
      prisma.dpp.groupBy({ by: ["status"], _count: true }),
    ]);

    return apiSuccess({ dpps, total, page, pageSize, statusCounts });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) throw new UnauthorizedError();
    await requirePermission(session.user.id, PERMISSIONS.DPP_CREATE);

    const body = await request.json();
    const data = dppSchema.parse(body);

    const { subject, chapter } = await resolveSubjectChapterNames(
      prisma,
      data.subjectId,
      data.chapterId || undefined
    );

    let dpp: Awaited<ReturnType<typeof prisma.dpp.create>> | null = null;
    let lastError: unknown = null;

    for (let attempt = 0; attempt < 3 && !dpp; attempt++) {
      const code = await generateDppCode(prisma);
      try {
        dpp = await prisma.dpp.create({
          data: {
            code,
            name: data.name,
            subject,
            chapter: chapter ?? "Unclassified",
            facultyName: data.facultyName || null,
            difficulty: data.difficulty,
            languageMode: data.languageMode,
            description: data.description || null,
            tags: data.tags.length > 0 ? data.tags.join(",") : null,
            instructions: data.instructions || null,
            estimatedTimeMin: data.estimatedTimeMin,
            correctMarks: data.correctMarks,
            incorrectMarks: data.incorrectMarks,
            negativeMarkingEnabled: data.negativeMarkingEnabled,
            questionTargetCount: data.questionTargetCount,
            level: data.level ?? null,
            topics: data.topics,
            createdById: session.user.id,
          },
        });
      } catch (err) {
        lastError = err;
        // Code collision from a concurrent create — loop and try the next
        // code. Any other error should propagate immediately.
        if (!(err instanceof Prisma.PrismaClientKnownRequestError) || err.code !== "P2002") {
          throw err;
        }
      }
    }

    if (!dpp) {
      throw lastError instanceof Error ? lastError : new Error("Could not generate a unique DPP code");
    }

    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        action: "DPP_CREATE",
        entityType: "Dpp",
        entityId: dpp.id,
      },
    });

    return apiSuccess({ dpp }, 201);
  } catch (error) {
    return handleApiError(error);
  }
}
