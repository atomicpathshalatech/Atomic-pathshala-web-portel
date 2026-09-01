import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { hasPermission } from "@/lib/rbac/guard";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { PredictorDataManager } from "@/components/team-portal/PredictorDataManager";

export const metadata: Metadata = {
  title: "Rank & College Predictor Data",
};

export default async function PredictorDataPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/login");

  const canManage = await hasPermission(session.user.id, PERMISSIONS.PREDICTOR_DATA_MANAGE);
  if (!canManage) redirect("/team");

  const [rankPoints, allotments] = await Promise.all([
    prisma.rankTrendPoint.findMany({ orderBy: [{ year: "desc" }, { marks: "desc" }], take: 200 }),
    prisma.collegeAllotment.findMany({ orderBy: [{ year: "desc" }, { rank: "asc" }], take: 200 }),
  ]);

  return (
    <div className="space-y-stack-lg max-w-5xl">
      <div>
        <h1 className="font-headline-lg text-headline-lg text-primary tracking-tight">
          Rank &amp; College Predictor Data
        </h1>
        <p className="text-on-surface-variant font-body-md mt-1">
          Reference data behind the student-facing predictor. Real historical data still needs to be
          imported from the old Test Portal (Phase C, blocked on Supabase access) — this table works
          the same either way, so imported rows will show up here once that runs.
        </p>
      </div>
      <PredictorDataManager initialRankPoints={rankPoints} initialAllotments={allotments} />
    </div>
  );
}
