import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { requireTeamSession } from "@/lib/auth/session";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { AppReleasesManager } from "@/components/team-portal/AppReleasesManager";

export const metadata: Metadata = {
  title: "App Releases | Team Portal",
};

export default async function AppReleasesPage() {
  const { permissions } = await requireTeamSession();
  if (!permissions.has(PERMISSIONS.APP_RELEASE_MANAGE)) redirect("/team");
  return <AppReleasesManager />;
}
