import Link from "next/link";
import type { PublicBlogPost } from "@/lib/blog";
import { ButtonLink, CardRail, Icon, Section, SectionHeader, hd, type Head } from "./ui";

const IST = "Asia/Kolkata";
export const blogDate = (iso: string) => new Date(iso).toLocaleDateString("en-IN", { timeZone: IST, day: "numeric", month: "short", year: "numeric" });

export function BlogCard({ post }: { post: PublicBlogPost }) {
  return (
    <Link
      href={`/blog/${post.slug}`}
      className="group flex h-full flex-col overflow-hidden rounded-2xl border border-slate-200/80 bg-white transition hover:-translate-y-0.5 hover:border-blue-200 hover:shadow-[0_8px_24px_-12px_rgba(30,64,175,0.25)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 motion-reduce:transform-none"
    >
      {post.coverImageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element -- CMS cover image
        <img src={post.coverImageUrl} alt="" loading="lazy" decoding="async" width={640} height={360} className="aspect-video w-full object-cover" />
      ) : (
        <div className="flex aspect-video w-full items-center justify-center bg-gradient-to-br from-blue-50 to-cyan-50">
          <Icon name="article" className="text-[40px] text-blue-300" />
        </div>
      )}
      <div className="flex flex-1 flex-col p-4">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-blue-600">
          {[post.category, blogDate(post.publishedAt)].filter(Boolean).join(" · ")}
        </p>
        <h3 className="mt-1 line-clamp-2 text-base font-bold text-slate-900 group-hover:text-blue-700">{post.title}</h3>
        {post.excerpt && <p className="mt-1 line-clamp-3 text-sm text-slate-600">{post.excerpt}</p>}
        <span className="mt-auto inline-flex items-center gap-1 pt-3 text-sm font-semibold text-blue-700">
          Read more <Icon name="arrow_forward" className="text-[16px]" />
        </span>
      </div>
    </Link>
  );
}

/** Homepage: the latest published blog posts (hidden when there are none). */
export function LatestBlogsSection({ posts, head }: { posts: PublicBlogPost[]; head?: Head }) {
  if (!posts.length) return null;
  return (
    <Section id="blog">
      <SectionHeader {...hd(head, { eyebrow: "Blog", title: "Tips, strategies & updates" })} action={<ButtonLink href="/blog" variant="secondary">Read all posts</ButtonLink>} />
      <CardRail cols="sm:grid-cols-2 lg:grid-cols-3">
        {posts.map((p) => (
          <BlogCard key={p.slug} post={p} />
        ))}
      </CardRail>
    </Section>
  );
}
