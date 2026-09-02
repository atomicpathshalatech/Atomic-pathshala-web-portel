import type { Metadata } from "next";
import { CheckoutView } from "@/components/course-platform/CheckoutView";
import { SAMPLE_COURSES } from "@/components/course-platform/sample-courses";

export const metadata: Metadata = {
  title: "Secure Checkout — Atomic Pathshala",
};

export default function CheckoutPage({ params }: { params: { courseSlug: string } }) {
  const found =
    SAMPLE_COURSES.find(
      (c) => c.slug === params.courseSlug || c.id === params.courseSlug
    ) ?? SAMPLE_COURSES[0]!;

  return <CheckoutView course={found} />;
}