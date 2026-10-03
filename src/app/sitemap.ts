import type { MetadataRoute } from "next";
import { getPublishedBlogPosts } from "@/lib/blog";

const SITE = "https://ap.atomicpathshala.in";

// Public pages only — student, team and parent areas need a login.
export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const pages: { path: string; priority: number; changeFrequency: "daily" | "weekly" | "monthly" | "yearly" }[] = [
    { path: "", priority: 1, changeFrequency: "daily" },
    { path: "/teachers", priority: 0.7, changeFrequency: "weekly" },
    { path: "/blog", priority: 0.7, changeFrequency: "daily" },
    { path: "/about-founder", priority: 0.5, changeFrequency: "monthly" },
    { path: "/careers/apply", priority: 0.4, changeFrequency: "monthly" },
    { path: "/install", priority: 0.4, changeFrequency: "monthly" },
    { path: "/register", priority: 0.6, changeFrequency: "monthly" },
    { path: "/login", priority: 0.3, changeFrequency: "yearly" },
    { path: "/privacy", priority: 0.2, changeFrequency: "yearly" },
    { path: "/terms", priority: 0.2, changeFrequency: "yearly" },
  ];
  const posts = await getPublishedBlogPosts(500);
  return [
    ...pages.map((p) => ({ url: `${SITE}${p.path}`, changeFrequency: p.changeFrequency, priority: p.priority })),
    ...posts.map((p) => ({ url: `${SITE}/blog/${p.slug}`, lastModified: new Date(p.publishedAt), changeFrequency: "monthly" as const, priority: 0.6 })),
  ];
}
