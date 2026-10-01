import type { Metadata } from "next";
import Link from "next/link";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getActiveBatchCatalog } from "@/lib/courses/catalog";
import { CourseData } from "@/components/course-platform/CourseCard";

export const metadata: Metadata = {
  title: "My Batches — Atomic Pathshala",
  description: "Access your active enrolled batches, live lectures, and study resources.",
};

export default async function CoursesPage() {
  let dbBatches: any[] = [];
  try {
    dbBatches = await getActiveBatchCatalog();
  } catch (err) {
    console.error("Error fetching batches:", err);
  }

  // Check logged-in user's active batch enrollments & subscription
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
    console.error("Error checking student enrollment status:", err);
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

  const enrolledCourses = allCourses.filter((c) => c.isEnrolled);

  return (
    <div className="max-w-5xl mx-auto py-4 sm:py-6 space-y-5">
      <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight">My Batches</h1>

      {enrolledCourses.length === 0 ? (
        <div className="p-12 text-center bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 space-y-4 shadow-xs max-w-lg mx-auto">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-emerald-500/10 to-teal-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mx-auto border border-emerald-500/20">
            <span className="material-symbols-outlined text-3xl">school</span>
          </div>
          <div>
            <h2 className="text-base font-bold text-slate-900 dark:text-white">
              You are not enrolled in any batches yet
            </h2>
            <p className="text-xs text-slate-500 mt-1">
              Explore our Store to find the right batch for NEET, JEE, or Board preparation.
            </p>
          </div>
          <Link
            href="/store"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-700 hover:from-emerald-700 hover:to-teal-800 text-white font-bold text-xs shadow-md transition"
          >
            <span className="material-symbols-outlined text-base">storefront</span>
            <span>Browse Store Catalog</span>
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {enrolledCourses.map((c) => (
            <Link
              key={c.id}
              href={`/courses/${c.slug}`}
              className="group rounded-3xl overflow-hidden bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:shadow-lg transition-shadow"
            >
              {/* The batch's own thumbnail, nothing drawn on top of it */}
              <div className="aspect-[16/9] bg-slate-100 dark:bg-slate-800">
                {c.thumbnailUrl ? (
                  <img src={c.thumbnailUrl} alt={c.title} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-4xl font-black text-slate-400">{c.title.charAt(0)}</div>
                )}
              </div>
              <div className="p-3.5 flex items-center justify-between gap-3">
                <span className="font-black text-sm sm:text-base text-slate-900 dark:text-white line-clamp-2">{c.title}</span>
                <span className="shrink-0 px-3 py-1.5 rounded-xl bg-blue-600 group-hover:bg-blue-700 text-white text-xs font-bold">Open</span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}