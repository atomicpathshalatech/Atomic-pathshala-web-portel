import "server-only";
import { unstable_cache } from "next/cache";
import { prisma } from "@/lib/db";

/**
 * Public, cached reads for the CMS-managed homepage sections (banner,
 * testimonials, FAQs). Each one mirrors `getActiveFounder` in src/lib/founder.ts:
 *   - served from the Next data cache, no DB round-trip on a cache hit,
 *   - wrapped in try/catch so a missing table or a brief DB outage never
 *     takes the marketing site down — the caller falls back to its built-in
 *     default content,
 *   - tagged so an admin's save can `revalidateTag(...)` for an instant update.
 */

export const HOMEPAGE_BANNER_TAG = "homepage-banner";
export const HOMEPAGE_TESTIMONIALS_TAG = "homepage-testimonials";
export const HOMEPAGE_FAQS_TAG = "homepage-faqs";
export const HOMEPAGE_FOOTER_TAG = "homepage-footer";

export type HomepageBanner = {
  title: string;
  subtitle: string | null;
  imageUrl: string;
  mobileImageUrl: string | null;
  ctaText: string | null;
  ctaUrl: string | null;
  openInNewTab: boolean;
};

export type HomepageTestimonial = {
  id: string;
  studentName: string;
  photoUrl: string | null;
  studentClass: string | null;
  targetExam: string | null;
  quote: string;
  rating: number | null;
};

export type HomepageFaq = {
  id: string;
  question: string;
  answer: string;
  category: string | null;
};

/** The single highest-priority ACTIVE banner whose optional date window covers now. */
export const getActiveBanner = unstable_cache(
  async (): Promise<HomepageBanner | null> => {
    try {
      const now = new Date();
      const banner = await prisma.banner.findFirst({
        where: {
          status: "ACTIVE",
          AND: [
            { OR: [{ startAt: null }, { startAt: { lte: now } }] },
            { OR: [{ endAt: null }, { endAt: { gte: now } }] },
          ],
        },
        orderBy: [{ priority: "desc" }, { order: "asc" }, { createdAt: "desc" }],
      });
      if (!banner) return null;
      return {
        title: banner.title,
        subtitle: banner.subtitle,
        imageUrl: banner.imageUrl,
        mobileImageUrl: banner.mobileImageUrl,
        ctaText: banner.ctaText,
        ctaUrl: banner.ctaUrl,
        openInNewTab: banner.openInNewTab,
      };
    } catch (error) {
      console.error("getActiveBanner failed, using default promo:", error);
      return null;
    }
  },
  ["homepage-active-banner"],
  { revalidate: 60, tags: [HOMEPAGE_BANNER_TAG] }
);

/** Approved testimonials in admin-defined order. */
export const getApprovedTestimonials = unstable_cache(
  async (): Promise<HomepageTestimonial[]> => {
    try {
      const rows = await prisma.testimonial.findMany({
        where: { isApproved: true },
        orderBy: [{ order: "asc" }, { createdAt: "desc" }],
        take: 12,
        select: {
          id: true,
          studentName: true,
          photoUrl: true,
          studentClass: true,
          targetExam: true,
          quote: true,
          rating: true,
        },
      });
      return rows;
    } catch (error) {
      console.error("getApprovedTestimonials failed, using defaults:", error);
      return [];
    }
  },
  ["homepage-approved-testimonials"],
  { revalidate: 60, tags: [HOMEPAGE_TESTIMONIALS_TAG] }
);

/** Published FAQs, ordered by category then position. */
export const getPublishedFaqs = unstable_cache(
  async (): Promise<HomepageFaq[]> => {
    try {
      const rows = await prisma.faq.findMany({
        where: { isPublished: true },
        orderBy: [{ category: { order: "asc" } }, { order: "asc" }, { createdAt: "asc" }],
        include: { category: { select: { name: true } } },
      });
      return rows.map((f) => ({
        id: f.id,
        question: f.question,
        answer: f.answer,
        category: f.category?.name ?? null,
      }));
    } catch (error) {
      console.error("getPublishedFaqs failed, using defaults:", error);
      return [];
    }
  },
  ["homepage-published-faqs"],
  { revalidate: 60, tags: [HOMEPAGE_FAQS_TAG] }
);

export type FooterLinkItem = { label: string; url: string; icon: string | null; openNewTab: boolean };
export type FooterColumnItem = { id: string; title: string; links: FooterLinkItem[] };
export type FooterSocial = { label: string; url: string; icon: string | null };
export type FooterData = {
  columns: FooterColumnItem[];
  logoUrl: string | null;
  description: string | null;
  copyrightText: string | null;
  contactPhone: string | null;
  contactEmail: string | null;
  address: string | null;
  social: FooterSocial[];
};

function parseSocial(raw: unknown): FooterSocial[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((x) => {
      if (!x || typeof x !== "object") return null;
      const o = x as Record<string, unknown>;
      const url = typeof o.url === "string" ? o.url : "";
      const label =
        (typeof o.label === "string" && o.label) ||
        (typeof o.platform === "string" && o.platform) ||
        "";
      if (!url || !label) return null;
      return { label, url, icon: typeof o.icon === "string" ? o.icon : null };
    })
    .filter((x): x is FooterSocial => x !== null);
}

/** Footer columns + link lists + singleton settings. */
export const getFooterData = unstable_cache(
  async (): Promise<FooterData | null> => {
    try {
      const [columns, settings] = await Promise.all([
        prisma.footerColumn.findMany({
          orderBy: { order: "asc" },
          include: { links: { orderBy: { order: "asc" } } },
        }),
        prisma.footerSettings.findFirst(),
      ]);
      if (columns.length === 0 && !settings) return null;
      return {
        columns: columns.map((c) => ({
          id: c.id,
          title: c.title,
          links: c.links.map((l) => ({
            label: l.label,
            url: l.url,
            icon: l.icon,
            openNewTab: l.openNewTab,
          })),
        })),
        logoUrl: settings?.logoUrl ?? null,
        description: settings?.description ?? null,
        copyrightText: settings?.copyrightText ?? null,
        contactPhone: settings?.contactPhone ?? null,
        contactEmail: settings?.contactEmail ?? null,
        address: settings?.address ?? null,
        social: parseSocial(settings?.socialLinks),
      };
    } catch (error) {
      console.error("getFooterData failed, using default footer:", error);
      return null;
    }
  },
  ["homepage-footer"],
  { revalidate: 60, tags: [HOMEPAGE_FOOTER_TAG] }
);
