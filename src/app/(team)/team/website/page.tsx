import type { Metadata } from "next";
import Link from "next/link";
import { requireTeamSession } from "@/lib/auth/session";
import { hasPermission } from "@/lib/rbac/guard";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { prisma } from "@/lib/db";
import { HomeSectionBuilder } from "@/components/home-cms/HomeSectionBuilder";

export const metadata: Metadata = {
  title: "Website Builder — Team Portal",
};

export default async function HomeBuilderPage() {
  const { user } = await requireTeamSession();
  const canView = await hasPermission(user.id, PERMISSIONS.HOME_VIEW);
  if (!canView) {
    return (
      <div className="glass-card rounded-2xl p-8 text-center text-on-surface-variant font-body-md">
        You don&apos;t have access to the Website Builder.
      </div>
    );
  }

  const [canCreate, canEdit, canDelete, canPublish, canReorder, sections, liveVersion] = await Promise.all([
    hasPermission(user.id, PERMISSIONS.HOME_CREATE),
    hasPermission(user.id, PERMISSIONS.HOME_EDIT),
    hasPermission(user.id, PERMISSIONS.HOME_DELETE),
    hasPermission(user.id, PERMISSIONS.HOME_PUBLISH),
    hasPermission(user.id, PERMISSIONS.HOME_REORDER),
    prisma.homePageSection.findMany({ orderBy: { order: "asc" } }),
    prisma.homePageVersion.findFirst({ where: { unpublishedAt: null }, orderBy: { publishedAt: "desc" } }),
  ]);

  return (
    <div className="space-y-stack-lg max-w-6xl">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-headline-lg text-headline-lg text-on-surface">Website Builder</h1>
          <p className="font-body-md text-body-md text-on-surface-variant">
            Build the public homepage from real sections — nothing here is live until you Publish.
          </p>
        </div>
        <nav className="flex flex-wrap gap-2">
          <Link href="/team/website/versions" className="text-label-sm text-primary hover:underline px-3 py-1.5 rounded-lg bg-primary/10">
            Version History
          </Link>
          <Link href="/team/website/banners" className="text-label-sm text-primary hover:underline px-3 py-1.5 rounded-lg bg-primary/10">
            Banners
          </Link>
          <Link href="/team/website/media" className="text-label-sm text-primary hover:underline px-3 py-1.5 rounded-lg bg-primary/10">
            Media Library
          </Link>
          <Link href="/team/website/testimonials" className="text-label-sm text-primary hover:underline px-3 py-1.5 rounded-lg bg-primary/10">
            Testimonials
          </Link>
          <Link href="/team/website/faqs" className="text-label-sm text-primary hover:underline px-3 py-1.5 rounded-lg bg-primary/10">
            FAQs
          </Link>
          <Link href="/team/website/footer" className="text-label-sm text-primary hover:underline px-3 py-1.5 rounded-lg bg-primary/10">
            Footer
          </Link>
          <Link href="/team/website/seo" className="text-label-sm text-primary hover:underline px-3 py-1.5 rounded-lg bg-primary/10">
            SEO
          </Link>
        </nav>
      </div>

      <div className="glass-card rounded-2xl p-5 flex flex-wrap items-center gap-4">
        <div className={`w-3 h-3 rounded-full ${liveVersion ? "bg-green-500" : "bg-on-surface-variant/40"}`} />
        <p className="font-label-md text-label-md text-on-surface">
          {liveVersion
            ? `Live: version ${liveVersion.versionNumber}, published ${liveVersion.publishedAt.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}`
            : "Nothing published yet — the site is showing the static fallback homepage."}
        </p>
      </div>

      <HomeSectionBuilder
        initialSections={sections.map((s) => ({
          id: s.id,
          type: s.type,
          title: s.title,
          subtitle: s.subtitle,
          order: s.order,
          visible: s.visible,
          visibleDesktop: s.visibleDesktop,
          visibleMobile: s.visibleMobile,
          config: s.config as Record<string, unknown>,
          background: s.background,
          padding: s.padding,
        }))}
        canCreate={canCreate}
        canEdit={canEdit}
        canDelete={canDelete}
        canPublish={canPublish}
        canReorder={canReorder}
      />
    </div>
  );
}
