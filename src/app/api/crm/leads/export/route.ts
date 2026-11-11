import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { requirePermission, UnauthorizedError } from "@/lib/rbac/guard";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { prisma } from "@/lib/db";

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) throw new UnauthorizedError();
    await requirePermission(session.user.id, PERMISSIONS.LEAD_READ);

    const leads = await prisma.cRMLead.findMany({
      where: { deletedAt: null },
      orderBy: { createdAt: "desc" },
      take: 1000,
      include: {
        assignedUser: { select: { name: true } },
        campaign: { select: { name: true } },
      },
    });

    const headers = [
      "Lead Code",
      "Student Name",
      "Mobile",
      "Email",
      "Status",
      "Priority",
      "Score",
      "Target Exam",
      "Class",
      "Medium",
      "City",
      "State",
      "Source",
      "Campaign",
      "Assigned Counsellor",
      "Created Date",
    ];

    const rows = leads.map((l) => [
      `"${l.leadCode}"`,
      `"${(l.name || "").replace(/"/g, '""')}"`,
      `"${l.phone}"`,
      `"${l.email || ""}"`,
      `"${l.status}"`,
      `"${l.priority}"`,
      `"${l.score}"`,
      `"${l.targetExam || ""}"`,
      `"${l.studentClass || ""}"`,
      `"${l.medium || ""}"`,
      `"${l.city || ""}"`,
      `"${l.state || ""}"`,
      `"${l.source}"`,
      `"${(l.campaign?.name || l.campaignName || "").replace(/"/g, '""')}"`,
      `"${(l.assignedUser?.name || "Unassigned").replace(/"/g, '""')}"`,
      `"${l.createdAt.toISOString().slice(0, 10)}"`,
    ]);

    const csvContent = [headers.join(","), ...rows.map((r) => r.join(","))].join("\r\n");

    return new NextResponse(csvContent, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="atomic_crm_leads_${new Date().toISOString().slice(0, 10)}.csv"`,
      },
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Export failed" }, { status: 500 });
  }
}
