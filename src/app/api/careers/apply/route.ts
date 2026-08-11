import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { teacherApplicationSchema } from "@/lib/validation/teacher";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/response";

export async function POST(request: NextRequest) {
  try {
    const data = teacherApplicationSchema.parse(await request.json());

    const existing = await prisma.teacherApplication.findUnique({
      where: { email: data.email.toLowerCase() },
      select: { id: true },
    });
    if (existing) {
      return apiError("An application with this email already exists.", 409);
    }

    const application = await prisma.teacherApplication.create({
      data: {
        fullName: data.fullName,
        email: data.email.toLowerCase(),
        phone: data.phone || null,
        subject: data.subject,
        experienceYears: data.experienceYears,
        bio: data.bio || null,
        resumeUrl: data.resumeUrl || null,
        portfolioUrl: data.portfolioUrl || null,
      },
    });

    return apiSuccess({ applicationId: application.id }, 201);
  } catch (error) {
    return handleApiError(error);
  }
}
