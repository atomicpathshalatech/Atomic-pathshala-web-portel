import { Metadata } from "next";
import { requireGamificationAdmin } from "@/lib/gamification/admin-guard";
import { XpManagementConsole } from "@/components/team-portal/XpManagementConsole";

export const metadata: Metadata = {
  title: "XP & Gamification Management — Super Admin",
};

export const dynamic = "force-dynamic";

export default async function XpManagementPage() {
  // Authorize Super Admin / Gamification Admin
  await requireGamificationAdmin();

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6">
      <XpManagementConsole />
    </div>
  );
}
