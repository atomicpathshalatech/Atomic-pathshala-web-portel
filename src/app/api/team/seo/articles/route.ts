import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireTeamSession } from "@/lib/auth/session";
import { hasPermission, isSuperAdminUser } from "@/lib/rbac/guard";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { generateSlug } from "@/lib/teacher/slug";

export async function GET() {
  try {
    const { user } = await requireTeamSession();
    const canManage = (await isSuperAdminUser(user.id)) || (await hasPermission(user.id, PERMISSIONS.SEO_MANAGE));
    if (!canManage) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const articles = await prisma.seoContentArticle.findMany({
      orderBy: { updatedAt: "desc" },
    });

    return NextResponse.json({ articles });
  } catch (error: any) {
    console.error("GET /api/team/seo/articles error:", error);
    return NextResponse.json({ error: error.message || "Failed to load articles" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const { user } = await requireTeamSession();
    const canManage = (await isSuperAdminUser(user.id)) || (await hasPermission(user.id, PERMISSIONS.SEO_MANAGE));
    if (!canManage) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const body = await req.json();
    const {
      id,
      title,
      slug,
      contentType,
      summary,
      content,
      primaryKeyword,
      secondaryKeywords,
      searchIntent,
      targetExam,
      targetSubject,
      targetClass,
      metaTitle,
      metaDescription,
      status,
      isIndexed,
      authorName,
      authorRole,
      faqs,
    } = body;

    if (!title || !content || !primaryKeyword) {
      return NextResponse.json({ error: "Title, content, and primary keyword are required" }, { status: 400 });
    }

    const cleanSlug = (slug || generateSlug(title))
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9-]+/g, "-")
      .replace(/^-+|-+$/g, "");

    const publishedAt = status === "PUBLISHED" ? new Date() : null;

    let result;
    if (id) {
      result = await prisma.seoContentArticle.update({
        where: { id },
        data: {
          title: title.trim(),
          slug: cleanSlug,
          contentType: contentType || "BLOG",
          summary: summary || "",
          content,
          primaryKeyword: primaryKeyword.trim(),
          secondaryKeywords: Array.isArray(secondaryKeywords) ? secondaryKeywords : [],
          searchIntent: searchIntent || "INFORMATIONAL",
          targetExam: targetExam || null,
          targetSubject: targetSubject || null,
          targetClass: targetClass || null,
          metaTitle: metaTitle || title,
          metaDescription: metaDescription || summary,
          status: status || "DRAFT",
          isIndexed: Boolean(isIndexed),
          authorName: authorName || "Atomic Pathshala Academic Team",
          authorRole: authorRole || "Subject Matter Expert",
          faqs: Array.isArray(faqs) ? faqs : [],
          publishedAt: status === "PUBLISHED" ? publishedAt : undefined,
          canonicalUrl: `https://ap.atomicpathshala.in/blog/${cleanSlug}`,
        },
      });
    } else {
      result = await prisma.seoContentArticle.create({
        data: {
          title: title.trim(),
          slug: cleanSlug,
          contentType: contentType || "BLOG",
          summary: summary || "",
          content,
          primaryKeyword: primaryKeyword.trim(),
          secondaryKeywords: Array.isArray(secondaryKeywords) ? secondaryKeywords : [],
          searchIntent: searchIntent || "INFORMATIONAL",
          targetExam: targetExam || null,
          targetSubject: targetSubject || null,
          targetClass: targetClass || null,
          metaTitle: metaTitle || title,
          metaDescription: metaDescription || summary,
          status: status || "DRAFT",
          isIndexed: Boolean(isIndexed),
          authorName: authorName || "Atomic Pathshala Academic Team",
          authorRole: authorRole || "Subject Matter Expert",
          faqs: Array.isArray(faqs) ? faqs : [],
          publishedAt,
          canonicalUrl: `https://ap.atomicpathshala.in/blog/${cleanSlug}`,
        },
      });
    }

    return NextResponse.json({ success: true, article: result });
  } catch (error: any) {
    console.error("POST /api/team/seo/articles error:", error);
    return NextResponse.json({ error: error.message || "Failed to save article" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { user } = await requireTeamSession();
    const canManage = (await isSuperAdminUser(user.id)) || (await hasPermission(user.id, PERMISSIONS.SEO_MANAGE));
    if (!canManage) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
    if (!id) {
      return NextResponse.json({ error: "id required" }, { status: 400 });
    }

    await prisma.seoContentArticle.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("DELETE /api/team/seo/articles error:", error);
    return NextResponse.json({ error: error.message || "Failed to delete article" }, { status: 500 });
  }
}
