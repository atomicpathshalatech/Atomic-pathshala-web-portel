import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { hasPermission } from "@/lib/rbac/guard";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { TestSeriesForm } from "@/components/team-portal/TestSeriesForm";

export const metadata: Metadata = {
  title: "Create Test Series",
};

export default async function NewTestSeriesPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/login");

  const canCreate = await hasPermission(session.user.id, PERMISSIONS.TEST_PUBLISH);
  if (!canCreate) redirect("/team/test-series");

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h1 className="font-headline-lg text-headline-lg text-primary">Create Test Series</h1>
        <p className="text-on-surface-variant font-body-md mt-1">
          A unique code (e.g. TS0001) will be generated automatically.
        </p>
      </div>
      <TestSeriesForm />
    </div>
  );
}
