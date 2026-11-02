import type { Metadata } from "next";
import Link from "next/link";
import { requireStudentSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { loadStudentCard } from "@/lib/id-card/data";
import { IdCardWorkspace } from "@/components/id-card/IdCardWorkspace";

export const metadata: Metadata = {
  title: "ID Card",
};

export const dynamic = "force-dynamic";

export default async function IdCardPage() {
  const { student } = await requireStudentSession();

  const [activeBatchCount, doubtsAsked, doubtsResolved, ncertPagesCompleted, loaded] = await Promise.all([
    prisma.batchEnrollment.count({ where: { studentId: student.id, status: "ACTIVE" } }),
    prisma.doubt.count({ where: { studentId: student.id } }),
    prisma.doubt.count({ where: { studentId: student.id, status: "RESOLVED" } }),
    prisma.ncertStudentPageProgress.count({ where: { studentId: student.id, status: "COMPLETED" } }),
    loadStudentCard({ studentId: student.id }),
  ]);

  return (
    <div className="space-y-stack-lg max-w-5xl">
      <header>
        <h1 className="font-display-lg text-display-lg-mobile md:text-display-lg text-on-surface">
          ID Card &amp; Profile
        </h1>
        <p className="text-body-lg text-on-surface-variant mt-2">
          Your official Atomic Pathshala student identity card.
        </p>
      </header>

      {loaded && <IdCardWorkspace loaded={loaded} />}

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="glass-card rounded-xl p-4 text-center">
          <p className="font-headline-lg text-headline-lg text-primary">{activeBatchCount}</p>
          <p className="text-label-sm text-on-surface-variant mt-1">Active Batches</p>
        </div>
        <div className="glass-card rounded-xl p-4 text-center">
          <p className="font-headline-lg text-headline-lg text-primary">{doubtsAsked}</p>
          <p className="text-label-sm text-on-surface-variant mt-1">Doubts Asked</p>
        </div>
        <div className="glass-card rounded-xl p-4 text-center">
          <p className="font-headline-lg text-headline-lg text-primary">{doubtsResolved}</p>
          <p className="text-label-sm text-on-surface-variant mt-1">Doubts Resolved</p>
        </div>
        <div className="glass-card rounded-xl p-4 text-center bg-teal-50/50 dark:bg-teal-950/20 border-teal-200/50">
          <p className="font-headline-lg text-headline-lg text-teal-600">{ncertPagesCompleted}</p>
          <p className="text-label-sm text-teal-700 dark:text-teal-400 mt-1 font-semibold">NCERT Pages</p>
        </div>
      </div>

      {/* NCERT Question Practice Highlight Card */}
      <div className="rounded-2xl p-5 bg-gradient-to-r from-teal-600 to-emerald-600 text-white shadow-md flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-xl bg-white/20 flex items-center justify-center shrink-0">
            <span className="material-symbols-outlined text-2xl text-white">menu_book</span>
          </div>
          <div>
            <h3 className="font-bold text-sm sm:text-base text-white">NCERT Question Practice</h3>
            <p className="text-xs text-white/80 mt-0.5">
              Page-by-page textbook reading with AI-verified NCERT locked questions.
            </p>
          </div>
        </div>
        <Link
          href="/practice/ncert"
          className="px-4 py-2 rounded-xl bg-white text-teal-800 text-xs font-black hover:bg-white/95 transition shadow-sm whitespace-nowrap active:scale-95"
        >
          Start Practice &rarr;
        </Link>
      </div>
    </div>
  );
}
