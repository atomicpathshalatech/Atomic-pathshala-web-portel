import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { UnauthorizedError, ForbiddenError } from "@/lib/rbac/guard";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/response";

async function requireStudent(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) throw new UnauthorizedError();
  const student = await prisma.student.findUnique({ where: { userId: session.user.id } });
  if (!student) throw new ForbiddenError("A student profile is required to write a review.");
  return student;
}

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const testimonials = await prisma.teacherTestimonial.findMany({
      where: {
        teacherId: params.id,
        status: "APPROVED",
      },
      orderBy: { createdAt: "desc" },
      include: {
        student: {
          include: {
            user: {
              select: { name: true, photoUrl: true },
            },
          },
        },
      },
      take: 20,
    });

    const items = testimonials.map((t) => ({
      id: t.id,
      rating: t.rating,
      content: t.content,
      createdAt: t.createdAt,
      studentName: t.student?.user?.name || "Student",
      studentPhoto: t.student?.user?.photoUrl || null,
    }));

    return apiSuccess({ testimonials: items });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const student = await requireStudent(request);

    const teacher = await prisma.teacher.findUnique({ where: { id: params.id } });
    if (!teacher) return apiError("Teacher not found", 404);

    const body = await request.json().catch(() => ({}));
    const rating = Math.max(1, Math.min(5, Number(body.rating) || 5));
    const content = typeof body.content === "string" ? body.content.trim() : "";

    if (!content || content.length < 5) {
      return apiError("Please write at least 5 characters in your review.", 400);
    }
    if (content.length > 1000) {
      return apiError("Review comment is too long (maximum 1000 characters).", 400);
    }

    // Upsert or create new review in PENDING status for admin review
    const testimonial = await prisma.teacherTestimonial.create({
      data: {
        teacherId: teacher.id,
        studentId: student.id,
        rating,
        content,
        status: "PENDING",
      },
    });

    return apiSuccess(
      {
        message: "Thank you! Your feedback has been submitted and will appear once approved by our moderation team.",
        id: testimonial.id,
        status: "PENDING",
      },
      201
    );
  } catch (error) {
    return handleApiError(error);
  }
}
