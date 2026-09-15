import type { Metadata } from "next";
import { requireTeamSession } from "@/lib/auth/session";
import { hasPermission } from "@/lib/rbac/guard";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { redirect } from "next/navigation";
import { LoginDevicesAdminClient } from "@/components/team-portal/LoginDevicesAdminClient";

export const metadata: Metadata = {
  title: "Login Devices & Sessions | Team Portal",
};

export default async function TeamLoginDevicesPage() {
  const { user } = await requireTeamSession();
  const canManage = await hasPermission(user.id, PERMISSIONS.SECURITY_DEVICE_MANAGE);
  if (!canManage) {
    redirect("/team");
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-black tracking-tight text-slate-900 dark:text-white">
          Login Devices & Session Control
        </h1>
        <p className="text-sm text-slate-500 mt-1">
          Monitor active user devices across Laptop/Desktop, Tablet, and Mobile, manage device permissions, and control remote sessions.
        </p>
      </div>

      <LoginDevicesAdminClient />
    </div>
  );
}
