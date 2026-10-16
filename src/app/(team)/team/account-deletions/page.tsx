import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { requireTeamSession } from "@/lib/auth/session";
import { listPendingDeletions } from "@/lib/account/deletion";
import { AccountDeletionsList } from "@/components/team-portal/AccountDeletionsList";

export const metadata: Metadata = { title: "Account Deletions | Team Portal" };
export const dynamic = "force-dynamic";

export default async function AccountDeletionsPage() {
  const { user } = await requireTeamSession();
  if (user.role?.name !== "SUPER_ADMIN" && user.role?.name !== "FOUNDER") redirect("/team");
  const pending = await listPendingDeletions();
  return (
    <div className="mx-auto max-w-4xl space-y-4">
      <div>
        <h1 className="text-2xl font-black text-on-surface">Account Deletions</h1>
        <p className="text-sm text-on-surface-variant">
          Students who asked to delete their account (app Settings or /delete-account). Their account is already closed. Erase the personal data
          within 30 days — Google Play requires it. Payment records and scores stay, without the name.
        </p>
      </div>
      <AccountDeletionsList initial={pending} />
    </div>
  );
}
