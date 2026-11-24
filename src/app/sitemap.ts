import type { MetadataRoute } from "next";
import { prisma } from "@/lib/db";
import { getPublishedBlogPosts } from "@/lib/blog";
import { buildChapterSlug } from "@/lib/pyq/slug-generator";

const SITE = "https://atomicpathshala.in";

// Public pages only — student, team and parent areas need a login.
export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const pages: { path: string; priority: number; changeFrequency: "daily" | "weekly" | "monthly" | "yearly" }[] = [
    { path: "", priority: 1.0, changeFrequency: "daily" },
    { path: "/neet", priority: 0.95, changeFrequency: "daily" },
    { path: "/jee", priority: 0.95, changeFrequency: "daily" },
    { path: "/chemistry", priority: 0.9, changeFrequency: "daily" },
    { path: "/physics", priority: 0.9, changeFrequency: "daily" },
    { path: "/biology", priority: 0.9, changeFrequency: "daily" },
    { path: "/class-10", priority: 0.85, changeFrequency: "weekly" },
    { path: "/class-11", priority: 0.85, changeFrequency: "weekly" },
    { path: "/class-12", priority: 0.85, changeFrequency: "weekly" },
    { path: "/boards", priority: 0.85, changeFrequency: "weekly" },
    { path: "/modules", priority: 0.8, changeFrequency: "weekly" },
    { path: "/pyq", priority: 0.9, changeFrequency: "daily" },
    { path: "/pyq/neet", priority: 0.85, changeFrequency: "daily" },
    { path: "/pyq/jee-main", priority: 0.85, changeFrequency: "daily" },
    { path: "/pyq/jee-advanced", priority: 0.85, changeFrequency: "daily" },
    { path: "/teachers", priority: 0.85, changeFrequency: "daily" },
    { path: "/blog", priority: 0.75, changeFrequency: "daily" },
    { path: "/about-founder", priority: 0.7, changeFrequency: "monthly" },
    { path: "/careers/apply", priority: 0.4, changeFrequency: "monthly" },
    { path: "/privacy", priority: 0.2, changeFrequency: "yearly" },
    { path: "/terms", priority: 0.2, changeFrequency: "yearly" },
  ];

  const [posts, publishedQuestions, chapterGroupings, eligibleTeachers, seoArticles] = await Promise.all([
    getPublishedBlogPosts(500),
    prisma.question.findMany({
      where: {
        isPublished: true,
        slug: { not: null },
        pyqOccurrences: { some: { verificationStatus: "VERIFIED" } },
      },
      take: 2000,
      select: {
        slug: true,
        createdAt: true,
      },
    }),
    prisma.question.groupBy({
      by: ["subject", "chapter"],
      where: {
        isPublished: true,
        chapter: { not: null },
        pyqOccurrences: { some: { verificationStatus: "VERIFIED" } },
      },
      _count: { id: true },
    }),
    prisma.teacherSeo.findMany({
      where: {
        isPublicProfileEnabled: true,
        isSeoIndexed: true,
        isApproved: true,
      },
      select: {
        slug: true,
        updatedAt: true,
      },
    }),
    prisma.seoContentArticle.findMany({
      where: {
        status: "PUBLISHED",
        isIndexed: true,
      },
      select: {
        slug: true,
        updatedAt: true,
      },
    }),
  ]);

  const teacherUrls: MetadataRoute.Sitemap = eligibleTeachers.map((t) => ({
    url: `${SITE}/teachers/${t.slug}`,
    lastModified: t.updatedAt,
    changeFrequency: "weekly",
    priority: 0.85,
  }));

  const articleUrls: MetadataRoute.Sitemap = seoArticles.map((a) => ({
    url: `${SITE}/blog/${a.slug}`,
    lastModified: a.updatedAt,
    changeFrequency: "weekly",
    priority: 0.7,
  }));

  const questionUrls: MetadataRoute.Sitemap = publishedQuestions.map((q) => ({
    url: `${SITE}/pyq/question/${q.slug}`,
    lastModified: q.createdAt,
    changeFrequency: "weekly",
    priority: 0.7,
  }));

  const chapterUrls: MetadataRoute.Sitemap = [];
  for (const group of chapterGroupings) {
    if (group.chapter && group._count.id > 0) {
      const chSlug = buildChapterSlug(group.chapter);
      const subSlug = group.subject.toLowerCase();
      for (const ex of ["neet", "jee-main", "jee-advanced"]) {
        chapterUrls.push({
          url: `${SITE}/pyq/${ex}/${subSlug}/${chSlug}`,
          changeFrequency: "weekly",
          priority: 0.8,
        });
      }
    }
  }

  return [
    ...pages.map((p) => ({ url: `${SITE}${p.path}`, changeFrequency: p.changeFrequency, priority: p.priority })),
    ...teacherUrls,
    ...articleUrls,
    ...posts.map((p) => ({ url: `${SITE}/blog/${p.slug}`, lastModified: new Date(p.publishedAt), changeFrequency: "monthly" as const, priority: 0.6 })),
    ...chapterUrls,
    ...questionUrls,
  ];
}
