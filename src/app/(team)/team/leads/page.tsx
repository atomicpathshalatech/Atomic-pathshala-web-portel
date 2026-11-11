import type { Metadata } from "next";
import { requireTeamSession } from "@/lib/auth/session";
import { hasPermission } from "@/lib/rbac/guard";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { prisma } from "@/lib/db";
import { getOutreachUsers } from "@/lib/integrations/outreach-leads";
import { getCrmDashboardMetrics, getLeads } from "@/lib/crm/crm-service";
import { EnterpriseCrmPortal } from "@/components/crm/EnterpriseCrmPortal";

export const metadata: Metadata = {
  title: "Growth & CRM — Atomic Pathshala",
  description: "Enterprise CRM, Lead Management, Counselling & Student Acquisition System",
};

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

  // Fetch real database metrics, initial leads, active courses, batches and counsellors
  const [initialMetrics, leadsResult, courses, batches, counselors] = await Promise.all([
    getCrmDashboardMetrics(),
    getLeads({ page: 1, limit: 25 }),
    prisma.course.findMany({
      where: { isPublished: true },
      select: { id: true, title: true, slug: true },
      orderBy: { title: "asc" },
    }),
    prisma.batch.findMany({
      select: { id: true, name: true, code: true, courseId: true, status: true },
      orderBy: { name: "asc" },
    }),
    getOutreachUsers(),
  ]);

  // Format leads to match client CrmLead format
  const initialLeads = leadsResult.leads.map((l) => ({
    ...l,
    createdAt: l.createdAt.toISOString(),
    updatedAt: l.updatedAt.toISOString(),
    lastContactedAt: l.lastContactedAt ? l.lastContactedAt.toISOString() : null,
    nextFollowUpAt: l.nextFollowUpAt ? l.nextFollowUpAt.toISOString() : null,
    followUps: l.followUps.map((fu) => ({
      ...fu,
      scheduledAt: fu.scheduledAt.toISOString(),
    })),
  }));

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <EnterpriseCrmPortal
        initialMetrics={initialMetrics}
        initialLeads={initialLeads as any}
        counselors={counselors}
        courses={courses}
        batches={batches}
        canUpdate={canUpdate}
        canAssign={canAssign}
      />
    </div>
  );
}
