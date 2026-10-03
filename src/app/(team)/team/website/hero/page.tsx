import type { Metadata } from "next";
import { requireTeamSession } from "@/lib/auth/session";
import { isSuperAdminUser } from "@/lib/rbac/guard";
import { prisma } from "@/lib/db";
import { HeroImageManager } from "@/components/home-cms/HeroImageManager";
import { SuperAdminOnlyNotice } from "@/components/team-portal/SuperAdminOnlyNotice";

export const metadata: Metadata = { title: "Homepage Hero Image — Website Builder" };
export const dynamic = "force-dynamic";

export default async function HeroImagePage() {
  const { user } = await requireTeamSession();
  if (!(await isSuperAdminUser(user.id))) return <SuperAdminOnlyNotice />;

  const hero = await prisma.homeHero.findUnique({ where: { id: "singleton" } }).catch(() => null);

  return (
    <div className="space-y-stack-lg max-w-3xl">
      <div>
        <h1 className="font-headline-lg text-headline-lg text-on-surface">Homepage Hero Image</h1>
        <p className="font-body-md text-body-md text-on-surface-variant">
          The picture next to “Learn Better. Practice More. Score Higher.” at the top of the homepage. With no image, the built-in illustration is shown.
          The banner slider below the hero comes from Banners (status Active).
        </p>
      </div>
      <HeroImageManager
        initial={{ imageUrl: hero?.imageUrl ?? "", mobileImageUrl: hero?.mobileImageUrl ?? "", altText: hero?.altText ?? "" }}
      />
    </div>
  );
}
