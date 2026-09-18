import type { Metadata } from "next";
import Link from "next/link";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getActiveBatchCatalog } from "@/lib/courses/catalog";
import { CourseListingMasterView } from "@/components/course-platform/CourseListingMasterView";
import { CourseData } from "@/components/course-platform/CourseCard";

export const metadata: Metadata = {
  title: "Store — Atomic Pathshala",
  description: "Browse and enroll in NEET, JEE, and Board courses engineered for exam success.",
};

export default async function StorePage() {
  let dbBatches: any[] = [];
  try {
    dbBatches = await getActiveBatchCatalog();
  } catch (err) {
    console.error("Error fetching store batches:", err);
  }

  let activeBatchIds = new Set<string>();
  let hasUniversalAccess = false;

  try {
    const session = await getServerSession(authOptions);
    if (session?.user?.id) {
      const { hasPermission } = await import("@/lib/rbac/guard");
      const { PERMISSIONS } = await import("@/lib/rbac/permissions");
      const canManage = await hasPermission(session.user.id, PERMISSIONS.BATCH_UPDATE);
      if (canManage) {
        hasUniversalAccess = true;
      }

      const student = await prisma.student.findUnique({
        where: { userId: session.user.id },
        select: { id: true },
      });

      if (student) {
        const enrollments = await prisma.batchEnrollment.findMany({
          where: { studentId: student.id, status: "ACTIVE" },
          select: { batchId: true },
        });
        for (const e of enrollments) {
          activeBatchIds.add(e.batchId);
        }

        const { hasActiveSubscription } = await import("@/lib/subscription/guard");
        if (await hasActiveSubscription(student.id)) {
          hasUniversalAccess = true;
        }
      }
    }
  } catch (err) {
    console.error("Error checking student enrollment status in store:", err);
  }

  const allCourses: CourseData[] = dbBatches.map((batch) => {
    const educatorsStr =
      batch.teachers?.map((t: any) => t.teacher?.user?.name).filter(Boolean).join(" & ") ||
      "Atomic Faculty";

    const subjectTitle =
      batch.course?.subjects?.[0]?.title || "Comprehensive";

    const isEnrolled = hasUniversalAccess || activeBatchIds.has(batch.id);

    const price = batch.price ?? 4999;
    const originalPrice = batch.originalPrice ?? 5999;
    const discount =
      originalPrice > price ? Math.round(((originalPrice - price) / originalPrice) * 100) : 15;

    return {
      id: batch.id,
      slug: batch.id,
      title: batch.name,
      subtitle: batch.course?.description || "Structured batch with live interactive classes and study materials.",
      exam: batch.targetExam || "NEET",
      examYear: "",
      subject: subjectTitle,
      courseType: "Batch",
      language: "English / Hindi",
      educators: educatorsStr,
      duration: "Full Academic Year",
      classesCount: batch._count?.schedules || 0,
      testsCount: 0,
      studentsCount: batch._count?.enrollments || 0,
      price,
      originalPrice,
      discountPercentage: discount,
      isNewBatch: true,
      thumbnailUrl: batch.thumbnailUrl ?? null,
      isEnrolled,
    };
  });

  // Enrolled batches must NEVER show as purchase items in Store
  const storeCourses = allCourses.filter((c) => !c.isEnrolled);

  return (
    <div className="max-w-7xl mx-auto py-4 sm:py-6 space-y-6">
      <div>
        <div className="flex items-center gap-2.5 mb-2">
          <Link
            href="/dashboard"
            className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 flex items-center justify-center text-slate-600 dark:text-slate-300 transition"
          >
            <span className="material-symbols-outlined text-lg">arrow_back</span>
          </Link>
          <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Back</span>
        </div>

        <div>
          <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight">
            Batch Store
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Explore and enroll in top-rated batches engineered for your target exam.
          </p>
        </div>
      </div>

      <CourseListingMasterView courses={storeCourses} />
    </div>
  );
}
