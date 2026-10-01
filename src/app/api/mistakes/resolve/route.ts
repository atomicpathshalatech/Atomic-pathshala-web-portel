import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { apiError, apiSuccess, handleApiError } from "@/lib/api/response";

const KEY = /^(test|guru|ncert):[A-Za-z0-9_-]{1,120}$/;

/**
 * Mistake Book: mark a question as understood ("Solved") or move it back.
 * Body: { key: "test:<questionId>" | "guru:<questionId>" | "ncert:<questionId>", solved: boolean }
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) return apiError("Please log in.", 401);
    const student = await prisma.student.findUnique({ where: { userId: session.user.id }, select: { id: true } });
    if (!student) return apiError("Only students have a Mistake Book.", 403);

    const body = await request.json().catch(() => ({}));
    const key = typeof body.key === "string" ? body.key.trim() : "";
    if (!KEY.test(key)) return apiError("Invalid question.", 400);
    const solved = body.solved !== false;

    if (solved) {
      await prisma.mistakeResolution.upsert({
        where: { studentId_key: { studentId: student.id, key } },
        update: {},
        create: { studentId: student.id, key },
      });
    } else {
      await prisma.mistakeResolution.deleteMany({ where: { studentId: student.id, key } });
    }
    return apiSuccess({ key, solved });
  } catch (error) {
    return handleApiError(error);
  }
}
