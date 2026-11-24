import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireTeamSession } from "@/lib/auth/session";
import { hasPermission, isSuperAdminUser } from "@/lib/rbac/guard";
import { PERMISSIONS } from "@/lib/rbac/permissions";

export async function GET() {
  try {
    const { user } = await requireTeamSession();
    const canManage = (await isSuperAdminUser(user.id)) || (await hasPermission(user.id, PERMISSIONS.SEO_MANAGE));
    if (!canManage) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const keywords = await prisma.seoKeyword.findMany({
      orderBy: [{ cluster: "asc" }, { priority: "asc" }],
    });

    // Detect keyword cannibalization: multiple high-priority keywords with overlapping intent targeting different URLs or same URL conflicting
    const urlMap = new Map<string, string[]>();
    for (const kw of keywords) {
      const existing = urlMap.get(kw.targetUrl) || [];
      existing.push(kw.keyword);
      urlMap.set(kw.targetUrl, existing);
    }

    const cannibalizationAlerts: Array<{ targetUrl: string; keywords: string[] }> = [];
    for (const [url, kws] of urlMap.entries()) {
      if (kws.length > 5) {
        cannibalizationAlerts.push({ targetUrl: url, keywords: kws });
      }
    }

    return NextResponse.json({
      keywords,
      cannibalizationAlerts,
      totalCount: keywords.length,
    });
  } catch (error: any) {
    console.error("GET /api/team/seo/keywords error:", error);
    return NextResponse.json({ error: error.message || "Failed to load keywords" }, { status: 500 });
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
      keyword,
      cluster,
      searchIntent,
      language,
      targetExam,
      targetSubject,
      targetClass,
      targetUrl,
      priority,
      status,
      notes,
    } = body;

    if (!keyword || !cluster || !targetUrl) {
      return NextResponse.json({ error: "Keyword, cluster, and targetUrl are required" }, { status: 400 });
    }

    let result;
    if (id) {
      result = await prisma.seoKeyword.update({
        where: { id },
        data: {
          keyword: keyword.trim(),
          cluster: cluster.toUpperCase(),
          searchIntent: searchIntent || "INFORMATIONAL",
          language: language || "en",
          targetExam: targetExam || null,
          targetSubject: targetSubject || null,
          targetClass: targetClass || null,
          targetUrl: targetUrl.trim(),
          priority: priority || "MEDIUM",
          status: status || "ACTIVE",
          notes: notes || null,
        },
      });
    } else {
      result = await prisma.seoKeyword.create({
        data: {
          keyword: keyword.trim(),
          cluster: cluster.toUpperCase(),
          searchIntent: searchIntent || "INFORMATIONAL",
          language: language || "en",
          targetExam: targetExam || null,
          targetSubject: targetSubject || null,
          targetClass: targetClass || null,
          targetUrl: targetUrl.trim(),
          priority: priority || "MEDIUM",
          status: status || "ACTIVE",
          notes: notes || null,
        },
      });
    }

    return NextResponse.json({ success: true, keyword: result });
  } catch (error: any) {
    console.error("POST /api/team/seo/keywords error:", error);
    return NextResponse.json({ error: error.message || "Failed to save keyword" }, { status: 500 });
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

    await prisma.seoKeyword.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("DELETE /api/team/seo/keywords error:", error);
    return NextResponse.json({ error: error.message || "Failed to delete keyword" }, { status: 500 });
  }
}
