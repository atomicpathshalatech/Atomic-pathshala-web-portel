import { NextRequest } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db";
import { studentRegistrationSchema } from "@/lib/validation/student";
import { apiSuccess, handleApiError } from "@/lib/api/response";
import { generateEnrollmentNumber, generateStudentIdCode } from "@/lib/utils/id-generator";
import { verifyLeadInviteToken } from "@/lib/integrations/lead-invite";
import { notifyOutreachConversion } from "@/lib/integrations/outreach-webhook";

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

    // An invite token (present only when this registration came from the
    // outreach CRM's "Convert to LMS" link) carries a signed batchId to
    // auto-enroll into. An invalid/expired token doesn't block signup —
    // the person still gets a real account, they just don't get the
    // automatic enrollment and a team member can enroll them manually.
    const invitePayload = input.inviteToken ? verifyLeadInviteToken(input.inviteToken) : null;

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

      let enrolledBatchId: string | null = null;
      if (invitePayload) {
        const batch = await tx.batch.findUnique({ where: { id: invitePayload.batchId } });
        if (batch) {
          await tx.batchEnrollment.create({
            data: { batchId: batch.id, studentId: student.id, status: "ACTIVE" },
          });
          enrolledBatchId = batch.id;
        }
      }

      await tx.auditLog.create({
        data: {
          userId: user.id,
          action: "STUDENT_REGISTERED",
          entityType: "Student",
          entityId: student.id,
          metadata: {
            enrollmentNumber,
            studentIdCode,
            source: invitePayload ? "CRM_LEAD" : "SELF_REGISTER",
            ...(invitePayload
              ? {
                  invitedBatchId: invitePayload.batchId,
                  enrolledBatchId,
                  counselorNotes: invitePayload.counselorNotes ?? null,
                }
              : {}),
          },
        },
      });

      return { user, student };
    });

    // Best-effort: tell the outreach CRM this lead actually finished
    // registering, so it can mark the Lead truly CONVERTED. Fire-and-forget
    // — never lets a slow/offline CRM affect the registration response.
    if (invitePayload) {
      notifyOutreachConversion(created.user.email, created.student.enrollmentNumber).catch((error) => {
        console.error("[outreach_webhook_error]", error);
      });
    }

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
