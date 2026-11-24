import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireTeamSession } from "@/lib/auth/session";
import { hasPermission, isSuperAdminUser } from "@/lib/rbac/guard";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { DEFAULT_SEO_SETTINGS, getSeoGlobalSettings } from "@/lib/seo/settings";

export async function GET() {
  try {
    const { user } = await requireTeamSession();
    const canManage = (await isSuperAdminUser(user.id)) || (await hasPermission(user.id, PERMISSIONS.SEO_MANAGE));
    if (!canManage) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const settings = await getSeoGlobalSettings();
    return NextResponse.json({ settings });
  } catch (error: any) {
    console.error("GET /api/team/seo/settings error:", error);
    return NextResponse.json({ error: error.message || "Internal error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const { user } = await requireTeamSession();
    const canManage = (await isSuperAdminUser(user.id)) || (await hasPermission(user.id, PERMISSIONS.SEO_MANAGE));
    if (!canManage) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const body = await req.json();

    const updated = await prisma.seoGlobalSettings.upsert({
      where: { id: "singleton" },
      update: {
        siteName: body.siteName || DEFAULT_SEO_SETTINGS.siteName,
        siteUrl: body.siteUrl || DEFAULT_SEO_SETTINGS.siteUrl,
        defaultTitle: body.defaultTitle || DEFAULT_SEO_SETTINGS.defaultTitle,
        defaultDescription: body.defaultDescription || DEFAULT_SEO_SETTINGS.defaultDescription,
        defaultOgTitle: body.defaultOgTitle || null,
        defaultOgDescription: body.defaultOgDescription || null,
        defaultOgImage: body.defaultOgImage || DEFAULT_SEO_SETTINGS.defaultOgImage,
        twitterCard: body.twitterCard || DEFAULT_SEO_SETTINGS.twitterCard,
        canonicalPolicy: body.canonicalPolicy || DEFAULT_SEO_SETTINGS.canonicalPolicy,
        orgName: body.orgName || DEFAULT_SEO_SETTINGS.orgName,
        orgLogoUrl: body.orgLogoUrl || DEFAULT_SEO_SETTINGS.orgLogoUrl,
        orgDescription: body.orgDescription || DEFAULT_SEO_SETTINGS.orgDescription,
        contactEmail: body.contactEmail || DEFAULT_SEO_SETTINGS.contactEmail,
        contactPhone: body.contactPhone || DEFAULT_SEO_SETTINGS.contactPhone,
        addressCountry: body.addressCountry || DEFAULT_SEO_SETTINGS.addressCountry,
        addressLocality: body.addressLocality || DEFAULT_SEO_SETTINGS.addressLocality,
        socialLinks: body.socialLinks || DEFAULT_SEO_SETTINGS.socialLinks,
        defaultLanguage: body.defaultLanguage || DEFAULT_SEO_SETTINGS.defaultLanguage,
        supportedLanguages: body.supportedLanguages || DEFAULT_SEO_SETTINGS.supportedLanguages,
        robotsDefault: body.robotsDefault || DEFAULT_SEO_SETTINGS.robotsDefault,
        gscVerificationCode: body.gscVerificationCode || null,
        bingVerificationCode: body.bingVerificationCode || null,
      },
      create: {
        id: "singleton",
        siteName: body.siteName || DEFAULT_SEO_SETTINGS.siteName,
        siteUrl: body.siteUrl || DEFAULT_SEO_SETTINGS.siteUrl,
        defaultTitle: body.defaultTitle || DEFAULT_SEO_SETTINGS.defaultTitle,
        defaultDescription: body.defaultDescription || DEFAULT_SEO_SETTINGS.defaultDescription,
        defaultOgTitle: body.defaultOgTitle || null,
        defaultOgDescription: body.defaultOgDescription || null,
        defaultOgImage: body.defaultOgImage || DEFAULT_SEO_SETTINGS.defaultOgImage,
        twitterCard: body.twitterCard || DEFAULT_SEO_SETTINGS.twitterCard,
        canonicalPolicy: body.canonicalPolicy || DEFAULT_SEO_SETTINGS.canonicalPolicy,
        orgName: body.orgName || DEFAULT_SEO_SETTINGS.orgName,
        orgLogoUrl: body.orgLogoUrl || DEFAULT_SEO_SETTINGS.orgLogoUrl,
        orgDescription: body.orgDescription || DEFAULT_SEO_SETTINGS.orgDescription,
        contactEmail: body.contactEmail || DEFAULT_SEO_SETTINGS.contactEmail,
        contactPhone: body.contactPhone || DEFAULT_SEO_SETTINGS.contactPhone,
        addressCountry: body.addressCountry || DEFAULT_SEO_SETTINGS.addressCountry,
        addressLocality: body.addressLocality || DEFAULT_SEO_SETTINGS.addressLocality,
        socialLinks: body.socialLinks || DEFAULT_SEO_SETTINGS.socialLinks,
        defaultLanguage: body.defaultLanguage || DEFAULT_SEO_SETTINGS.defaultLanguage,
        supportedLanguages: body.supportedLanguages || DEFAULT_SEO_SETTINGS.supportedLanguages,
        robotsDefault: body.robotsDefault || DEFAULT_SEO_SETTINGS.robotsDefault,
        gscVerificationCode: body.gscVerificationCode || null,
        bingVerificationCode: body.bingVerificationCode || null,
      },
    });

    return NextResponse.json({ success: true, settings: updated });
  } catch (error: any) {
    console.error("POST /api/team/seo/settings error:", error);
    return NextResponse.json({ error: error.message || "Failed to update settings" }, { status: 500 });
  }
}
