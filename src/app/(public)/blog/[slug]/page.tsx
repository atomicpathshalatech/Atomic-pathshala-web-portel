import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getPublishedBlogPost, getPublishedBlogPosts } from "@/lib/blog";
import { getFooterData } from "@/lib/homepage";
import { PublicHeader } from "@/components/public-home/PublicHeader";
import { PublicFooter } from "@/components/public-home/TrustSections";
import { BlogCard, blogDate } from "@/components/public-home/BlogSections";
import { BlogContent } from "@/components/blog/BlogContent";
import { ButtonLink, Icon } from "@/components/public-home/ui";

export const revalidate = 60;

const SITE = "https://ap.atomicpathshala.in";

export async function generateMetadata({ params }: { params: { slug: string } }): Promise<Metadata> {
  const post = await getPublishedBlogPost(params.slug);
  if (!post) return { title: "Post not found", robots: { index: false } };
  const title = post.seoTitle || post.title;
  const description = post.metaDescription || post.excerpt || undefined;
  return {
    title,
    description,
    alternates: { canonical: `/blog/${post.slug}` },
    openGraph: {
      type: "article",
      url: `/blog/${post.slug}`,
      title,
      description,
      publishedTime: post.publishedAt,
      ...(post.coverImageUrl ? { images: [{ url: post.coverImageUrl }] } : {}),
    },
  };
}

export default async function BlogPostPage({ params }: { params: { slug: string } }) {
  const post = await getPublishedBlogPost(params.slug);
  if (!post) notFound();
  const [more, footer] = await Promise.all([getPublishedBlogPosts(4), getFooterData().catch(() => null)]);
  const related = more.filter((p) => p.slug !== post.slug).slice(0, 3);

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    headline: post.title,
    datePublished: post.publishedAt,
    dateModified: post.updatedAt,
    ...(post.excerpt ? { description: post.excerpt } : {}),
    ...(post.coverImageUrl ? { image: post.coverImageUrl } : {}),
    author: { "@type": post.authorName ? "Person" : "Organization", name: post.authorName || "Atomic Pathshala" },
    publisher: { "@type": "Organization", name: "Atomic Pathshala", logo: { "@type": "ImageObject", url: `${SITE}/brand/logo.png` } },
    mainEntityOfPage: `${SITE}/blog/${post.slug}`,
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} />
      <PublicHeader />
      <main className="bg-white">
        <article className="mx-auto w-full max-w-3xl px-4 py-8 sm:px-6 sm:py-12">
          <Link href="/blog" className="inline-flex min-h-[44px] items-center gap-1 text-sm font-semibold text-blue-700">
            <Icon name="arrow_back" className="text-[18px]" /> All posts
          </Link>
          <p className="mt-2 text-xs font-semibold uppercase tracking-wider text-blue-600">
            {[post.category, blogDate(post.publishedAt)].filter(Boolean).join(" · ")}
          </p>
          <h1 className="mt-1 text-3xl sm:text-4xl font-bold leading-tight tracking-tight text-slate-900">{post.title}</h1>
          {post.authorName && <p className="mt-2 text-sm text-slate-500">By {post.authorName}</p>}
          {post.coverImageUrl && (
            // eslint-disable-next-line @next/next/no-img-element -- CMS cover image
            <img src={post.coverImageUrl} alt="" width={1280} height={720} className="mt-6 aspect-video w-full rounded-2xl object-cover" />
          )}
          <div className="mt-6">
            <BlogContent content={post.content} />
          </div>
          <div className="mt-10 flex flex-col items-start gap-3 rounded-2xl bg-blue-50 p-5 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm font-medium text-slate-800">Practise PYQs, notes, DPPs and tests — free with your account.</p>
            <ButtonLink href="/register">Start Learning Free</ButtonLink>
          </div>
        </article>
        {related.length > 0 && (
          <section className="mx-auto w-full max-w-6xl px-4 pb-16 sm:px-6">
            <h2 className="text-xl font-bold text-slate-900">More from the blog</h2>
            <ul className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {related.map((p) => (
                <li key={p.slug}>
                  <BlogCard post={p} />
                </li>
              ))}
            </ul>
          </section>
        )}
      </main>
      <PublicFooter socials={(footer?.social ?? []).map((s) => ({ label: s.label, url: s.url }))} />
    </>
  );
}
