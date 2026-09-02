import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { hasPermission } from "@/lib/rbac/guard";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { AtomicWhiteboardStudio } from "@/components/whiteboard/AtomicWhiteboardStudio";

export const metadata: Metadata = {
  title: "Atomic Whiteboard Studio",
};

export default async function TeamWhiteboardPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/login");

  const canAccess = await hasPermission(session.user.id, PERMISSIONS.WHITEBOARD_ACCESS);
  if (!canAccess) redirect("/team");

  const teacher = await prisma.teacher.findUnique({
    where: { userId: session.user.id },
    include: { user: { select: { name: true } } },
  });

  return (
    <div className="w-full">
      <AtomicWhiteboardStudio
        classTitle="Atomic Whiteboard Studio"
        teacherName={teacher?.user?.name || session.user.name || "Educator"}
        batchName="Faculty Studio"
      />
    </div>
  );
}
