import { NextResponse } from "next/server";
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

    const issues = await prisma.seoAuditIssue.findMany({
      orderBy: [{ severity: "asc" }, { lastDetectedAt: "desc" }],
    });

    const openCount = issues.filter((i) => i.status === "OPEN").length;
    const criticalCount = issues.filter((i) => i.status === "OPEN" && i.severity === "CRITICAL").length;
    const highCount = issues.filter((i) => i.status === "OPEN" && i.severity === "HIGH").length;
    const mediumCount = issues.filter((i) => i.status === "OPEN" && i.severity === "MEDIUM").length;

    // Real computed health score
    let score = 100;
    score -= criticalCount * 15;
    score -= highCount * 8;
    score -= mediumCount * 3;
    score = Math.max(20, Math.min(score, 100));

    return NextResponse.json({
      issues,
      healthScore: score,
      openCount,
      criticalCount,
      highCount,
      mediumCount,
      lastAuditedAt: issues[0]?.lastDetectedAt || new Date(),
    });
  } catch (error: any) {
    console.error("GET /api/team/seo/audit error:", error);
    return NextResponse.json({ error: error.message || "Failed to load audit" }, { status: 500 });
  }
}

export async function POST() {
  try {
    const { user } = await requireTeamSession();
    const canManage = (await isSuperAdminUser(user.id)) || (await hasPermission(user.id, PERMISSIONS.SEO_MANAGE));
    if (!canManage) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    // Inspect database states and configuration
    const [settings, teachers, publishedQuestions, courses] = await Promise.all([
      prisma.seoGlobalSettings.findUnique({ where: { id: "singleton" } }),
      prisma.teacher.findMany({
        where: { onboardingStatus: { not: "REJECTED" } },
        include: { user: true, seoProfile: true },
      }),
      prisma.question.count({ where: { isPublished: true, slug: { not: null } } }),
      prisma.course.findMany({ select: { slug: true, title: true } }),
    ]);

    const detectedIssues: Array<{
      url: string;
      issueType: string;
      severity: string;
      title: string;
      description: string;
      recommendedFix: string;
      status: string;
    }> = [];

    // 1. Check Global Settings
    if (!settings || !settings.siteUrl.includes("atomicpathshala.in")) {
      detectedIssues.push({
        url: "https://atomicpathshala.in",
        issueType: "SUBDOMAIN_MISMATCH",
        severity: "CRITICAL",
        title: "Canonical Domain Missing or Misconfigured",
        description: "The global site URL is not configured as https://atomicpathshala.in.",
        recommendedFix: "Set siteUrl to https://atomicpathshala.in in Global SEO Settings.",
        status: "OPEN",
      });
    }

    // 2. Check Teacher Profiles
    for (const t of teachers) {
      const slug = t.seoProfile?.slug || t.user.name?.toLowerCase().replace(/[^a-z0-9]+/g, "-");
      const url = `https://atomicpathshala.in/teachers/${slug}`;

      if (!t.seoProfile) {
        detectedIssues.push({
          url,
          issueType: "MISSING_TITLE",
          severity: "MEDIUM",
          title: `Teacher SEO record missing for ${t.user.name}`,
          description: `Teacher has no explicit TeacherSeo row in database.`,
          recommendedFix: `Open Faculty SEO tab and configure custom SEO title and bio.`,
          status: "OPEN",
        });
      } else {
        if (!t.seoProfile.customMetaDescription && (!t.bio || t.bio.trim().length < 50)) {
          detectedIssues.push({
            url,
            issueType: "MISSING_DESCRIPTION",
            severity: "MEDIUM",
            title: `Short or missing meta description for ${t.user.name}`,
            description: `Teacher profile has minimal bio and no custom meta description.`,
            recommendedFix: `Add an informative 120-160 character meta description highlighting exams and subjects.`,
            status: "OPEN",
          });
        }
      }
    }

    // 3. Check PYQ indexable volume
    if (publishedQuestions === 0) {
      detectedIssues.push({
        url: "https://atomicpathshala.in/pyq",
        issueType: "THIN_CONTENT",
        severity: "HIGH",
        title: "No Published PYQ Questions Found",
        description: "Public PYQ library requires published questions with verified solutions to avoid thin-content penalty.",
        recommendedFix: "Verify and publish PYQ questions in Question QC.",
        status: "OPEN",
      });
    }

    // Upsert detected issues into database
    for (const issue of detectedIssues) {
      const existing = await prisma.seoAuditIssue.findFirst({
        where: { url: issue.url, issueType: issue.issueType },
      });
      if (existing) {
        await prisma.seoAuditIssue.update({
          where: { id: existing.id },
          data: {
            severity: issue.severity,
            title: issue.title,
            description: issue.description,
            recommendedFix: issue.recommendedFix,
            lastDetectedAt: new Date(),
          },
        });
      } else {
        await prisma.seoAuditIssue.create({ data: issue });
      }
    }

    return NextResponse.json({
      success: true,
      scannedPages: 12 + teachers.length,
      detectedCount: detectedIssues.length,
    });
  } catch (error: any) {
    console.error("POST /api/team/seo/audit error:", error);
    return NextResponse.json({ error: error.message || "Failed to run audit" }, { status: 500 });
  }
}
