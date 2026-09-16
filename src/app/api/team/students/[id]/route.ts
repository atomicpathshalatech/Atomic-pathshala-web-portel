import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { hasPermission } from "@/lib/rbac/guard";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/response";

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) return apiError("Unauthorized", 401);

    const canRead =
      (await hasPermission(session.user.id, PERMISSIONS.STUDENT_READ_ANY)) ||
      (await hasPermission(session.user.id, PERMISSIONS.USER_READ));
    if (!canRead) return apiError("Forbidden", 403);

    const student = await prisma.student.findUnique({
      where: { id: params.id },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
            photoUrl: true,
            status: true,
            createdAt: true,
          },
        },
        batchEnrollments: {
          include: {
            batch: true,
          },
        },
        subscription: true,
        attempts: {
          take: 5,
          orderBy: { startedAt: "desc" },
        },
      },
    });

    if (!student) return apiError("Student not found", 404);

    const allBatches = await prisma.batch.findMany({
      where: { status: "ACTIVE" },
      orderBy: { name: "asc" },
    });

    return apiSuccess({ student, allBatches });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) return apiError("Unauthorized", 401);

    const canUpdate =
      (await hasPermission(session.user.id, PERMISSIONS.STUDENT_UPDATE)) ||
      (await hasPermission(session.user.id, PERMISSIONS.USER_UPDATE)) ||
      (await hasPermission(session.user.id, PERMISSIONS.USER_PROFILE_EDIT));
    if (!canUpdate) return apiError("Forbidden", 403);

    const body = await req.json();

    const student = await prisma.student.findUnique({
      where: { id: params.id },
      include: { user: true },
    });

    if (!student) return apiError("Student not found", 404);

    const userUpdateData: any = {};
    const studentUpdateData: any = {};
    const auditChanges: Record<string, { old: any; new: any }> = {};

    // 1. User Name
    if (body.name !== undefined && body.name.trim() !== "" && body.name.trim() !== student.user.name) {
      userUpdateData.name = body.name.trim();
      auditChanges.name = { old: student.user.name, new: userUpdateData.name };
    }

    // 2. User Email with Uniqueness check
    if (body.email !== undefined) {
      const trimmedEmail = body.email.trim().toLowerCase();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
        return apiError("Enter a valid email address.", 400);
      }
      if (trimmedEmail !== student.user.email.toLowerCase()) {
        const emailTaken = await prisma.user.findFirst({
          where: {
            email: { equals: trimmedEmail, mode: "insensitive" },
            id: { not: student.userId },
          },
          select: { id: true },
        });
        if (emailTaken) {
          return apiError("Email address is already associated with another account.", 409);
        }
        userUpdateData.email = trimmedEmail;
        auditChanges.email = { old: student.user.email, new: trimmedEmail };
      }
    }

    // 3. User Phone with Uniqueness check
    if (body.phone !== undefined) {
      const rawPhone = body.phone ? body.phone.trim() : null;
      const cleanPhone = rawPhone ? rawPhone.replace(/\D/g, "").replace(/^0+/, "").replace(/^91(?=\d{10}$)/, "") : null;
      if (cleanPhone && !/^[6-9]\d{9}$/.test(cleanPhone)) {
        return apiError("Enter a valid 10-digit Indian mobile number.", 400);
      }
      if (cleanPhone !== student.user.phone) {
        if (cleanPhone) {
          const phoneTaken = await prisma.user.findFirst({
            where: {
              phone: cleanPhone,
              id: { not: student.userId },
            },
            select: { id: true },
          });
          if (phoneTaken) {
            return apiError("Mobile number is already associated with another account.", 409);
          }
        }
        userUpdateData.phone = cleanPhone;
        auditChanges.phone = { old: student.user.phone, new: cleanPhone };
      }
    }

    // 4. User Photo URL
    if (body.photoUrl !== undefined && body.photoUrl !== student.user.photoUrl) {
      userUpdateData.photoUrl = body.photoUrl || null;
      auditChanges.photoUrl = { old: student.user.photoUrl, new: userUpdateData.photoUrl };
    }

    // 5. User Account Status
    if (body.status !== undefined && body.status !== student.user.status) {
      userUpdateData.status = body.status;
      auditChanges.userStatus = { old: student.user.status, new: body.status };
    }

    // 6. Student Academic Status
    if (body.academicStatus !== undefined && body.academicStatus !== student.status) {
      studentUpdateData.status = body.academicStatus;
      auditChanges.academicStatus = { old: student.status, new: body.academicStatus };
    }

    // 7. Student Class
    const targetClass = body.class !== undefined ? body.class : body.targetClass;
    if (targetClass !== undefined && targetClass !== student.class) {
      studentUpdateData.class = targetClass;
      auditChanges.class = { old: student.class, new: targetClass };
    }

    // 8. Student Target Exam
    if (body.targetExam !== undefined && body.targetExam !== student.targetExam) {
      studentUpdateData.targetExam = body.targetExam;
      auditChanges.targetExam = { old: student.targetExam, new: body.targetExam };
    }

    // 9. Parent details & demographics
    if (body.fatherName !== undefined && body.fatherName !== student.fatherName) {
      studentUpdateData.fatherName = body.fatherName;
      auditChanges.fatherName = { old: student.fatherName, new: body.fatherName };
    }
    if (body.motherName !== undefined && body.motherName !== student.motherName) {
      studentUpdateData.motherName = body.motherName;
      auditChanges.motherName = { old: student.motherName, new: body.motherName };
    }
    if (body.dob !== undefined) {
      const parsedDob = body.dob ? new Date(body.dob) : student.dob;
      studentUpdateData.dob = parsedDob;
      auditChanges.dob = { old: student.dob, new: parsedDob };
    }
    if (body.gender !== undefined && body.gender !== student.gender) {
      studentUpdateData.gender = body.gender;
      auditChanges.gender = { old: student.gender, new: body.gender };
    }
    if (body.school !== undefined && body.school !== student.school) {
      studentUpdateData.school = body.school;
      auditChanges.school = { old: student.school, new: body.school };
    }
    if (body.city !== undefined && body.city !== student.city) {
      studentUpdateData.city = body.city;
      auditChanges.city = { old: student.city, new: body.city };
    }
    if (body.state !== undefined && body.state !== student.state) {
      studentUpdateData.state = body.state;
      auditChanges.state = { old: student.state, new: body.state };
    }
    if (body.address !== undefined && body.address !== student.address) {
      studentUpdateData.address = body.address || null;
      auditChanges.address = { old: student.address, new: body.address || null };
    }
    if (body.bloodGroup !== undefined && body.bloodGroup !== student.bloodGroup) {
      studentUpdateData.bloodGroup = body.bloodGroup || null;
      auditChanges.bloodGroup = { old: student.bloodGroup, new: body.bloodGroup || null };
    }
    if (body.emergencyContact !== undefined && body.emergencyContact !== student.emergencyContact) {
      studentUpdateData.emergencyContact = body.emergencyContact || null;
      auditChanges.emergencyContact = { old: student.emergencyContact, new: body.emergencyContact || null };
    }
    if (body.board !== undefined && body.board !== student.board) {
      studentUpdateData.board = body.board || null;
      auditChanges.board = { old: student.board, new: body.board || null };
    }

    const updated = await prisma.$transaction(async (tx) => {
      if (Object.keys(userUpdateData).length > 0) {
        await tx.user.update({
          where: { id: student.userId },
          data: userUpdateData,
        });
      }

      return tx.student.update({
        where: { id: params.id },
        data: studentUpdateData,
        include: {
          user: true,
          batchEnrollments: { include: { batch: true } },
        },
      });
    });

    if (Object.keys(auditChanges).length > 0) {
      await prisma.auditLog.create({
        data: {
          userId: session.user.id,
          action: "STUDENT_PROFILE_UPDATE",
          entityType: "Student",
          entityId: student.id,
          metadata: {
            targetUserId: student.userId,
            targetUserName: student.user.name,
            changedFields: Object.keys(auditChanges),
            changes: auditChanges,
          },
        },
      });
    }

    return apiSuccess(updated);
  } catch (error) {
    return handleApiError(error);
  }
}
