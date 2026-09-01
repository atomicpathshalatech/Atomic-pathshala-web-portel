import type { Metadata } from "next";
import { CourseDetailMasterView } from "@/components/course-platform/CourseDetailMasterView";
import { SAMPLE_COURSES } from "@/components/course-platform/CourseListingMasterView";
import { prisma } from "@/lib/db";

export const metadata: Metadata = {
  title: "Course Details — Atomic Pathshala",
};

export default async function CourseDetailPage({ params }: { params: { batchId: string } }) {
  // 1. Check if matches predefined sample/store course
  const foundSample = SAMPLE_COURSES.find(
    (c) => c.slug === params.batchId || c.id === params.batchId
  );

  if (foundSample) {
    return <CourseDetailMasterView course={foundSample} />;
  }

  // 2. Check Database for batch
  const batch = await prisma.batch.findUnique({
    where: { id: params.batchId },
    include: {
      course: true,
    },
  });

  const courseData = {
    id: batch?.id || "default-course",
    slug: batch?.id || "course-details",
    title: batch?.name || "YODHA Chemistry Batch for NEET 2027",
    subtitle: batch?.course?.description || "Complete NCERT Class 11 & 12 Chemistry preparation with structured live + recorded classes.",
    exam: "NEET",
    examYear: "2027",
    subject: "Chemistry",
    courseType: "Full Syllabus",
    language: "Hinglish",
    educators: "By Sonu Bhaiya",
    duration: "12 Months",
    classesCount: 128,
    testsCount: 21,
    studentsCount: 805,
    price: 4700,
    originalPrice: 5500,
    discountPercentage: 15,
    isNewBatch: true,
    thumbnailUrl:
      "https://lh3.googleusercontent.com/aida-public/AB6AXuD7YAZXVaHigh3RrfotJ1dphorsBl-gSAYvezYpMeV9rQSbQKvPk-AIGgvAUIs_j2OwoO9mv1RtVt-gCvSEP_621X3MnJUCxljXh4RIY-I6RaAwuw1s2rbJcbhRmE4zZjf-Kggrln5NK6LDAzGkCCjaRiQg-wlkb4AQglZ6CtSX0C6SOktuBjAPPjgF7jbnrTLR698i6gAjdpvYGjyIQzSwQYShpDlSqaTeKmUrHC3GKWAEUHK02G85AQ",
  };

  return <CourseDetailMasterView course={courseData} />;
}