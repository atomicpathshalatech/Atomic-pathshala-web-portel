import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { hasPermission } from "@/lib/rbac/guard";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { redirect } from "next/navigation";

/**
 * Server-side gate for the WHOLE Communication Center — every page under
 * /team/communication (logs, birthday, and any page added later) inherits
 * this check for free, so a new page can never accidentally ship without
 * it. This is the actual enforcement point (spec section 13): the "hidden
 * unless you have the permission" nav link in (team)/team/layout.tsx is
 * cosmetic only, not the security boundary. A Teacher or Student hitting
 * any /team/communication/* URL directly never reaches the page component
 * or any of its data fetching.
 */
export default async function CommunicationLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/login");

  const canAccess = await hasPermission(session.user.id, PERMISSIONS.COMMUNICATION_CENTER_ACCESS);
  if (!canAccess) {
    return (
      <div className="mx-auto max-w-lg mt-16 rounded-2xl border border-rose-200 bg-rose-50 dark:border-rose-900/50 dark:bg-rose-950/30 p-8 text-center">
        <span className="material-symbols-outlined text-4xl text-rose-500">block</span>
        <h1 className="mt-3 text-lg font-bold text-slate-900 dark:text-white">Access Denied</h1>
        <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
          The Communication Center is restricted to Admin accounts. Your role does not have
          permission to view this page.
        </p>
      </div>
    );
  }

  return <>{children}</>;
}
