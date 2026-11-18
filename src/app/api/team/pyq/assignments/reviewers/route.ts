import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { apiSuccess, handleApiError } from "@/lib/api/response";
import { requireTeam } from "@/lib/pyq/api";

const NON_TEAM = ["STUDENT", "PARENT", "GUEST"];

/**
 * GET /api/team/pyq/assignments/reviewers
 * Returns all active team members (Super Admin, Admins, SMEs, Teachers)
 * with their real-time question review performance statistics.
 */
export async function GET() {
  try {
    await requireTeam(PERMISSIONS.QUESTION_READ);

    // Fetch all eligible team members
    const teamUsers = await prisma.user.findMany({
      where: {
        role: { name: { notIn: NON_TEAM } },
        status: "ACTIVE",
      },
      select: {
        id: true,
        name: true,
        email: true,
        photoUrl: true,
        position: true,
        role: { select: { name: true, label: true } },
      },
      orderBy: { name: "asc" },
    });

    // Fetch review performance metrics for each reviewer from PyqAssignmentQuestion & Question
    const userStats = await Promise.all(
      teamUsers.map(async (u) => {
        const [assignedQuestions, inReviewQuestions, verifiedQuestions, correctionsCount] =
          await Promise.all([
            prisma.question.count({
              where: { assignedToId: u.id, pyqVerificationStatus: "ASSIGNED" },
            }),
            prisma.question.count({
              where: { assignedToId: u.id, pyqVerificationStatus: "IN_REVIEW" },
            }),
            prisma.question.count({
              where: {
                OR: [
                  { pyqVerifiedById: u.id },
                  { assignedToId: u.id, pyqVerificationStatus: "VERIFIED" },
                ],
              },
            }),
            prisma.question.count({
              where: { assignedToId: u.id, pyqVerificationStatus: "NEEDS_CORRECTION" },
            }),
          ]);

        const totalAssigned = assignedQuestions + inReviewQuestions + verifiedQuestions + correctionsCount;

        return {
          id: u.id,
          name: u.name || u.email,
          email: u.email,
          photoUrl: u.photoUrl,
          position: u.position,
          role: u.role?.label || u.role?.name || "Staff",
          roleCode: u.role?.name || "STAFF",
          totalAssigned,
          pendingCount: assignedQuestions,
          inProgressCount: inReviewQuestions,
          verifiedCount: verifiedQuestions,
          correctionsCount: correctionsCount,
        };
      })
    );

    return apiSuccess({ reviewers: userStats });
  } catch (error) {
    return handleApiError(error);
  }
}
