import type { Metadata } from "next";
import { requireTeamSession } from "@/lib/auth/session";
import { hasPermission, isSuperAdminUser } from "@/lib/rbac/guard";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { prisma } from "@/lib/db";
import { FooterManager } from "@/components/home-cms/FooterManager";
import { SuperAdminOnlyNotice } from "@/components/team-portal/SuperAdminOnlyNotice";

export const metadata: Metadata = { title: "Footer — Website Builder" };

export default async function FooterPage() {
  const { user } = await requireTeamSession();
  if (!(await isSuperAdminUser(user.id))) return <SuperAdminOnlyNotice />;
  const canManage = await hasPermission(user.id, PERMISSIONS.FOOTER_MANAGE);
  if (!canManage) {
    return <div className="glass-card rounded-2xl p-8 text-center text-on-surface-variant font-body-md">You don&apos;t have access to Footer settings.</div>;
  }

  let settings = await prisma.footerSettings.findFirst();
  if (!settings) settings = await prisma.footerSettings.create({ data: {} });

  const columns = await prisma.footerColumn.findMany({
    orderBy: { order: "asc" },
    include: { links: { orderBy: { order: "asc" } } },
  });

  return (
    <div className="space-y-stack-lg max-w-5xl">
      <div>
        <h1 className="font-headline-lg text-headline-lg text-on-surface">Footer</h1>
        <p className="font-body-md text-body-md text-on-surface-variant">
          Contact details, social links, and link columns shown at the bottom of every public page.
        </p>
      </div>
      <FooterManager
        initialSettings={{
          logoUrl: settings.logoUrl,
          description: settings.description,
          copyrightText: settings.copyrightText,
          contactPhone: settings.contactPhone,
          contactEmail: settings.contactEmail,
          address: settings.address,
          socialLinks: socialLinkMap(settings.socialLinks),
        }}
        initialColumns={columns.map((c) => ({
          id: c.id,
          title: c.title,
          links: c.links.map((l) => ({ id: l.id, label: l.label, url: l.url })),
        }))}
      />
    </div>
  );
}

/** Social links as { youtube: url, … } — stored either as that map or as [{ label|platform, url }]. */
function socialLinkMap(raw: unknown): Record<string, string> {
  const out: Record<string, string> = {};
  if (Array.isArray(raw)) {
    for (const x of raw) {
      if (!x || typeof x !== "object") continue;
      const o = x as Record<string, unknown>;
      const key = String(o.platform ?? o.label ?? "").trim().toLowerCase();
      if (key && typeof o.url === "string" && o.url) out[key] = o.url;
    }
  } else if (raw && typeof raw === "object") {
    for (const [k, v] of Object.entries(raw as Record<string, unknown>)) if (typeof v === "string" && v) out[k.toLowerCase()] = v;
  }
  return out;
}
