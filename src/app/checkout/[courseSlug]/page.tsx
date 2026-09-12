import type { Metadata } from "next";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { CheckoutView } from "@/components/course-platform/CheckoutView";
import { SAMPLE_COURSES } from "@/components/course-platform/sample-courses";

export const metadata: Metadata = {
  title: "Secure Checkout — Atomic Pathshala",
};

export default async function CheckoutPage({ params }: { params: { courseSlug: string } }) {
  const found =
    SAMPLE_COURSES.find(
      (c) => c.slug === params.courseSlug || c.id === params.courseSlug
    ) ?? SAMPLE_COURSES[0]!;

  // CRM signal: arriving at checkout is a real "clicked Enroll/Buy" payment
  // intent (see src/lib/crm/lead-category.ts), independent of whether the
  // checkout below actually completes. batchId is best-effort — this
  // catalog is a separate mock store from the real Batch table, so a slug
  // that happens to match a real batch's code gets attributed to it, and
  // one that doesn't just records the intent without a batch link.
  try {
    const session = await getServerSession(authOptions);
    if (session?.user?.id) {
      const student = await prisma.student.findUnique({
        where: { userId: session.user.id },
        select: { id: true },
      });
      if (student) {
        const matchingBatch = await prisma.batch.findFirst({
          where: { code: params.courseSlug },
          select: { id: true },
        });
        const { recordActivity, syncCategoryToOutreach } = await import("@/lib/crm/lead-category");
        const category = await recordActivity({
          studentId: student.id,
          type: "PAYMENT_INTENT",
          batchId: matchingBatch?.id,
        });
        await syncCategoryToOutreach(student.id, category);
      }
    }
  } catch (err) {
    console.error("Activity tracking error (checkout intent):", err);
  }

  return <CheckoutView course={found} />;
}