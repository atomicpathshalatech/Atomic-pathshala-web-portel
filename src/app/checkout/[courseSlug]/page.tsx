import type { Metadata } from "next";
import Link from "next/link";
import { requireStudentSession } from "@/lib/auth/session";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { CheckoutView } from "@/components/course-platform/CheckoutView";
import { RealBatchCheckoutView } from "@/components/course-platform/RealBatchCheckoutView";
import { SAMPLE_COURSES } from "@/components/course-platform/sample-courses";

export const metadata: Metadata = {
  title: "Secure Checkout — Atomic Pathshala",
};

export default async function CheckoutPage({ params }: { params: { courseSlug: string } }) {
  // A real Batch takes priority over the sample/demo catalog — this is the
  // actual product, and checkout for it must go through the real,
  // server-verified payment flow (see RealBatchCheckoutView), never the
  // old CheckoutView, which faked success with a setTimeout and never
  // touched a BatchEnrollment.
  const realBatch = await prisma.batch.findFirst({
    where: { OR: [{ id: params.courseSlug }, { code: params.courseSlug }] },
    select: { id: true, name: true, price: true, originalPrice: true, thumbnailUrl: true, description: true },
  });

  if (realBatch) {
    if (realBatch.price == null) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-[#f9f9ff] px-4 text-center">
          <div className="max-w-md space-y-3">
            <h1 className="text-lg font-black text-[#031635]">This batch isn&apos;t available for individual purchase yet</h1>
            <p className="text-sm text-slate-500">
              Please contact admissions for enrollment options, or check back soon.
            </p>
          </div>
        </div>
      );
    }

    const { student } = await requireStudentSession();

    // Check if student already has active access (Admin grant, paid enrollment, or subscription)
    const { resolveBatchAccess } = await import("@/lib/batch/entitlement");
    const access = await resolveBatchAccess(student.userId, realBatch.id);
    const hasActiveAccess =
      access.status === "ACTIVE_ENROLLMENT" ||
      access.status === "ACTIVE_SUBSCRIPTION" ||
      access.status === "ADMIN_GRANTED";

    if (hasActiveAccess) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-[#f9f9ff] px-4 text-center py-12">
          <div className="max-w-md w-full bg-white border border-emerald-200/90 rounded-3xl p-6 sm:p-8 shadow-xl shadow-emerald-500/5 space-y-5">
            <div className="w-14 h-14 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto shadow-2xs">
              <span className="material-symbols-outlined text-3xl">verified</span>
            </div>
            <div className="space-y-2">
              <span className="bg-emerald-100 text-emerald-800 text-[10px] font-extrabold uppercase px-2.5 py-1 rounded-full">
                Active Enrollment
              </span>
              <h1 className="text-xl font-black text-[#031635]">{realBatch.name}</h1>
              <p className="text-xs text-slate-500 leading-relaxed">
                You already have active access to this batch. You do not need to purchase it again.
              </p>
            </div>
            <div className="pt-2 flex flex-col gap-2.5">
              <Link
                href={`/courses/${realBatch.id}`}
                className="w-full py-3 px-4 rounded-xl bg-[#6b46c1] hover:bg-[#5b3da5] text-white font-bold text-xs shadow-md transition flex items-center justify-center gap-2"
              >
                <span>Continue Learning</span>
                <span className="material-symbols-outlined text-base">arrow_forward</span>
              </Link>
              <Link
                href="/courses"
                className="w-full py-2.5 px-4 rounded-xl border border-slate-200 text-slate-600 font-bold text-xs hover:bg-slate-50 transition text-center"
              >
                Explore Other Batches
              </Link>
            </div>
          </div>
        </div>
      );
    }

    const sellableBatch = {
      id: realBatch.id,
      name: realBatch.name,
      price: realBatch.price,
      originalPrice: realBatch.originalPrice,
      thumbnailUrl: realBatch.thumbnailUrl,
      description: realBatch.description,
    };

    // CRM signal: arriving at real-batch checkout is a real payment intent.
    try {
      const { recordActivity, syncCategoryToOutreach } = await import("@/lib/crm/lead-category");
      const category = await recordActivity({
        studentId: student.id,
        type: "PAYMENT_INTENT",
        batchId: realBatch.id,
      });
      await syncCategoryToOutreach(student.id, category);
    } catch (err) {
      console.error("Activity tracking error (batch checkout intent):", err);
    }

    return (
      <RealBatchCheckoutView
        batch={sellableBatch}
        studentName={student.user.name ?? "Student"}
        studentEmail={student.user.email ?? ""}
      />
    );
  }

  // No matching real Batch — fall back to the sample/demo catalog. This is
  // legacy marketing/demo content, disconnected from real Batch data by
  // design (see sample-courses.ts) — no real payment exists to run here.
  const found =
    SAMPLE_COURSES.find((c) => c.slug === params.courseSlug || c.id === params.courseSlug) ??
    SAMPLE_COURSES[0]!;

  try {
    const session = await getServerSession(authOptions);
    if (session?.user?.id) {
      const student = await prisma.student.findUnique({
        where: { userId: session.user.id },
        select: { id: true },
      });
      if (student) {
        const { recordActivity, syncCategoryToOutreach } = await import("@/lib/crm/lead-category");
        const category = await recordActivity({ studentId: student.id, type: "PAYMENT_INTENT" });
        await syncCategoryToOutreach(student.id, category);
      }
    }
  } catch (err) {
    console.error("Activity tracking error (demo checkout intent):", err);
  }

  return <CheckoutView course={found} />;
}
