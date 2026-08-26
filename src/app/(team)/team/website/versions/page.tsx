import type { Metadata } from "next";
import { requireTeamSession } from "@/lib/auth/session";
import { hasPermission } from "@/lib/rbac/guard";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { prisma } from "@/lib/db";
import { VersionHistoryList } from "@/components/home-cms/VersionHistoryList";

export const metadata: Metadata = {
  title: "Version History — Website Builder",
};

export default async function HomeVersionsPage() {
  const { user } = await requireTeamSession();
  const canView = await hasPermission(user.id, PERMISSIONS.HOME_VIEW);
  if (!canView) {
    return (
      <div className="glass-card rounded-2xl p-8 text-center text-on-surface-variant font-body-md">
        You don&apos;t have access to the Website Builder.
      </div>
    );
  }
  const canPublish = await hasPermission(user.id, PERMISSIONS.HOME_PUBLISH);

  const versions = await prisma.homePageVersion.findMany({
    orderBy: { versionNumber: "desc" },
    take: 50,
    include: { publishedBy: { select: { name: true } } },
  });

  return (
    <div className="space-y-stack-lg max-w-4xl">
      <div>
        <h1 className="font-headline-lg text-headline-lg text-on-surface">Version History</h1>
        <p className="font-body-md text-body-md text-on-surface-variant">
          Every publish is kept forever — restore any version without losing what came after it.
        </p>
      </div>
      <VersionHistoryList
        canRestore={canPublish}
        versions={versions.map((v) => ({
          id: v.id,
          versionNumber: v.versionNumber,
          note: v.note,
          publishedAt: v.publishedAt.toISOString(),
          unpublishedAt: v.unpublishedAt ? v.unpublishedAt.toISOString() : null,
          publishedByName: v.publishedBy.name,
        }))}
      />
    </div>
  );
}
