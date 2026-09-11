import type { Metadata } from "next";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { hasPermission } from "@/lib/rbac/guard";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { CreativeManagementConsole } from "@/components/team-portal/CreativeManagementConsole";

export const metadata: Metadata = { title: "Creative Management — Atomic Pathshala" };

export default async function CreativeManagementPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/login");

  const canAccess = await hasPermission(session.user.id, PERMISSIONS.COMMUNICATION_CENTER_ACCESS);
  if (!canAccess) {
    return (
      <div className="mx-auto max-w-lg mt-16 rounded-2xl border border-rose-200 bg-rose-50 dark:border-rose-900/50 dark:bg-rose-950/30 p-8 text-center">
        <span className="material-symbols-outlined text-4xl text-rose-500">block</span>
        <h1 className="mt-3 text-lg font-bold text-slate-900 dark:text-white">Access Denied</h1>
        <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">Creative Management is restricted to Admin accounts.</p>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-4">
      <div>
        <h1 className="text-xl font-bold text-slate-900 dark:text-white">🎨 Creative Management</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
          Every auto-generated batch/chapter/lecture/test-series creative, plus the templates and
          backgrounds they're built from. Educators upload their Creative PNG once, from their
          profile — everything here just combines that with content already in the platform.
        </p>
      </div>
      <CreativeManagementConsole />
    </div>
  );
}
