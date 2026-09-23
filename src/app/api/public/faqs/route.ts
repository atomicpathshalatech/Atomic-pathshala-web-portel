import { prisma } from "@/lib/db";
import { apiSuccess, handleApiError } from "@/lib/api/response";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const faqs = await prisma.faq.findMany({
      where: { isPublished: true },
      orderBy: [{ order: "asc" }, { createdAt: "asc" }],
      select: {
        id: true,
        question: true,
        answer: true,
        order: true,
        category: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    return apiSuccess({ faqs });
  } catch (error) {
    return handleApiError(error);
  }
}
