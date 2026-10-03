import type { Metadata } from "next";
import Link from "next/link";
import { requireTeamSession } from "@/lib/auth/session";
import { isSuperAdminUser } from "@/lib/rbac/guard";
import { prisma } from "@/lib/db";
import { getPublicHomeData } from "@/lib/public-home";
import { DEFAULT_LAYOUT, type LayoutSection } from "@/lib/home-templates";
import { PublicHeader } from "@/components/public-home/PublicHeader";
import { HomeSections } from "@/components/public-home/HomeSections";
import { PublicFooter } from "@/components/public-home/TrustSections";
import { SuperAdminOnlyNotice } from "@/components/team-portal/SuperAdminOnlyNotice";

export const metadata: Metadata = { title: "Homepage preview (draft)", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

/** Website Builder → Preview: the DRAFT sections exactly as the homepage would show them. Super admin only. */
export default async function HomepagePreviewPage() {
  const { user } = await requireTeamSession();
  if (!(await isSuperAdminUser(user.id))) return <SuperAdminOnlyNotice />;

  const [rows, data] = await Promise.all([prisma.homePageSection.findMany({ orderBy: { order: "asc" } }), getPublicHomeData()]);
  const sections: LayoutSection[] = rows.length
    ? rows.map((r) => ({
        id: r.id,
        type: r.type,
        title: r.title,
        subtitle: r.subtitle,
        visible: r.visible,
        visibleDesktop: r.visibleDesktop,
        visibleMobile: r.visibleMobile,
        config: (r.config ?? {}) as Record<string, unknown>,
        background: r.background,
        padding: r.padding,
      }))
    : DEFAULT_LAYOUT;

  return (
    <>
      <div className="sticky top-0 z-[60] flex flex-wrap items-center justify-center gap-x-3 gap-y-1 bg-amber-400 px-4 py-2 text-center text-sm font-semibold text-amber-950">
        PREVIEW — ye draft hai, abhi live nahi hai. “Sirf paid/free/guest” wale sections aapke account ke hisaab se dikhte hain.
        <Link href="/team/website" className="underline">
          Website Builder par wapas
        </Link>
      </div>
      <PublicHeader />
      <main className="overflow-x-hidden bg-white">
        <HomeSections sections={sections} />
      </main>
      <PublicFooter socials={data.socials} />
    </>
  );
}
