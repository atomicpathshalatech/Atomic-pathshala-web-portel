import type { Metadata } from "next";
import Link from "next/link";
import { prisma } from "@/lib/db";
import { Navbar } from "@/components/landing/Navbar";
import { Footer } from "@/components/landing/Footer";
import { FacultyDirectoryList } from "@/components/teacher/FacultyDirectoryList";

export const metadata: Metadata = {
  title: "Expert Faculty Directory | Atomic Pathshala",
  description:
    "Explore Atomic Pathshala's verified faculty members, doctors, and engineers dedicated to academic excellence across NEET, JEE, Foundation, and Board examinations.",
};

export default async function FacultyDirectoryPage() {
  const teachers = await prisma.teacher.findMany({
    where: {
      onboardingStatus: { not: "REJECTED" },
      user: {
        status: "ACTIVE",
        role: {
          name: { in: ["TEACHER", "ACADEMIC_HEAD", "DEPARTMENT_HEAD", "SUPER_ADMIN", "ADMIN", "FOUNDER"] },
        },
      },
    },
    include: {
      user: {
        select: {
          id: true,
          name: true,
          photoUrl: true,
          email: true,
        },
      },
      badges: {
        select: {
          id: true,
          title: true,
          icon: true,
        },
      },
      batchAssignments: {
        include: {
          batch: {
            select: { id: true, name: true },
          },
        },
      },
      followers: {
        select: { id: true },
      },
    },
    orderBy: { createdAt: "asc" },
  });

  return (
    <div className="min-h-screen flex flex-col bg-[#f8fafc] dark:bg-[#0b0f19] text-slate-900 dark:text-slate-100 antialiased font-sans">
      <Navbar />

      <main className="flex-1 pt-24 pb-20 px-4 sm:px-6 max-w-6xl mx-auto w-full space-y-8">
        {/* Breadcrumb Navigation */}
        <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
          <Link href="/" className="hover:text-blue-600 transition-colors">
            Home
          </Link>
          <span className="material-symbols-outlined text-xs text-slate-400">chevron_right</span>
          <span className="text-blue-600 dark:text-blue-400 font-semibold truncate">
            Faculty Directory
          </span>
        </nav>

        {/* Directory Hero Banner */}
        <section className="bg-white dark:bg-[#111625] rounded-3xl p-6 sm:p-10 border border-slate-200/90 dark:border-slate-800 shadow-sm relative overflow-hidden text-center space-y-3">
          <div className="absolute top-0 right-0 w-96 h-96 bg-blue-500/5 dark:bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />

          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 text-xs font-bold border border-blue-200 dark:border-blue-800">
            <span className="material-symbols-outlined text-sm">school</span>
            <span>Atomic Pathshala Educators</span>
          </div>

          <h1 className="text-3xl sm:text-4xl font-black text-slate-900 dark:text-white tracking-tight">
            Learn from <span className="text-blue-600 dark:text-blue-400">Top Academic Mentors</span>
          </h1>

          <p className="text-sm sm:text-base text-slate-600 dark:text-slate-400 max-w-2xl mx-auto leading-relaxed">
            Our educators are subject specialists, doctors, and engineers dedicated to concept-first learning across NEET, JEE, Foundation, and Board examinations.
          </p>
        </section>

        {/* Interactive Faculty Directory with Category & Subject Selection */}
        <FacultyDirectoryList teachers={teachers as any} />
      </main>

      <Footer />
    </div>
  );
}
