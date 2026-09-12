import { NextRequest } from "next/server";
import { z } from "zod";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { UnauthorizedError, ForbiddenError } from "@/lib/rbac/guard";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/response";

const createSlotSchema = z.object({
  date: z.string().min(1), // "YYYY-MM-DD"
  startTime: z.string().min(1), // ISO datetime
  endTime: z.string().min(1), // ISO datetime
});

async function resolveTeacher(userId: string) {
  return prisma.teacher.findUnique({ where: { userId } });
}

/**
 * Teacher publishes one bookable slot. Rejects any overlap with the
 * teacher's own existing non-cancelled slots — a classic interval-overlap
 * check against real rows, not a computed window, since slots are stored
 * as pre-generated discrete rows (see prisma/schema.prisma's DoubtSlot
 * doc comment for why).
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) throw new UnauthorizedError();

    const teacher = await resolveTeacher(session.user.id);
    if (!teacher) throw new ForbiddenError("Only teachers can publish doubt session slots.");

    const { date, startTime, endTime } = createSlotSchema.parse(await request.json());
    const start = new Date(startTime);
    const end = new Date(endTime);
    if (!(start < end)) return apiError("Start time must be before end time.", 400);

    const overlapping = await prisma.doubtSlot.findFirst({
      where: {
        teacherId: teacher.id,
        status: { not: "CANCELLED" },
        startTime: { lt: end },
        endTime: { gt: start },
      },
    });
    if (overlapping) {
      return apiError("This overlaps with an existing slot.", 409);
    }

    const slot = await prisma.doubtSlot.create({
      data: { teacherId: teacher.id, date: new Date(date), startTime: start, endTime: end },
    });

    return apiSuccess({ slot }, 201);
  } catch (error) {
    return handleApiError(error);
  }
}

/** Teacher's own slots (own-only — never a client-supplied teacherId). */
export async function GET(_request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) throw new UnauthorizedError();

    const teacher = await resolveTeacher(session.user.id);
    if (!teacher) throw new ForbiddenError("Only teachers can view their own slots.");

    const slots = await prisma.doubtSlot.findMany({
      where: { teacherId: teacher.id },
      orderBy: { startTime: "asc" },
      include: {
        booking: {
          include: { student: { include: { user: { select: { name: true, photoUrl: true } } } } },
        },
      },
    });

    return apiSuccess({ slots });
  } catch (error) {
    return handleApiError(error);
  }
}
