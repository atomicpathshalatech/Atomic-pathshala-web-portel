import { NextRequest } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db";
import { studentRegistrationSchema } from "@/lib/validation/student";
import { apiSuccess, handleApiError } from "@/lib/api/response";
import { generateEnrollmentNumber, generateStudentIdCode } from "@/lib/utils/id-generator";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const json = await req.json();
    const input = studentRegistrationSchema.parse(json);

    const existing = await prisma.user.findFirst({
      where: { OR: [{ email: input.email.toLowerCase() }, { phone: input.mobile }] },
      select: { id: true },
    });
    if (existing) {
      return handleApiError(
        new Error("An account with this email or mobile number already exists.")
      );
    }

    const passwordHash = await bcrypt.hash(input.password, 12);
    const securityAnswerHash = input.securityAnswer
      ? await bcrypt.hash(input.securityAnswer, 12)
      : undefined;

    const studentRole = await prisma.role.findUnique({ where: { name: "STUDENT" } });
    if (!studentRole) {
      throw new Error("STUDENT role is not seeded. Run `npm run db:seed` first.");
    }

    const enrollmentNumber = generateEnrollmentNumber();
    const studentIdCode = generateStudentIdCode();

    const created = await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          email: input.email.toLowerCase(),
          phone: input.mobile,
          passwordHash,
          name: input.fullName,
          photoUrl: input.photoUrl,
          roleId: studentRole.id,
          securityQuestion: input.securityQuestion,
          securityAnswerHash,
          status: "ACTIVE",
        },
      });

      const student = await tx.student.create({
        data: {
          userId: user.id,
          enrollmentNumber,
          studentIdCode,
          fatherName: input.fatherName,
          motherName: input.motherName,
          dob: input.dob,
          gender: input.gender,
          class: input.class,
          targetExam: input.targetExam,
          school: input.school,
          city: input.city,
          state: input.state,
          address: input.address,
          bloodGroup: input.bloodGroup,
          emergencyContact: input.emergencyContact,
        },
      });

      await tx.auditLog.create({
        data: {
          userId: user.id,
          action: "STUDENT_REGISTERED",
          entityType: "Student",
          entityId: student.id,
          metadata: { enrollmentNumber, studentIdCode },
        },
      });

      return { user, student };
    });

    return apiSuccess(
      {
        userId: created.user.id,
        studentId: created.student.id,
        enrollmentNumber: created.student.enrollmentNumber,
        studentIdCode: created.student.studentIdCode,
      },
      201
    );
  } catch (error) {
    return handleApiError(error);
  }
}
