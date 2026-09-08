import type { Metadata } from "next";
import { requireTeamSession } from "@/lib/auth/session";
import { hasPermission } from "@/lib/rbac/guard";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { prisma } from "@/lib/db";
import { FounderManager, type FounderData } from "@/components/home-cms/FounderManager";
import { parseFounderSocialLinks } from "@/lib/founder";

export const metadata: Metadata = { title: "About the Founder — Website Builder" };

export default async function FounderAdminPage() {
  const { user } = await requireTeamSession();
  const canManage = await hasPermission(user.id, PERMISSIONS.FOUNDER_MANAGE);
  if (!canManage) {
    return (
      <div className="glass-card rounded-2xl p-8 text-center text-on-surface-variant font-body-md">
        You don&apos;t have access to the Founder section.
      </div>
    );
  }

  const row = await prisma.founder.upsert({
    where: { id: "singleton" },
    update: {},
    create: { id: "singleton" },
  });

  const initial: FounderData = {
    name: row.name,
    designation: row.designation,
    photoUrl: row.photoUrl,
    mobilePhotoUrl: row.mobilePhotoUrl,
    shortBio: row.shortBio,
    biography: row.biography,
    education: row.education,
    experience: row.experience,
    teachingPhilosophy: row.teachingPhilosophy,
    vision: row.vision,
    founderMessage: row.founderMessage,
    socialLinks: parseFounderSocialLinks(row.socialLinks),
    isActive: row.isActive,
    seoTitle: row.seoTitle,
    metaDescription: row.metaDescription,
    ogImageUrl: row.ogImageUrl,
    canonicalUrl: row.canonicalUrl,
  };

  return (
    <div className="space-y-stack-lg max-w-4xl">
      <div>
        <h1 className="font-headline-lg text-headline-lg text-on-surface">About the Founder</h1>
        <p className="font-body-md text-body-md text-on-surface-variant">
          Enter verified information only. Nothing is invented — every field is optional and shows
          on the site exactly as typed. Save publishes immediately to the homepage teaser and the
          <span className="font-medium"> /about-founder</span> page.
        </p>
      </div>
      <FounderManager initial={initial} />
    </div>
  );
}
