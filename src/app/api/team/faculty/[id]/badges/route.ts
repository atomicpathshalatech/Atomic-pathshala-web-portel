import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { requirePermission, UnauthorizedError } from "@/lib/rbac/guard";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/response";

const BADGE_PRESETS: Record<string, { title: string; description: string; icon: string }> = {
  STUDENT_FAVOURITE: {
    title: "Student Favourite",
    description: "Loved by students for engaging and relatable teaching style",
    icon: "favorite",
  },
  BEST_EXPLAINER: {
    title: "Best Explainer",
    description: "Simplifies complex concepts into crystal-clear lessons",
    icon: "psychology",
  },
  NCERT_EXPERT: {
    title: "NCERT Expert",
    description: "Line-by-line mastery over NCERT curriculum and high-yield topics",
    icon: "menu_book",
  },
  DOUBT_SOLVER: {
    title: "Doubt Solver",
    description: "Dedicated, responsive, and comprehensive doubt resolution",
    icon: "help",
  },
  MOST_FOLLOWED: {
    title: "Most Followed",
    description: "Among the most followed and respected educators on Atomic Pathshala",
    icon: "group",
  },
  TEACHER_OF_THE_MONTH: {
    title: "Teacher of the Month",
    description: "Recognized for outstanding academic contribution and student mentorship",
    icon: "military_tech",
  },
  LEGEND: {
    title: "Legend",
    description: "Years of proven track record producing top medical & engineering ranks",
    icon: "workspace_premium",
  },
};

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const badges = await prisma.teacherBadge.findMany({
      where: { teacherId: params.id },
      orderBy: { assignedAt: "desc" },
    });
    return apiSuccess({ badges, presets: BADGE_PRESETS });
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
    await requirePermission(session.user.id, PERMISSIONS.TEACHER_UPDATE);

    const teacher = await prisma.teacher.findUnique({ where: { id: params.id } });
    if (!teacher) return apiError("Teacher not found", 404);

    const body = await request.json().catch(() => ({}));
    const badgeType = String(body.badgeType || "").trim().toUpperCase();

    if (!badgeType) {
      return apiError("badgeType is required", 400);
    }

    const preset = BADGE_PRESETS[badgeType];
    const title = body.title || preset?.title || badgeType.replace(/_/g, " ");
    const description = body.description || preset?.description || "";
    const icon = body.icon || preset?.icon || "stars";

    const badge = await prisma.teacherBadge.upsert({
      where: {
        teacherId_badgeType: {
          teacherId: teacher.id,
          badgeType,
        },
      },
      create: {
        teacherId: teacher.id,
        badgeType,
        title,
        description,
        icon,
        assignedBy: session.user.id,
      },
      update: {
        title,
        description,
        icon,
        assignedBy: session.user.id,
      },
    });

    return apiSuccess({ badge }, 201);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) throw new UnauthorizedError();
    await requirePermission(session.user.id, PERMISSIONS.TEACHER_UPDATE);

    const { searchParams } = new URL(request.url);
    const badgeType = searchParams.get("badgeType");

    if (!badgeType) {
      return apiError("badgeType query parameter is required", 400);
    }

    await prisma.teacherBadge.deleteMany({
      where: {
        teacherId: params.id,
        badgeType,
      },
    });

    return apiSuccess({ deleted: true });
  } catch (error) {
    return handleApiError(error);
  }
}
