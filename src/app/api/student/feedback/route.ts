import { NextRequest } from "next/server";
import { z } from "zod";
import { requireStudentSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/response";

export const dynamic = "force-dynamic";

const schema = z.object({
  quote: z.string().trim().min(5, "Please write at least a short feedback (min 5 characters).").max(1000),
  rating: z.number().int().min(1).max(5).default(5),
  studentClass: z.string().trim().optional(),
  targetExam: z.string().trim().optional(),
});

export async function POST(req: NextRequest) {
  try {
    const { student } = await requireStudentSession();
    const data = schema.parse(await req.json());

    const studentName = student.user.name || "Atomic Student";
    const photoUrl = student.user.photoUrl || null;
    const targetExam = data.targetExam || student.targetExam || "NEET";
    const studentClass = data.studentClass || (student as any).class || "Class 12 / Dropper";

    const testimonial = await prisma.testimonial.create({
      data: {
        studentName,
        photoUrl,
        studentClass,
        targetExam,
        quote: data.quote,
        rating: data.rating,
        isApproved: true, // Visible on student home
        createdById: student.user.id,
      },
    });

    return apiSuccess({ testimonial, message: "Thank you for sharing your feedback!" });
  } catch (error) {
    return handleApiError(error);
  }
}
