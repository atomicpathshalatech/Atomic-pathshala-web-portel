import type { Metadata } from "next";
import { prisma } from "@/lib/db";
import { CourseListingMasterView } from "@/components/course-platform/CourseListingMasterView";
import { CourseData } from "@/components/course-platform/CourseCard";

export const metadata: Metadata = {
  title: "Courses & Batches — Atomic Pathshala",
  description: "Explore top-tier NEET, JEE, and Board courses engineered for exam success.",
};

export default async function CoursesPage() {
  let dbBatches: any[] = [];
  try {
    dbBatches = await prisma.batch.findMany({
      where: {
        status: { in: ["ACTIVE", "UPCOMING"] },
      },
      include: {
        course: {
          include: {
            subjects: true,
          },
        },
        teachers: {
          include: {
            teacher: {
              include: {
                user: { select: { name: true } },
              },
            },
          },
        },
        _count: {
          select: {
            enrollments: true,
            schedules: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });
  } catch (err) {
    console.error("Error fetching batches:", err);
  }

  const courses: CourseData[] = dbBatches.map((batch) => {
    const educatorsStr =
      batch.teachers?.map((t: any) => t.teacher?.user?.name).filter(Boolean).join(" & ") ||
      "Atomic Faculty";

    const subjectTitle =
      batch.course?.subjects?.[0]?.title || "Comprehensive";

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
      price: 4999,
      originalPrice: 5999,
      discountPercentage: 15,
      isNewBatch: true,
      thumbnailUrl: null,
    };
  });

  return (
    <div className="max-w-7xl mx-auto py-4 sm:py-6">
      <CourseListingMasterView courses={courses} />
    </div>
  );
}