import type { Metadata } from "next";
import { requireTeamSession } from "@/lib/auth/session";
import { hasPermission } from "@/lib/rbac/guard";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { prisma } from "@/lib/db";
import { BannerManager } from "@/components/home-cms/BannerManager";

export const metadata: Metadata = { title: "Banners — Website Builder" };

export default async function BannersPage() {
  const { user } = await requireTeamSession();
  const canManage = await hasPermission(user.id, PERMISSIONS.BANNER_MANAGE);
  if (!canManage) {
    return <div className="glass-card rounded-2xl p-8 text-center text-on-surface-variant font-body-md">You don&apos;t have access to Banners.</div>;
  }

  const banners = await prisma.banner.findMany({ orderBy: [{ priority: "desc" }, { order: "asc" }] });

  return (
    <div className="space-y-stack-lg max-w-5xl">
      <div>
        <h1 className="font-headline-lg text-headline-lg text-on-surface">Banners</h1>
        <p className="font-body-md text-body-md text-on-surface-variant">
          Promotional banners for the IMAGE_BANNER homepage section and other campaign placements.
        </p>
      </div>
      <BannerManager
        initialBanners={banners.map((b) => ({
          id: b.id,
          title: b.title,
          subtitle: b.subtitle,
          imageUrl: b.imageUrl,
          ctaText: b.ctaText,
          ctaUrl: b.ctaUrl,
          status: b.status,
          priority: b.priority,
        }))}
      />
    </div>
  );
}
