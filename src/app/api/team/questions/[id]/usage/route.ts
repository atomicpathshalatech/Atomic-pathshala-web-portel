import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { requirePermission, UnauthorizedError } from "@/lib/rbac/guard";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/response";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) throw new UnauthorizedError();
    await requirePermission(session.user.id, PERMISSIONS.QUESTION_READ);

    const question = await prisma.question.findUnique({
      where: { id: params.id },
      select: {
        id: true,
        questionCode: true,
        sectionLinks: {
          select: {
            id: true,
            order: true,
            section: {
              select: {
                id: true,
                name: true,
                test: {
                  select: {
                    id: true,
                    title: true,
                    examType: true,
                    testType: true,
                    isPublished: true,
                    startDate: true,
                  },
                },
              },
            },
          },
        },
        dppLinks: {
          select: {
            id: true,
            dpp: {
              select: {
                id: true,
                title: true,
                chapter: true,
                dppNumber: true,
              },
            },
          },
        },
        exerciseLinks: {
          select: {
            id: true,
            displayOrder: true,
            exercise: {
              select: {
                id: true,
                title: true,
                subject: true,
                chapter: true,
              },
            },
          },
        },
        collectionItems: {
          select: {
            id: true,
            collection: {
              select: {
                id: true,
                name: true,
                description: true,
              },
            },
          },
        },
      },
    });

    if (!question) {
      return apiError("Question not found", 404);
    }

    const tests = question.sectionLinks.map((sl) => ({
      linkId: sl.id,
      order: sl.order,
      sectionId: sl.section?.id,
      sectionName: sl.section?.name,
      testId: sl.section?.test?.id,
      testTitle: sl.section?.test?.title,
      examType: sl.section?.test?.examType,
      isPublished: sl.section?.test?.isPublished,
      startDate: sl.section?.test?.startDate,
    }));

    const dpps = question.dppLinks.map((dl) => ({
      linkId: dl.id,
      dppId: dl.dpp?.id,
      title: dl.dpp?.title,
      chapter: dl.dpp?.chapter,
      dppNumber: dl.dpp?.dppNumber,
    }));

    const exercises = question.exerciseLinks.map((el) => ({
      linkId: el.id,
      order: el.displayOrder,
      exerciseId: el.exercise?.id,
      title: el.exercise?.title,
      subject: el.exercise?.subject,
      chapter: el.exercise?.chapter,
    }));

    const collections = question.collectionItems.map((ci) => ({
      id: ci.id,
      collectionId: ci.collection?.id,
      name: ci.collection?.name,
    }));

    return apiSuccess({
      usage: {
        tests,
        dpps,
        exercises,
        collections,
        totalUsages: tests.length + dpps.length + exercises.length,
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}
