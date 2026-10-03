import "server-only";
import { prisma } from "@/lib/db";

export type PublicBlogPost = {
  slug: string;
  title: string;
  excerpt: string | null;
  coverImageUrl: string | null;
  category: string | null;
  authorName: string | null;
  publishedAt: string;
};

/** "Hello World!" → "hello-world" */
export function blogSlugify(input: string): string {
  return input
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/[\s-]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 120);
}

const listSelect = { slug: true, title: true, excerpt: true, coverImageUrl: true, category: true, authorName: true, publishedAt: true, createdAt: true } as const;

function toPublic(p: { slug: string; title: string; excerpt: string | null; coverImageUrl: string | null; category: string | null; authorName: string | null; publishedAt: Date | null; createdAt: Date }): PublicBlogPost {
  return { ...p, publishedAt: (p.publishedAt ?? p.createdAt).toISOString() };
}

/** Published posts, newest first. Never throws (returns [] if the table is missing). */
export async function getPublishedBlogPosts(limit = 50): Promise<PublicBlogPost[]> {
  try {
    const rows = await prisma.blogPost.findMany({
      where: { status: "PUBLISHED" },
      orderBy: [{ publishedAt: "desc" }, { createdAt: "desc" }],
      take: limit,
      select: listSelect,
    });
    return rows.map(toPublic);
  } catch (error) {
    console.error("getPublishedBlogPosts failed:", error);
    return [];
  }
}

/** One published post with its content, or null. */
export async function getPublishedBlogPost(slug: string) {
  try {
    const p = await prisma.blogPost.findFirst({
      where: { slug, status: "PUBLISHED" },
      select: { ...listSelect, content: true, seoTitle: true, metaDescription: true, updatedAt: true },
    });
    if (!p) return null;
    return { ...toPublic(p), content: p.content, seoTitle: p.seoTitle, metaDescription: p.metaDescription, updatedAt: p.updatedAt.toISOString() };
  } catch (error) {
    console.error("getPublishedBlogPost failed:", error);
    return null;
  }
}

/** Homepage hero centre image, or null when none is set. */
export async function getHomeHeroImage(): Promise<{ imageUrl: string; mobileImageUrl: string | null; altText: string | null } | null> {
  try {
    const h = await prisma.homeHero.findUnique({ where: { id: "singleton" } });
    if (!h?.imageUrl) return null;
    return { imageUrl: h.imageUrl, mobileImageUrl: h.mobileImageUrl, altText: h.altText };
  } catch (error) {
    console.error("getHomeHeroImage failed:", error);
    return null;
  }
}
