import type { Metadata } from "next";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { ModuleRedesignStudio } from "@/components/team-portal/ModuleRedesignStudio";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Module Redesign Studio | Atomic Pathshala",
};

export default async function ModuleRedesignPage() {
  const session = await getServerSession(authOptions);
  let userRole = "STAFF";

  if (session?.user?.id) {
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      include: { role: true },
    });
    userRole = user?.role?.name || "STAFF";
  }

  return (
    <div className="p-2 md:p-6">
      <ModuleRedesignStudio userRole={userRole} />
    </div>
  );
}
