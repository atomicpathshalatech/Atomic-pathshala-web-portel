import type { Metadata } from "next";
import { CourseListingMasterView } from "@/components/course-platform/CourseListingMasterView";

export const metadata: Metadata = {
  title: "Courses & Batches — Atomic Pathshala",
  description: "Explore top-tier NEET, JEE, and Board courses engineered for exam success.",
};

export default function CoursesPage() {
  return (
    <div className="max-w-7xl mx-auto py-4 sm:py-6">
      <CourseListingMasterView />
    </div>
  );
}