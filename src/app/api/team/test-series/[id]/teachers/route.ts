import { NextRequest } from "next/server";
import { z } from "zod";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { requirePermission, UnauthorizedError } from "@/lib/rbac/guard";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/response";
import { regenerateCreativeAwaited } from "@/lib/creative/engine";

export const runtime = "nodejs";

/** GET — assigned educators for a test series (TestSeries had no educator relation before this system — see TestSeriesTeacher in schema.prisma). */
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) throw new UnauthorizedError();
    await requirePermission(session.user.id, PERMISSIONS.TEST_READ);

    const assignments = await prisma.testSeriesTeacher.findMany({
      where: { testSeriesId: params.id },
      include: { teacher: { select: { id: true, user: { select: { name: true, photoUrl: true } } } } },
      orderBy: { createdAt: "asc" },
    });
    return apiSuccess({ assignments });
  } catch (error) {
    return handleApiError(error);
  }
}

const assignSchema = z.object({ teacherId: z.string(), subject: z.string().trim().optional() });

/** POST — assign an educator to a test series. */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) throw new UnauthorizedError();
    await requirePermission(session.user.id, PERMISSIONS.TEST_UPDATE);

    const series = await prisma.testSeries.findUnique({ where: { id: params.id } });
    if (!series) return apiError("Test series not found", 404);

    const input = assignSchema.parse(await req.json());
    const teacher = await prisma.teacher.findUnique({ where: { id: input.teacherId } });
    if (!teacher) return apiError("Teacher not found", 404);

    const already = await prisma.testSeriesTeacher.findFirst({
      where: { testSeriesId: params.id, teacherId: input.teacherId, subject: input.subject || null },
    });
    if (already) return apiError("This teacher is already assigned to this test series.", 409);

    const assignment = await prisma.testSeriesTeacher.create({
      data: { testSeriesId: params.id, teacherId: input.teacherId, subject: input.subject || null },
    });

    // Test-series creative auto-updates the moment an educator's assignment changes (spec section 7).
    await regenerateCreativeAwaited("TEST_SERIES", params.id);

    return apiSuccess({ assignment }, 201);
  } catch (error) {
    return handleApiError(error);
  }
}
