import { NextRequest } from "next/server";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db";
import { studentRegistrationSchema } from "@/lib/validation/student";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/response";
import { generateEnrollmentNumber, generateStudentIdCode } from "@/lib/utils/id-generator";
import { verifyLeadInviteToken } from "@/lib/integrations/lead-invite";
import { notifyOutreachConversion } from "@/lib/integrations/outreach-webhook";
import { PHONE_RE, normalisePhone, consumeVerifyToken } from "@/lib/otp";

export const runtime = "nodejs";

// Simplified, phone-OTP-verified student sign-up. Only these fields — the
// rest of the student profile is collected later. `verifyToken` comes from
// POST /api/auth/otp/verify and proves the phone was OTP-verified.
const otpRegisterSchema = z.object({
  phone: z.string().trim(),
  verifyToken: z.string().trim().min(20),
  name: z.string().trim().min(2).max(120),
  email: z.string().trim().email().toLowerCase(),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .regex(/[A-Z]/, "Password must contain an uppercase letter")
    .regex(/[0-9]/, "Password must contain a number"),
});

export async function POST(req: NextRequest) {
  try {
    const json = await req.json();

    // ---- Phone-OTP path (new, simplified) ------------------------------
    if (json && typeof json === "object" && "verifyToken" in json) {
      return await registerViaOtp(otpRegisterSchema.parse(json));
    }

    // ---- Legacy full-form path (kept for back-compat) -----------------
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

/**
 * Simplified sign-up: phone (OTP-verified) + name + email + password.
 * - Never creates a second user for an existing phone.
 * - Rejects an email that already belongs to another account.
 * - Always the STUDENT role — this path can never mint a staff account.
 */
async function registerViaOtp(input: z.infer<typeof otpRegisterSchema>) {
  const phone = normalisePhone(input.phone);
  if (!PHONE_RE.test(phone)) return apiError("Invalid mobile number.", 422);

  const check = await consumeVerifyToken(phone, "STUDENT_SIGNUP", input.verifyToken);
  if (!check.ok) return apiError(check.reason, 400, { code: "OTP_NOT_VERIFIED" });

  const byPhone = await prisma.user.findUnique({ where: { phone }, select: { id: true } });
  if (byPhone) {
    return apiError("An account already exists for this number. Please sign in.", 409, {
      code: "PHONE_EXISTS",
    });
  }
  const byEmail = await prisma.user.findUnique({ where: { email: input.email }, select: { id: true } });
  if (byEmail) {
    return apiError("That email is already used by another account. Use a different email.", 409, {
      code: "EMAIL_EXISTS",
    });
  }

  const studentRole = await prisma.role.findUnique({ where: { name: "STUDENT" } });
  if (!studentRole) throw new Error("STUDENT role is not seeded. Run `npm run db:seed` first.");

  const passwordHash = await bcrypt.hash(input.password, 12);
  const enrollmentNumber = generateEnrollmentNumber();
  const studentIdCode = generateStudentIdCode();

  const created = await prisma.$transaction(async (tx) => {
    const user = await tx.user.create({
      data: {
        email: input.email,
        phone,
        passwordHash,
        name: input.name,
        roleId: studentRole.id,
        status: "ACTIVE",
      },
    });
    // Minimal student shell — parents' names / DOB / class / exam / school /
    // city / state are collected later from the profile page. Placeholders
    // match the auto-create fallback in requireStudentSession().
    const student = await tx.student.create({
      data: {
        userId: user.id,
        enrollmentNumber,
        studentIdCode,
        fatherName: "—",
        motherName: "—",
        dob: new Date(2007, 0, 1),
        gender: "OTHER",
        class: "",
        targetExam: "",
        school: "",
        city: "",
        state: "",
      },
    });
    await tx.auditLog.create({
      data: {
        userId: user.id,
        action: "STUDENT_REGISTERED",
        entityType: "Student",
        entityId: student.id,
        metadata: { enrollmentNumber, studentIdCode, source: "OTP_SIGNUP" },
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
}
