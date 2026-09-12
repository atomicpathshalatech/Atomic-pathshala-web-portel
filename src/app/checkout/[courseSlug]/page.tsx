import type { Metadata } from "next";
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
        batch={realBatch}
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
