import type { Metadata } from "next";
import Link from "next/link";
import { requireTeamSession } from "@/lib/auth/session";
import { hasPermission, isSuperAdminUser } from "@/lib/rbac/guard";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { prisma } from "@/lib/db";
import { HomeTemplateBuilder } from "@/components/home-cms/HomeTemplateBuilder";
import { getPublicHomeData } from "@/lib/public-home";
import { SuperAdminOnlyNotice } from "@/components/team-portal/SuperAdminOnlyNotice";

export const metadata: Metadata = {
  title: "Website Builder — Team Portal",
};

export default async function HomeBuilderPage() {
  const { user } = await requireTeamSession();
  if (!(await isSuperAdminUser(user.id))) return <SuperAdminOnlyNotice />;
  const canView =
    (await hasPermission(user.id, PERMISSIONS.HOME_VIEW)) ||
    (await hasPermission(user.id, PERMISSIONS.TEAM_PORTAL_ACCESS));
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
    // Newest version decides what is live (an unpublished newest version = default homepage).
    prisma.homePageVersion.findFirst({ orderBy: { publishedAt: "desc" } }),
  ]);
  const home = await getPublicHomeData();

  return (
    <div className="space-y-stack-lg max-w-6xl">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-headline-lg text-headline-lg text-on-surface">Website Builder</h1>
          <p className="font-body-md text-body-md text-on-surface-variant">
            Poora homepage yahan se: template chuniye, form bhariye, upar/neeche kariye, kaun dekhe chuniye — Preview karke Publish kariye.
          </p>
        </div>
        <nav className="flex flex-wrap gap-2">
          <Link href="/team/website/versions" className="text-label-sm text-primary hover:underline px-3 py-1.5 rounded-lg bg-primary/10">
            Version History
          </Link>
          <Link href="/team/website/banners" className="text-label-sm text-primary hover:underline px-3 py-1.5 rounded-lg bg-primary/10">
            Banners
          </Link>
          <Link href="/team/website/hero" className="text-label-sm text-primary hover:underline px-3 py-1.5 rounded-lg bg-primary/10">
            Homepage Hero Image
          </Link>
          <Link href="/team/website/blog" className="text-label-sm text-primary hover:underline px-3 py-1.5 rounded-lg bg-primary/10">
            Blog
          </Link>
          <Link href="/team/website/media" className="text-label-sm text-primary hover:underline px-3 py-1.5 rounded-lg bg-primary/10">
            Media Library
          </Link>
          <Link href="/team/website/testimonials" className="text-label-sm text-primary hover:underline px-3 py-1.5 rounded-lg bg-primary/10">
            Testimonials
          </Link>
          <Link href="/team/website/founder" className="text-label-sm text-primary hover:underline px-3 py-1.5 rounded-lg bg-primary/10">
            About the Founder
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

      <HomeTemplateBuilder
        initialSections={sections.map((s) => ({
          id: s.id,
          type: s.type,
          title: s.title,
          subtitle: s.subtitle,
          order: s.order,
          visible: s.visible,
          visibleDesktop: s.visibleDesktop,
          visibleMobile: s.visibleMobile,
          config: (s.config ?? {}) as Record<string, unknown>,
        }))}
        live={liveVersion ? { versionNumber: liveVersion.versionNumber, publishedAt: liveVersion.publishedAt.toISOString(), unpublished: !!liveVersion.unpublishedAt } : null}
        options={{
          batches: home.batches.map((b) => ({ id: b.id, name: b.name })),
          teachers: home.faculty.map((f) => ({ slug: f.slug, name: f.subjects.length ? `${f.name} (${f.subjects.join(", ")})` : f.name })),
          testSeries: home.freeSeries.map((t) => ({ id: t.id, name: t.name })),
        }}
        perms={{ canCreate, canEdit, canDelete, canPublish, canReorder }}
      />
    </div>
  );
}
