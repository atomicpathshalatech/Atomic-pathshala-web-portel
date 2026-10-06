import React from "react";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { hasPermission } from "@/lib/rbac/guard";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { getWhatsAppSettings } from "@/lib/whatsapp/settings";
import { WhatsAppAutomationDashboard } from "@/components/team/whatsapp/WhatsAppAutomationDashboard";

export const metadata: Metadata = {
  title: "WhatsApp Automation & Broadcast | Atomic Pathshala",
};

export default async function WhatsAppAutomationPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/login");

  const canRead = await hasPermission(session.user.id, PERMISSIONS.WHATSAPP_READ);
  if (!canRead) redirect("/team");

  const canManage = await hasPermission(session.user.id, PERMISSIONS.WHATSAPP_MANAGE);

  const [settings, batches] = await Promise.all([
    getWhatsAppSettings(),
    prisma.batch.findMany({
      where: { status: { in: ["ACTIVE", "UPCOMING"] } },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
  ]);

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <WhatsAppAutomationDashboard
        initialSettings={settings}
        batches={batches}
        canManage={canManage}
      />
    </div>
  );
}
