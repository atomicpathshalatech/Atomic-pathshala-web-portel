import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { hasPermission } from "@/lib/rbac/guard";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { AtomicQuestionEditor } from "@/components/questions/AtomicQuestionEditor";

export const metadata: Metadata = {
  title: "Create Question (Bilingual) — Universal Engine",
};

export default async function NewBilingualQuestionPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/login");

  const canCreate = await hasPermission(session.user.id, PERMISSIONS.QUESTION_CREATE);
  if (!canCreate) redirect("/team/questions");

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <AtomicQuestionEditor onCancelHref="/team/questions" />
    </div>
  );
}
