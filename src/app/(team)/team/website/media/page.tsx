import type { Metadata } from "next";
import { requireTeamSession } from "@/lib/auth/session";
import { hasPermission } from "@/lib/rbac/guard";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { prisma } from "@/lib/db";
import { MediaLibrary } from "@/components/home-cms/MediaLibrary";

export const metadata: Metadata = { title: "Media Library — Website Builder" };

export default async function MediaPage() {
  const { user } = await requireTeamSession();
  const canManage = await hasPermission(user.id, PERMISSIONS.MEDIA_MANAGE);
  if (!canManage) {
    return <div className="glass-card rounded-2xl p-8 text-center text-on-surface-variant font-body-md">You don&apos;t have access to the Media Library.</div>;
  }

  const assets = await prisma.mediaAsset.findMany({ orderBy: { createdAt: "desc" }, take: 200 });

  return (
    <div className="space-y-stack-lg max-w-5xl">
      <div>
        <h1 className="font-headline-lg text-headline-lg text-on-surface">Media Library</h1>
        <p className="font-body-md text-body-md text-on-surface-variant">
          Upload images once, reuse the URL across banners, sections, and testimonials.
        </p>
      </div>
      <MediaLibrary
        initialAssets={assets.map((a) => ({ id: a.id, url: a.url, fileName: a.fileName, sizeBytes: a.sizeBytes }))}
      />
    </div>
  );
}
