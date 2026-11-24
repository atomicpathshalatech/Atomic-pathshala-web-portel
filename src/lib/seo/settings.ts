import { prisma } from "@/lib/db";

export interface SeoSettings {
  siteName: string;
  siteUrl: string;
  defaultTitle: string;
  defaultDescription: string;
  defaultOgTitle: string | null;
  defaultOgDescription: string | null;
  defaultOgImage: string;
  twitterCard: string;
  canonicalPolicy: string;
  orgName: string;
  orgLogoUrl: string;
  orgDescription: string;
  contactEmail: string;
  contactPhone: string;
  addressCountry: string;
  addressLocality: string;
  socialLinks: Array<{ platform: string; url: string }>;
  defaultLanguage: string;
  supportedLanguages: string[];
  robotsDefault: string;
  gscVerificationCode: string | null;
  bingVerificationCode: string | null;
}

export const DEFAULT_SEO_SETTINGS: SeoSettings = {
  siteName: "Atomic Pathshala",
  siteUrl: "https://atomicpathshala.in",
  defaultTitle: "Atomic Pathshala — NEET, JEE & Board Exam Preparation",
  defaultDescription:
    "India's premier education accelerator for NEET UG, JEE Main, and Foundation courses with chapter-wise PYQs, live interactive classes, and verified faculty.",
  defaultOgTitle: "Atomic Pathshala — Accelerating Academic Excellence",
  defaultOgDescription:
    "Master NEET, JEE & Board exams with expert faculty, chapter-wise previous year questions (PYQ) with verified solutions, test series, and personalized AI mentorship.",
  defaultOgImage: "/brand/logo.png",
  twitterCard: "summary_large_image",
  canonicalPolicy: "STRICT_APEX",
  orgName: "Atomic Pathshala",
  orgLogoUrl: "/brand/logo.png",
  orgDescription:
    "Atomic Pathshala is an premier educational platform providing live classes, comprehensive test series, chapter-wise previous year questions (PYQ), and AI mentorship for NEET, JEE, and Board exams.",
  contactEmail: "support@atomicpathshala.in",
  contactPhone: "+91 8958900405",
  addressCountry: "IN",
  addressLocality: "India",
  socialLinks: [
    { platform: "YouTube", url: "https://www.youtube.com/@AtomicPathshala" },
    { platform: "Telegram", url: "https://t.me/atomicpathshala" },
    { platform: "Instagram", url: "https://instagram.com/atomicpathshala" },
  ],
  defaultLanguage: "en-IN",
  supportedLanguages: ["en", "hi"],
  robotsDefault: "index,follow",
  gscVerificationCode: null,
  bingVerificationCode: null,
};

/**
 * Fetch persistent global SEO settings from DB, falling back to sane defaults.
 */
export async function getSeoGlobalSettings(): Promise<SeoSettings> {
  try {
    const row = await prisma.seoGlobalSettings.findUnique({
      where: { id: "singleton" },
    });

    if (!row) {
      return DEFAULT_SEO_SETTINGS;
    }

    return {
      siteName: row.siteName || DEFAULT_SEO_SETTINGS.siteName,
      siteUrl: row.siteUrl || DEFAULT_SEO_SETTINGS.siteUrl,
      defaultTitle: row.defaultTitle || DEFAULT_SEO_SETTINGS.defaultTitle,
      defaultDescription: row.defaultDescription || DEFAULT_SEO_SETTINGS.defaultDescription,
      defaultOgTitle: row.defaultOgTitle || row.defaultTitle || DEFAULT_SEO_SETTINGS.defaultOgTitle,
      defaultOgDescription: row.defaultOgDescription || row.defaultDescription || DEFAULT_SEO_SETTINGS.defaultOgDescription,
      defaultOgImage: row.defaultOgImage || DEFAULT_SEO_SETTINGS.defaultOgImage,
      twitterCard: row.twitterCard || DEFAULT_SEO_SETTINGS.twitterCard,
      canonicalPolicy: row.canonicalPolicy || DEFAULT_SEO_SETTINGS.canonicalPolicy,
      orgName: row.orgName || DEFAULT_SEO_SETTINGS.orgName,
      orgLogoUrl: row.orgLogoUrl || DEFAULT_SEO_SETTINGS.orgLogoUrl,
      orgDescription: row.orgDescription || DEFAULT_SEO_SETTINGS.orgDescription,
      contactEmail: row.contactEmail || DEFAULT_SEO_SETTINGS.contactEmail,
      contactPhone: row.contactPhone || DEFAULT_SEO_SETTINGS.contactPhone,
      addressCountry: row.addressCountry || DEFAULT_SEO_SETTINGS.addressCountry,
      addressLocality: row.addressLocality || DEFAULT_SEO_SETTINGS.addressLocality,
      socialLinks: (row.socialLinks as any) || DEFAULT_SEO_SETTINGS.socialLinks,
      defaultLanguage: row.defaultLanguage || DEFAULT_SEO_SETTINGS.defaultLanguage,
      supportedLanguages: row.supportedLanguages || DEFAULT_SEO_SETTINGS.supportedLanguages,
      robotsDefault: row.robotsDefault || DEFAULT_SEO_SETTINGS.robotsDefault,
      gscVerificationCode: row.gscVerificationCode,
      bingVerificationCode: row.bingVerificationCode,
    };
  } catch (err) {
    console.error("Failed to fetch SeoGlobalSettings:", err);
    return DEFAULT_SEO_SETTINGS;
  }
}

/**
 * Builds an absolute canonical URL using the canonical site URL from settings.
 */
export function buildCanonicalUrl(path: string, siteUrl: string = "https://atomicpathshala.in"): string {
  const cleanBase = siteUrl.replace(/\/+$/, "");
  const cleanPath = path.startsWith("/") ? path : `/${path}`;
  return `${cleanBase}${cleanPath}`;
}
