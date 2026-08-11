import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { doubtCreateSchema } from "@/lib/validation/doubt";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/response";

async function getStudentOrThrow(userId: string) {
  const student = await prisma.student.findUnique({ where: { userId } });
  if (!student) throw new Error("No student record for this account");
  return student;
}

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) return apiError("Unauthorized", 401);

    const student = await getStudentOrThrow(session.user.id);
    const doubts = await prisma.doubt.findMany({
      where: { studentId: student.id },
      orderBy: { createdAt: "desc" },
    });

    return apiSuccess({ doubts });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) return apiError("Unauthorized", 401);

    const student = await getStudentOrThrow(session.user.id);
    const data = doubtCreateSchema.parse(await request.json());

    const doubt = await prisma.doubt.create({
      data: {
        studentId: student.id,
        subject: data.subject,
        body: data.body,
      },
    });

    return apiSuccess({ doubt }, 201);
  } catch (error) {
    return handleApiError(error);
  }
}
