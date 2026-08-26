import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { requireServiceApiKey } from "@/lib/integrations/service-auth";
import { apiSuccess, handleApiError } from "@/lib/api/response";

/**
 * Real course + batch catalogue for the outreach CRM's lead-conversion
 * form — replaces the hardcoded ATOMIC_LMS_COURSES list that lived only in
 * the CRM's own codebase. API-key gated (server-to-server, no user
 * session).
 */
export async function GET(request: NextRequest) {
  try {
    requireServiceApiKey(request);

    const courses = await prisma.course.findMany({
      where: { isPublished: true },
      include: {
        batches: {
          where: { status: { in: ["UPCOMING", "ACTIVE"] } },
          select: { id: true, name: true, code: true, status: true, startDate: true },
          orderBy: { name: "asc" },
        },
      },
      orderBy: { title: "asc" },
    });

    return apiSuccess({
      courses: courses.map((c) => ({
        id: c.id,
        title: c.title,
        slug: c.slug,
        batches: c.batches.map((b) => ({
          id: b.id,
          name: b.name,
          code: b.code,
          status: b.status,
          startDate: b.startDate,
        })),
      })),
    });
  } catch (error) {
    return handleApiError(error);
  }
}
