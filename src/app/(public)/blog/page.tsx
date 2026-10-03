import type { Metadata } from "next";
import { getPublishedBlogPosts } from "@/lib/blog";
import { getFooterData } from "@/lib/homepage";
import { PublicHeader } from "@/components/public-home/PublicHeader";
import { PublicFooter } from "@/components/public-home/TrustSections";
import { BlogCard } from "@/components/public-home/BlogSections";
import { CONTAINER } from "@/components/public-home/ui";

export const revalidate = 60;

export const metadata: Metadata = {
  title: "Blog",
  description: "Study tips, exam strategies and updates for NEET, JEE and board exams from Atomic Pathshala.",
  alternates: { canonical: "/blog" },
  openGraph: { type: "website", url: "/blog", title: "Atomic Pathshala Blog", description: "Study tips, exam strategies and updates for NEET, JEE and board exams." },
};

export default async function BlogIndexPage() {
  const [posts, footer] = await Promise.all([getPublishedBlogPosts(60), getFooterData().catch(() => null)]);
  return (
    <>
      <PublicHeader />
      <main className="min-h-[60vh] bg-white">
        <section className="bg-gradient-to-b from-blue-50/70 to-white">
          <div className={`${CONTAINER} py-10 sm:py-14`}>
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-blue-600">Blog</p>
            <h1 className="mt-1 text-3xl sm:text-4xl font-bold tracking-tight text-slate-900">Atomic Pathshala Blog</h1>
            <p className="mt-2 max-w-2xl text-base text-slate-600">Study tips, exam strategies and updates for NEET, JEE and board exams.</p>
          </div>
        </section>
        <section className={`${CONTAINER} pb-16`}>
          {posts.length ? (
            <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {posts.map((p) => (
                <li key={p.slug}>
                  <BlogCard post={p} />
                </li>
              ))}
            </ul>
          ) : (
            <p className="rounded-2xl border border-dashed border-slate-300 p-6 text-center text-sm text-slate-600">New posts are coming soon.</p>
          )}
        </section>
      </main>
      <PublicFooter socials={(footer?.social ?? []).map((s) => ({ label: s.label, url: s.url }))} />
    </>
  );
}
