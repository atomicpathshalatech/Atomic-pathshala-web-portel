import type { Metadata } from "next";
import Link from "next/link";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { CourseDetailMasterView } from "@/components/course-platform/CourseDetailMasterView";
import { SAMPLE_COURSES } from "@/components/course-platform/sample-courses";

export const metadata: Metadata = {
  title: "Batch & Course — Atomic Pathshala",
};

export default async function BatchCoursePage({
  params,
}: {
  params: { batchId: string } | Promise<{ batchId: string }>;
}) {
  const resolvedParams = await Promise.resolve(params);
  const batchId = resolvedParams?.batchId || "yodha-chemistry-neet-2027";

  // 1. Check if matches predefined sample store course
  const foundSample = SAMPLE_COURSES.find(
    (c) => c.slug === batchId || c.id === batchId
  );

  let studentId: string | null = null;
  try {
    const session = await getServerSession(authOptions);
    if (session?.user?.id) {
      const student = await prisma.student.findUnique({
        where: { userId: session.user.id },
        select: { id: true },
      });
      studentId = student?.id || null;
    }
  } catch (err) {
    console.error("Session lookup error in batch page:", err);
  }

  // 2. If student is logged in, check if active enrollment exists
  if (studentId) {
    try {
      const enrollment = await prisma.batchEnrollment.findFirst({
        where: {
          batchId: batchId,
          studentId: studentId,
          status: "ACTIVE",
        },
        include: {
          batch: {
            include: {
              course: {
                include: {
                  subjects: {
                    include: {
                      chapters: {
                        where: { status: "PUBLISHED" },
                        orderBy: { order: "asc" },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      });

      if (enrollment?.batch?.course) {
        const course = enrollment.batch.course;
        return (
          <div className="space-y-6 max-w-5xl mx-auto py-4 sm:py-6 px-4">
            {/* Breadcrumbs & Header */}
            <div>
              <p className="flex items-center gap-2 text-xs text-slate-500 mb-2">
                <Link href="/courses" className="hover:text-purple-600 font-bold transition">
                  Batches
                </Link>
                <span className="material-symbols-outlined text-xs">chevron_right</span>
                <span className="text-[#031635] font-bold">{enrollment.batch.name}</span>
              </p>

              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-200">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-extrabold uppercase tracking-wider">
                      Enrolled &amp; Active
                    </span>
                    <span className="text-xs font-bold text-slate-400 font-mono">
                      Code: {enrollment.batch.code}
                    </span>
                  </div>
                  <h1 className="text-xl sm:text-2xl font-black text-[#031635]">{course.title}</h1>
                  {course.description && (
                    <p className="text-xs text-slate-500 mt-1 max-w-3xl">{course.description}</p>
                  )}
                </div>

                <Link
                  href="/watch"
                  className="px-5 py-2.5 rounded-xl bg-[#6b46c1] hover:bg-[#5b3da5] text-white font-bold text-xs shadow-md transition flex items-center justify-center gap-1.5 self-start sm:self-auto"
                >
                  <span className="material-symbols-outlined text-base">play_circle</span>
                  <span>Continue Learning</span>
                </Link>
              </div>
            </div>

            {/* Course Subjects Grid */}
            <div className="space-y-4">
              <h2 className="text-sm font-extrabold text-[#031635] uppercase tracking-wider">
                Subjects in this Batch
              </h2>

              {course.subjects.length === 0 ? (
                <div className="bg-white rounded-3xl border border-slate-200/80 p-12 text-center text-slate-500 text-xs">
                  No subjects added to this course yet.
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {course.subjects.map((s) => (
                    <Link
                      key={s.id}
                      href={`/courses/${enrollment.batch.id}/subjects/${s.id}`}
                      className="bg-white rounded-3xl border border-slate-200/80 p-5 hover:border-purple-300 hover:shadow-md transition-all group flex flex-col justify-between"
                    >
                      <div className="space-y-2">
                        <div className="w-10 h-10 rounded-2xl bg-purple-100 text-purple-700 flex items-center justify-center font-black text-sm">
                          {s.title.charAt(0)}
                        </div>
                        <h3 className="font-bold text-sm text-[#031635] group-hover:text-purple-600 transition">
                          {s.title}
                        </h3>
                        <p className="text-xs text-slate-500">
                          {s.chapters.length} Published Chapters
                        </p>
                      </div>

                      <div className="pt-4 border-t border-slate-100 mt-4 flex items-center justify-between text-xs font-bold text-purple-600">
                        <span>View Chapters</span>
                        <span className="material-symbols-outlined text-base group-hover:translate-x-1 transition-transform">
                          arrow_forward
                        </span>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          </div>
        );
      }
    } catch (err) {
      console.error("Enrollment check error in batch page:", err);
    }
  }

  // 3. Fallback to Predefined Store Course or Database Course preview
  if (foundSample) {
    return <CourseDetailMasterView course={foundSample} />;
  }

  // Query Database Batch if ID matches
  let batch = null;
  try {
    batch = await prisma.batch.findUnique({
      where: { id: batchId },
      include: { course: true },
    });
  } catch (err) {
    console.error("Batch query error:", err);
  }

  const courseData = {
    id: batch?.id || "default-course",
    slug: batch?.id || batchId,
    title: batch?.name || "YODHA Chemistry Batch for NEET 2027",
    subtitle:
      batch?.course?.description ||
      "Complete NCERT Class 11 & 12 Chemistry preparation with structured live + recorded classes.",
    exam: "NEET",
    examYear: "2027",
    subject: "Chemistry",
    courseType: "Full Syllabus",
    language: "Hinglish",
    educators: "By Sonu Bhaiya & Dr. Priya Sharma",
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
