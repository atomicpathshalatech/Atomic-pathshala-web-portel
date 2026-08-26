import type { Metadata } from "next";
import { requireTeamSession } from "@/lib/auth/session";
import { hasPermission } from "@/lib/rbac/guard";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { prisma } from "@/lib/db";
import { SeoManager } from "@/components/home-cms/SeoManager";

export const metadata: Metadata = { title: "SEO — Website Builder" };

export default async function SeoPage() {
  const { user } = await requireTeamSession();
  const canManage = await hasPermission(user.id, PERMISSIONS.SEO_MANAGE);
  if (!canManage) {
    return <div className="glass-card rounded-2xl p-8 text-center text-on-surface-variant font-body-md">You don&apos;t have access to SEO settings.</div>;
  }

  const seo = await prisma.pageSeo.findUnique({ where: { pageKey: "home" } });

  return (
    <div className="space-y-stack-lg max-w-3xl">
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
