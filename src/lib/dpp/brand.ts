import "server-only";
import { prisma } from "@/lib/db";
import { DEFAULT_DPP_BRAND, type DppBrand } from "@/lib/dpp/cover-html";

/** Footer social link (array of {label|platform, url} or a {youtube: url} map) for a platform. */
function footerLink(raw: unknown, platform: string): string | null {
  if (!raw || typeof raw !== "object") return null;
  if (Array.isArray(raw)) {
    for (const x of raw) {
      if (!x || typeof x !== "object") continue;
      const o = x as Record<string, unknown>;
      const name = String(o.platform ?? o.label ?? o.icon ?? "").toLowerCase();
      if (name.includes(platform) && typeof o.url === "string" && o.url) return o.url;
    }
    return null;
  }
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    if (k.toLowerCase().includes(platform) && typeof v === "string" && v) return v;
  }
  return null;
}

/**
 * Links and tagline for the DPP front page: the DPP settings (edited on the
 * DPP page), else the website footer's social links, else the defaults.
 */
export async function getDppBrand(): Promise<DppBrand> {
  const [settings, footer] = await Promise.all([
    prisma.dppBrandSettings.findFirst({ orderBy: { updatedAt: "desc" } }),
    prisma.footerSettings.findFirst({ select: { socialLinks: true } }),
  ]);
  return {
    tagline: settings?.tagline?.trim() || DEFAULT_DPP_BRAND.tagline,
    youtubeUrl: settings?.youtubeUrl?.trim() || footerLink(footer?.socialLinks, "youtube") || DEFAULT_DPP_BRAND.youtubeUrl,
    telegramUrl: settings?.telegramUrl?.trim() || footerLink(footer?.socialLinks, "telegram") || DEFAULT_DPP_BRAND.telegramUrl,
    websiteUrl: settings?.websiteUrl?.trim() || DEFAULT_DPP_BRAND.websiteUrl,
  };
}

export async function saveDppBrand(input: Partial<DppBrand>, userId: string): Promise<DppBrand> {
  const current = await prisma.dppBrandSettings.findFirst({ orderBy: { updatedAt: "desc" } });
  const data = {
    tagline: input.tagline?.trim() || null,
    youtubeUrl: input.youtubeUrl?.trim() || null,
    telegramUrl: input.telegramUrl?.trim() || null,
    websiteUrl: input.websiteUrl?.trim() || null,
    updatedById: userId,
  };
  if (current) await prisma.dppBrandSettings.update({ where: { id: current.id }, data });
  else await prisma.dppBrandSettings.create({ data });
  return getDppBrand();
}
