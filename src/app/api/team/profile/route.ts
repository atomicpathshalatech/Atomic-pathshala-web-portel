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

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      include: {
        role: { select: { name: true, label: true } },
        teacher: true,
      },
    });
    if (!user) return apiError("User not found", 404);

    return apiSuccess({ user, teacher: user.teacher });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) return apiError("Unauthorized", 401);

    const currentUser = await prisma.user.findUnique({
      where: { id: session.user.id },
      include: { teacher: true, role: true },
    });
    if (!currentUser) return apiError("User not found", 404);

    const body = await request.json();
    const userUpdateData: any = {};
    const auditChanges: Record<string, { old: any; new: any }> = {};

    // 1. Name
    if (body.name !== undefined && body.name.trim() !== "" && body.name.trim() !== currentUser.name) {
      userUpdateData.name = body.name.trim();
      auditChanges.name = { old: currentUser.name, new: userUpdateData.name };
    }

    // 2. Email with uniqueness
    if (body.email !== undefined) {
      const trimmedEmail = body.email.trim().toLowerCase();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
        return apiError("Enter a valid email address.", 400);
      }
      if (trimmedEmail !== currentUser.email.toLowerCase()) {
        const emailTaken = await prisma.user.findFirst({
          where: {
            email: { equals: trimmedEmail, mode: "insensitive" },
            id: { not: session.user.id },
          },
          select: { id: true },
        });
        if (emailTaken) {
          return apiError("Email address is already associated with another account.", 409);
        }
        userUpdateData.email = trimmedEmail;
        auditChanges.email = { old: currentUser.email, new: trimmedEmail };
      }
    }

    // 3. Phone with uniqueness
    if (body.phone !== undefined) {
      const rawPhone = body.phone ? body.phone.trim() : null;
      const cleanPhone = rawPhone ? rawPhone.replace(/\D/g, "").replace(/^0+/, "").replace(/^91(?=\d{10}$)/, "") : null;
      if (cleanPhone && !/^[6-9]\d{9}$/.test(cleanPhone)) {
        return apiError("Enter a valid 10-digit Indian mobile number.", 400);
      }
      if (cleanPhone !== currentUser.phone) {
        if (cleanPhone) {
          const phoneTaken = await prisma.user.findFirst({
            where: {
              phone: cleanPhone,
              id: { not: session.user.id },
            },
            select: { id: true },
          });
          if (phoneTaken) {
            return apiError("Mobile number is already associated with another account.", 409);
          }
        }
        userUpdateData.phone = cleanPhone;
        auditChanges.phone = { old: currentUser.phone, new: cleanPhone };
      }
    }

    // 4. Photo URL
    if (body.photoUrl !== undefined && body.photoUrl !== currentUser.photoUrl) {
      userUpdateData.photoUrl = body.photoUrl || null;
      auditChanges.photoUrl = { old: currentUser.photoUrl, new: userUpdateData.photoUrl };
    }

    // 5. If user has teacher profile, update teacher fields too
    const teacherUpdateData: any = {};
    if (currentUser.teacher) {
      if (body.displayName !== undefined) teacherUpdateData.displayName = body.displayName || null;
      if (Array.isArray(body.subjects)) teacherUpdateData.subjects = body.subjects;
      if (Array.isArray(body.targetExams)) teacherUpdateData.targetExams = body.targetExams;
      if (Array.isArray(body.classes)) teacherUpdateData.classes = body.classes;
      if (Array.isArray(body.languages)) teacherUpdateData.languages = body.languages;
      if (body.experienceYears !== undefined) teacherUpdateData.experienceYears = body.experienceYears || null;
      if (body.qualifications !== undefined) teacherUpdateData.qualifications = body.qualifications;
      if (body.experienceList !== undefined) teacherUpdateData.experienceList = body.experienceList;
      if (body.bio !== undefined) teacherUpdateData.bio = body.bio || null;
      if (body.dob !== undefined) teacherUpdateData.dob = body.dob ? new Date(body.dob) : null;
    }

    const updatedUser = await prisma.$transaction(async (tx) => {
      if (Object.keys(userUpdateData).length > 0) {
        await tx.user.update({
          where: { id: session.user.id },
          data: userUpdateData,
        });
      }

      if (currentUser.teacher && Object.keys(teacherUpdateData).length > 0) {
        await tx.teacher.update({
          where: { userId: session.user.id },
          data: teacherUpdateData,
        });
      }

      return tx.user.findUnique({
        where: { id: session.user.id },
        include: {
          role: { select: { name: true, label: true } },
          teacher: true,
        },
      });
    });

    if (Object.keys(auditChanges).length > 0) {
      await prisma.auditLog.create({
        data: {
          userId: session.user.id,
          action: "SELF_PROFILE_UPDATE",
          entityType: "User",
          entityId: session.user.id,
          metadata: {
            changedFields: Object.keys(auditChanges),
            changes: auditChanges,
          },
        },
      });
    }

    return apiSuccess({ user: updatedUser, teacher: updatedUser?.teacher });
  } catch (error) {
    return handleApiError(error);
  }
}
