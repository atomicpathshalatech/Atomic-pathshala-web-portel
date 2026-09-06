import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { hasPermission } from "@/lib/rbac/guard";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { UnifiedQuestionEditor } from "@/components/questions/UnifiedQuestionEditor";

export const metadata: Metadata = {
  title: "Create Question (Bilingual) — Unified Question Studio",
};

export default async function NewBilingualQuestionPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/login");

  const canCreate = await hasPermission(session.user.id, PERMISSIONS.QUESTION_CREATE);
  if (!canCreate) redirect("/team/questions");

  return (
    <div className="w-full space-y-6">
      <UnifiedQuestionEditor mode="bank" onCancelHref="/team/questions" />
    </div>
  );
}
