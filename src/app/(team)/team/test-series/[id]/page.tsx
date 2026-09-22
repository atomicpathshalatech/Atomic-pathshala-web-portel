import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { hasPermission } from "@/lib/rbac/guard";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { SeriesTestCreateForm } from "@/components/team-portal/SeriesTestCreateForm";
import { SeriesTestsList } from "@/components/team-portal/SeriesTestsList";
import { TestSeriesEditModal } from "@/components/team-portal/TestSeriesEditModal";
import { cleanBatchName, formatDescriptionText } from "@/lib/academic/canonical-courses";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export const metadata: Metadata = {
  title: "Test Series Management",
};

export default async function TestSeriesDetailPage({ params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/login");

  const canRead = await hasPermission(session.user.id, PERMISSIONS.TEST_READ);
  if (!canRead) redirect("/team");

  const canCreateTest = await hasPermission(session.user.id, PERMISSIONS.TEST_CREATE);
  const canEditSeries =
    (await hasPermission(session.user.id, PERMISSIONS.TEST_PUBLISH)) ||
    (await hasPermission(session.user.id, PERMISSIONS.TEST_UPDATE)) ||
    (await hasPermission(session.user.id, PERMISSIONS.TEST_CREATE));

  const series = await prisma.testSeries.findUnique({
    where: { id: params.id },
    include: {
      tests: {
        where: { archived: false },
        include: {
          sections: {
            include: {
              _count: { select: { questions: true } },
            },
          },
        },
        orderBy: { createdAt: "desc" },
      },
    },
  });
  if (!series) notFound();

  const cleanedName = cleanBatchName(series.name);
  const cleanedTargetBatch = cleanBatchName(series.targetBatch);
  const cleanedCourse = cleanBatchName(series.course);
  const formattedDescription = formatDescriptionText(series.description);

  return (
    <div className="space-y-stack-lg max-w-5xl mx-auto">
      {/* Header Info */}
      <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <span className="text-[11px] font-bold text-slate-500">Unique Test Series ID:</span>
            <span className="text-xs font-mono font-bold bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300 px-2.5 py-0.5 rounded-lg border border-blue-200 dark:border-blue-800">
              {series.code}
            </span>
            <span className="text-[11px] text-slate-400">· Use this code to import into any batch</span>
          </div>
          <h1 className="font-headline-lg text-headline-lg text-primary tracking-tight font-extrabold">{cleanedName}</h1>
          {series.description && (
            <div className="text-on-surface-variant font-body-md mt-2 max-w-3xl whitespace-pre-line leading-relaxed text-sm">
              {formattedDescription}
            </div>
          )}
        </div>
        <div className="flex items-center gap-2.5 self-start">
          <span
            className={`px-3.5 py-1.5 rounded-full text-xs font-extrabold uppercase tracking-wider ${
              series.visibility === "PUBLIC"
                ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                : "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300"
            }`}
          >
            {series.visibility}
          </span>
          {canEditSeries && (
            <TestSeriesEditModal
              series={{
                id: series.id,
                code: series.code,
                name: series.name,
                description: series.description,
                targetBatch: series.targetBatch,
                className: series.className,
                course: series.course,
                examType: series.examType,
                tags: series.tags,
                thumbnailUrl: series.thumbnailUrl,
                visibility: series.visibility,
                status: series.status,
              }}
              triggerVariant="button"
            />
          )}
        </div>
      </div>

      {/* Overview Stat Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-gutter">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 rounded-2xl shadow-sm">
          <p className="text-label-sm text-on-surface-variant">Batch</p>
          <p className="text-body-md font-bold text-primary truncate">{cleanedTargetBatch || "All Batches"}</p>
        </div>
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 rounded-2xl shadow-sm">
          <p className="text-label-sm text-on-surface-variant">Class</p>
          <p className="text-body-md font-bold text-primary truncate">{series.className ?? "—"}</p>
        </div>
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 rounded-2xl shadow-sm">
          <p className="text-label-sm text-on-surface-variant">Course</p>
          <p className="text-body-md font-bold text-primary truncate">{cleanedCourse || "—"}</p>
        </div>
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 rounded-2xl shadow-sm">
          <p className="text-label-sm text-on-surface-variant">Tests</p>
          <p className="text-body-md font-bold text-primary">{series.tests.length}</p>
        </div>
      </div>

      {/* Tests in this Series List Header & Inline Create Form */}
      <div className="space-y-4 pt-2">
        <div className="flex items-center justify-between">
          <h3 className="font-extrabold text-lg sm:text-xl text-slate-900 dark:text-white tracking-tight">
            Tests in this Series
          </h3>
          {canCreateTest && <SeriesTestCreateForm testSeriesId={series.id} />}
        </div>

        {/* Tests List in Exact Format (Matching Image 1) */}
        <SeriesTestsList
          testSeriesId={series.id}
          tests={series.tests.map((t) => ({
            id: t.id,
            name: t.name,
            code: t.code,
            durationMin: t.durationMin,
            status: t.status,
            sections: t.sections.map((s) => ({
              id: s.id,
              name: s.name,
              targetCount: s.targetCount,
              _count: s._count,
            })),
          }))}
        />
      </div>
    </div>
  );
}
