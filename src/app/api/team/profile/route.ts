import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/response";
import { teacherSelfUpdateSchema } from "@/lib/validation/teacher";

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) return apiError("Unauthorized", 401);

    const teacher = await prisma.teacher.findUnique({
      where: { userId: session.user.id },
      include: { user: true },
    });
    if (!teacher) return apiError("No teacher profile for this account", 404);

    return apiSuccess({ teacher });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) return apiError("Unauthorized", 401);

    const existing = await prisma.teacher.findUnique({ where: { userId: session.user.id } });
    if (!existing) return apiError("No teacher profile for this account", 404);

    const data = teacherSelfUpdateSchema.parse(await request.json());

    const teacher = await prisma.teacher.update({
      where: { userId: session.user.id },
      data: { subjects: data.subjects, bio: data.bio || null },
    });

    return apiSuccess({ teacher });
  } catch (error) {
    return handleApiError(error);
  }
}
