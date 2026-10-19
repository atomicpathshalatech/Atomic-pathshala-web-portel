import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { hasPermission } from "@/lib/rbac/guard";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { PyqImportReview } from "@/components/pyq/PyqImportReview";

export const metadata: Metadata = { title: "PYQ Import Review" };

export default async function PyqImportReviewPage({ params }: { params: { jobId: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/login");
  if (!(await hasPermission(session.user.id, PERMISSIONS.QUESTION_IMPORT))) redirect("/team");
  const canApprove =
    (await hasPermission(session.user.id, PERMISSIONS.QUESTION_APPROVE)) || (await hasPermission(session.user.id, PERMISSIONS.QUESTION_VERIFY));
  return <PyqImportReview jobId={params.jobId} canApprove={canApprove} />;
}
