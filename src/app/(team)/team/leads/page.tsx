import type { Metadata } from "next";
import { requireTeamSession } from "@/lib/auth/session";
import { hasPermission } from "@/lib/rbac/guard";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { getOutreachLeads, getOutreachUsers, OutreachIntegrationError } from "@/lib/integrations/outreach-leads";
import { LeadsManager } from "@/components/team-portal/LeadsManager";

export const metadata: Metadata = { title: "CRM / Leads — Team Portal" };

export default async function LeadsPage() {
  const { user } = await requireTeamSession();
  const canView = await hasPermission(user.id, PERMISSIONS.LEAD_READ);
  if (!canView) {
    return (
      <div className="glass-card rounded-2xl p-8 text-center text-on-surface-variant font-body-md">
        You don&apos;t have access to CRM / Leads.
      </div>
    );
  }

  const [canUpdate, canAssign] = await Promise.all([
    hasPermission(user.id, PERMISSIONS.LEAD_UPDATE),
    hasPermission(user.id, PERMISSIONS.LEAD_ASSIGN),
  ]);

  let leads: Awaited<ReturnType<typeof getOutreachLeads>> = [];
  let counselors: Awaited<ReturnType<typeof getOutreachUsers>> = [];
  let loadError: string | null = null;
  try {
    [leads, counselors] = await Promise.all([getOutreachLeads(), getOutreachUsers()]);
  } catch (error) {
    loadError = error instanceof OutreachIntegrationError ? error.message : "Could not load leads from the CRM.";
  }

  return (
    <div className="space-y-stack-lg max-w-6xl">
      <div>
        <h1 className="font-headline-lg text-headline-lg text-on-surface">CRM / Leads</h1>
        <p className="font-body-md text-body-md text-on-surface-variant">
          Live from atomic-outreach-system — this is a management view, not a separate lead store. Full
          calling, campaigns and follow-up tools stay in the CRM itself.
        </p>
      </div>

      {loadError ? (
        <div className="glass-card rounded-2xl p-8 text-center text-error font-body-md">{loadError}</div>
      ) : (
        <LeadsManager initialLeads={leads} counselors={counselors} canUpdate={canUpdate} canAssign={canAssign} />
      )}
    </div>
  );
}
