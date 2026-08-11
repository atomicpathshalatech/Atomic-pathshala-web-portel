import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { requireTeamSession } from "@/lib/auth/session";
import { hasPermission } from "@/lib/rbac/guard";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { prisma } from "@/lib/db";
import { DocumentUploadForm } from "@/components/team-portal/DocumentUploadForm";

export const metadata: Metadata = { title: "My Documents" };

const STATUS_COPY: Record<string, string> = {
  PENDING_DOCUMENTS: "Upload the documents below to begin verification.",
  PENDING_REVIEW: "Your documents are under review by HR/Academic Head.",
  PENDING_CONTRACT: "Documents verified — your contract will be sent shortly.",
  ACTIVE: "You're fully onboarded.",
  REJECTED: "Your application was not approved. Contact HR for details.",
};

export default async function MyDocumentsPage() {
  const { session, user } = await requireTeamSession();

  const canUpload = await hasPermission(user.id, PERMISSIONS.DOCUMENT_UPLOAD_SELF);
  if (!canUpload) redirect("/team");

  const teacher = await prisma.teacher.findUnique({
    where: { userId: session.user.id },
    include: { documents: { orderBy: { createdAt: "desc" } } },
  });
  if (!teacher) redirect("/team");

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="font-headline-lg text-headline-lg text-primary">My Documents</h1>
        <p className="text-on-surface-variant font-body-md mt-1">
          {STATUS_COPY[teacher.onboardingStatus] ?? ""}
        </p>
      </div>
      <DocumentUploadForm existingDocuments={teacher.documents} />
    </div>
  );
}
