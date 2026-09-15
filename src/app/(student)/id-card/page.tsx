import type { Metadata } from "next";
import Link from "next/link";
import { requireStudentSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { generateStudentQrDataUrl } from "@/lib/utils/qr";

export const metadata: Metadata = {
  title: "ID Card",
};

export default async function IdCardPage() {
  const { student } = await requireStudentSession();

  const [activeBatchCount, doubtsAsked, doubtsResolved, qrDataUrl, ncertPagesCompleted] = await Promise.all([
    prisma.batchEnrollment.count({ where: { studentId: student.id, status: "ACTIVE" } }),
    prisma.doubt.count({ where: { studentId: student.id } }),
    prisma.doubt.count({ where: { studentId: student.id, status: "RESOLVED" } }),
    generateStudentQrDataUrl(student.studentIdCode),
    prisma.ncertStudentPageProgress.count({ where: { studentId: student.id, status: "COMPLETED" } }),
  ]);

  const initials = student.user.name
    .split(" ")
    .map((part) => part[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  const locationParts = [student.city, student.state].filter(Boolean);

  return (
    <div className="space-y-stack-lg max-w-3xl">
      <header>
        <h1 className="font-display-lg text-display-lg-mobile md:text-display-lg text-on-surface">
          ID Card &amp; Profile
        </h1>
        <p className="text-body-lg text-on-surface-variant mt-2">
          Your official Atomic Pathshala student identity.
        </p>
      </header>

      <div className="glass-card rounded-2xl p-6 sm:p-8 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-primary-container/40 to-transparent pointer-events-none" />
        <div className="relative flex flex-col sm:flex-row gap-6 items-center sm:items-start">
          <div className="w-28 h-28 rounded-2xl bg-surface-container-high overflow-hidden shrink-0 flex items-center justify-center">
            {student.user.photoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element -- external/user-uploaded URL, not in next.config image domains
              <img
                src={student.user.photoUrl}
                alt={student.user.name}
                className="w-full h-full object-cover"
              />
            ) : (
              <span className="font-headline-lg text-headline-lg text-primary">{initials}</span>
            )}
          </div>

          <div className="flex-1 min-w-0 text-center sm:text-left">
            <h2 className="font-headline-lg text-headline-lg text-on-surface">{student.user.name}</h2>
            <p className="text-label-md text-on-surface-variant">{student.studentIdCode}</p>
            <div className="mt-3 flex flex-wrap justify-center sm:justify-start gap-2">
              {student.class && (
                <span className="text-label-sm px-2.5 py-1 rounded-full bg-secondary-container text-on-secondary-container">
                  Class {student.class}
                </span>
              )}
              {student.targetExam && (
                <span className="text-label-sm px-2.5 py-1 rounded-full bg-secondary-container text-on-secondary-container">
                  {student.targetExam}
                </span>
              )}
            </div>
          </div>

          <div className="w-24 h-24 rounded-lg bg-white p-2 shrink-0">
            {/* eslint-disable-next-line @next/next/no-img-element -- data: URL, not a remote image */}
            <img src={qrDataUrl} alt="Student verification QR code" className="w-full h-full object-contain" />
          </div>
        </div>

        <dl className="relative mt-6 grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3 border-t border-outline-variant/30 pt-5">
          <div>
            <dt className="text-label-sm text-on-surface-variant">Enrollment Number</dt>
            <dd className="text-body-md text-on-surface">{student.enrollmentNumber || "—"}</dd>
          </div>
          <div>
            <dt className="text-label-sm text-on-surface-variant">School</dt>
            <dd className="text-body-md text-on-surface">{student.school || "—"}</dd>
          </div>
          <div>
            <dt className="text-label-sm text-on-surface-variant">Location</dt>
            <dd className="text-body-md text-on-surface">
              {locationParts.length > 0 ? locationParts.join(", ") : "—"}
            </dd>
          </div>
          <div>
            <dt className="text-label-sm text-on-surface-variant">Email</dt>
            <dd className="text-body-md text-on-surface truncate">{student.user.email || "—"}</dd>
          </div>
        </dl>
      </div>

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
