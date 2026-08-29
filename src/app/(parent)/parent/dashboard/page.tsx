import type { Metadata } from "next";
import Link from "next/link";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";

export const metadata: Metadata = {
  title: "Parent Portal — Student Progress",
};

export default async function ParentDashboardPage({
  searchParams,
}: {
  searchParams?: { studentCode?: string };
}) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/login");

  // Find student by phone/email or query param
  let student = null;

  if (searchParams?.studentCode) {
    student = await prisma.student.findUnique({
      where: { studentIdCode: searchParams.studentCode },
      include: {
        user: true,
        batchEnrollments: {
          include: {
            batch: {
              include: {
                teachers: { include: { teacher: { include: { user: true } } } },
              },
            },
          },
        },
        attempts: {
          where: { status: { in: ["SUBMITTED", "AUTO_SUBMITTED"] } },
          include: { test: true, answers: { select: { isCorrect: true } } },
          orderBy: { submittedAt: "desc" },
          take: 5,
        },
        liveClassAttendances: {
          include: { whiteboardSession: { include: { batchSchedule: true } } },
          orderBy: { joinedAt: "desc" },
          take: 5,
        },
        subscription: {
          include: { payments: { where: { status: "SUCCESS" }, orderBy: { createdAt: "desc" }, take: 3 } },
        },
      },
    });
  }

  // Fallback to first student if not specified
  if (!student) {
    student = await prisma.student.findFirst({
      include: {
        user: true,
        batchEnrollments: {
          include: {
            batch: {
              include: {
                teachers: { include: { teacher: { include: { user: true } } } },
              },
            },
          },
        },
        attempts: {
          where: { status: { in: ["SUBMITTED", "AUTO_SUBMITTED"] } },
          include: { test: true, answers: { select: { isCorrect: true } } },
          orderBy: { submittedAt: "desc" },
          take: 5,
        },
        liveClassAttendances: {
          include: { whiteboardSession: { include: { batchSchedule: true } } },
          orderBy: { joinedAt: "desc" },
          take: 5,
        },
        subscription: {
          include: { payments: { where: { status: "SUCCESS" }, orderBy: { createdAt: "desc" }, take: 3 } },
        },
      },
    });
  }

  if (!student) {
    return (
      <div className="glass-card rounded-3xl p-12 text-center max-w-xl mx-auto space-y-4">
        <span className="material-symbols-outlined text-4xl text-primary">person_search</span>
        <h1 className="font-headline-md text-headline-md text-on-surface">No Student Profile Linked</h1>
        <p className="text-sm text-on-surface-variant">
          Please contact our academic counseling desk with your child's enrollment number to link their profile to your Parent Portal account.
        </p>
      </div>
    );
  }

  const activeBatches = student.batchEnrollments.filter((e) => e.status === "ACTIVE");
  const recentTests = student.attempts;
  const recentAttendances = student.liveClassAttendances;
  const payments = student.subscription?.payments || [];

  return (
    <div className="space-y-stack-lg">
      {/* Student Overview Header */}
      <section className="glass-card rounded-3xl p-6 md:p-8 flex flex-col md:flex-row items-start md:items-center justify-between gap-6 relative overflow-hidden bg-gradient-to-r from-primary/10 via-surface to-surface">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-2xl bg-primary/20 text-primary flex items-center justify-center font-bold text-2xl border border-primary/30 shrink-0">
            {student.user.name.charAt(0)}
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="font-headline-lg text-headline-lg font-bold text-on-surface">{student.user.name}</h1>
              <span className="text-[10px] uppercase font-bold px-2.5 py-0.5 rounded-full bg-primary/10 text-primary">
                {student.status}
              </span>
            </div>
            <p className="text-xs text-on-surface-variant mt-1">
              Class {student.class} &middot; {student.targetExam} Aspirant &middot; ID: <b>{student.studentIdCode}</b>
            </p>
            <p className="text-xs text-on-surface-variant">
              Guardian: {student.fatherName || student.motherName} ({student.emergencyContact || "No contact logged"})
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 self-end md:self-auto">
          <div className="bg-surface-container-lowest border border-outline-variant/30 px-4 py-2.5 rounded-2xl text-center shadow-sm">
            <span className="text-xs text-on-surface-variant block">Study Streak</span>
            <span className="font-bold text-primary text-base flex items-center justify-center gap-1">
              <span className="material-symbols-outlined text-error text-lg">local_fire_department</span>
              {student.currentStreakDays} Days
            </span>
          </div>
          <div className="bg-surface-container-lowest border border-outline-variant/30 px-4 py-2.5 rounded-2xl text-center shadow-sm">
            <span className="text-xs text-on-surface-variant block">XP Level</span>
            <span className="font-bold text-on-surface text-base">Lvl {student.level}</span>
          </div>
        </div>
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Academic & Test Performance */}
        <div className="lg:col-span-8 space-y-6">
          {/* Test Performance */}
          <section className="glass-card rounded-3xl p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-headline-md text-headline-md text-on-surface flex items-center gap-2">
                <span className="material-symbols-outlined text-primary">quiz</span>
                Recent Test Scores & Assessments
              </h2>
              <span className="text-xs text-on-surface-variant">{recentTests.length} tests completed</span>
            </div>

            {recentTests.length === 0 ? (
              <p className="text-xs text-on-surface-variant text-center py-6">No test records submitted yet.</p>
            ) : (
              <div className="space-y-3">
                {recentTests.map((t) => {
                  const correctCount = t.answers.filter((a) => a.isCorrect === true).length;
                  const incorrectCount = t.answers.filter((a) => a.isCorrect === false).length;
                  return (
                    <div
                      key={t.id}
                      className="p-4 rounded-2xl bg-surface-container-lowest border border-outline-variant/30 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                    >
                      <div>
                        <h3 className="font-bold text-sm text-on-surface">{t.test?.name ?? "Test"}</h3>
                        <p className="text-xs text-on-surface-variant mt-0.5">
                          {t.submittedAt?.toLocaleDateString("en-IN", {
                            day: "numeric",
                            month: "short",
                            year: "numeric",
                          })}
                        </p>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="text-right">
                          <span className="text-xs text-on-surface-variant block">Marks Obtained</span>
                          <span className="font-bold text-primary text-base font-mono">
                            {t.score ?? 0} Marks
                          </span>
                        </div>
                        <div className="text-right">
                          <span className="text-xs text-on-surface-variant block">Accuracy</span>
                          <span className="font-bold text-secondary text-sm">
                            {correctCount} Correct / {incorrectCount} Incorrect
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          {/* Live Class Attendance */}
          <section className="glass-card rounded-3xl p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-headline-md text-headline-md text-on-surface flex items-center gap-2">
                <span className="material-symbols-outlined text-secondary">videocam</span>
                Live Class Attendance Logs
              </h2>
              <span className="text-xs text-on-surface-variant">Verified presence</span>
            </div>

            {recentAttendances.length === 0 ? (
              <p className="text-xs text-on-surface-variant text-center py-6">No live class logs recorded yet.</p>
            ) : (
              <div className="space-y-2.5">
                {recentAttendances.map((att) => (
                  <div
                    key={att.id}
                    className="p-3.5 rounded-xl bg-surface-container-lowest border border-outline-variant/20 flex items-center justify-between text-xs"
                  >
                    <div>
                      <p className="font-bold text-on-surface">
                        {att.whiteboardSession.batchSchedule.title}
                      </p>
                      <p className="text-on-surface-variant mt-0.5">
                        Joined: {att.joinedAt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} &middot; Active duration: {Math.round(att.activeDurationSec / 60)} mins
                      </p>
                    </div>
                    <span className="px-2.5 py-1 rounded-full bg-secondary/10 text-secondary font-bold uppercase text-[10px]">
                      Present
                    </span>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>

        {/* Right Column: Batches, Fee Status & Counselor Contacts */}
        <div className="lg:col-span-4 space-y-6">
          {/* Active Batches */}
          <section className="glass-card rounded-3xl p-6 space-y-3">
            <h3 className="font-headline-md text-headline-md text-on-surface">Enrolled Batches</h3>
            {activeBatches.length === 0 ? (
              <p className="text-xs text-on-surface-variant">Not currently enrolled in any batch.</p>
            ) : (
              <div className="space-y-2">
                {activeBatches.map((e) => (
                  <div key={e.id} className="p-3 rounded-xl bg-surface-container-lowest border border-outline-variant/20">
                    <p className="font-bold text-xs text-on-surface">{e.batch.name}</p>
                    <p className="text-[11px] text-on-surface-variant mt-0.5">{e.batch.code}</p>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Fee & Invoices */}
          <section className="glass-card rounded-3xl p-6 space-y-3">
            <h3 className="font-headline-md text-headline-md text-on-surface">Fee Receipts & Billing</h3>
            {payments.length === 0 ? (
              <p className="text-xs text-on-surface-variant">No fee payments recorded.</p>
            ) : (
              <div className="space-y-2">
                {payments.map((p) => (
                  <div
                    key={p.id}
                    className="p-3 rounded-xl bg-surface-container-lowest border border-outline-variant/20 flex items-center justify-between text-xs"
                  >
                    <div>
                      <p className="font-bold text-on-surface">₹{p.amount.toLocaleString("en-IN")}</p>
                      <p className="text-[10px] text-on-surface-variant font-mono">{p.invoiceNumber}</p>
                    </div>
                    <Link
                      href={`/subscription/billing/${p.id}`}
                      className="px-2.5 py-1 rounded-lg bg-primary/10 text-primary font-semibold hover:bg-primary/20 transition-colors text-[11px]"
                    >
                      View GST Receipt
                    </Link>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Academic Counseling Support */}
          <section className="glass-card rounded-3xl p-6 space-y-3 bg-primary/5 border border-primary/20">
            <h3 className="font-headline-md text-headline-md text-primary">Need Help or Feedback?</h3>
            <p className="text-xs text-on-surface-variant leading-relaxed">
              Connect directly with our dedicated Academic Mentor & Parent Care Desk on WhatsApp or phone.
            </p>
            <a
              href="https://wa.me/919999999999?text=Hello%20Atomic%20Pathshala,%20I%20am%20calling%20regarding%20my%20child's%20progress"
              target="_blank"
              rel="noopener noreferrer"
              className="w-full py-2.5 rounded-xl bg-primary text-on-primary font-semibold text-xs flex items-center justify-center gap-2 hover:opacity-90 transition-all block text-center"
            >
              <span className="material-symbols-outlined text-sm">chat</span>
              Chat with Academic Counselor
            </a>
          </section>
        </div>
      </div>
    </div>
  );
}
