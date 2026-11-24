import type { Metadata } from "next";
import Link from "next/link";
import { requireTeamSession } from "@/lib/auth/session";
import { hasPermission, isSuperAdminUser } from "@/lib/rbac/guard";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { prisma } from "@/lib/db";
import { SeoManager } from "@/components/home-cms/SeoManager";
import { SuperAdminOnlyNotice } from "@/components/team-portal/SuperAdminOnlyNotice";

export const metadata: Metadata = { title: "SEO — Website Builder" };

export default async function SeoPage() {
  const { user } = await requireTeamSession();
  if (!(await isSuperAdminUser(user.id))) return <SuperAdminOnlyNotice />;
  const canManage = await hasPermission(user.id, PERMISSIONS.SEO_MANAGE);
  if (!canManage) {
    return <div className="glass-card rounded-2xl p-8 text-center text-on-surface-variant font-body-md">You don&apos;t have access to SEO settings.</div>;
  }

  const seo = await prisma.pageSeo.findUnique({ where: { pageKey: "home" } });

  return (
    <div className="space-y-stack-lg max-w-3xl">
      <div className="p-4 rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 text-white flex items-center justify-between shadow-md">
        <div className="space-y-0.5">
          <div className="text-xs font-bold uppercase tracking-wider text-blue-200">Unified SEO Management Suite</div>
          <div className="text-sm font-black">Looking for Global SEO, Faculty SEO &amp; Keywords?</div>
        </div>
        <Link
          href="/team/seo"
          className="px-3.5 py-2 rounded-xl bg-white text-blue-600 font-bold text-xs hover:bg-blue-50 transition-colors shrink-0 shadow-sm"
        >
          Open SEO Manager →
        </Link>
      </div>

      <div>
        <h1 className="font-headline-lg text-headline-lg text-on-surface">SEO — Homepage</h1>
        <p className="font-body-md text-body-md text-on-surface-variant">
          Search and social preview metadata for the public homepage.
        </p>
      </div>
      <SeoManager
        pageKey="home"
        initial={{
          metaTitle: seo?.metaTitle ?? "",
          metaDescription: seo?.metaDescription ?? "",
          keywords: seo?.keywords ?? "",
          ogTitle: seo?.ogTitle ?? "",
          ogDescription: seo?.ogDescription ?? "",
          ogImageUrl: seo?.ogImageUrl ?? "",
          canonicalUrl: seo?.canonicalUrl ?? "",
        }}
      />
    </div>
  );
}
