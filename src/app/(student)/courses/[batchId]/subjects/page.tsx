import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { requireStudentSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { isEnrolledInCourse } from "@/lib/lecture/access";

export const metadata: Metadata = {
  title: "Recorded Classes & Subjects — Atomic Pathshala",
};

export default async function BatchSubjectsPage({
  params,
}: {
  params: { batchId: string } | Promise<{ batchId: string }>;
}) {
  const resolvedParams = await Promise.resolve(params);
  const batchId = resolvedParams.batchId;
  const { student } = await requireStudentSession();

  // Find batch
  const batch = await prisma.batch.findFirst({
    where: {
      OR: [
        { id: batchId },
        { code: batchId },
        { name: { contains: batchId, mode: "insensitive" } },
      ],
    },
    include: {
      course: {
        include: {
          subjects: {
            include: {
              chapters: {
                where: { status: "PUBLISHED" },
                orderBy: { order: "asc" },
                include: {
                  _count: {
                    select: {
                      lectures: { where: { status: "PUBLISHED" } },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
  });

  if (!batch || !batch.course) {
    notFound();
  }

  // Check enrollment
  const enrolled = await isEnrolledInCourse(student.id, batch.course.id);
  if (!enrolled) {
    redirect("/courses");
  }

  // Pure NEET: Filter out Mathematics for NEET students
  const isNeet = !student.targetExam || student.targetExam.toUpperCase().includes("NEET");
  let subjects = batch.course.subjects;
  if (isNeet) {
    subjects = subjects.filter((s) => !s.title.toLowerCase().includes("math"));
  }

  const SUBJECT_ICONS: Record<string, { icon: string; color: string; bg: string }> = {
    physics: { icon: "bolt", color: "text-blue-600", bg: "bg-blue-50 border-blue-200" },
    chemistry: { icon: "science", color: "text-amber-600", bg: "bg-amber-50 border-amber-200" },
    biology: { icon: "biotech", color: "text-emerald-600", bg: "bg-emerald-50 border-emerald-200" },
    botany: { icon: "eco", color: "text-green-600", bg: "bg-green-50 border-green-200" },
    zoology: { icon: "pets", color: "text-teal-600", bg: "bg-teal-50 border-teal-200" },
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto py-4 sm:py-6 px-4 bg-white">
      {/* Breadcrumbs & Header */}
      <div>
        <p className="flex items-center gap-1.5 text-xs text-slate-400 mb-2">
          <Link href="/dashboard" className="hover:text-orange-600 font-bold transition">
            Dashboard
          </Link>
          <span className="material-symbols-outlined text-xs">chevron_right</span>
          <Link href="/courses" className="hover:text-orange-600 font-bold transition">
            Batches
          </Link>
          <span className="material-symbols-outlined text-xs">chevron_right</span>
          <span className="text-slate-800 font-bold truncate">{batch.name}</span>
          <span className="material-symbols-outlined text-xs">chevron_right</span>
          <span className="text-orange-600 font-bold">Recorded Classes</span>
        </p>

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-200/80">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="px-2 py-0.5 rounded-md bg-orange-50 text-orange-700 border border-orange-200 text-[10px] font-bold uppercase tracking-wider">
                Recorded Classes &amp; Lectures
              </span>
              <span className="text-xs font-bold text-slate-400 font-mono">
                {batch.code}
              </span>
            </div>
            <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
              {batch.name} — Subjects &amp; Chapters
            </h1>
            <p className="text-xs text-slate-500 mt-1 max-w-3xl">
              Select your subject to watch recorded video lectures and chapter-wise class recordings.
            </p>
          </div>
        </div>
      </div>

      {/* Subjects & Chapters List */}
      {subjects.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200/80 p-12 text-center text-slate-500 text-xs">
          No subjects created for this batch yet.
        </div>
      ) : (
        <div className="space-y-6">
          {subjects.map((subject) => {
            const key = subject.title.toLowerCase().trim();
            const config = SUBJECT_ICONS[key] || {
              icon: "menu_book",
              color: "text-orange-600",
              bg: "bg-orange-50 border-orange-200",
            };
            const totalLectures = subject.chapters.reduce(
              (sum, ch) => sum + (ch._count?.lectures || 0),
              0
            );

            return (
              <div
                key={subject.id}
                className="bg-white border border-slate-200/90 rounded-2xl overflow-hidden shadow-2xs transition-all"
              >
                {/* Subject Header */}
                <div className="p-4 sm:p-5 bg-slate-50/70 border-b border-slate-100 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-10 h-10 rounded-xl flex items-center justify-center border shrink-0 ${config.bg}`}
                    >
                      <span className={`material-symbols-outlined text-2xl ${config.color}`}>
                        {config.icon}
                      </span>
                    </div>
                    <div>
                      <h2 className="text-base sm:text-lg font-bold text-slate-900 leading-tight">
                        {subject.title}
                      </h2>
                      <p className="text-xs text-slate-500">
                        {subject.chapters.length} Chapters &middot; {totalLectures} Recorded Classes
                      </p>
                    </div>
                  </div>

                  <Link
                    href={`/courses/${batch.id}/subjects/${subject.id}`}
                    className="px-3.5 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold transition shadow-2xs shrink-0"
                  >
                    View All
                  </Link>
                </div>

                {/* Chapters inside Subject */}
                <div className="p-3 sm:p-4">
                  {subject.chapters.length === 0 ? (
                    <p className="text-xs text-slate-400 py-3 text-center">
                      No chapters published in {subject.title} yet.
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {subject.chapters.map((ch, idx) => (
                        <Link
                          key={ch.id}
                          href={`/courses/${batch.id}/subjects/${subject.id}/chapters/${ch.id}`}
                          className="p-3 sm:px-4 sm:py-2.5 rounded-xl bg-white border border-slate-200/80 hover:border-slate-300 flex items-center justify-between gap-3 hover:shadow-2xs transition group"
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <span className="w-7 h-7 rounded-lg bg-slate-100 group-hover:bg-orange-50 group-hover:text-orange-600 text-slate-600 font-bold text-xs flex items-center justify-center shrink-0 border border-slate-200/60 transition-colors">
                              {idx + 1}
                            </span>
                            <div className="min-w-0">
                              <h3 className="font-bold text-xs sm:text-sm text-slate-900 group-hover:text-orange-600 transition-colors truncate">
                                {ch.title}
                              </h3>
                              <p className="text-[11px] text-slate-500">
                                {ch._count?.lectures === 0
                                  ? "No video lectures yet"
                                  : `${ch._count.lectures} class${ch._count.lectures === 1 ? "" : "es"}`}
                              </p>
                            </div>
                          </div>

                          <div className="flex items-center gap-2 shrink-0 text-slate-400 group-hover:text-orange-600 transition-colors">
                            <span className="text-xs font-bold hidden sm:inline">Watch Classes</span>
                            <span className="material-symbols-outlined text-lg group-hover:translate-x-0.5 transition-transform">
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
          })}
        </div>
      )}
    </div>
  );
}
