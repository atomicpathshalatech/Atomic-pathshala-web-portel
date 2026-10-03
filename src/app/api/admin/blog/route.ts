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

/** Blog is managed from Team → Website → Blog (super admin, like the Website Builder). */
async function requireBlogAdmin() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) throw new UnauthorizedError();
  await requireSuperAdmin(session.user.id);
  return session.user.id;
}

export async function GET() {
  try {
    await requireBlogAdmin();
    const posts = await prisma.blogPost.findMany({ orderBy: { updatedAt: "desc" } });
    return apiSuccess({ posts });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const userId = await requireBlogAdmin();
    const input = blogPostSchema.parse(await request.json());
    if (await prisma.blogPost.findUnique({ where: { slug: input.slug } })) {
      return apiError("Another post already uses this URL (slug).", 409);
    }
    const post = await prisma.blogPost.create({
      data: {
        ...input,
        coverImageUrl: input.coverImageUrl || null,
        publishedAt: input.status === "PUBLISHED" ? new Date() : null,
        createdById: userId,
      },
    });
    await prisma.auditLog.create({
      data: { userId, action: "BLOG_POST_CREATED", entityType: "BlogPost", entityId: post.id, metadata: { title: post.title, status: post.status } },
    });
    revalidatePath("/");
    revalidatePath("/blog");
    return apiSuccess({ post }, 201);
  } catch (error) {
    return handleApiError(error);
  }
}
