import { NextRequest } from "next/server";
import { revalidatePath } from "next/cache";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { requireSuperAdmin, UnauthorizedError } from "@/lib/rbac/guard";
import { blogPostSchema } from "@/lib/validation/blog";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/response";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function requireBlogAdmin() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) throw new UnauthorizedError();
  await requireSuperAdmin(session.user.id);
  return session.user.id;
}

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const userId = await requireBlogAdmin();
    const input = blogPostSchema.parse(await request.json());
    const existing = await prisma.blogPost.findUnique({ where: { id: params.id } });
    if (!existing) return apiError("Post not found.", 404);
    const clash = await prisma.blogPost.findUnique({ where: { slug: input.slug } });
    if (clash && clash.id !== existing.id) return apiError("Another post already uses this URL (slug).", 409);

    const post = await prisma.blogPost.update({
      where: { id: params.id },
      data: {
        ...input,
        coverImageUrl: input.coverImageUrl || null,
        // First publish stamps the date; later edits keep it.
        publishedAt: input.status === "PUBLISHED" ? existing.publishedAt ?? new Date() : existing.publishedAt,
        updatedById: userId,
      },
    });
    await prisma.auditLog.create({
      data: { userId, action: "BLOG_POST_UPDATED", entityType: "BlogPost", entityId: post.id, metadata: { title: post.title, status: post.status } },
    });
    revalidatePath("/");
    revalidatePath("/blog");
    revalidatePath(`/blog/${existing.slug}`);
    if (existing.slug !== post.slug) revalidatePath(`/blog/${post.slug}`);
    return apiSuccess({ post });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(_request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const userId = await requireBlogAdmin();
    const existing = await prisma.blogPost.findUnique({ where: { id: params.id } });
    if (!existing) return apiError("Post not found.", 404);
    await prisma.blogPost.delete({ where: { id: params.id } });
    await prisma.auditLog.create({
      data: { userId, action: "BLOG_POST_DELETED", entityType: "BlogPost", entityId: existing.id, metadata: { title: existing.title } },
    });
    revalidatePath("/");
    revalidatePath("/blog");
    revalidatePath(`/blog/${existing.slug}`);
    return apiSuccess({ deleted: true });
  } catch (error) {
    return handleApiError(error);
  }
}
