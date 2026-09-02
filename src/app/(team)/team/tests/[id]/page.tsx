import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { hasPermission } from "@/lib/rbac/guard";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { canManageTest } from "@/lib/test-engine/access";
import { computeAttemptCounts } from "@/lib/test-engine/scoring";
import { TestDetailClient } from "@/components/team-portal/TestDetailClient";

export const metadata: Metadata = {
  title: "Test Detail",
};

export default async function TestDetailPage({ params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/login");

  const canRead = await hasPermission(session.user.id, PERMISSIONS.TEST_READ);
  if (!canRead) redirect("/team");

  const test = await prisma.test.findUnique({
    where: { id: params.id },
    include: {
      template: { select: { id: true, name: true } },
      batchSchedule: { include: { batch: { select: { id: true, name: true } } } },
      sections: {
        orderBy: { order: "asc" },
        include: {
          questions: {
            orderBy: { order: "asc" },
            include: { question: { include: { translations: true } } },
          },
        },
      },
    },
  });
  if (!test) notFound();

  const manageable = await canManageTest(session.user.id, test.batchScheduleId);
  if (!manageable) redirect("/team/tests");

  const canPublish = await hasPermission(session.user.id, PERMISSIONS.TEST_PUBLISH);
  const isDraft = test.status === "DRAFT";

  const sectionQuestions = test.sections.flatMap((s) => s.questions.map((sq) => ({ ...sq, section: s })));

  const results =
    test.status !== "DRAFT"
      ? await prisma.attempt.findMany({
          where: { testId: test.id, status: { in: ["SUBMITTED", "AUTO_SUBMITTED"] } },
          include: { student: { include: { user: true } }, answers: true },
          orderBy: [{ score: "desc" }, { submittedAt: "asc" }],
        })
      : [];

  return (
    <div className="space-y-6 max-w-5xl">
      <p className="flex items-center gap-2 text-xs text-slate-500 mb-2">
        <Link href="/team/tests" className="hover:text-indigo-600 transition">
          Tests
        </Link>
        <span className="material-symbols-outlined text-sm">chevron_right</span>
        <span className="text-slate-900 font-medium">{test.name}</span>
      </p>

      {/* State-driven Authoring Client */}
      <TestDetailClient
        test={test as any}
        isDraft={isDraft}
        canPublish={canPublish}
      />

      {/* Submissions leaderboard if published */}
      {test.status !== "DRAFT" && (
        <section className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-4">
          <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <span className="material-symbols-outlined text-indigo-600">leaderboard</span>
            Student Submissions ({results.length} attempts)
          </h2>
          {results.length === 0 ? (
            <p className="text-xs text-slate-500">No submissions recorded yet.</p>
          ) : (
            <div className="divide-y divide-slate-100">
              {results.map((r, i) => {
                const counts = computeAttemptCounts(r.answers, sectionQuestions.length);
                return (
                  <div
                    key={r.id}
                    className="flex items-center justify-between py-3 hover:bg-slate-50 px-2 rounded-xl transition"
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-xs font-bold text-indigo-600 w-6">#{i + 1}</span>
                      <div>
                        <p className="text-xs font-bold text-slate-900">{r.student.user.name}</p>
                        <p className="text-[11px] text-slate-500">
                          {r.student.enrollmentNumber} · {counts.correctCount} correct ·{" "}
                          {counts.incorrectCount} incorrect · {counts.unattemptedCount} unattempted
                          {r.status === "AUTO_SUBMITTED" ? " · auto-submitted" : ""}
                        </p>
                      </div>
                    </div>
                    <span className="text-sm font-bold text-slate-900">{r.score ?? 0} Marks</span>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      )}
    </div>
  );
}
