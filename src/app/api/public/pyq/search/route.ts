import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { apiSuccess, handleApiError } from "@/lib/api/response";

export const revalidate = 60; // Cache search responses for 60 seconds

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    const isAuthorized = Boolean(session?.user?.id);

    const sp = request.nextUrl.searchParams;
    const q = sp.get("q")?.trim();
    const examSlug = sp.get("exam")?.trim();
    const subject = sp.get("subject")?.trim();
    const chapter = sp.get("chapter")?.trim();
    const year = sp.get("year") ? parseInt(sp.get("year")!, 10) : null;
    const page = Math.max(1, Number(sp.get("page") || 1));
    const pageSize = Math.min(30, Math.max(1, Number(sp.get("pageSize") || 15)));

    const where: any = {
      isPublished: true,
      pyqOccurrences: {
        some: {
          verificationStatus: "VERIFIED",
          ...(year ? { year } : {}),
          ...(examSlug
            ? {
                exam: {
                  OR: [{ slug: examSlug }, { canonicalType: examSlug.toUpperCase().replace(/-/g, "_") }],
                },
              }
            : {}),
        },
      },
      ...(subject ? { subject: { equals: subject, mode: "insensitive" } } : {}),
      ...(chapter ? { chapter: { contains: chapter, mode: "insensitive" } } : {}),
    };

    if (q) {
      where.OR = [
        { questionCode: { contains: q, mode: "insensitive" } },
        { topic: { contains: q, mode: "insensitive" } },
        { tags: { contains: q, mode: "insensitive" } },
        {
          translations: {
            some: {
              statement: { contains: q, mode: "insensitive" },
            },
          },
        },
      ];
    }

    const [total, questions] = await Promise.all([
      prisma.question.count({ where }),
      prisma.question.findMany({
        where,
        orderBy: [{ pyqYear: "desc" }, { createdAt: "desc" }],
        skip: (page - 1) * pageSize,
        take: pageSize,
        select: {
          id: true,
          slug: true,
          questionCode: true,
          type: true,
          difficulty: true,
          subject: true,
          chapter: true,
          topic: true,
          imageUrl: true,
          pyqExam: true,
          pyqYear: true,
          pyqMonth: true,
          pyqQuestionNumber: true,
          // Protected fields: ONLY returned if user is authenticated!
          solution: isAuthorized,
          translations: {
            select: {
              language: true,
              statement: true,
              options: true,
              // Answer & solution protected:
              correctOptionIds: isAuthorized,
              solution: isAuthorized,
            },
          },
          pyqOccurrences: {
            where: { verificationStatus: "VERIFIED" },
            select: {
              year: true,
              session: true,
              shift: true,
              paper: true,
              questionNumber: true,
              exam: { select: { slug: true, name: true, canonicalType: true } },
            },
          },
        },
      }),
    ]);

    return apiSuccess({
      total,
      page,
      pageSize,
      isAuthorized,
      questions,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
