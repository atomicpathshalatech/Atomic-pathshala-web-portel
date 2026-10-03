import type { Metadata } from "next";
import { requireTeamSession } from "@/lib/auth/session";
import { isSuperAdminUser } from "@/lib/rbac/guard";
import { prisma } from "@/lib/db";
import { BlogManager } from "@/components/home-cms/BlogManager";
import { SuperAdminOnlyNotice } from "@/components/team-portal/SuperAdminOnlyNotice";

export const metadata: Metadata = { title: "Blog — Website Builder" };
export const dynamic = "force-dynamic";

export default async function BlogAdminPage() {
  const { user } = await requireTeamSession();
  if (!(await isSuperAdminUser(user.id))) return <SuperAdminOnlyNotice />;

  let posts: Awaited<ReturnType<typeof prisma.blogPost.findMany>> = [];
  let tableMissing = false;
  try {
    posts = await prisma.blogPost.findMany({ orderBy: { updatedAt: "desc" } });
  } catch (error) {
    console.error("Blog admin: could not load posts", error);
    tableMissing = true;
  }

  return (
    <div className="space-y-stack-lg max-w-5xl">
      <div>
        <h1 className="font-headline-lg text-headline-lg text-on-surface">Blog</h1>
        <p className="font-body-md text-body-md text-on-surface-variant">
          Write posts for ap.atomicpathshala.in/blog. Published posts also appear on the homepage (latest 3).
        </p>
      </div>
      {tableMissing ? (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-800">
          The blog database table isn&apos;t set up yet. Run <code>npx prisma migrate deploy</code> on the production database, then reload this page.
        </div>
      ) : (
        <BlogManager
          initialPosts={posts.map((p) => ({
            id: p.id,
            slug: p.slug,
            title: p.title,
            excerpt: p.excerpt,
            coverImageUrl: p.coverImageUrl,
            content: p.content,
            category: p.category,
            authorName: p.authorName,
            status: p.status,
            publishedAt: p.publishedAt?.toISOString() ?? null,
            seoTitle: p.seoTitle,
            metaDescription: p.metaDescription,
            updatedAt: p.updatedAt.toISOString(),
          }))}
        />
      )}
    </div>
  );
}
